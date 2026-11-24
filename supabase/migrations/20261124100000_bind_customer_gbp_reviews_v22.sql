-- P1-02 phase 2. Rollback uses the matching definition and constraint checks in supabase/rollbacks.
begin;

-- The source and metrics are checked independently of the Python worker.
create function public.validate_v22_customer_review_sample(snapshot jsonb, manifest jsonb, selected_branch text)
returns void language plpgsql stable set search_path=public as $review$
declare s jsonb=snapshot->'review_sample'; sample_time timestamptz;
begin
 if snapshot->>'schema_version' is distinct from 'customer_public_gbp_snapshot_v3'
   or snapshot->>'identity_match_status' is distinct from 'matched'
   or snapshot->>'collection_status' is distinct from 'succeeded'
   or manifest#>>'{identity_inheritance,branch}' is distinct from 'retained'
   or nullif(selected_branch,'') is null or s->>'branch_ref' is distinct from selected_branch
   or not exists (select 1 from jsonb_array_elements(snapshot#>'{record,observed_entity_keys}') o
      join jsonb_array_elements(snapshot#>'{request_target,entity_keys}') t on t->>'kind'=o->>'kind'
      where o->>'kind' in ('cid','place_id') and o->>'value'=selected_branch and t->>'value'=selected_branch)
   or exists (select 1 from jsonb_array_elements(snapshot#>'{record,observed_entity_keys}') o
      join jsonb_array_elements(snapshot#>'{request_target,entity_keys}') t on t->>'kind'=o->>'kind'
      where o->>'value' is distinct from t->>'value')
   or ((s->>'data_id') is not null and exists (select 1
      from jsonb_array_elements(snapshot#>'{record,observed_entity_keys}') o
      where o->>'kind'='data_id' and o->>'value' is distinct from s->>'data_id'))
   or (s->>'data_id' is not null and s->>'data_id' !~ '^0x[0-9a-fA-F]+:0x[0-9a-fA-F]+$')
   or jsonb_typeof(s) is distinct from 'object'
   or not (s ?& array['branch_ref','data_id','pages','reviews','sampled_at','completed_at','stop','invalid_records','discarded_recent_or_invalid'])
   or s-array['branch_ref','data_id','pages','reviews','sampled_at','completed_at','stop','invalid_records','discarded_recent_or_invalid'] <> '{}'::jsonb
   or jsonb_typeof(s->'pages') is distinct from 'array' or jsonb_typeof(s->'reviews') is distinct from 'array'
   or jsonb_array_length(s->'pages')>4 or jsonb_array_length(s->'reviews')>30
   or coalesce(s->>'stop','') not in ('natural_end','sample_cap','page_cap','provider_failure','branch_unavailable','invalid_pagination','budget')
   or jsonb_typeof(s->'invalid_records') is distinct from 'number' or coalesce(s->>'invalid_records','') !~ '^[0-9]+$'
   or (s->>'invalid_records')::numeric>400 or jsonb_typeof(s->'discarded_recent_or_invalid') is distinct from 'boolean'
   or nullif(s->>'completed_at','') is null or (s->>'completed_at')::timestamptz>(manifest->>'evaluated_at')::timestamptz
 then raise exception 'CAPABILITY_CUSTOMER_REVIEWS_BINDING_INVALID'; end if;

 sample_time=(s->>'sampled_at')::timestamptz;
 if sample_time is distinct from (s#>>'{pages,0,sampled_at}')::timestamptz
   or (sample_time is not null and (sample_time<(manifest#>>'{identity_inheritance,confirmed_at}')::timestamptz
       or s->>'data_id' is null))
   or (s->>'stop'='natural_end' and (jsonb_array_length(s->'pages')=0 or (s->'pages'->-1)->>'has_next' is distinct from 'false'))
   or (s->>'stop'='sample_cap' and jsonb_array_length(s->'reviews')<>30)
   or (s->>'stop'='page_cap' and jsonb_array_length(s->'pages')<>4)
   or exists (select 1 from jsonb_array_elements(s->'pages') with ordinality t(p,i)
       where jsonb_typeof(p) is distinct from 'object'
        or not(p ?& array['sampled_at','response_checksum','sort_verified','has_next','returned'])
        or p-array['sampled_at','response_checksum','sort_verified','has_next','returned'] <> '{}'::jsonb
        or coalesce(p->>'response_checksum','') !~ '^sha256:[a-f0-9]{64}$'
        or jsonb_typeof(p->'sort_verified') is distinct from 'boolean'
        or jsonb_typeof(p->'has_next') is distinct from 'boolean'
        or (i<jsonb_array_length(s->'pages') and p->>'has_next' is distinct from 'true')
        or jsonb_typeof(p->'returned') is distinct from 'number' or coalesce(p->>'returned','') !~ '^[0-9]+$'
        or (p->>'returned')::numeric>100 or (p->>'sampled_at')::timestamptz is null
        or (p->>'sampled_at')::timestamptz>(s->>'completed_at')::timestamptz)
   or jsonb_array_length(s->'reviews')>(select coalesce(sum((p->>'returned')::int),0) from jsonb_array_elements(s->'pages') p)
   or jsonb_array_length(s->'reviews')<>(select count(distinct r->>'id') from jsonb_array_elements(s->'reviews') r)
   or exists (select 1 from jsonb_array_elements(s->'reviews') r
       where jsonb_typeof(r) is distinct from 'object' or not(r ?& array['id','provider_id','iso_date','reply_state'])
         or r-array['id','provider_id','iso_date','reply_state'] <> '{}'::jsonb
         or coalesce(r->>'id','') !~ '^[0-9a-f]{64}$'
         or jsonb_typeof(r->'provider_id') is distinct from 'boolean'
         or jsonb_typeof(r->'iso_date') not in ('null','string')
         or coalesce(r->>'reply_state','') not in ('visible','not_visible','unknown'))
 then raise exception 'CAPABILITY_CUSTOMER_REVIEWS_BINDING_INVALID'; end if;
end $review$;

create function public.validate_v22_customer_review_metric(customer jsonb, customer_id text,
    profile_at timestamptz, field text, m jsonb)
returns void language plpgsql stable set search_path=public as $review$
declare s jsonb=customer->'review_sample'; t timestamptz=(s->>'sampled_at')::timestamptz;
  status text='not_checked'; reason text; v jsonb='null'; latest timestamptz; observation_at timestamptz;
  dates_invalid boolean; recent integer; n integer; reply_known integer; reply_visible integer;
  exact_count boolean=false; lower_bound boolean=false; numerator integer; denominator integer;
begin
 reason=case when s->>'stop'='branch_unavailable' then 'identity_unresolved' else 'no_review_sample' end;
 select count(*), count(*) filter(where x->>'reply_state'<>'unknown'), count(*) filter(where x->>'reply_state'='visible'),
   coalesce(bool_or(x->>'iso_date' is null or (x->>'iso_date')::timestamptz>t),false),
   count(*) filter(where (x->>'iso_date')::timestamptz between t-interval '90 days' and t),
   max((x->>'iso_date')::timestamptz)
 into n,reply_known,reply_visible,dates_invalid,recent,latest
 from jsonb_array_elements(s->'reviews') x;
 if n=0 and customer#>>'{record,fields,review_count,state}'='observed'
     and customer#>'{record,fields,review_count,value}'='0'::jsonb then
  if field='reviews_90d' then status='observed';reason='saved_value';v='0';observation_at=coalesce(t,profile_at);
  else status='not_applicable';reason='no_reviews';end if;
 elsif n>0 then
  if field='visible_replies' and reply_known>0 then
   status='observed';reason='saved_value';observation_at=t;numerator=reply_visible;denominator=reply_known;
   if jsonb_typeof(m->'value') is distinct from 'number' or
      abs((m->>'value')::double precision-reply_visible::double precision/reply_known)>1e-12
   then raise exception 'CAPABILITY_CUSTOMER_REVIEWS_VALUE_INVALID'; end if;
   v=m->'value';
  elsif field in ('latest_review','reviews_90d') then
   if dates_invalid or t is null then reason='date_unavailable';
   else
    status='observed';reason='saved_value';observation_at=t;
    if field='latest_review' then
     if (m->>'value')::timestamptz is distinct from latest then raise exception 'CAPABILITY_CUSTOMER_REVIEWS_VALUE_INVALID'; end if;
     v=m->'value';
    else
     exact_count=s->>'stop' in ('natural_end','sample_cap','page_cap') and (s->>'invalid_records')::int=0
       and s->>'discarded_recent_or_invalid'='false'
       and not exists (select 1 from jsonb_array_elements(s->'pages') p where p->>'sort_verified' is distinct from 'true')
       and not exists (select 1 from jsonb_array_elements(s->'reviews') r where r->>'provider_id' is distinct from 'true')
       and not exists (select 1 from (select (x->>'iso_date')::timestamptz d,
         lag((x->>'iso_date')::timestamptz) over(order by i) as previous
         from jsonb_array_elements(s->'reviews') with ordinality q(x,i)) q where q.previous<q.d)
       and (s->>'stop'='natural_end' or ((s->'reviews'->-1)->>'iso_date')::timestamptz<t-interval '90 days');
     v=to_jsonb(recent);lower_bound=not exact_count;
     if lower_bound then reason='sample_lower_bound';end if;
    end if;
   end if;
  end if;
 end if;
 if m->>'status' is distinct from status or m->>'reason' is distinct from reason or m->'value' is distinct from v
    or m->'lower_bound' is distinct from to_jsonb(lower_bound)
    or m->'numerator' is distinct from coalesce(to_jsonb(numerator),'null'::jsonb)
    or m->'denominator' is distinct from coalesce(to_jsonb(denominator),'null'::jsonb)
    or (m->>'sampled_at')::timestamptz is distinct from observation_at
    or m->'source_refs' is distinct from jsonb_build_array(customer_id||':/payload/review_sample')
 then raise exception 'CAPABILITY_CUSTOMER_REVIEWS_VALUE_INVALID';end if;
end $review$;

revoke all on function public.validate_v22_customer_review_sample(jsonb,jsonb,text),
  public.validate_v22_customer_review_metric(jsonb,text,timestamptz,text,jsonb) from public,anon,authenticated;
grant execute on function public.validate_v22_customer_review_sample(jsonb,jsonb,text),
  public.validate_v22_customer_review_metric(jsonb,text,timestamptz,text,jsonb) to service_role;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure;
 if md5(source)<>'6edb7a3fb074a371044bb09c7dca2506' or md5(definition)<>'4288d622a353b963ac040f5277b4230e' then raise exception 'P102_BASELINE_MISMATCH_check_v22_acquisition_preparation_binding'; end if;
 old := $patch$new.payload->>'ruleset_version'='v22_capability_public_v21'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,old,$patch$new.payload->>'ruleset_version' in ('v22_capability_public_v21','v22_capability_public_v22')$patch$);
 old := $patch$m.payload->>'ruleset_version'='v22_capability_public_v21'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,old,$patch$m.payload->>'ruleset_version' in ('v22_capability_public_v21','v22_capability_public_v22')$patch$);
 old := $patch$'v22_capability_public_v21'),false)$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_check_v22_acquisition_preparation_binding'; end if;
 definition := replace(definition,old,$patch$'v22_capability_public_v21','v22_capability_public_v22'),false)$patch$);
 if md5(definition)<>'d2486fc3b18a7c2961b7b25497b4f87f' then raise exception 'P102_TARGET_MISMATCH_check_v22_acquisition_preparation_binding'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.check_v22_acquisition_preparation_binding()'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'b8c9ddac4303d436dfd91298067ba5ed')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_check_v22_acquisition_preparation_binding';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure;
 if md5(source)<>'38fa04c7fbfaeed6717ca885e0bbc47e' or md5(definition)<>'a4740fc94671d835351a1ce23549e339' then raise exception 'P102_BASELINE_MISMATCH_enforce_v22_delivery_prerequisites'; end if;
 old := $patch$'2.2.16')$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_enforce_v22_delivery_prerequisites'; end if;
 definition := replace(definition,old,$patch$'2.2.16','2.2.17')$patch$);
 if md5(definition)<>'16978eaaf5bf35d8cbfc63e8924c8523' then raise exception 'P102_TARGET_MISMATCH_enforce_v22_delivery_prerequisites'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.enforce_v22_delivery_prerequisites()'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'5e996b873d4715831777df5be4e1399a')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_enforce_v22_delivery_prerequisites';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure;
 if md5(source)<>'b570b42a415e852ebf420210d3f80ff6' or md5(definition)<>'7f26b20183e9672aa0723062f9420291' then raise exception 'P102_BASELINE_MISMATCH_freeze_v22_analysis_manifest'; end if;
 old := $patch$        when source->>'schema_version'='customer_public_gbp_snapshot_v2'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_freeze_v22_analysis_manifest'; end if;
 definition := replace(definition,old,$patch$        when p_manifest->>'ruleset_version'='v22_capability_public_v22'
        then 'customer_public_gbp_snapshot_v3'
        when source->>'schema_version'='customer_public_gbp_snapshot_v2'$patch$);
 if md5(definition)<>'8a73e0e6b841a04d6f44e3aecea41248' then raise exception 'P102_TARGET_MISMATCH_freeze_v22_analysis_manifest'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.freeze_v22_analysis_manifest(uuid,uuid,uuid,jsonb,text,text)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'21b652dffff62bbc234450c19fd703cc')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_freeze_v22_analysis_manifest';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure;
 if md5(source)<>'877ea62bdcc7322363938e4f5d9b6e8d' or md5(definition)<>'c3b9f2f829513e4466215cb2d3f44920' then raise exception 'P102_BASELINE_MISMATCH_get_v22_completed_plan_source'; end if;
 old := $patch$'2.2.16')$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_get_v22_completed_plan_source'; end if;
 definition := replace(definition,old,$patch$'2.2.16','2.2.17')$patch$);
 if md5(definition)<>'b32a1cba1877e1902463785b8f20e133' then raise exception 'P102_TARGET_MISMATCH_get_v22_completed_plan_source'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.get_v22_completed_plan_source(uuid,uuid,uuid)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'cfd75d927271ddf2167ee3d232b24080')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_get_v22_completed_plan_source';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure;
 if md5(source)<>'e0b6181f3aee5ac5dbe721bf12247112' or md5(definition)<>'9b20332a342669a8d367b1c887956d21' then raise exception 'P102_BASELINE_MISMATCH_list_v22_completed_capability_reports'; end if;
 old := $patch$'2.2.16')$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_list_v22_completed_capability_reports'; end if;
 definition := replace(definition,old,$patch$'2.2.16','2.2.17')$patch$);
 if md5(definition)<>'de05e6e93b8eca70f0fc60fb61313a9a' then raise exception 'P102_TARGET_MISMATCH_list_v22_completed_capability_reports'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.list_v22_completed_capability_reports(uuid)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'73b3bbd5d26d4bc69fa597e6306b7e23')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_list_v22_completed_capability_reports';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure;
 if md5(source)<>'4639d97f0df2dcbe623d258143cf1bea' or md5(definition)<>'5902b9597dd7230ea4d3e03db1670553' then raise exception 'P102_BASELINE_MISMATCH_prepare_v22_capability_analysis_input_core'; end if;
 old := $patch$or (a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21' and exists$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,old,$patch$or (((a3_shape ? 'identity_inheritance' and a3_shape->>'ruleset_version'='v22_capability_public_v21')
        or p_manifest->>'ruleset_version'='v22_capability_public_v22') and exists$patch$);
 old := $patch$    insert into public.data_snapshots(id,case_id$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_prepare_v22_capability_analysis_input_core'; end if;
 definition := replace(definition,old,$patch$    if kind='public_gbp' and p_manifest->>'ruleset_version'='v22_capability_public_v22' then
      perform public.validate_v22_customer_review_sample(src->'payload',p_manifest,pub#>>'{business_identity,selected_branch_ref}');
    end if;
    insert into public.data_snapshots(id,case_id$patch$);
 if md5(definition)<>'86f2ed577f195ea4ec8c490ea29c5636' then raise exception 'P102_TARGET_MISMATCH_prepare_v22_capability_analysis_input_core'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.prepare_v22_capability_analysis_input_core(uuid,uuid,uuid,jsonb,text,jsonb,text,jsonb,text,integer)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'95c5c5815ff5a6977f158feeac96c878')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_prepare_v22_capability_analysis_input_core';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure;
 if md5(source)<>'38b98afa2a148d6c6cbbca7e262414ae' or md5(definition)<>'7e68875ac1eeec348c3e1d906312b014' then raise exception 'P102_BASELINE_MISMATCH_save_v22_report_content_revision'; end if;
 old := $patch$'2.2.16')$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_save_v22_report_content_revision'; end if;
 definition := replace(definition,old,$patch$'2.2.16','2.2.17')$patch$);
 if md5(definition)<>'d032a96b89e46f88b3bbab43d74d9a24' then raise exception 'P102_TARGET_MISMATCH_save_v22_report_content_revision'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.save_v22_report_content_revision(uuid,uuid,uuid,jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'bae42543b0061e36b130280b78adeba4')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_save_v22_report_content_revision';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)'::regprocedure;
 if md5(source)<>'fbb82903e09e0b47d95cfe38bff0fcc7' or md5(definition)<>'58366933c7bd8fd9435f0e6d8b05cbc6' then raise exception 'P102_BASELINE_MISMATCH_start_v22_verified_analysis_legacy_financial_bridge'; end if;
 old := $patch$'customer_public_gbp_snapshot_v1','customer_public_gbp_snapshot_v2')$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_start_v22_verified_analysis_legacy_financial_bridge'; end if;
 definition := replace(definition,old,$patch$'customer_public_gbp_snapshot_v1','customer_public_gbp_snapshot_v2','customer_public_gbp_snapshot_v3')$patch$);
 if md5(definition)<>'4c05385cf794e527693a5bf1c68cbb85' then raise exception 'P102_TARGET_MISMATCH_start_v22_verified_analysis_legacy_financial_bridge'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.start_v22_verified_analysis_legacy_financial_bridge(uuid,uuid,uuid,text,text,uuid,uuid)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'91aa1715a552765638ea3b410c79468a')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_start_v22_verified_analysis_legacy_financial_bridge';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure;
 if md5(source)<>'5cf5e7bd11e77a91dc871033a466b81b' or md5(definition)<>'9a6b53b668e38d18dc61b38435ba0bc7' then raise exception 'P102_BASELINE_MISMATCH_store_v22_capability_report'; end if;
 old := $patch$'2.2.16')$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,old,$patch$'2.2.16','2.2.17')$patch$);
 old := $patch$case when manifest.payload->>'ruleset_version'='v22_capability_public_v21' then '2.2.16'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,old,$patch$case when manifest.payload->>'ruleset_version'='v22_capability_public_v22' then '2.2.17' when manifest.payload->>'ruleset_version'='v22_capability_public_v21' then '2.2.16'$patch$);
 old := $patch$'v22_capability_public_v21')$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_store_v22_capability_report'; end if;
 definition := replace(definition,old,$patch$'v22_capability_public_v21','v22_capability_public_v22')$patch$);
 if md5(definition)<>'9fb6881aa61bec49015c6f38114b0d8f' then raise exception 'P102_TARGET_MISMATCH_store_v22_capability_report'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.store_v22_capability_report(uuid,uuid,uuid,jsonb,text,integer)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'06d3d0d1b6d85a7e9ac13f097f3a5ead')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_store_v22_capability_report';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.v22_a3_manifest_shape(jsonb)'::regprocedure;
 if md5(source)<>'0b0e5c86c8766ff7430d5ec9caf809d3' or md5(definition)<>'30a3d88907d1394fdf17f94ade2d1e2f' then raise exception 'P102_BASELINE_MISMATCH_v22_a3_manifest_shape'; end if;
 old := $patch$m->>'schema_version' is distinct from 'v22_analysis_input_v11' and m->>'ruleset_version' is distinct from 'v22_capability_public_v21'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_v22_a3_manifest_shape'; end if;
 definition := replace(definition,old,$patch$coalesce(m->>'schema_version','') not in ('v22_analysis_input_v11','v22_analysis_input_v12') and coalesce(m->>'ruleset_version','') not in ('v22_capability_public_v21','v22_capability_public_v22')$patch$);
 old := $patch$m->>'schema_version' is distinct from 'v22_analysis_input_v11' or m->>'ruleset_version' is distinct from 'v22_capability_public_v21'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_v22_a3_manifest_shape'; end if;
 definition := replace(definition,old,$patch$coalesce(m->>'schema_version','') not in ('v22_analysis_input_v11','v22_analysis_input_v12') or coalesce(m->>'ruleset_version','') not in ('v22_capability_public_v21','v22_capability_public_v22')
   or (m->>'schema_version'='v22_analysis_input_v12') is distinct from (m->>'ruleset_version'='v22_capability_public_v22')
   or (m->>'ruleset_version'='v22_capability_public_v22' and (
     coalesce(proof->>'branch','')<>'retained' or coalesce(ruleset,'') in ('','v22_capability_public_v13','v22_capability_public_v14')
     or not exists(select 1 from jsonb_array_elements(m->'snapshots') s
                   where s->>'source_kind'='public_gbp' and s->>'schema_version'='customer_public_gbp_snapshot_v3')))$patch$);
 if md5(definition)<>'4b2b6fccd5ad492ea71d2fdd41c064d7' then raise exception 'P102_TARGET_MISMATCH_v22_a3_manifest_shape'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.v22_a3_manifest_shape(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'5da9618d0d5796cc9f37ba0c99e8f14b')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_v22_a3_manifest_shape';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.v22_a3_report_shape(jsonb)'::regprocedure;
 if md5(source)<>'3a783fc8d5dbe0c59941b4974b14b3b3' or md5(definition)<>'fdc05e39ee9be73c617b0b2f6062640b' then raise exception 'P102_BASELINE_MISMATCH_v22_a3_report_shape'; end if;
 old := $patch$if coalesce(p->>'schema_version'='2.2.16',false) is distinct from
    (coalesce(p#>>'{input_manifest,ruleset_version}','')='v22_capability_public_v21') then$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_v22_a3_report_shape'; end if;
 definition := replace(definition,old,$patch$if (coalesce(p->>'schema_version'='2.2.16',false) is distinct from
    (coalesce(p#>>'{input_manifest,ruleset_version}','')='v22_capability_public_v21'))
    or (coalesce(p->>'schema_version'='2.2.17',false) is distinct from
    (coalesce(p#>>'{input_manifest,ruleset_version}','')='v22_capability_public_v22')) then$patch$);
 old := $patch$if p->>'schema_version' is distinct from '2.2.16' then return p; end if;$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_v22_a3_report_shape'; end if;
 definition := replace(definition,old,$patch$if coalesce(p->>'schema_version','') not in ('2.2.16','2.2.17') then return p; end if;$patch$);
 if md5(definition)<>'71651369f909486795bf207f1cf7a2fe' then raise exception 'P102_TARGET_MISMATCH_v22_a3_report_shape'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.v22_a3_report_shape(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'fbf8ca15345158e603c0f86b99244f0e')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_v22_a3_report_shape';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure;
 if md5(source)<>'0c8ef85809288363c25b47bc8ae303d5' or md5(definition)<>'7b0379ddc64e732f7d783f032e109469' then raise exception 'P102_BASELINE_MISMATCH_validate_v22_gbp_comparison'; end if;
 old := $patch$declare m jsonb; v jsonb=p->'gbp_comparison';$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,old,$patch$declare m jsonb; review_version boolean=coalesce(p->>'schema_version'='2.2.17',false); v jsonb=p->'gbp_comparison';$patch$);
 old := $patch$v->>'schema_version' is distinct from 'gbp_comparison_v1'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,old,$patch$v->>'schema_version' is distinct from (case when review_version then 'gbp_comparison_v2' else 'gbp_comparison_v1' end)$patch$);
 old := $patch$   if idx=0 and field in ('reviews_90d','latest_review','visible_replies') then$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,old,$patch$   if review_version and idx=0 and field in ('reviews_90d','latest_review','visible_replies') then
    perform public.validate_v22_customer_review_metric(customer,customer_id,customer_time,field,item);
    continue;
   end if;
   if idx=0 and field in ('reviews_90d','latest_review','visible_replies') then$patch$);
 old := $patch$if field not in ('categories','rating','review_count') or item->>'status' is distinct from 'observed'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,old,$patch$if (field not in ('categories','rating','review_count') and not (review_version and field in ('reviews_90d','latest_review'))) or item->>'status' is distinct from 'observed'$patch$);
 old := $patch$or other->>'lower_bound' is distinct from 'false' or item->>'lower_bound' is distinct from 'false' then$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,old,$patch$or ((not review_version or field<>'reviews_90d') and (other->>'lower_bound' is distinct from 'false' or item->>'lower_bound' is distinct from 'false')) then$patch$);
 old := $patch$    if field<>'categories' and not ((d->>'direction'='higher' and (other->>'value')::numeric>(item->>'value')::numeric)
       or (d->>'direction'='lower' and (other->>'value')::numeric<(item->>'value')::numeric)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_gbp_comparison'; end if;
 definition := replace(definition,old,$patch$    if review_version and field='latest_review' then
     if not ((d->>'direction'='higher' and (other->>'value')::timestamptz>(item->>'value')::timestamptz)
       or (d->>'direction'='lower' and (other->>'value')::timestamptz<(item->>'value')::timestamptz)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    elsif review_version and field='reviews_90d' then
     if not ((d->>'direction'='higher' and item->>'lower_bound'='false' and (other->>'value')::numeric>(item->>'value')::numeric)
       or (d->>'direction'='lower' and other->>'lower_bound'='false' and (other->>'value')::numeric<(item->>'value')::numeric)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;
    elsif field<>'categories' and not ((d->>'direction'='higher' and (other->>'value')::numeric>(item->>'value')::numeric)
       or (d->>'direction'='lower' and (other->>'value')::numeric<(item->>'value')::numeric)) then raise exception 'CAPABILITY_GBP_COMPARISON_VALUE_INVALID'; end if;$patch$);
 if md5(definition)<>'45b51b2493d35b5f21e0f765a1b0defa' then raise exception 'P102_TARGET_MISMATCH_validate_v22_gbp_comparison'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_gbp_comparison(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'48f876bc969beb47c77784dcd5c91707')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_validate_v22_gbp_comparison';end if;
end $migration$;

do $migration$
declare definition text; old text; prior_acl aclitem[]; source text;
begin
 select pg_get_functiondef(oid),prosrc,proacl into strict definition,source,prior_acl from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure;
 if md5(source)<>'e5ed327182dbab4779f652dff4cd4d2c' or md5(definition)<>'3291d74a000c8ff0139faf0c10cc54fe' then raise exception 'P102_BASELINE_MISMATCH_validate_v22_possible_reasons'; end if;
 old := $patch$declare m jsonb; g jsonb=p->'gbp_comparison';$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_possible_reasons'; end if;
 definition := replace(definition,old,$patch$declare m jsonb; g jsonb=p->'gbp_comparison'; original_report jsonb=p;
 review_version boolean=coalesce(p->>'schema_version'='2.2.17',false); dates text;$patch$);
 old := $patch$perform public.validate_v22_gbp_comparison(p);$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_possible_reasons'; end if;
 definition := replace(definition,old,$patch$perform public.validate_v22_gbp_comparison(case when review_version then original_report else p end);$patch$);
 old := $patch$ wanted=jsonb_build_object('schema_version','possible_reasons_v1'$patch$;
 if position(old in definition)=0 then raise exception 'P102_TARGET_MISSING_validate_v22_possible_reasons'; end if;
 definition := replace(definition,old,$patch$ if review_version and g#>>'{differences,3,direction}'='higher' and g#>>'{differences,4,direction}'='higher' then
  select to_jsonb(array_agg(x::int order by x::int)) into indices
   from jsonb_array_elements_text(g#>'{differences,3,competitor_indices}') x
   where (g#>'{differences,4,competitor_indices}') @> jsonb_build_array(x::int);
  if jsonb_array_length(indices)>=2 then
   refs=jsonb_build_array('/gbp_comparison/differences/3','/gbp_comparison/differences/4');
   foreach metric in array array['reviews_90d','latest_review'] loop
    refs=refs||(g#>array['rows','0','metrics',metric,'source_refs']);
    for i in select value::int from jsonb_array_elements_text(indices) loop
     refs=refs||(g#>array['rows',i::text,'metrics',metric,'source_refs']);
    end loop;
   end loop;
   nums='';dates='';
   for i in select value::int from jsonb_array_elements_text(indices) loop
    nums=concat_ws(', ',nullif(nums,''),(case when g#>>array['rows',i::text,'metrics','reviews_90d','lower_bound']='true' then 'at least ' else '' end)
       ||trim_scale((g#>>array['rows',i::text,'metrics','reviews_90d','value'])::numeric)::text);
    dates=concat_ws(', ',nullif(dates,''),left(g#>>array['rows',i::text,'metrics','latest_review','value'],10));
   end loop;
   item=jsonb_build_object('metric','recent_review_activity','classification','inference','basis_refs',refs,'competitor_indices',indices,'customer_text',
     'Sample competitors had '||nums||' reviews in their 90-day windows and sample latest dates of '||dates||'. Your profile had '
     ||trim_scale((g#>>'{rows,0,metrics,reviews_90d,value}')::numeric)::text||' reviews in its sampled 90-day window and a sample latest date of '
     ||left(g#>>'{rows,0,metrics,latest_review,value}',10)||'. This difference may be one contributing factor. These observations do not establish ranking causation.');
   items=items||jsonb_build_array(item);
  end if;
 end if;
 wanted=jsonb_build_object('schema_version',case when review_version then 'possible_reasons_v2' else 'possible_reasons_v1' end$patch$);
 if md5(definition)<>'b41df040ff85c38df0bb2e4c1b0175b1' then raise exception 'P102_TARGET_MISMATCH_validate_v22_possible_reasons'; end if;
 execute definition;
 if exists(select 1 from pg_proc where oid='public.validate_v22_possible_reasons(jsonb)'::regprocedure and
   (proacl is distinct from prior_acl or md5(prosrc)<>'9f99a3793ae9e9cb48140167e26180b9')) then raise exception 'P102_ACL_OR_SOURCE_MISMATCH_validate_v22_possible_reasons';end if;
end $migration$;

do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_input_variant') is distinct from '821494ee70419167dc0c4d932365798f' then
  raise exception 'P102_BASELINE_MISMATCH_capability_report_input_variant';end if;
 alter table public.capability_report_versions drop constraint capability_report_input_variant;
 alter table public.capability_report_versions add constraint capability_report_input_variant CHECK ((((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text, '2.2.16'::text, '2.2.17'::text])) AND (manifest_id IS NOT NULL) AND (review_input_job_id IS NULL)) OR ((schema_version = '2.2.3'::text) AND (manifest_id IS NULL) AND (review_input_job_id IS NOT NULL) AND (review_input_job_id = id))));
end $constraint$;

do $constraint$ begin
 if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conrelid='public.capability_report_versions'::regclass and conname='capability_report_versions_schema_version_check') is distinct from 'f404d0a3e4b017594d750726cfaf6a04' then
  raise exception 'P102_BASELINE_MISMATCH_capability_report_versions_schema_version_check';end if;
 alter table public.capability_report_versions drop constraint capability_report_versions_schema_version_check;
 alter table public.capability_report_versions add constraint capability_report_versions_schema_version_check CHECK ((schema_version = ANY (ARRAY['2.2.2'::text, '2.2.3'::text, '2.2.4'::text, '2.2.5'::text, '2.2.6'::text, '2.2.7'::text, '2.2.8'::text, '2.2.9'::text, '2.2.10'::text, '2.2.11'::text, '2.2.12'::text, '2.2.13'::text, '2.2.15'::text, '2.2.16'::text, '2.2.17'::text])));
end $constraint$;

commit;
