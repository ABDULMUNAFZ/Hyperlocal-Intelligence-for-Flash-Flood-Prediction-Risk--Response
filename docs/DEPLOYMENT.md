# FloodGuard — production deployment

| | URL |
|---|---|
| Frontend (Vercel) | https://floodguard.techmavericks.me |
| Citizen PWA | https://floodguard.techmavericks.me/emergency |
| Admin / responder console | https://floodguard.techmavericks.me/ → **Responder** (top bar) → **RESCUE PEOPLE** |
| API (AWS) | https://api.techmavericks.me/api/v1 |
| Liveness / full health | https://api.techmavericks.me/health · https://api.techmavericks.me/api/v1/health |
| API docs | https://api.techmavericks.me/docs |

Local development is unchanged: `docker compose up -d` (Docker Desktop). AWS is production only.

## Architecture (AWS ap-south-1, Mumbai)

```
Browser ──HTTPS──▶ Vercel (React/Vite build, SPA rewrites, PWA headers)
   │
   └──HTTPS──▶ api.techmavericks.me ─▶ Application Load Balancer (ACM cert, TLS 1.3/1.2, :80→:443)
                                          │
                                          ▼  (security group: ALB → tasks :8000 only)
                     ECS Fargate cluster floodguard-prod — one image from Amazon ECR
                       floodguard-api     uvicorn ×2 workers, /health checks, graceful shutdown
                       floodguard-worker  Celery worker (push delivery, official-alert ingestion)
                       floodguard-beat    Celery beat (SACHET poll 5 min, retention hourly)
                          │                         │                       │
            RDS PostgreSQL 16 + PostGIS    ElastiCache Valkey (TLS)    S3 (private): trained
            (private, encrypted,           SSE pub/sub + Celery        model artifacts, pulled
             from ECS SG only)             broker (from ECS SG only)   at container start
                          └──── Secrets Manager (floodguard/prod/app, floodguard/prod/admin) ────┘
```

* **Secrets** live only in AWS Secrets Manager and are injected into containers by ECS
  (`SECRET_KEY`, `POSTGRES_PASSWORD`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`). They are generated
  inside `provision.sh` and never printed or written to disk. Nothing secret is in git or in images
  (`backend/.dockerignore` excludes `.env`, `.cache/`, venv and model binaries).
* **Admin login**: `ops@techmavericks.me`; the password is in Secrets Manager →
  `floodguard/prod/admin` (AWS console → Secrets Manager → Retrieve secret value). Rotate it by
  updating that secret and re-running the admin bootstrap task (below).
* **Large data**: model binaries (`backend/models/trained/…`) are stored in S3
  (`s3://floodguard-prod-assets-<account>/models/…`) and fetched by `scripts/fetch_models.py` at
  container start. Geo rasters/OSM are fetched from their public sources on demand and cached on the
  task's ephemeral disk (no large datasets in images).
* **Long simulations** run as background jobs (`POST /geo/simulate/jobs` → poll
  `GET /geo/simulate/jobs/{id}`), so no HTTP request is held open for minutes.

## Files

| file | purpose |
|---|---|
| `backend/Dockerfile` (`production` target) | non-root (uid 10001), HEALTHCHECK, uvicorn workers, proxy headers, graceful shutdown |
| `backend/docker-entrypoint.sh` | fetch model artifacts from S3, then exec the command |
| `backend/scripts/db_bootstrap.py` | PostGIS extensions + `alembic upgrade head` + spatial checks (one-off task) |
| `backend/scripts/create_responder.py --password-secret` | create/rotate an admin from Secrets Manager |
| `backend/scripts/emergency_smoke.py --full` | end-to-end production test (register → pin → rescue → alert → worker push → safe location → reached) |
| `infrastructure/aws/provision.sh` | idempotent AWS provisioning (network, secrets, data, registry, roles, cluster, ALB, HTTPS, services) |
| `infrastructure/aws/taskdef-*.json` | ECS task definitions (templated) |
| `frontend/vercel.json` | SPA rewrites, service-worker/manifest headers, immutable asset caching |
| `.github/workflows/ci.yml` | typecheck, tests, build, production image build |
| `.github/workflows/backend-deploy.yml` | GitHub OIDC → ECR push → migrations → ECS rolling deploy → live health check |

## Deploying

* **Frontend**: push to `main` → Vercel builds `frontend/` (Git integration). Environment:
  `VITE_API_BASE_URL=https://api.techmavericks.me/api/v1` (Production + Preview).
* **Backend**: push to `main` touching `backend/**` → `backend-deploy` workflow (role
  `floodguard-github-deploy`, repository variables `AWS_DEPLOY_ROLE_ARN`, `AWS_REGION`, `API_BASE_URL`).
  Manual equivalent:

```
IMAGE=<ecr-uri>:<tag> AWS_REGION=ap-south-1 infrastructure/aws/provision.sh services
```

* **Admin bootstrap / rotation** (one-off Fargate task):

```
aws ecs run-task --cluster floodguard-prod --launch-type FARGATE --task-definition floodguard-api \
  --network-configuration 'awsvpcConfiguration={subnets=[…],securityGroups=[…],assignPublicIp=ENABLED}' \
  --overrides '{"containerOverrides":[{"name":"api","command":["python","scripts/create_responder.py","--email","ops@techmavericks.me","--role","admin","--password-secret","floodguard/prod/admin"]}]}'
```

## DNS (Namecheap, techmavericks.me)

| type | host | value |
|---|---|---|
| CNAME | `api` | ALB DNS name (`floodguard-alb-….ap-south-1.elb.amazonaws.com`) |
| CNAME | `_a9b4…api` | ACM validation record (keep — used for automatic certificate renewal) |
| A | `floodguard` | `76.76.21.21` (Vercel) |

## Cost (approx., on-demand, Mumbai)

RDS db.t4g.micro + 20 GB gp3, ElastiCache cache.t4g.micro, ALB, Fargate (API 1 vCPU/3 GB,
worker 0.5/1 GB, beat 0.25/0.5 GB), public IPv4 addresses, CloudWatch Logs, Secrets Manager:
roughly **US$100–130 / month**. Free-plan credits apply while available.

## Notes / limitations

* The AWS account is on the Free plan: RDS backups are limited to 1 day, CloudFront requires account
  verification (not used — HTTPS is terminated on the ALB with an ACM certificate instead).
* Web Push works end-to-end in production (verified ECS → FCM → browser service worker); iOS requires
  the PWA to be installed to the Home Screen (iOS 16.4+). Browsers cannot track GPS in the background.
* Public OSRM demo servers are used for routing (no SLA); self-host OSRM for real operations.
