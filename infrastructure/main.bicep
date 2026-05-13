// ============================================================
//  main.bicep — Azure infrastructure for the full-stack app
//  Deploys: ACR, App Service Plan, App Service, Static Web App,
//           Azure SQL Server + Database, Key Vault
// ============================================================

@description('Environment name (staging | production)')
@allowed(['staging', 'production'])
param environment string = 'staging'

@description('Azure region for most resources')
param location string = resourceGroup().location

@description('Azure region for Static Web App (different due to availability)')
param swaLocation string = 'centralus'

@description('Globally unique base name (e.g. myapp)')
@minLength(3)
@maxLength(20)
param appName string = 'myapp'

@description('SQL Server administrator login')
param sqlAdminLogin string = 'sqladmin'

@description('SQL Server administrator password')
@secure()
param sqlAdminPassword string

@description('Object ID of the AAD group/user that gets Key Vault access')
param keyVaultAdminObjectId string

// ── Derived naming ────────────────────────────────────────────
var suffix        = '${appName}-${environment}'
var acrName       = replace('${appName}acr${environment}', '-', '')
var kvName        = '${suffix}-kv'
var sqlServerName = '${suffix}-sql'
var dbName        = '${appName}db'
var appPlanName   = '${suffix}-plan'
var backendName   = '${suffix}-backend'
var frontendName  = '${suffix}-swa'
var appInsightsName = '${suffix}-ai'
var logWorkspaceName = '${suffix}-law'

// ── Tags applied to all resources ────────────────────────────
var commonTags = {
  environment: environment
  application: appName
  managedBy:   'bicep'
}

// ============================================================
//  Log Analytics Workspace (backing App Insights)
// ============================================================
resource logWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name:     logWorkspaceName
  location: location
  tags:     commonTags
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ============================================================
//  Application Insights
// ============================================================
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name:     appInsightsName
  location: location
  kind:     'web'
  tags:     commonTags
  properties: {
    Application_Type:             'web'
    WorkspaceResourceId:          logWorkspace.id
    IngestionMode:                'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery:     'Enabled'
  }
}

// ============================================================
//  Azure Container Registry
// ============================================================
resource acr 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' = {
  name:     acrName
  location: location
  tags:     commonTags
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: true
  }
}

// ============================================================
//  Key Vault
// ============================================================
resource keyVault 'Microsoft.KeyVault/vaults@2023-02-01' = {
  name:     kvName
  location: location
  tags:     commonTags
  properties: {
    sku:      { family: 'A', name: 'standard' }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true
    enableSoftDelete:        true
    softDeleteRetentionInDays: 7
    enabledForDeployment:        false
    enabledForTemplateDeployment: true
    networkAcls: {
      bypass:        'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// ── Key Vault RBAC: admin access ──────────────────────────────
resource kvAdminRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name:  guid(keyVault.id, keyVaultAdminObjectId, 'Key Vault Administrator')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '00482a5a-887f-4fb3-b363-3b7fe8e74483')
    principalId:      keyVaultAdminObjectId
    principalType:    'User'
  }
}

// ── Key Vault secrets ─────────────────────────────────────────
resource secretAcrPassword 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name:   'ACR-Password'
  properties: { value: acr.listCredentials().passwords[0].value }
}

resource secretSqlConnStr 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = {
  parent: keyVault
  name:   'SQL-ConnectionString'
  properties: {
    value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=${dbName};User ID=${sqlAdminLogin};Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;'
  }
}

// ============================================================
//  Azure SQL Server + Database
// ============================================================
resource sqlServer 'Microsoft.Sql/servers@2022-11-01-preview' = {
  name:     sqlServerName
  location: location
  tags:     commonTags
  properties: {
    administratorLogin:         sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version:                    '12.0'
    minimalTlsVersion:          '1.2'
    publicNetworkAccess:        'Enabled'
  }
}

// Allow Azure services to connect
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2022-11-01-preview' = {
  parent: sqlServer
  name:   'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress:   '0.0.0.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-11-01-preview' = {
  parent:   sqlServer
  name:     dbName
  location: location
  tags:     commonTags
  sku: {
    name:     environment == 'production' ? 'S2' : 'S0'
    tier:     'Standard'
    capacity: environment == 'production' ? 50 : 10
  }
  properties: {
    collation:                     'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes:                  environment == 'production' ? 107374182400 : 2147483648
    zoneRedundant:                 false
    readScale:                     'Disabled'
    requestedBackupStorageRedundancy: 'Local'
  }
}

// ============================================================
//  App Service Plan (Linux containers)
// ============================================================
resource appServicePlan 'Microsoft.Web/serverfarms@2022-09-01' = {
  name:     appPlanName
  location: location
  tags:     commonTags
  kind:     'linux'
  sku: {
    name:     environment == 'production' ? 'P1v3' : 'B1'
    tier:     environment == 'production' ? 'PremiumV3' : 'Basic'
    capacity: environment == 'production' ? 2 : 1
  }
  properties: {
    reserved: true   // required for Linux
  }
}

// ============================================================
//  App Service (Backend API)
// ============================================================
resource backendApp 'Microsoft.Web/sites@2022-09-01' = {
  name:     backendName
  location: location
  tags:     commonTags
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId:        appServicePlan.id
    httpsOnly:           true
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion:      'DOCKER|${acr.properties.loginServer}/backend-api:latest'
      alwaysOn:            true
      minTlsVersion:       '1.2'
      http20Enabled:       true
      ftpsState:           'Disabled'
      healthCheckPath:     '/api/health'
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL',      value: 'https://${acr.properties.loginServer}' }
        { name: 'DOCKER_REGISTRY_SERVER_USERNAME', value: acr.listCredentials().username }
        { name: 'DOCKER_REGISTRY_SERVER_PASSWORD', value: '@Microsoft.KeyVault(SecretUri=${secretAcrPassword.properties.secretUri})' }
        { name: 'NODE_ENV',                        value: environment }
        { name: 'SQL_CONNECTION_STRING',           value: '@Microsoft.KeyVault(SecretUri=${secretSqlConnStr.properties.secretUri})' }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: appInsights.properties.ConnectionString }
        { name: 'WEBSITES_PORT',                   value: '8080' }
      ]
    }
  }
}

// Grant backend App Service access to Key Vault via RBAC
resource backendKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name:  guid(keyVault.id, backendApp.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId:      backendApp.identity.principalId
    principalType:    'ServicePrincipal'
  }
}

// ── Staging deployment slot ───────────────────────────────────
resource stagingSlot 'Microsoft.Web/sites/slots@2022-09-01' = if (environment == 'production') {
  parent:   backendApp
  name:     'staging'
  location: location
  tags:     commonTags
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly:    true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${acr.properties.loginServer}/backend-api:latest'
      alwaysOn:       true
    }
  }
}

// ============================================================
//  App Service (Frontend App)
// ============================================================
resource frontendApp 'Microsoft.Web/sites@2022-09-01' = {
  name:     frontendName
  location: location
  tags:     commonTags
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId:        appServicePlan.id
    httpsOnly:           true
    siteConfig: {
      linuxFxVersion:      'DOCKER|${acr.properties.loginServer}/frontend-app:latest'
      alwaysOn:            true
      appSettings: [
        { name: 'DOCKER_REGISTRY_SERVER_URL',      value: 'https://${acr.properties.loginServer}' }
        { name: 'DOCKER_REGISTRY_SERVER_USERNAME', value: acr.listCredentials().username }
        { name: 'DOCKER_REGISTRY_SERVER_PASSWORD', value: '@Microsoft.KeyVault(SecretUri=${secretAcrPassword.properties.secretUri})' }
        { name: 'VITE_API_BASE_URL',               value: 'https://${backendApp.properties.defaultHostName}' }
      ]
    }
  }
}

// Grant frontend App Service access to Key Vault
resource frontendKvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name:  guid(keyVault.id, frontendApp.id, 'Key Vault Secrets User')
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '4633458b-17de-408a-b874-0445c86b69e6')
    principalId:      frontendApp.identity.principalId
    principalType:    'ServicePrincipal'
  }
}

// ============================================================
//  Outputs (used by pipeline for wiring)
// ============================================================
output acrLoginServer      string = acr.properties.loginServer
output backendUrl          string = 'https://${backendApp.properties.defaultHostName}'
output frontendUrl         string = 'https://${frontendApp.properties.defaultHostName}'
output sqlServerFqdn       string = sqlServer.properties.fullyQualifiedDomainName
output keyVaultName        string = keyVault.name
output appInsightsKey      string = appInsights.properties.InstrumentationKey
output backendPrincipalId  string = backendApp.identity.principalId
output frontendPrincipalId string = frontendApp.identity.principalId
