# ============================================================
#  Backend Dockerfile — multi-stage build
#  Stage 1 (builder): compile TypeScript
#  Stage 2 (runner):  minimal production image
# ============================================================

# ── Stage 1: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder

# Build-time labels (populated by docker build --build-arg)
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

WORKDIR /app

# Install dependencies first (leverages Docker layer cache)
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline --no-audit --ignore-scripts

# Copy source and compile
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Prune dev dependencies so only prod deps remain
RUN npm prune --production

# ── Stage 2: Production runtime ────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser  -u 1001 -S appuser -G appgroup

WORKDIR /app

# OCI labels for traceability
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.title="backend-api" \
      org.opencontainers.image.description="Node.js Express REST API"

# Copy only compiled output + prod node_modules
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Azure App Service expects PORT 8080 by default
ENV PORT=8080 \
    NODE_ENV=production

EXPOSE 8080

# Healthcheck used by App Service & Docker
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health || exit 1

USER appuser

CMD ["node", "dist/server.js"]
