create or replace function public.is_admin_user()
returns boolean
language sql
stable
as $$
  select coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

alter table public.keyword_aliases enable row level security;
alter table public.ai_automation_usage enable row level security;
alter table public.instagram_feed_runs enable row level security;

drop policy if exists "Admins can read keyword aliases" on public.keyword_aliases;
create policy "Admins can read keyword aliases"
  on public.keyword_aliases
  for select
  to authenticated
  using ((select public.is_admin_user()));

drop policy if exists "Admins can insert keyword aliases" on public.keyword_aliases;
create policy "Admins can insert keyword aliases"
  on public.keyword_aliases
  for insert
  to authenticated
  with check ((select public.is_admin_user()));

drop policy if exists "Admins can update keyword aliases" on public.keyword_aliases;
create policy "Admins can update keyword aliases"
  on public.keyword_aliases
  for update
  to authenticated
  using ((select public.is_admin_user()))
  with check ((select public.is_admin_user()));

drop policy if exists "Admins can delete keyword aliases" on public.keyword_aliases;
create policy "Admins can delete keyword aliases"
  on public.keyword_aliases
  for delete
  to authenticated
  using ((select public.is_admin_user()));

drop policy if exists "Admins can read ai automation usage" on public.ai_automation_usage;
create policy "Admins can read ai automation usage"
  on public.ai_automation_usage
  for select
  to authenticated
  using ((select public.is_admin_user()));

drop policy if exists "Admins can read instagram feed runs" on public.instagram_feed_runs;
create policy "Admins can read instagram feed runs"
  on public.instagram_feed_runs
  for select
  to authenticated
  using ((select public.is_admin_user()));
