-- reports: add language, switch unique key from (report_date) to (report_date, lang)
alter table public.reports
  add column lang text not null default 'zh' check (lang in ('zh','en'));

alter table public.reports drop constraint reports_report_date_key;

alter table public.reports
  add constraint reports_date_lang_key unique (report_date, lang);

-- subscriptions: add preferred email language
alter table public.subscriptions
  add column lang text not null default 'zh' check (lang in ('zh','en'));
