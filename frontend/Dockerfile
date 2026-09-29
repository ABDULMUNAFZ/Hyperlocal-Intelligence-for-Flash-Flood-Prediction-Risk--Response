# FloodGuard Frontend Dockerfile
# Multi-stage build for development and production

# Base stage
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Development stage
FROM base AS development

ENV NODE_ENV=development
ENV VITE_API_BASE_URL=/api/v1
ENV VITE_WS_BASE_URL=/api/v1

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# Build stage
FROM base AS builder

ENV NODE_ENV=production

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]