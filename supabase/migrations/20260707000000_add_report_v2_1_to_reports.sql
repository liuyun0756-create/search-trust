alter table reports
  add column if not exists report_v2_1 jsonb null;
