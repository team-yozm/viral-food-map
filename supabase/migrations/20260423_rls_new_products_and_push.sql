create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.push_subscriptions enable row level security;
alter table public.new_products enable row level security;
alter table public.new_product_sources enable row level security;
alter table public.new_product_crawl_runs enable row level security;

create or replace function public.register_push_subscription(
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(trim(coalesce(subscription_endpoint, ''))) = 0
    or length(trim(coalesce(subscription_p256dh, ''))) = 0
    or length(trim(coalesce(subscription_auth, ''))) = 0
  then
    raise exception 'Invalid push subscription';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth)
  values (subscription_endpoint, subscription_p256dh, subscription_auth)
  on conflict (endpoint)
  do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth;
end;
$$;

revoke all on function public.register_push_subscription(text, text, text) from public;
grant execute on function public.register_push_subscription(text, text, text) to anon, authenticated;

drop policy if exists "Anyone can read visible new products" on public.new_products;
create policy "Anyone can read visible new products"
  on public.new_products
  for select
  to anon, authenticated
  using (status = 'visible' and is_food = true);

drop policy if exists "Admins can read new products" on public.new_products;
create policy "Admins can read new products"
  on public.new_products
  for select
  to authenticated
  using ((select public.is_admin_user()));

drop policy if exists "Admins can update new products" on public.new_products;
create policy "Admins can update new products"
  on public.new_products
  for update
  to authenticated
  using ((select public.is_admin_user()))
  with check ((select public.is_admin_user()));

drop policy if exists "Anyone can read active new product sources" on public.new_product_sources;
create policy "Anyone can read active new product sources"
  on public.new_product_sources
  for select
  to anon, authenticated
  using (is_active = true);

drop policy if exists "Admins can read new product sources" on public.new_product_sources;
create policy "Admins can read new product sources"
  on public.new_product_sources
  for select
  to authenticated
  using ((select public.is_admin_user()));

drop policy if exists "Admins can read new product crawl runs" on public.new_product_crawl_runs;
create policy "Admins can read new product crawl runs"
  on public.new_product_crawl_runs
  for select
  to authenticated
  using ((select public.is_admin_user()));
