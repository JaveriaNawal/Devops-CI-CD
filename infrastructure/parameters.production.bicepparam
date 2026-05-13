// ============================================================
//  parameters.production.bicepparam
// ============================================================

using './main.bicep'

param environment            = 'production'
param location               = 'southeastasia'
param appName                = 'taskapp'
param sqlAdminLogin          = 'sqladmin'
param sqlAdminPassword       = ''           // injected at deploy time
param keyVaultAdminObjectId  = '9131282d-a5d6-4de0-9457-9b86c1b14c4f'
