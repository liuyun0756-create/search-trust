-- V22-092 remediation: report-share rotation is a server-only operation.

begin;

revoke execute on function public.rotate_v22_report_share(
  uuid, uuid, uuid, text, timestamptz
) from anon, authenticated;

comment on function public.rotate_v22_report_share(
  uuid, uuid, uuid, text, timestamptz
) is 'Server-only rotation of a v2.2 report share; browser roles have no direct execution privilege.';

commit;
