-- SearchTrust v2.2 Case API invariants.

begin;

create or replace function public.v22_case_location_key(location jsonb)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  latitude_value numeric;
  longitude_value numeric;
  country_value text;
  region_value text;
  city_value text;
  postal_value text;
  display_value text;
begin
  if jsonb_typeof(location) is distinct from 'object' then
    return null;
  end if;

  country_value := lower(regexp_replace(btrim(coalesce(location ->> 'country_code', '')), '[[:space:]]+', ' ', 'g'));
  display_value := lower(regexp_replace(btrim(coalesce(location ->> 'display_name', '')), '[[:space:]]+', ' ', 'g'));

  if country_value = '' or display_value = '' then
    return null;
  end if;

  if jsonb_typeof(location -> 'latitude') = 'number'
     and jsonb_typeof(location -> 'longitude') = 'number' then
    latitude_value := round((location ->> 'latitude')::numeric, 6);
    longitude_value := round((location ->> 'longitude')::numeric, 6);
    return 'geo:'
      || to_char(latitude_value, 'FM990.000000')
      || ':'
      || to_char(longitude_value, 'FM990.000000');
  end if;

  region_value := lower(regexp_replace(btrim(coalesce(location ->> 'region', '')), '[[:space:]]+', ' ', 'g'));
  city_value := lower(regexp_replace(btrim(coalesce(location ->> 'city', '')), '[[:space:]]+', ' ', 'g'));
  postal_value := lower(regexp_replace(btrim(coalesce(location ->> 'postal_code', '')), '[[:space:]]+', ' ', 'g'));

  return 'place:' || array_to_string(
    array[country_value, region_value, city_value, postal_value, display_value],
    '|'
  );
end;
$$;

revoke all on function public.v22_case_location_key(jsonb) from public, anon, authenticated;
grant execute on function public.v22_case_location_key(jsonb) to service_role;

alter table public.client_cases
  add column location_key text generated always as (
    public.v22_case_location_key(business_identity -> 'primary_location')
  ) stored;

create unique index uq_client_cases_user_domain_location
  on public.client_cases (user_id, normalized_domain, location_key)
  where location_key is not null;

alter table public.client_cases
  add constraint client_cases_complete_identity_consistency_check check (
    location_key is null or (
      business_identity ->> 'business_name' = business_name and
      business_identity ->> 'site_url' = site_url and
      business_identity ->> 'normalized_domain' = normalized_domain and
      business_identity ->> 'operating_model' = operating_model and
      jsonb_typeof(business_identity -> 'primary_location') = 'object'
    )
  ) not valid;

create or replace function public.enforce_v22_case_site_immutability()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.site_url is distinct from old.site_url
     or new.normalized_domain is distinct from old.normalized_domain then
    raise exception using
      errcode = '23514',
      message = 'case site_url and normalized_domain are immutable';
  end if;
  return new;
end;
$$;

create trigger enforce_client_case_site_immutability
before update of site_url, normalized_domain on public.client_cases
for each row execute function public.enforce_v22_case_site_immutability();

comment on function public.v22_case_location_key(jsonb) is
  'Builds the canonical v2.2 Location identity key from a normalized primary_location object.';
comment on column public.client_cases.location_key is
  'Server-internal generated Location identity; never exposed by the Case API.';
comment on index public.uq_client_cases_user_domain_location is
  'Prevents duplicate active or archived Cases for the same user, domain and normalized Location.';

commit;
