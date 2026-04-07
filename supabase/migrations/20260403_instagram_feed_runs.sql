create table if not exists public.instagram_feed_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null unique,
  status text not null check (status in ('running', 'published', 'skipped', 'failed')),
  trend_id uuid references public.trends(id) on delete set null,
  trend_name_snapshot text,
  candidate_status text check (candidate_status in ('rising', 'active')),
  caption text,
  source_image_url text,
  final_image_url text,
  instagram_creation_id text,
  instagram_media_id text,
  skip_reason text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists instagram_feed_runs_status_idx
  on public.instagram_feed_runs (status, run_date desc);

create index if not exists instagram_feed_runs_trend_id_idx
  on public.instagram_feed_runs (trend_id)
  where trend_id is not null;

drop trigger if exists set_instagram_feed_runs_updated_at on public.instagram_feed_runs;
create trigger set_instagram_feed_runs_updated_at
before update on public.instagram_feed_runs
for each row
execute function public.set_updated_at();
