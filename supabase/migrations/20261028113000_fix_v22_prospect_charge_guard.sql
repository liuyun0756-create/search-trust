begin;

-- Prospect reservations run as service_role. The shared review guard reads an
-- intentionally private review table, so it must execute with its owner's
-- privileges rather than requiring direct table access from every caller.
-- Its body remains case-scoped and all referenced tables are schema-qualified.
alter function public.guard_v22_review_parallel_charge() security definer;
alter function public.guard_v22_review_parallel_charge() set search_path = public;
revoke all on function public.guard_v22_review_parallel_charge()
  from public, anon, authenticated, service_role;

comment on function public.guard_v22_review_parallel_charge() is
  'Internal charge trigger: preserves review overlap protection without exposing private review requests to service-role callers.';

commit;
