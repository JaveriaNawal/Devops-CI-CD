# Azure DevOps CI/CD Pipeline — Node.js + React Full-Stack

> **Production-grade CI/CD** for an Express.js backend + React frontend deployed to  
> Azure App Service (containers) and Azure Static Web Apps, backed by Azure SQL Database.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Azure DevOps Pipeline                         │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐  │
│  │ Validate │→ │  Build   │→ │Integration│→ │ Deploy Staging   │  │
│  │Lint+Test │  │TS+Docker │  │ Playwright │  │ App Svc + SWA   │  │
│  └──────────┘  └──────────┘  └───────────┘  └────────┬─────────┘  │
│                                                        │             │
│                                              ┌─────────▼─────────┐  │
│                                              │ Deploy Production  │  │
│                                              │  (manual gate)     │  │
│                                              └─────────┬─────────┘  │
│                                                        │             │
│                                              ┌─────────▼─────────┐  │
│                                              │ Notify (always)    │  │
│                                              │ Teams + Email      │  │
│                                              └───────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│                        Azure Resources                           │
│                                                                  │
│   ACR              App Service         Static Web App            │
│ ┌──────┐         ┌────────────────┐   ┌──────────────┐          │
│ │Docker│ ──�azure-cicd-pipeline/
├── azure-pipelines/                 ← Modular pipeline files
│   ├── backend-pipeline.yml         ← Build + Deploy Backend (App Svc)
│   ├── frontend-pipeline.yml        ← Build + Deploy Frontend (SWA)
│   └── security-pipeline.yml        ← EM-B/C/D Security Stages
│
├── backend/                         ← Express.js TypeScript API
│   ├── Dockerfile                   ← Multi-stage Alpine build
│   ├── package.json
│   ├── tsconfig.json
│   ├── .eslintrc.js
│   ├── .dockerignore
│   └── src/
│       ├── server.ts                ← Entry point + graceful shutdown
│       ├── app.ts                   ← Express setup + middleware
│       ├── db/connection.ts         ← Azure SQL connection pool
│       ├── middleware/
│       │   └── auth.ts              ← JWT authentication middleware
│       ├── routes/
│       │   ├── health.ts            ← /api/health liveness + readiness
│       │   ├── auth.ts              ← JWT login + register
│       │   ├── api.ts               ← API orchestrator
│       │   └── tasks.ts             ← Task Manager CRUD routes
│       └── utils/logger.ts          ← Winston structured logging
│
├── frontend/                        ← React + Vite + TypeScript SPA
│   ├── Dockerfile                   ← Multi-stage Nginx build
│   ├── nginx.conf                   ← Custom Nginx config for SPA
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx                 ← App entry
│       ├── App.tsx                  ← Router + private routes
│       ├── index.css                ← Premium glassmorphism styles
│       ├── lib/api.ts               ← Axios client + tasksApi
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx
│       │   └── TasksPage.tsx        ← Task Manager UI
│       └── store/authStore.ts       ← Zustand state management
│
├── db/
│   └── schema.sql                   ← Database initialization script
│
├── terraform/                       ← EM-A: Infrastructure as Code
│   ├── main.tf                      ← Provisioning ACR, App Svc, etc.
│   └── variables.tf                 ← Configurable infrastructure variables
│
├── infrastructure/                  ← (Optional) Bicep templates
├── scripts/                         ← Helper scripts
└── README.md                        ← Lab report and documentation
g.json
│   ├── .eslintrc.js
│   └── src/
│       ├── server.ts                ← Entry point + graceful shutdown
│       ├── app.ts                   ← Express setup + middleware
│       ├── db/connection.ts         ← Azure SQL connection pool
│       ├── routes/
│       │   ├── health.ts            ← /api/health liveness + readiness
│       │   ├── auth.ts              ← JWT login + register
│       │   └── api.ts               ← Protected resource routes
│       ├── migrations/run-migrations.ts ← Idempotent SQL migrations
│       └── utils/logger.ts          ← Winston structured logging
│   └── tests/
│       └── routes/
│           ├── health.test.ts
│           └── auth.test.ts
│
├── frontend/                        ← React + Vite + TypeScript SPA
│   ├── index.html
│   ├── vite.config.ts               ← Vite + Vitest config
│   ├── playwright.config.ts
│   ├── package.json
│   └── src/
│       ├── main.tsx                 ← App entry + providers
│       ├── App.tsx                  ← Router + auth guard
│       ├── index.css                ← Global dark theme
│       ├── store/authStore.ts       ← Zustand auth state
│       ├── lib/api.ts               ← Axios + JWT interceptors
│       ├── pages/
│       │   ├── LoginPage.tsx + .module.css
│       │   └── DashboardPage.tsx + .module.css
│       └── test/
│           ├── setup.ts
│           └── LoginPage.test.tsx
│   └── tests/e2e/auth.spec.ts       ← Playwright E2E
│
├── infrastructure/
│   ├── main.bicep                   ← All Azure resources (IaC)
│   ├── parameters.staging.bicepparam
│   └── parameters.production.bicepparam
│
└── scripts/
    ├── bootstrap-azure.sh           ← One-time Azure setup
    └── rollback.sh                  ← Emergency rollback
```

---

## Prerequisites

| Tool             | Version  | Purpose                          |
|------------------|----------|----------------------------------|
| Azure CLI        | ≥ 2.55   | Resource management              |
| Bicep CLI        | ≥ 0.23   | IaC deployment                   |
| Node.js          | 20 LTS   | Local development                |
| Docker Desktop   | ≥ 24     | Local container testing          |
| Azure DevOps org | any      | Pipeline host                    |

---

## Quick Start — First-Time Setup

### Step 1 — Bootstrap Azure Resources

```bash
chmod +x scripts/bootstrap-azure.sh
./scripts/bootstrap-azure.sh \
  --app-name myapp \
  --location eastus \
  --subscription YOUR-SUBSCRIPTION-ID \
  --environment staging
```

This script creates:
- Resource group
- Azure Container Registry
- App Service Plan + App Service (backend)
- Azure Static Web Apps (frontend)
- Azure SQL Server + Database
- Key Vault with RBAC
- Application Insights + Log Analytics
- Service principal for Azure DevOps

### Step 2 — Configure Azure DevOps

#### 2a. Service Connection
`Project Settings` → `Service Connections` → `New` → `Azure Resource Manager`  
Use the **service principal** credentials printed by the bootstrap script.  
Name it: **`azure-service-connection`**

#### 2b. Variable Groups
Go to `Pipelines` → `Library` → `Variable groups`

**Group 1: `pipeline-env-vars`**
| Variable               | Value                       |
|------------------------|-----------------------------|
| `AZURE_SUBSCRIPTION_ID`| `your-subscription-id`      |
| `AZURE_TENANT_ID`      | `your-tenant-id`            |

**Group 2: `keyvault-secrets`** ← Link to Azure Key Vault
| Secret Name              | Description                        |
|--------------------------|------------------------------------|
| `ACR-Password`           | Auto-stored by Bicep               |
| `SQL-ConnectionString`   | Auto-stored by Bicep               |
| `SWA-DeploymentToken`    | Get from Static Web App → Manage   |
| `NotificationEmail`      | Alert recipient email              |
| `SENDGRID-ApiKey`        | SendGrid API key for emails        |
| `TEAMS-WebhookUrl`       | Teams webhook (optional)           |
| `JWT-Secret`             | 32+ char random secret             |

#### 2c. ACR Service Connection
`Project Settings` → `Service Connections` → `Docker Registry`  
Select **Azure Container Registry** and your ACR.  
Name it: **`myappacr`** (must match `ACR_NAME` in pipeline)

#### 2d. Production Approval Gate
`Pipelines` → `Environments` → `production` → `Approvals and checks`  
Add an **Approvals** check with your team lead's email.

### Step 3 — Create the Pipeline

`Pipelines` → `New Pipeline` → `Azure Repos Git` → select your repo  
→ `Existing Azure Pipelines YAML file` → select `/azure-pipelines.yml`

---

## Pipeline Stages

| Stage              | Trigger            | Jobs                                    |
|--------------------|--------------------|-----------------------------------------|
| **Validate**       | Every push + PR    | ESLint, Jest (backend + frontend)       |
| **Build**          | After Validate ✅  | TypeScript compile, Docker build + push, Trivy scan |
| **IntegrationTest**| After Build ✅ (non-PR) | Playwright E2E                     |
| **DeployStaging**  | After E2E ✅       | App Service (staging) + SWA (staging)   |
| **DeployProduction**| `main` branch + manual gate | App Service + SWA (prod)  |
| **Notify**         | Always             | Teams webhook + SendGrid email          |

---

## Secrets Handling

All secrets follow the **Key Vault Reference** pattern — they are **never stored as plaintext** in pipeline variables or app settings:

```
App Setting → @Microsoft.KeyVault(SecretUri=https://mykv.vault.azure.net/secrets/JWT-Secret/)
```

The App Service's **System-Assigned Managed Identity** is granted `Key Vault Secrets User` RBAC role, so it can read secrets at runtime without any credentials in code.

```
Pipeline Variable Groups ──link──▶ Azure Key Vault
        │                                 ▲
        │                                 │ RBAC
        ▼                                 │
Azure DevOps Agent                App Service (MSI)
(reads secrets at build time)     (reads secrets at runtime)
```

---

## npm Dependency Caching

Cache keys are scoped to OS + `package-lock.json` hash:

```yaml
key: 'npm-backend | "$(Agent.OS)" | backend/package-lock.json'
```

- **Cache hit**: `node_modules` restored in ~5s, `npm ci` skipped  
- **Cache miss**: full `npm ci` runs, result cached for next build  
- Separate caches for backend and frontend to maximize hit rate

Expected time saving: **60–90 seconds** per job on cache hits.

---

## Docker Build Optimizations

1. **Multi-stage build** — TypeScript compiled in `builder`, only `dist/` + prod `node_modules` in `runner`
2. **BuildKit** enabled (`DOCKER_BUILDKIT=1`) — parallel layer building
3. **Layer caching** — `package.json` copied before source files
4. **Cache-from** — pulls `latest` tag from ACR as build cache: `--cache-from acr.io/backend-api:latest`
5. **Non-root user** — runs as `appuser:appgroup` (UID 1001)
6. **Trivy scan** — blocks push on `HIGH`/`CRITICAL` CVEs

Final image size: **~180MB** (vs ~900MB for a single-stage build)

---

## Health Checks & Smoke Tests

After every deployment:

```bash
# Pipeline smoke test
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://myapp.azurewebsites.net/api/health")
# Fails pipeline if not 200
```

The `/api/health` endpoint checks:
- **Database**: `SELECT 1` ping to Azure SQL
- **Memory**: heap usage alert at >85%, error at >95%
- **Version**: current `BUILD_ID` for traceability

---

## Database Migrations

Migrations run as part of every backend deployment:

```bash
node dist/migrations/run-migrations.js
```

- Tracked in `schema_migrations` table — fully idempotent
- Each migration has a `version` number and `name`
- Skipped if already applied (safe to re-run)
- Deployment blocked if migrations fail (`continueOnError: false`)

---

## Emergency Rollback

```bash
./scripts/rollback.sh \
  --build-id 241 \
  --app-service myapp-production-backend \
  --resource-group myapp-production-rg \
  --acr myappacr.azurecr.io
```

- Verifies the target image tag exists in ACR
- Updates App Service container image
- Restarts the service
- Runs health check — fails loudly if unsuccessful

---

## Local Development

```bash
# Backend
cd backend
cp .env.example .env          # fill in local SQL credentials
npm ci
npm run dev                   # ts-node-dev with hot reload on :8080

# Frontend
cd frontend
npm ci
npm run dev                   # Vite dev server on :5173 (proxies /api to :8080)

# Run all tests
cd backend  && npm test
cd frontend && npm test
cd frontend && npm run test:e2e
```

---

## Environment Variables Reference

### Backend

| Variable                              | Source        | Required | Description                    |
|---------------------------------------|---------------|----------|--------------------------------|
| `NODE_ENV`                            | App Settings  | ✅       | `production` / `staging`       |
| `PORT`                                | App Settings  | ✅       | Default `8080`                 |
| `SQL_CONNECTION_STRING`               | Key Vault ref | ✅       | Azure SQL connection string    |
| `JWT_SECRET`                          | Key Vault ref | ✅       | 32+ char signing secret        |
| `APPLICATIONINSIGHTS_CONNECTION_STRING`| Key Vault ref | ✅      | App Insights telemetry         |
| `ALLOWED_ORIGINS`                     | App Settings  | ✅       | Comma-sep CORS origins         |
| `LOG_LEVEL`                           | App Settings  |          | Default: `info`                |

### Frontend (Vite)

| Variable             | Set at         | Description                       |
|----------------------|----------------|-----------------------------------|
| `VITE_API_BASE_URL`  | Build time     | Backend API base URL              |

---

## Security Checklist

- [x] Secrets stored in Azure Key Vault, never in code or plaintext env vars  
- [x] App Service reads secrets via Managed Identity (no credentials)  
- [x] Docker image scanned for CVEs with Trivy (blocks on HIGH/CRITICAL)  
- [x] Container runs as non-root user (UID 1001)  
- [x] HTTPS enforced on App Service (`httpsOnly: true`)  
- [x] TLS 1.2 minimum enforced  
- [x] FTP disabled on App Service  
- [x] Rate limiting on all API routes (100 req/15min)  
- [x] Helmet.js security headers  
- [x] CORS restricted to known origins  
- [x] SQL queries use parameterized inputs (no raw string interpolation)  
- [x] JWT tokens expire after 24h  
- [x] Production approval gate — no auto-deploy to production  
- [x] Service principal scoped to resource group only  

---

## Troubleshooting

| Symptom                              | Check                                                     |
|--------------------------------------|-----------------------------------------------------------|
| Pipeline fails at `ACR Login`        | Verify ACR service connection name matches `ACR_NAME`     |
| `Health check FAILED — 503`         | Check App Service logs: `az webapp log tail --name ...`   |
| Migrations fail                      | Verify SQL firewall allows Azure services (`0.0.0.0`)     |
| Key Vault access denied              | Check MSI has `Key Vault Secrets User` role on the vault  |
| SWA deploy fails                     | Regenerate `SWA-DeploymentToken` in Azure Portal          |
| Trivy blocks push                    | Update base image: `FROM node:20-alpine` → latest patch   |
| npm cache miss every run             | Ensure `package-lock.json` is committed                   |

---

## License

MIT — see [LICENSE](LICENSE)

---

## Submission

### Live Application URL

> **Static Web App (Frontend):**  
> `https://stapp-taskapp-frontend.azurestaticapps.net`
>
> **App Service (Backend API):**  
> `https://app-taskapp-backend-yourname.azurewebsites.net/api/health`

---

### Screenshot — Successful Pipeline Run

<!-- Replace with your actual screenshot after running the pipeline -->
> _Add a screenshot of your Azure DevOps pipeline showing all stages (Build → DeployDev / DeployProd) with green checkmarks._

---

### Screenshot — ACR Repositories with Build Tags

<!-- Replace with your actual screenshot after pipeline push -->
> _Add a screenshot of Azure Portal → Container Registry → Repositories showing:_
> - `taskapp-backend` with tags e.g. `42`, `43`, `latest`
> - `taskapp-frontend` with tags e.g. `42`, `43`, `latest`

---

## Extra Mile — EM-D: ZAP Vulnerability Analysis

> After running the security pipeline, download `zap-security-reports` from the pipeline artifacts and review `zap-report.html`.

### Top 3 Vulnerabilities Found by OWASP ZAP

| # | Alert | Risk | Affected URL | Remediation |
|---|-------|------|-------------|-------------|
| 1 | **Missing Anti-clickjacking Header** | Medium | All pages | Add `X-Frame-Options: SAMEORIGIN` or CSP `frame-ancestors 'none'` to all responses |
| 2 | **Content Security Policy (CSP) Not Set** | Medium | All pages | Configure a strict CSP header: `Content-Security-Policy: default-src 'self'` |
| 3 | **Server Leaks Version Information via "Server" Header** | Low | All API responses | Remove the `Server` response header in nginx/Express using `helmet()` and `server_tokens off` in nginx.conf |
