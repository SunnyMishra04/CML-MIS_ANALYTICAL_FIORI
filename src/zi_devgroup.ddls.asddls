@AccessControl.authorizationCheck: #NOT_REQUIRED
@EndUserText.label: 'Developer Group - Interface View'
define root view entity ZI_DevGroup
  as select from zmis_devgrp
{
  key scheme                as Scheme,
  key borrower_group        as BorrowerGroup,
      borrower_group_name   as BorrowerGroupName,
      projects_cy           as ProjectsCY,
      project_cost_cy       as ProjectCostCY,
      disbursement_cy       as DisbursementCY,
      gross_sanction_cy     as GrossSanctionCY,
      net_sanction_cy       as NetSanctionCY,
      principal_os_cy       as PrincipalOsCY,
      projects_py           as ProjectsPY,
      project_cost_py       as ProjectCostPY,
      disbursement_py       as DisbursementPY,
      gross_sanction_py     as GrossSanctionPY,
      net_sanction_py       as NetSanctionPY,
      principal_os_py       as PrincipalOsPY,

      // Variance fields — computed once here, not re-computed on the frontend
      ( projects_cy - projects_py )         as ProjectsVar,
      ( disbursement_cy - disbursement_py ) as DisbursementVar,
      ( gross_sanction_cy - gross_sanction_py ) as GrossSanctionVar,

      // Example % variance — division-by-zero guarded. Repeat this pattern
      // for DisbursementVarPct and GrossSanctionVarPct yourself as practice.
      case when projects_py = 0 then 0
           else round( ( ( projects_cy - projects_py ) * 100 ) / projects_py, 2 )
      end as ProjectsVarPct
}
