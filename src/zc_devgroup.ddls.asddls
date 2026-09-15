@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'Developer Group - Consumption View'
@Metadata.ignorePropagatedAnnotations: true
define root view entity ZC_DevGroup provider contract transactional_query as projection on ZI_DevGroup
{


  key Scheme,
  key BorrowerGroup,
      BorrowerGroupName,
      ProjectsCY,
      ProjectCostCY,
      DisbursementCY,
      GrossSanctionCY,
      NetSanctionCY,
      PrincipalOsCY,
      ProjectsPY,
      ProjectCostPY,
      DisbursementPY,
      GrossSanctionPY,
      NetSanctionPY,
      PrincipalOsPY,
      ProjectsVar,
      DisbursementVar,
      GrossSanctionVar,
      ProjectsVarPct
}
