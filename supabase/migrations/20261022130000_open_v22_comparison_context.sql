begin;
-- Metadata only; new checks still resolve/validate full inputs in the backend.
create function public.get_v22_comparison_context(p_user_id uuid,p_case_id uuid,p_report_id uuid,p_delivery_revision_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare implementation jsonb; sources jsonb; history jsonb;
begin
  perform public.v22_comparison_owner(p_user_id,p_case_id);
  perform public.v22_implementation_source(p_user_id,p_case_id,p_report_id,p_delivery_revision_id);
  select jsonb_build_object('id',r.id,'revision',r.revision,'checksum',r.checksum) into implementation
    from public.capability_implementation_records r where r.user_id=p_user_id and r.case_id=p_case_id
      and r.report_id=p_report_id and r.delivery_revision_id=p_delivery_revision_id order by r.revision desc limit 1;
  select coalesce(jsonb_agg(row_data order by fetched_at desc,id),'[]'::jsonb) into sources from (
    select s.id,s.fetched_at,jsonb_build_object('id',s.id,'source',s.source_type,'resource',b.external_resource_id,
      'coverage_start',s.coverage_start,'coverage_end',s.coverage_end,
      'fetched_at',to_char(s.fetched_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'expires_at',to_char(s.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'current_eligible',s.expires_at>clock_timestamp() and b.health_status=s.health_status and b.health_reasons=s.health_reasons
        and not exists(select 1 from public.data_snapshots newer where newer.binding_id=s.binding_id and (newer.fetched_at,newer.id)>(s.fetched_at,s.id))) row_data
    from public.data_snapshots s join public.case_source_bindings b on b.id=s.binding_id
    join public.google_connections g on g.id=b.connection_id
    where s.case_id=p_case_id and b.case_id=p_case_id and g.user_id=p_user_id and g.status='active'
      and b.is_active and b.identity_match_status='matched' and b.confirmed_by_user_id=p_user_id and b.confirmed_at<=clock_timestamp()
      and s.source_type in ('gsc','ga4') and b.source_type=s.source_type and s.schema_version=s.source_type||'_sync_v1'
      and (case s.source_type when 'gsc' then 'https://www.googleapis.com/auth/webmasters.readonly' else 'https://www.googleapis.com/auth/analytics.readonly' end)=any(g.granted_scopes)
      and s.provider_request_context->>'external_resource_id'=b.external_resource_id and s.normalized_payload->>'resource_id'=b.external_resource_id
      and s.fetched_at<=clock_timestamp() and s.expires_at is not null and s.coverage_start is not null and s.coverage_end is not null
      and s.health_status in ('healthy','unhealthy') and s.retention_policy='standard' and s.raw_payload is null
    order by s.fetched_at desc,s.id limit 50
  ) candidate;
  select coalesce(jsonb_agg(row_data order by frozen_at desc,id),'[]'::jsonb) into history from (
    select c.id,c.frozen_at,jsonb_build_object('id',c.id,'implementation',c.selection->'implementation','action_id',c.selection->'action_id',
      'days',c.selection->'days','source',c.selection#>'{scope,source}','state',c.result->'state','evaluated_at',c.result->'evaluated_at') row_data
    from public.capability_comparisons c join public.capability_implementation_records r
      on r.id=c.implementation_id and r.revision=c.implementation_revision
    where c.user_id=p_user_id and c.case_id=p_case_id and r.report_id=p_report_id and r.delivery_revision_id=p_delivery_revision_id
    order by c.frozen_at desc,c.id limit 20
  ) saved;
  return jsonb_build_object('schema_version','v22_comparison_context_v1','case_id',p_case_id,'report_id',p_report_id,
    'delivery_revision_id',p_delivery_revision_id,'implementation',implementation,'sources',sources,'history',history);
end; $$;
revoke all on function public.get_v22_comparison_context(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_v22_comparison_context(uuid,uuid,uuid,uuid) to service_role;
commit;
