// ============================================================
//  parameters.production.bicepparam
// ============================================================

using './main.bicep'

param environment            = 'production'
param location               = 'southeastasia'
param appName                = 'taskapp'
param sqlAdminLogin          = 'sqladmin'
param sqlAdminPassword       = ''           // injected at deploy time
param keyVaultAdminObjectId  = 'YOUR-AAD-OBJECT-ID'   // ← replace
