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
param keyVaultAdminObjectId  = 'YOUR-AAD-OBJECT-ID'   // ← replace
