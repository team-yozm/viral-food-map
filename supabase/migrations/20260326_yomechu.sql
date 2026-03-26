create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.yomechu_places (
  id uuid primary key default gen_random_uuid(),
  external_place_id text not null unique,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  phone text,
  place_url text,
  category_name text not null,
  category_slug text not null,
  rating numeric(3, 1),
  quality_score double precision,
  trend_names text[] not null default '{}'::text[],
  raw_payload jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_enriched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists yomechu_places_category_slug_idx
  on public.yomechu_places (category_slug);

create index if not exists yomechu_places_last_seen_at_idx
  on public.yomechu_places (last_seen_at desc);

create index if not exists yomechu_places_quality_score_idx
  on public.yomechu_places (quality_score desc nulls last);

drop trigger if exists set_yomechu_places_updated_at on public.yomechu_places;
create trigger set_yomechu_places_updated_at
before update on public.yomechu_places
for each row
execute function public.set_updated_at();

create table if not exists public.yomechu_spins (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  lat_rounded numeric(8, 3) not null,
  lng_rounded numeric(8, 3) not null,
  radius_m integer not null,
  category_slug text not null,
  pool_size integer not null,
  used_fallback boolean not null default false,
  winner_place_id uuid references public.yomechu_places(id),
  reel_place_ids uuid[] not null default '{}'::uuid[],
  created_at timestamptz not null default now()
);

create index if not exists yomechu_spins_created_at_idx
  on public.yomechu_spins (created_at desc);

create index if not exists yomechu_spins_session_id_idx
  on public.yomechu_spins (session_id);

create table if not exists public.yomechu_feedback (
  id uuid primary key default gen_random_uuid(),
  spin_id uuid not null references public.yomechu_spins(id) on delete cascade,
  place_id uuid references public.yomechu_places(id),
  session_id text,
  event_type text not null check (event_type in ('reroll', 'open', 'close')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists yomechu_feedback_spin_id_idx
  on public.yomechu_feedback (spin_id, created_at desc);

create or replace function public.get_nearby_trend_stores(
  user_lat double precision,
  user_lng double precision,
  result_limit integer default 5
)
returns table (
  id uuid,
  trend_id uuid,
  name text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  place_url text,
  rating numeric,
  source text,
  verified boolean,
  last_updated timestamptz,
  trend_name text,
  distance_km double precision
)
language sql
stable
as $$
  select
    s.id,
    s.trend_id,
    s.name,
    s.address,
    s.lat,
    s.lng,
    s.phone,
    s.place_url,
    s.rating,
    s.source,
    s.verified,
    s.last_updated,
    t.name as trend_name,
    (
      6371 * acos(
        least(
          1,
          greatest(
            -1,
            cos(radians(user_lat)) * cos(radians(s.lat)) * cos(radians(s.lng) - radians(user_lng)) +
            sin(radians(user_lat)) * sin(radians(s.lat))
          )
        )
      )
    ) as distance_km
  from public.stores s
  left join public.trends t on t.id = s.trend_id
  order by distance_km asc
  limit greatest(result_limit, 1);
$$;
