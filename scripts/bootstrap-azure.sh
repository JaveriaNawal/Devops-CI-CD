#!/usr/bin/env bash
# ============================================================
#  scripts/bootstrap-azure.sh
#  One-time setup: creates all Azure resources needed before
#  running the pipeline for the first time.
#
#  Usage:
#    chmod +x scripts/bootstrap-azure.sh
#    ./scripts/bootstrap-azure.sh \
#      --app-name myapp \
#      --location eastus \
#      --subscription 00000000-0000-0000-0000-000000000000
# ============================================================
set -euo pipefail

# ── Defaults (override via flags) ────────────────────────────
APP_NAME="myapp"
LOCATION="eastus"
SUBSCRIPTION_ID=""
ENVIRONMENT="staging"

# ── Parse arguments ──────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --app-name)      APP_NAME="$2";      shift 2 ;;
    --location)      LOCATION="$2";      shift 2 ;;
    --subscription)  SUBSCRIPTION_ID="$2"; shift 2 ;;
    --environment)   ENVIRONMENT="$2";   shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

if [[ -z "$SUBSCRIPTION_ID" ]]; then
  echo "ERROR: --subscription is required"
  exit 1
fi

RESOURCE_GROUP="${APP_NAME}-${ENVIRONMENT}-rg"
SERVICE_PRINCIPAL_NAME="${APP_NAME}-devops-sp"

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   Azure Bootstrap — CI/CD Pipeline Setup      ║"
echo "╚═══════════════════════════════════════════════╝"
echo ""
echo "  App Name     : $APP_NAME"
echo "  Environment  : $ENVIRONMENT"
echo "  Location     : $LOCATION"
echo "  Subscription : $SUBSCRIPTION_ID"
echo "  Rsrc Group   : $RESOURCE_GROUP"
echo ""
read -rp "Proceed? (y/N): " confirm
[[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

# ── 1. Set subscription ──────────────────────────────────────
echo ""
echo "▶ Setting subscription..."
az account set --subscription "$SUBSCRIPTION_ID"

# ── 2. Create resource group ─────────────────────────────────
echo "▶ Creating resource group: $RESOURCE_GROUP..."
az group create \
  --name     "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags     "app=$APP_NAME" "environment=$ENVIRONMENT" "managedBy=bootstrap-script"

# ── 3. Create service principal for Azure DevOps ─────────────
echo "▶ Creating service principal: $SERVICE_PRINCIPAL_NAME..."
SP_OUTPUT=$(az ad sp create-for-rbac \
  --name    "$SERVICE_PRINCIPAL_NAME" \
  --role    "Contributor" \
  --scopes  "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP" \
  --query   "[appId, password, tenant]" \
  --output  tsv)

# Read tab-separated values into variables
read -r SP_CLIENT_ID SP_CLIENT_SECRET SP_TENANT_ID <<< "$SP_OUTPUT"

# ── 4. Deploy Bicep infrastructure ───────────────────────────
echo "▶ Deploying Bicep infrastructure..."
echo "  Enter SQL admin password (min 16 chars, mixed case + numbers + symbols):"
read -rsp "  SQL Password: " SQL_PASSWORD
echo ""

DEPLOY_OUTPUT=$(az deployment group create \
  --resource-group  "$RESOURCE_GROUP" \
  --template-file   "infrastructure/main.bicep" \
  --parameters      "infrastructure/parameters.${ENVIRONMENT}.bicepparam" \
  --parameters      sqlAdminPassword="$SQL_PASSWORD" \
  --query           "properties.outputs.{acr:acrLoginServer.value, backend:backendUrl.value, frontend:frontendUrl.value, kv:keyVaultName.value}" \
  --output          tsv)

# Read values into variables
read -r ACR_LOGIN_SERVER BACKEND_URL FRONTEND_URL KV_NAME <<< "$DEPLOY_OUTPUT"

# ── 5. Grant SP access to Key Vault ──────────────────────────
echo "▶ Granting service principal Key Vault Secrets User role..."
az role assignment create \
  --assignee   "$SP_CLIENT_ID" \
  --role       "Key Vault Secrets User" \
  --scope      "$(az keyvault show --name "$KV_NAME" --query id -o tsv)"

# ── 6. Print summary ─────────────────────────────────────────
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║  ✅ Bootstrap Complete — Copy these into Azure DevOps  ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "  📦 Service Connection (ARM):"
echo "     Subscription ID : $SUBSCRIPTION_ID"
echo "     Tenant ID       : $SP_TENANT_ID"
echo "     Client ID       : $SP_CLIENT_ID"
echo "     Client Secret   : $SP_CLIENT_SECRET"
echo ""
echo "  📦 Pipeline Variable Group 'pipeline-env-vars':"
echo "     AZURE_SUBSCRIPTION_ID = $SUBSCRIPTION_ID"
echo "     AZURE_TENANT_ID       = $SP_TENANT_ID"
echo ""
echo "  📦 Key Vault Variable Group 'keyvault-secrets':"
echo "     Key Vault Name  : $KV_NAME"
echo "     (Link ACR-Password, SQL-ConnectionString, SWA-DeploymentToken)"
echo ""
echo "  🌐 Deployed Endpoints:"
echo "     Backend  : $BACKEND_URL"
echo "     Frontend : $FRONTEND_URL"
echo "     ACR      : $ACR_LOGIN_SERVER"
echo ""
echo "  ⚠  IMPORTANT: Rotate the SP client secret and store it securely."
echo "     Do NOT commit any of these values to source control."
echo ""
