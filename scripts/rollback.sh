#!/usr/bin/env bash
# ============================================================
#  scripts/rollback.sh
#  Emergency rollback: redeploy the previous Docker image tag
#  to the App Service without going through the full pipeline.
#
#  Usage:
#    ./scripts/rollback.sh \
#      --build-id 241 \
#      --app-service myapp-production-backend \
#      --resource-group myapp-production-rg \
#      --acr myappacr.azurecr.io
# ============================================================
set -euo pipefail

BUILD_ID=""
APP_SERVICE=""
RESOURCE_GROUP=""
ACR_LOGIN_SERVER=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --build-id)       BUILD_ID="$2";         shift 2 ;;
    --app-service)    APP_SERVICE="$2";      shift 2 ;;
    --resource-group) RESOURCE_GROUP="$2";   shift 2 ;;
    --acr)            ACR_LOGIN_SERVER="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

for var in BUILD_ID APP_SERVICE RESOURCE_GROUP ACR_LOGIN_SERVER; do
  [[ -z "${!var}" ]] && { echo "ERROR: --${var//_/-} is required"; exit 1; }
done

IMAGE="${ACR_LOGIN_SERVER}/backend-api:${BUILD_ID}"

echo ""
echo "⚠️  ROLLBACK INITIATED"
echo "   Reverting $APP_SERVICE to build #$BUILD_ID"
echo "   Image: $IMAGE"
echo ""
read -rp "Confirm rollback? (yes/no): " confirm
[[ "$confirm" == "yes" ]] || { echo "Rollback aborted."; exit 0; }

echo "▶ Verifying image exists in ACR..."
az acr repository show-tags \
  --name "$(echo "$ACR_LOGIN_SERVER" | cut -d. -f1)" \
  --repository backend-api \
  --query "[?@=='$BUILD_ID']" \
  --output tsv | grep -q "$BUILD_ID" || {
    echo "ERROR: Image tag $BUILD_ID not found in ACR. Cannot rollback."
    exit 1
  }

echo "▶ Updating App Service container image..."
az webapp config container set \
  --name           "$APP_SERVICE" \
  --resource-group "$RESOURCE_GROUP" \
  --docker-custom-image-name "$IMAGE"

echo "▶ Restarting App Service..."
az webapp restart \
  --name           "$APP_SERVICE" \
  --resource-group "$RESOURCE_GROUP"

echo "▶ Waiting 30s for restart..."
sleep 30

APP_URL="https://${APP_SERVICE}.azurewebsites.net"
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${APP_URL}/api/health")

if [[ "$HTTP_STATUS" == "200" ]]; then
  echo ""
  echo "✅ Rollback successful — Build #$BUILD_ID is live"
  echo "   Health: $APP_URL/api/health → HTTP $HTTP_STATUS"
else
  echo ""
  echo "❌ Rollback health check FAILED — HTTP $HTTP_STATUS"
  echo "   Manually investigate: $APP_URL/api/health"
  exit 1
fi
