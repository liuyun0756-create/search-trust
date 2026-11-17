-- Rollback definition; preserve original ACL.
CREATE OR REPLACE FUNCTION public.check_v22_acquisition_preparation_binding()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare prep public.capability_acquisition_preparations; m public.analysis_input_manifests; req jsonb; pub jsonb;
begin
  if TG_TABLE_NAME='analysis_input_manifests' then
    select * into prep from public.capability_acquisition_preparations where job_id=new.job_id;
    if prep.job_id is not null and (new.user_id<>prep.user_id or new.case_id<>prep.case_id
      or new.business_version_id<>prep.business_version_id or new.mode<>'acquisition') then
      raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
  else
    select * into m from public.analysis_input_manifests where id=new.manifest_id;
    select * into prep from public.capability_acquisition_preparations where job_id=m.job_id;
    if prep.job_id is not null then
      req=prep.request->'analyze_request'; pub=new.recipe->'request';
      if (case when pub#>>'{business_identity,schema_version}'='business_identity_v2' then
          not coalesce(m.payload->>'ruleset_version' in ('v22_capability_public_v13','v22_capability_public_v14'),false)
          or pub#>'{business_identity,business_name}' is distinct from req#>'{business_identity,business_name}'
          or pub#>'{business_identity,site_url}' is distinct from req#>'{business_identity,site_url}'
          or pub#>'{business_identity,normalized_domain}' is distinct from req#>'{business_identity,normalized_domain}'
          or pub#>'{business_identity,public_gbp_url}' is distinct from req#>'{business_identity,public_gbp_url}'
          or pub#>'{business_identity,country_code}' is distinct from req#>'{business_identity,primary_location,country_code}'
        else pub->'business_identity' is distinct from req->'business_identity' end)
        or pub#>'{evidence_input,context,queries}' is distinct from req->'queries'
        or pub#>'{evidence_input,context,target_market}' is distinct from req->'target_market'
        or pub#>'{evidence_input,context,competitors}' is distinct from req->'competitors' then
        raise exception 'CAPABILITY_PREPARATION_CONFLICT'; end if;
    end if;
  end if;
  return new;
end;
$function$
;
