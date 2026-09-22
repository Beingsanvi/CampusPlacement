#!/bin/bash
# Deployment script for Campus Placement AI to Azure Functions
# Usage: ./deploy.sh [function-app-name]
# Defaults to the sandbox Function App; pass another name to override.

set -e

APP_NAME="${1:-campus-placement-api-eah8hkg9embeh5e4}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "Campus Placement AI - Azure Deployment"
echo "Function App: $APP_NAME"
echo "=========================================="

# Check required tools
for cmd in func az; do
    if ! command -v $cmd &> /dev/null; then
        echo "Missing required tool: $cmd"
        echo "  func: npm install -g azure-functions-core-tools@4 --unsafe-perm true"
        echo "  az:   brew install azure-cli"
        exit 1
    fi
done

cd "$SCRIPT_DIR/backend"

echo ""
echo "Step 1: Logging in to Azure..."
az login

echo ""
echo "Step 2: Publishing Azure Function..."
func azure functionapp publish "$APP_NAME"

echo ""
echo "Step 3: Syncing app settings from backend/.env (no secrets are printed)..."
# Only set the known safe variable names; value goes straight to Azure.
ENV_SYNC="FOUNDRY_PROJECT_ENDPOINT FOUNDRY_API_KEY MODEL_DEPLOYMENT_NAME \
AZURE_SEARCH_ENDPOINT AZURE_SEARCH_API_KEY AZURE_SEARCH_INDEX_NAME \
SMTP_HOST SMTP_PORT SMTP_USERNAME SMTP_PASSWORD EMAIL_FROM EMAIL_FROM_NAME"

if [ -f .env ]; then
    set -a
    . ./.env
    set +a
    for VAR in $ENV_SYNC; do
        VALUE="${!VAR:-}"
        if [ -n "$VALUE" ]; then
            az functionapp config appsettings set --name "$APP_NAME" \
                --resource-group "${RESOURCE_GROUP:-campus-placement-rg}" \
                --settings "$VAR=$VALUE" \
                --output none 2>/dev/null || true
        fi
    done
else
    echo "  backend/.env not found - skipping app settings sync."
fi

echo ""
echo "Step 4: Restarting Function App..."
az functionapp restart --name "$APP_NAME" --resource-group "${RESOURCE_GROUP:-campus-placement-rg}" --output none 2>/dev/null || true

echo ""
echo "Deployment complete!"
echo "API root:  https://${APP_NAME}.azurewebsites.net/api/"
echo "Health:    https://${APP_NAME}.azurewebsites.net/api/health"