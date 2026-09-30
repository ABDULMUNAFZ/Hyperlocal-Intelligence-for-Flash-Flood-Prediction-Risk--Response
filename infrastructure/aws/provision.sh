#!/usr/bin/env bash
# =============================================================================================
# FloodGuard — AWS production infrastructure (idempotent; safe to re-run)
#
#   VPC (default) ─ ALB (HTTP, CloudFront-only + secret origin header) ─ ECS/Fargate
#       api (uvicorn) · celery worker · celery beat            ← image from Amazon ECR
#   RDS PostgreSQL 16 + PostGIS (private)   ElastiCache Valkey (private, TLS)
#   S3 (private: trained model artifacts)   Secrets Manager (app secrets)
#   CloudFront (HTTPS *.cloudfront.net) → ALB                  CloudWatch Logs
#
# Usage:  AWS_REGION=ap-south-1 infrastructure/aws/provision.sh <step>
#   steps: network secrets data wait-data registry roles cluster alb alb-https|cdn services migrate status
#
# Secrets are generated here and written straight into Secrets Manager — never printed, never
# written to disk. Non-secret resource ids are cached in infrastructure/aws/.state (gitignored).
# =============================================================================================
set -euo pipefail

REGION="${AWS_REGION:-ap-south-1}"
APP="floodguard"
STATE_FILE="$(cd "$(dirname "$0")" && pwd)/.state"
export AWS_REGION="$REGION" AWS_PAGER=""
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ECR_REPO="${APP}-backend"
CLUSTER="${APP}-prod"
LOG_GROUP="/ecs/${APP}"
BUCKET="${APP}-prod-assets-${ACCOUNT}"
SECRET_NAME="${APP}/prod/app"
DB_ID="${APP}-prod-db"
REDIS_ID="${APP}-prod-cache"
TAGS="Key=Project,Value=${APP} Key=Environment,Value=production"

touch "$STATE_FILE"
st_get() { grep -E "^$1=" "$STATE_FILE" | tail -1 | cut -d= -f2- || true; }
st_set() { grep -vE "^$1=" "$STATE_FILE" > "$STATE_FILE.tmp" || true; echo "$1=$2" >> "$STATE_FILE.tmp"; mv "$STATE_FILE.tmp" "$STATE_FILE"; }
log() { printf '\n==> %s\n' "$*"; }
rand() { python3 -c "import secrets,string;a=string.ascii_letters+string.digits;print(''.join(secrets.choice(a) for _ in range($1)))"; }

sg_id() { aws ec2 describe-security-groups --filters "Name=group-name,Values=$1" "Name=vpc-id,Values=$(st_get VPC)" --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null | grep -v None || true; }
ensure_sg() {  # name description
  local id; id="$(sg_id "$1")"
  if [ -z "$id" ]; then
    id="$(aws ec2 create-security-group --group-name "$1" --description "$2" --vpc-id "$(st_get VPC)" \
          --tag-specifications "ResourceType=security-group,Tags=[{Key=Project,Value=${APP}},{Key=Name,Value=$1}]" --query GroupId --output text)"
  fi
  echo "$id"
}
allow_sg() {  # target-sg port source-sg
  aws ec2 authorize-security-group-ingress --group-id "$1" --ip-permissions \
    "IpProtocol=tcp,FromPort=$2,ToPort=$2,UserIdGroupPairs=[{GroupId=$3}]" >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------------------------
step_network() {
  log "network: default VPC, subnets, security groups"
  local vpc; vpc="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"
  if [ "$vpc" = "None" ]; then aws ec2 create-default-vpc >/dev/null; vpc="$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)"; fi
  st_set VPC "$vpc"
  st_set SUBNETS "$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$vpc" Name=default-for-az,Values=true --query 'Subnets[].SubnetId' --output text | tr '\t' ',')"
  local alb ecs db cache pl
  alb="$(ensure_sg ${APP}-alb 'FloodGuard ALB - CloudFront origin-facing only')"
  ecs="$(ensure_sg ${APP}-ecs 'FloodGuard ECS tasks')"
  db="$(ensure_sg ${APP}-db 'FloodGuard RDS - from ECS only')"
  cache="$(ensure_sg ${APP}-cache 'FloodGuard ElastiCache - from ECS only')"
  pl="$(aws ec2 describe-managed-prefix-lists --filters Name=prefix-list-name,Values=com.amazonaws.global.cloudfront.origin-facing --query 'PrefixLists[0].PrefixListId' --output text)"
  aws ec2 authorize-security-group-ingress --group-id "$alb" --ip-permissions \
    "IpProtocol=tcp,FromPort=80,ToPort=80,PrefixListIds=[{PrefixListId=$pl,Description=CloudFront}]" >/dev/null 2>&1 || true
  allow_sg "$ecs" 8000 "$alb"
  allow_sg "$db" 5432 "$ecs"
  allow_sg "$cache" 6379 "$ecs"
  st_set SG_ALB "$alb"; st_set SG_ECS "$ecs"; st_set SG_DB "$db"; st_set SG_CACHE "$cache"
  echo "vpc=$vpc subnets=$(st_get SUBNETS)"
}

# ---------------------------------------------------------------------------------------------
step_secrets() {
  log "secrets: ${SECRET_NAME} (Secrets Manager)"
  if ! aws secretsmanager describe-secret --secret-id "$SECRET_NAME" >/dev/null 2>&1; then
    local tmp; tmp="$(mktemp)"; chmod 600 "$tmp"
    python3 - "$tmp" <<'PY'
import base64, json, secrets, string, sys
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
b64u = lambda b: base64.urlsafe_b64encode(b).rstrip(b"=").decode()
k = ec.generate_private_key(ec.SECP256R1())
alnum = string.ascii_letters + string.digits
json.dump({
  "SECRET_KEY": secrets.token_urlsafe(48),
  "POSTGRES_PASSWORD": "".join(secrets.choice(alnum) for _ in range(32)),
  "VAPID_PRIVATE_KEY": b64u(k.private_numbers().private_value.to_bytes(32, "big")),
  "VAPID_PUBLIC_KEY": b64u(k.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)),
  "ORIGIN_VERIFY": secrets.token_urlsafe(32),
}, open(sys.argv[1], "w"))
PY
    aws secretsmanager create-secret --name "$SECRET_NAME" --description "FloodGuard production app secrets" \
      --secret-string "file://$tmp" --tags Key=Project,Value=$APP >/dev/null
    rm -f "$tmp"
  fi
  st_set SECRET_ARN "$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --query ARN --output text)"
  echo "secret: $(st_get SECRET_ARN)"
}
secret_field() { aws secretsmanager get-secret-value --secret-id "$SECRET_NAME" --query SecretString --output text | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }

# ---------------------------------------------------------------------------------------------
step_data() {
  log "data: RDS PostgreSQL + PostGIS, ElastiCache Valkey (TLS), S3"
  local subnets_sp; subnets_sp="$(st_get SUBNETS | tr ',' ' ')"
  aws rds create-db-subnet-group --db-subnet-group-name "${APP}-db-subnets" --db-subnet-group-description "FloodGuard" \
    --subnet-ids $subnets_sp >/dev/null 2>&1 || true
  if ! aws rds describe-db-instances --db-instance-identifier "$DB_ID" >/dev/null 2>&1; then
    local ver; ver="$(aws rds describe-db-engine-versions --engine postgres --query "DBEngineVersions[?starts_with(EngineVersion,'16.')].EngineVersion" --output text | tr '\t' '\n' | sort -V | tail -1)"
    aws rds create-db-instance --db-instance-identifier "$DB_ID" --engine postgres --engine-version "$ver" \
      --db-instance-class db.t4g.micro --allocated-storage 20 --max-allocated-storage 100 --storage-type gp3 \
      --master-username fgadmin --master-user-password "$(secret_field POSTGRES_PASSWORD)" --db-name floodguard \
      --vpc-security-group-ids "$(st_get SG_DB)" --db-subnet-group-name "${APP}-db-subnets" --no-publicly-accessible \
      --backup-retention-period "${DB_BACKUP_DAYS:-1}" --storage-encrypted --deletion-protection --copy-tags-to-snapshot \
      --auto-minor-version-upgrade --tags $TAGS >/dev/null
    echo "RDS $DB_ID ($ver) creating…"
  fi
  aws elasticache create-cache-subnet-group --cache-subnet-group-name "${APP}-cache-subnets" \
    --cache-subnet-group-description "FloodGuard" --subnet-ids $subnets_sp >/dev/null 2>&1 || true
  if ! aws elasticache describe-replication-groups --replication-group-id "$REDIS_ID" >/dev/null 2>&1; then
    aws elasticache create-replication-group --replication-group-id "$REDIS_ID" \
      --replication-group-description "FloodGuard SSE pub/sub + Celery broker" --engine valkey \
      --cache-node-type cache.t4g.micro --num-cache-clusters 1 --cache-subnet-group-name "${APP}-cache-subnets" \
      --security-group-ids "$(st_get SG_CACHE)" --transit-encryption-enabled --transit-encryption-mode required \
      --at-rest-encryption-enabled --tags $TAGS >/dev/null
    echo "ElastiCache $REDIS_ID creating…"
  fi
  if ! aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
    aws s3api create-bucket --bucket "$BUCKET" --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
    aws s3api put-public-access-block --bucket "$BUCKET" --public-access-block-configuration \
      BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
    aws s3api put-bucket-encryption --bucket "$BUCKET" --server-side-encryption-configuration \
      '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
    aws s3api put-bucket-versioning --bucket "$BUCKET" --versioning-configuration Status=Enabled
  fi
  st_set BUCKET "$BUCKET"
}

wait_data() {
  log "waiting for RDS and ElastiCache to become available (typically 5–15 min)"
  aws rds wait db-instance-available --db-instance-identifier "$DB_ID"
  st_set DB_HOST "$(aws rds describe-db-instances --db-instance-identifier "$DB_ID" --query 'DBInstances[0].Endpoint.Address' --output text)"
  until [ "$(aws elasticache describe-replication-groups --replication-group-id "$REDIS_ID" --query 'ReplicationGroups[0].Status' --output text)" = "available" ]; do sleep 20; done
  st_set REDIS_HOST "$(aws elasticache describe-replication-groups --replication-group-id "$REDIS_ID" --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text)"
  echo "db=$(st_get DB_HOST) redis=$(st_get REDIS_HOST)"
}

# ---------------------------------------------------------------------------------------------
step_registry() {
  log "registry: ECR repository + model artifacts in S3"
  aws ecr describe-repositories --repository-names "$ECR_REPO" >/dev/null 2>&1 || \
    aws ecr create-repository --repository-name "$ECR_REPO" --image-scanning-configuration scanOnPush=true \
      --encryption-configuration encryptionType=AES256 --tags $TAGS >/dev/null
  aws ecr put-lifecycle-policy --repository-name "$ECR_REPO" --lifecycle-policy-text \
    '{"rules":[{"rulePriority":1,"description":"keep last 20 images","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":20},"action":{"type":"expire"}}]}' >/dev/null
  st_set ECR_URI "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}"
  # upload trained artifacts referenced by PRODUCTION/STAGING registry entries (not stored in git or images)
  local root; root="$(cd "$(dirname "$0")/../../backend" && pwd)"
  python3 - "$root" <<'PY' | while read -r d; do [ -d "$root/$d" ] && aws s3 sync "$root/$d" "s3://$BUCKET/$d" --only-show-errors; done
import json, sys, pathlib
idx = json.load(open(pathlib.Path(sys.argv[1]) / "models/registry/index.json"))
for d in sorted({str(pathlib.Path(m["model_path"]).parent) for m in idx.values() if m.get("stage") in ("production", "staging")}):
    print(d)
PY
  aws s3 ls "s3://$BUCKET/models/trained/" --recursive | awk '{print "  s3:", $4, $3" bytes"}'
}

# ---------------------------------------------------------------------------------------------
step_roles() {
  log "IAM: task execution role + task role"
  local trust='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  aws iam get-role --role-name ${APP}-ecs-execution >/dev/null 2>&1 || \
    aws iam create-role --role-name ${APP}-ecs-execution --assume-role-policy-document "$trust" >/dev/null
  aws iam attach-role-policy --role-name ${APP}-ecs-execution --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  aws iam put-role-policy --role-name ${APP}-ecs-execution --policy-name read-app-secret --policy-document \
    "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"$(st_get SECRET_ARN)\"}]}"
  aws iam get-role --role-name ${APP}-ecs-task >/dev/null 2>&1 || \
    aws iam create-role --role-name ${APP}-ecs-task --assume-role-policy-document "$trust" >/dev/null
  aws iam put-role-policy --role-name ${APP}-ecs-task --policy-name app-runtime --policy-document "{\"Version\":\"2012-10-17\",\"Statement\":[
    {\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:ListBucket\"],\"Resource\":[\"arn:aws:s3:::$BUCKET\",\"arn:aws:s3:::$BUCKET/*\"]},
    {\"Effect\":\"Allow\",\"Action\":[\"ssmmessages:CreateControlChannel\",\"ssmmessages:CreateDataChannel\",\"ssmmessages:OpenControlChannel\",\"ssmmessages:OpenDataChannel\"],\"Resource\":\"*\"}]}"
  if aws secretsmanager describe-secret --secret-id "${APP}/prod/admin" >/dev/null 2>&1; then  # admin bootstrap (create_responder --password-secret)
    aws iam put-role-policy --role-name ${APP}-ecs-task --policy-name read-admin-bootstrap-secret --policy-document \
      "{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":\"secretsmanager:GetSecretValue\",\"Resource\":\"$(aws secretsmanager describe-secret --secret-id "${APP}/prod/admin" --query ARN --output text)\"}]}"
  fi
  st_set EXEC_ROLE "arn:aws:iam::${ACCOUNT}:role/${APP}-ecs-execution"
  st_set TASK_ROLE "arn:aws:iam::${ACCOUNT}:role/${APP}-ecs-task"
}

# ---------------------------------------------------------------------------------------------
step_cluster() {
  log "ECS cluster + logs"
  # new accounts lack the ECS / ELB service-linked roles
  aws iam get-role --role-name AWSServiceRoleForECS >/dev/null 2>&1 || aws iam create-service-linked-role --aws-service-name ecs.amazonaws.com >/dev/null
  aws iam get-role --role-name AWSServiceRoleForElasticLoadBalancing >/dev/null 2>&1 || aws iam create-service-linked-role --aws-service-name elasticloadbalancing.amazonaws.com >/dev/null || true
  aws logs create-log-group --log-group-name "$LOG_GROUP" >/dev/null 2>&1 || true
  aws logs put-retention-policy --log-group-name "$LOG_GROUP" --retention-in-days 30
  aws ecs describe-clusters --clusters "$CLUSTER" --query 'clusters[?status==`ACTIVE`].clusterName' --output text | grep -q "$CLUSTER" || \
    aws ecs create-cluster --cluster-name "$CLUSTER" --capacity-providers FARGATE FARGATE_SPOT \
      --settings name=containerInsights,value=disabled --tags key=Project,value=$APP >/dev/null
}

# ---------------------------------------------------------------------------------------------
step_alb() {
  log "ALB + target group (only CloudFront with the secret origin header is forwarded)"
  local subnets_sp; subnets_sp="$(st_get SUBNETS | tr ',' ' ')"
  local alb_arn; alb_arn="$(aws elbv2 describe-load-balancers --names ${APP}-alb --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || true)"
  if [ -z "$alb_arn" ] || [ "$alb_arn" = "None" ]; then
    alb_arn="$(aws elbv2 create-load-balancer --name ${APP}-alb --type application --scheme internet-facing \
      --subnets $subnets_sp --security-groups "$(st_get SG_ALB)" --tags $TAGS --query 'LoadBalancers[0].LoadBalancerArn' --output text)"
  fi
  # long idle timeout: SSE streams (15 s heartbeats) and slower geo requests
  aws elbv2 modify-load-balancer-attributes --load-balancer-arn "$alb_arn" --attributes \
    Key=idle_timeout.timeout_seconds,Value=300 Key=routing.http.drop_invalid_header_fields.enabled,Value=true >/dev/null
  local tg; tg="$(aws elbv2 describe-target-groups --names ${APP}-api --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || true)"
  if [ -z "$tg" ] || [ "$tg" = "None" ]; then
    tg="$(aws elbv2 create-target-group --name ${APP}-api --protocol HTTP --port 8000 --vpc-id "$(st_get VPC)" \
      --target-type ip --health-check-path /health --health-check-interval-seconds 15 --healthy-threshold-count 2 \
      --unhealthy-threshold-count 3 --matcher HttpCode=200 --query 'TargetGroups[0].TargetGroupArn' --output text)"
  fi
  aws elbv2 modify-target-group-attributes --target-group-arn "$tg" --attributes Key=deregistration_delay.timeout_seconds,Value=30 >/dev/null
  local lst; lst="$(aws elbv2 describe-listeners --load-balancer-arn "$alb_arn" --query 'Listeners[?Port==`80`].ListenerArn' --output text)"
  if [ -z "$lst" ]; then
    lst="$(aws elbv2 create-listener --load-balancer-arn "$alb_arn" --protocol HTTP --port 80 \
      --default-actions 'Type=fixed-response,FixedResponseConfig={StatusCode=403,ContentType=text/plain,MessageBody=Forbidden}' \
      --query 'Listeners[0].ListenerArn' --output text)"
  fi
  if [ "$(aws elbv2 describe-rules --listener-arn "$lst" --query 'length(Rules[?Priority==`10`])' --output text)" = "0" ]; then
    aws elbv2 create-rule --listener-arn "$lst" --priority 10 \
      --conditions "Field=http-header,HttpHeaderConfig={HttpHeaderName=X-Origin-Verify,Values=[$(secret_field ORIGIN_VERIFY)]}" \
      --actions "Type=forward,TargetGroupArn=$tg" >/dev/null
  fi
  st_set ALB_ARN "$alb_arn"; st_set TG_ARN "$tg"
  st_set ALB_DNS "$(aws elbv2 describe-load-balancers --load-balancer-arns "$alb_arn" --query 'LoadBalancers[0].DNSName' --output text)"
  echo "alb=$(st_get ALB_DNS)"
}

# ---------------------------------------------------------------------------------------------
step_alb_https() {  # custom domain: ACM certificate on the ALB (used when CloudFront is not available)
  log "ALB HTTPS: 443 with ACM certificate, 80 → 301 https"
  local alb tg cert sg lst80 lst443
  alb="$(st_get ALB_ARN)"; tg="$(st_get TG_ARN)"; cert="$(st_get CERT_ARN)"; sg="$(st_get SG_ALB)"
  [ "$(aws acm describe-certificate --certificate-arn "$cert" --query Certificate.Status --output text)" = "ISSUED" ] || { echo "certificate not issued yet"; return 1; }
  for port in 80 443; do
    aws ec2 authorize-security-group-ingress --group-id "$sg" --ip-permissions \
      "IpProtocol=tcp,FromPort=$port,ToPort=$port,IpRanges=[{CidrIp=0.0.0.0/0,Description=public-https}]" >/dev/null 2>&1 || true
  done
  lst443="$(aws elbv2 describe-listeners --load-balancer-arn "$alb" --query 'Listeners[?Port==`443`].ListenerArn' --output text)"
  if [ -z "$lst443" ]; then
    aws elbv2 create-listener --load-balancer-arn "$alb" --protocol HTTPS --port 443 --certificates CertificateArn="$cert" \
      --ssl-policy ELBSecurityPolicy-TLS13-1-2-2021-06 --default-actions "Type=forward,TargetGroupArn=$tg" >/dev/null
  fi
  lst80="$(aws elbv2 describe-listeners --load-balancer-arn "$alb" --query 'Listeners[?Port==`80`].ListenerArn' --output text)"
  aws elbv2 modify-listener --listener-arn "$lst80" --default-actions \
    'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}' >/dev/null
  # the CloudFront-only header rule is not used with a direct HTTPS listener
  for r in $(aws elbv2 describe-rules --listener-arn "$lst80" --query 'Rules[?!IsDefault].RuleArn' --output text); do aws elbv2 delete-rule --rule-arn "$r"; done
  echo "https://$(st_get API_DOMAIN) → $(st_get ALB_DNS)"
}

# ---------------------------------------------------------------------------------------------
step_cdn() {
  log "CloudFront (HTTPS) → ALB"
  local id; id="$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='${APP}-api'].Id | [0]" --output text 2>/dev/null || true)"
  if [ -z "$id" ] || [ "$id" = "None" ]; then
    # cache policy: TTL 0 by default (API is uncached) but Authorization + all query strings are part of the
    # key so CloudFront forwards them on GET (bearer tokens, SSE ?token=) and can never mix users.
    local cp; cp="$(aws cloudfront list-cache-policies --type custom --query "CachePolicyList.Items[?CachePolicy.CachePolicyConfig.Name=='${APP}-api-nocache'].CachePolicy.Id | [0]" --output text)"
    if [ -z "$cp" ] || [ "$cp" = "None" ]; then
      cp="$(aws cloudfront create-cache-policy --cache-policy-config "{\"Name\":\"${APP}-api-nocache\",\"MinTTL\":0,\"DefaultTTL\":0,\"MaxTTL\":1,
        \"ParametersInCacheKeyAndForwardedToOrigin\":{\"EnableAcceptEncodingGzip\":false,\"EnableAcceptEncodingBrotli\":false,
        \"HeadersConfig\":{\"HeaderBehavior\":\"whitelist\",\"Headers\":{\"Quantity\":1,\"Items\":[\"Authorization\"]}},
        \"CookiesConfig\":{\"CookieBehavior\":\"none\"},\"QueryStringsConfig\":{\"QueryStringBehavior\":\"all\"}}}" --query CachePolicy.Id --output text)"
    fi
    local cfg; cfg="$(mktemp)"
    cat > "$cfg" <<JSON
{"CallerReference":"${APP}-api-$(date +%s)","Comment":"${APP}-api","Enabled":true,"PriceClass":"PriceClass_200","HttpVersion":"http2and3","IsIPV6Enabled":true,
 "Origins":{"Quantity":1,"Items":[{"Id":"alb","DomainName":"$(st_get ALB_DNS)",
   "CustomHeaders":{"Quantity":1,"Items":[{"HeaderName":"X-Origin-Verify","HeaderValue":"$(secret_field ORIGIN_VERIFY)"}]},
   "CustomOriginConfig":{"HTTPPort":80,"HTTPSPort":443,"OriginProtocolPolicy":"http-only","OriginReadTimeout":60,"OriginKeepaliveTimeout":5,
     "OriginSslProtocols":{"Quantity":1,"Items":["TLSv1.2"]}}}]},
 "DefaultCacheBehavior":{"TargetOriginId":"alb","ViewerProtocolPolicy":"redirect-to-https","Compress":false,
   "AllowedMethods":{"Quantity":7,"Items":["GET","HEAD","OPTIONS","PUT","POST","PATCH","DELETE"],"CachedMethods":{"Quantity":2,"Items":["GET","HEAD"]}},
   "CachePolicyId":"$cp","OriginRequestPolicyId":"b689b0a8-53d0-40ab-baf2-68738e2966ac"}}
JSON
    id="$(aws cloudfront create-distribution --distribution-config "file://$cfg" --query Distribution.Id --output text)"
    rm -f "$cfg"
  fi
  st_set CF_ID "$id"
  st_set CF_DOMAIN "$(aws cloudfront get-distribution --id "$id" --query Distribution.DomainName --output text)"
  echo "cloudfront=https://$(st_get CF_DOMAIN)"
}

# ---------------------------------------------------------------------------------------------
register_taskdefs() {  # image
  local image="$1" tmpl dir; dir="$(cd "$(dirname "$0")" && pwd)"
  for tmpl in api worker beat; do
    python3 "$dir/render_taskdef.py" "$dir/taskdef-$tmpl.json" "$STATE_FILE" "$image" "$REGION" "$SECRET_ARN_OVERRIDE" > "$dir/.taskdef-$tmpl.rendered.json"
    aws ecs register-task-definition --cli-input-json "file://$dir/.taskdef-$tmpl.rendered.json" --query 'taskDefinition.taskDefinitionArn' --output text
    rm -f "$dir/.taskdef-$tmpl.rendered.json"
  done
}
SECRET_ARN_OVERRIDE=""

run_migrations() {
  log "one-off task: db_bootstrap (extensions + alembic upgrade head + PostGIS checks)"
  local arn; arn="$(aws ecs run-task --cluster "$CLUSTER" --launch-type FARGATE --task-definition ${APP}-api \
    --network-configuration "awsvpcConfiguration={subnets=[$(st_get SUBNETS)],securityGroups=[$(st_get SG_ECS)],assignPublicIp=ENABLED}" \
    --overrides '{"containerOverrides":[{"name":"api","command":["python","scripts/db_bootstrap.py"],"environment":[{"name":"SKIP_MODEL_FETCH","value":"1"}]}]}' \
    --query 'tasks[0].taskArn' --output text)"
  aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$arn"
  local code; code="$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$arn" --query 'tasks[0].containers[0].exitCode' --output text)"
  aws logs tail "$LOG_GROUP" --log-stream-names "api/api/${arn##*/}" --since 30m --format short 2>/dev/null | tail -8 || true
  echo "db_bootstrap exit code: $code"; [ "$code" = "0" ]
}

step_services() {  # requires IMAGE=<ecr uri:tag>
  local image="${IMAGE:?set IMAGE=<ecr-uri>:<tag>}"
  log "task definitions + migrations + services ($image)"
  register_taskdefs "$image"
  run_migrations
  local net="awsvpcConfiguration={subnets=[$(st_get SUBNETS)],securityGroups=[$(st_get SG_ECS)],assignPublicIp=ENABLED}"
  for svc in api worker beat; do
    local exists; exists="$(aws ecs describe-services --cluster "$CLUSTER" --services ${APP}-$svc --query 'services[?status==`ACTIVE`].serviceName' --output text)"
    if [ -n "$exists" ]; then
      aws ecs update-service --cluster "$CLUSTER" --service ${APP}-$svc --task-definition ${APP}-$svc --force-new-deployment >/dev/null
    elif [ "$svc" = "api" ]; then
      aws ecs create-service --cluster "$CLUSTER" --service-name ${APP}-api --task-definition ${APP}-api --desired-count 1 \
        --launch-type FARGATE --platform-version LATEST --network-configuration "$net" \
        --load-balancers "targetGroupArn=$(st_get TG_ARN),containerName=api,containerPort=8000" \
        --health-check-grace-period-seconds 240 --enable-execute-command \
        --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=200,minimumHealthyPercent=100" \
        --tags key=Project,value=$APP >/dev/null
    else
      # beat must never run twice (duplicate schedules): stop old before starting new
      local maxp=200 minp=100; [ "$svc" = "beat" ] && maxp=100 && minp=0
      aws ecs create-service --cluster "$CLUSTER" --service-name ${APP}-$svc --task-definition ${APP}-$svc --desired-count 1 \
        --launch-type FARGATE --platform-version LATEST --network-configuration "$net" --enable-execute-command \
        --deployment-configuration "deploymentCircuitBreaker={enable=true,rollback=true},maximumPercent=$maxp,minimumHealthyPercent=$minp" \
        --tags key=Project,value=$APP >/dev/null
    fi
  done
  aws ecs wait services-stable --cluster "$CLUSTER" --services ${APP}-api ${APP}-worker ${APP}-beat
  echo "services stable"
}

step_status() {
  cat "$STATE_FILE"
  aws ecs describe-services --cluster "$CLUSTER" --services ${APP}-api ${APP}-worker ${APP}-beat \
    --query 'services[].{svc:serviceName,running:runningCount,desired:desiredCount,td:taskDefinition}' --output table 2>/dev/null || true
}

case "${1:-status}" in
  network) step_network ;;
  secrets) step_secrets ;;
  data) step_data ;;
  wait-data) wait_data ;;
  registry) step_registry ;;
  roles) step_roles ;;
  cluster) step_cluster ;;
  alb) step_alb ;;
  alb-https) step_alb_https ;;
  cdn) step_cdn ;;
  services) step_services ;;
  migrate) run_migrations ;;
  all) step_network; step_secrets; step_data; step_registry; step_roles; step_cluster; step_alb; step_cdn; wait_data ;;
  status) step_status ;;
  *) echo "unknown step $1"; exit 2 ;;
esac
