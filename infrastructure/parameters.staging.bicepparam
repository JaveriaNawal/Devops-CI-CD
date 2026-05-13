// ============================================================
//  parameters.staging.bicepparam
//  Parameter values for the staging environment deployment.
//  NOTE: sensitive values are supplied at deploy time via
//        --parameters sqlAdminPassword=$SECRET
// ============================================================

using './main.bicep'

param environment            = 'staging'
param location               = 'southeastasia'
param appName                = 'taskapp'
param sqlAdminLogin          = 'sqladmin'
param sqlAdminPassword       = ''           // injected at deploy time
param keyVaultAdminObjectId  = '9131282d-a5d6-4de0-9457-9b86c1b14c4f'
