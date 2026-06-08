-- subscriptions
create table public.subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  status      text not null default 'active' check (status in ('active','cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id)
);
create index subscriptions_status_idx on public.subscriptions (status);

-- reports
create table public.reports (
  id           uuid primary key default gen_random_uuid(),
  report_date  date not null unique,
  title        text not null,
  content_md   text not null,
  content_html text,
  model        text not null,
  status       text not null default 'ready' check (status in ('ready','sent')),
  created_at   timestamptz not null default now()
);
create index reports_date_desc_idx on public.reports (report_date desc);

-- report_deliveries
create table public.report_deliveries (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid not null references public.reports(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  status      text not null check (status in ('sent','failed')),
  error       text,
  created_at  timestamptz not null default now(),
  unique (report_id, user_id)
);
create index report_deliveries_report_idx on public.report_deliveries (report_id);

-- RLS
alter table public.subscriptions enable row level security;
alter table public.reports enable row level security;
alter table public.report_deliveries enable row level security;

-- subscriptions: users can only read/write their own row
create policy subscriptions_select_own on public.subscriptions
  for select using (user_id = auth.uid());
create policy subscriptions_insert_own on public.subscriptions
  for insert with check (user_id = auth.uid());
create policy subscriptions_update_own on public.subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy subscriptions_delete_own on public.subscriptions
  for delete using (user_id = auth.uid());

-- reports: only logged-in users with an active subscription may read; no write policy (admin client bypasses RLS)
create policy reports_select_subscribed on public.reports
  for select using (
    exists (
      select 1 from public.subscriptions s
      where s.user_id = auth.uid() and s.status = 'active'
    )
  );

-- report_deliveries: no client policy at all (default deny)
