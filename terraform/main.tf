# ── terraform/main.tf ─────────────────────────────────────────
# EM-A: Terraform IaC for TaskApp Azure infrastructure
#
# Resources provisioned:
#   - Resource Group
#   - Azure Container Registry (Basic, admin enabled)
#   - App Service Plan (Linux, B1)
#   - Linux Web App (pulls from ACR)
#
# Remote state stored in Azure Blob Storage (tfstate container)
# ──────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.85"
    }
  }

  # ── Remote backend — Azure Blob Storage ──────────────────────
  # Run first:
  #   az storage account create --name <storage_account_name> \
  #     --resource-group <rg> --sku Standard_LRS
  #   az storage container create --name tfstate \
  #     --account-name <storage_account_name>
  backend "azurerm" {
    resource_group_name  = "rg-tfstate"
    storage_account_name = "sttaskappstate"        # change to your storage account
    container_name       = "tfstate"
    key                  = "taskapp.tfstate"
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}

# ── Resource Group ────────────────────────────────────────────
resource "azurerm_resource_group" "main" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    project     = "taskapp"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# ── Azure Container Registry (Basic, admin enabled) ───────────
resource "azurerm_container_registry" "acr" {
  name                = var.acr_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Basic"
  admin_enabled       = true

  tags = azurerm_resource_group.main.tags
}

# ── App Service Plan (Linux, B1) ──────────────────────────────
resource "azurerm_service_plan" "main" {
  name                = "asp-taskapp-${var.environment}-${var.location_abbreviation}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "B1"

  tags = azurerm_resource_group.main.tags
}

# ── Linux Web App (backend — pulls from ACR) ──────────────────
resource "azurerm_linux_web_app" "backend" {
  name                = var.backend_app_name
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  service_plan_id     = azurerm_service_plan.main.id

  site_config {
    container_registry_use_managed_identity = false

    application_stack {
      docker_image_name   = "${var.backend_image_name}:latest"
      docker_registry_url = "https://${azurerm_container_registry.acr.login_server}"
      docker_registry_username = azurerm_container_registry.acr.admin_username
      docker_registry_password = azurerm_container_registry.acr.admin_password
    }

    always_on = true
  }

  app_settings = {
    "WEBSITES_PORT"              = "3001"
    "PORT"                       = "3001"
    "NODE_ENV"                   = var.environment
    "DB_HOST"                    = var.db_host
    "DB_NAME"                    = var.db_name
    "DB_USER"                    = var.db_user
    "DB_PASSWORD"                = var.db_password     # use Key Vault reference in prod
    "ALLOWED_ORIGINS"            = var.allowed_origins
    "DOCKER_REGISTRY_SERVER_URL" = "https://${azurerm_container_registry.acr.login_server}"
  }

  https_only = true

  tags = azurerm_resource_group.main.tags
}

# ── Outputs ───────────────────────────────────────────────────
output "acr_login_server" {
  value       = azurerm_container_registry.acr.login_server
  description = "ACR login server URL"
}

output "acr_admin_username" {
  value       = azurerm_container_registry.acr.admin_username
  description = "ACR admin username"
  sensitive   = true
}

output "acr_admin_password" {
  value       = azurerm_container_registry.acr.admin_password
  description = "ACR admin password"
  sensitive   = true
}

output "backend_url" {
  value       = "https://${azurerm_linux_web_app.backend.default_hostname}"
  description = "Backend App Service URL"
}
