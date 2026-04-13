create table if not exists public.new_product_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  title text not null,
  brand text not null,
  source_type text not null check (source_type in ('convenience', 'franchise')),
  channel text not null,
  site_url text not null,
  crawl_url text not null,
  is_active boolean not null default true,
  last_crawled_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists new_product_sources_type_idx
  on public.new_product_sources (source_type, is_active);

drop trigger if exists set_new_product_sources_updated_at on public.new_product_sources;
create trigger set_new_product_sources_updated_at
before update on public.new_product_sources
for each row
execute function public.set_updated_at();

create table if not exists public.new_products (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.new_product_sources(id) on delete cascade,
  external_id text not null,
  name text not null,
  brand text not null,
  source_type text not null check (source_type in ('convenience', 'franchise')),
  channel text not null,
  category text,
  summary text,
  image_url text,
  product_url text,
  published_at timestamptz,
  available_from timestamptz,
  available_to timestamptz,
  first_seen_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  is_food boolean not null default true,
  is_limited boolean not null default false,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'expired')),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (source_id, external_id)
);

create index if not exists new_products_feed_idx
  on public.new_products (status, source_type, published_at desc nulls last, first_seen_at desc);

create index if not exists new_products_source_idx
  on public.new_products (source_id, status, last_seen_at desc);

create index if not exists new_products_brand_idx
  on public.new_products (brand, status, published_at desc nulls last, first_seen_at desc);

drop trigger if exists set_new_products_updated_at on public.new_products;
create trigger set_new_products_updated_at
before update on public.new_products
for each row
execute function public.set_updated_at();

create table if not exists public.new_product_crawl_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.new_product_sources(id) on delete set null,
  source_key text,
  trigger text not null,
  status text not null check (status in ('running', 'success', 'failed')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  visible_count integer not null default 0,
  error_message text,
  summary jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists new_product_crawl_runs_source_idx
  on public.new_product_crawl_runs (source_id, started_at desc);

create index if not exists new_product_crawl_runs_status_idx
  on public.new_product_crawl_runs (status, started_at desc);
