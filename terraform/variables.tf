# ── terraform/variables.tf ────────────────────────────────────
# Variable declarations for the TaskApp Terraform configuration
# ──────────────────────────────────────────────────────────────

variable "subscription_id" {
  type        = string
  description = "Azure Subscription ID (az account show --query id)"
}

variable "resource_group_name" {
  type        = string
  description = "Name of the resource group"
  default     = "rg-taskapp-javeria-eus-01"
}

variable "location" {
  type        = string
  description = "Azure region to deploy resources"
  default     = "eastus"
}

variable "location_abbreviation" {
  type        = string
  description = "Short abbreviation for the region (used in naming)"
  default     = "eus"
}

variable "environment" {
  type        = string
  description = "Deployment environment: staging or production"
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be 'staging' or 'production'."
  }
}

variable "acr_name" {
  type        = string
  description = "Azure Container Registry name (globally unique, alphanumeric only)"
  default     = "acrtaskappjaveria"
}

variable "backend_app_name" {
  type        = string
  description = "App Service Web App name for the backend"
  default     = "app-taskapp-backend-javeria-eus-01"
}

variable "backend_image_name" {
  type        = string
  description = "Docker image name for the backend (without registry prefix)"
  default     = "taskapp-backend"
}

# ── Database variables (sensitive — use terraform.tfvars or env vars) ──
variable "db_host" {
  type        = string
  description = "Azure SQL Server hostname (e.g. sql-taskapp-yourname.database.windows.net)"
}

variable "db_name" {
  type        = string
  description = "Azure SQL Database name"
  default     = "db-taskapp"
}

variable "db_user" {
  type        = string
  description = "Azure SQL admin login username"
}

variable "db_password" {
  type        = string
  description = "Azure SQL admin password"
  sensitive   = true
}

variable "allowed_origins" {
  type        = string
  description = "Comma-separated list of allowed CORS origins"
  default     = "https://stapp-taskapp-frontend.azurestaticapps.net"
}
