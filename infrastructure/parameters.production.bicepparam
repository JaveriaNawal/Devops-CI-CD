// ============================================================
//  parameters.production.bicepparam
// ============================================================

using './main.bicep'

param environment            = 'production'
param location               = 'eastus'
param appName                = 'myapp'
param sqlAdminLogin          = 'sqladmin'
param sqlAdminPassword       = ''           // injected at deploy time
param keyVaultAdminObjectId  = 'YOUR-AAD-OBJECT-ID'   // ← replace
