# syntax=docker/dockerfile:1

# Strategy: single parameterized Dockerfile using `turbo prune --docker`.
#
# One build recipe for every Node backend service. Pass two build args:
#   - PACKAGE     npm package name used by turbo (e.g. @byrdos/api)
#   - SERVICE_DIR filesystem path of the workspace package (e.g. apps/api)
#   - CMD         optional runtime command (default: node dist/index.js)
#
# Examples:
#
#   docker build --build-arg PACKAGE=@byrdos/api --build-arg SERVICE_DIR=apps/api --build-arg CMD="node dist/main.js" -t byrdos/api .
#   docker build --build-arg PACKAGE=@byrdos/sync-worker --build-arg SERVICE_DIR=services/sync-worker -t byrdos/sync-worker .
#   docker build --build-arg PACKAGE=@byrdos/webhook-worker --build-arg SERVICE_DIR=services/webhook-worker -t byrdos/webhook-worker .
#   docker build --build-arg PACKAGE=@byrdos/scheduler --build-arg SERVICE_DIR=services/scheduler -t byrdos/scheduler .
#   docker build --build-arg PACKAGE=@byrdos/outbox-relay --build-arg SERVICE_DIR=services/outbox-relay -t byrdos/outbox-relay .
#   docker build --build-arg PACKAGE=@byrdos/db --build-arg SERVICE_DIR=packages/db --build-arg CMD="pnpm run db:migrate" -t byrdos/migrate .
#
# apps/web deploys to Vercel per ADR-0010 and is intentionally not covered by
# this Dockerfile. Add `output: 'standalone'` to apps/web/next.config.ts later
# if a containerized web image is needed.

ARG NODE_VERSION=20
ARG PNPM_VERSION=9.15.4
ARG PACKAGE
ARG SERVICE_DIR
ARG CMD="node dist/index.js"

# -----------------------------------------------------------------------------
# Base stage: tooling and workspace root
# -----------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
ENV CI=true HUSKY=0
WORKDIR /app

# -----------------------------------------------------------------------------
# Pruner stage: produce the minimal monorepo slice for PACKAGE
# -----------------------------------------------------------------------------
FROM base AS pruner
ARG PACKAGE
COPY . .
RUN pnpm dlx turbo prune --docker ${PACKAGE}

# -----------------------------------------------------------------------------
# Installer stage: install the pruned dependency graph
# -----------------------------------------------------------------------------
FROM base AS installer
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/pnpm-workspace.yaml ./pnpm-workspace.yaml
RUN pnpm install --frozen-lockfile --prod=false

# -----------------------------------------------------------------------------
# Builder stage: compile the service and its workspace dependencies
# -----------------------------------------------------------------------------
FROM base AS builder
COPY --from=installer /app/ .
COPY --from=pruner /app/out/full/ .
ARG PACKAGE
RUN pnpm run build --filter=${PACKAGE}...

# -----------------------------------------------------------------------------
# Runner stage: smallest possible production image
# -----------------------------------------------------------------------------
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 byrdos
WORKDIR /app
ENV NODE_ENV=production

# The pruned workspace tree already contains only the transitive closure needed
# by PACKAGE, so copying the whole tree is safe and keeps workspace symlinks
# intact without maintaining a per-package allow-list.
COPY --from=builder --chown=byrdos:nodejs /app ./

USER byrdos
ARG SERVICE_DIR
WORKDIR /app/${SERVICE_DIR}
ARG CMD
CMD ${CMD}
