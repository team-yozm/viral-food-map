alter table public.instagram_feed_runs
  drop constraint if exists instagram_feed_runs_status_check;

alter table public.instagram_feed_runs
  add constraint instagram_feed_runs_status_check
  check (status in ('running', 'pending_review', 'published', 'skipped', 'failed'));

alter table public.instagram_feed_runs
  add column if not exists final_image_path text,
  add column if not exists image_review_payload jsonb,
  add column if not exists discord_review_status text,
  add column if not exists discord_reviewed_at timestamptz,
  add column if not exists discord_reviewed_by text,
  add column if not exists discord_reviewed_by_name text;

alter table public.instagram_feed_runs
  drop constraint if exists instagram_feed_runs_discord_review_status_check;

alter table public.instagram_feed_runs
  add constraint instagram_feed_runs_discord_review_status_check
  check (discord_review_status is null or discord_review_status in ('pending', 'approved', 'rejected'));

create index if not exists instagram_feed_runs_pending_review_idx
  on public.instagram_feed_runs (status, created_at)
  where status = 'pending_review';

alter table public.discord_review_messages
  drop constraint if exists discord_review_messages_entity_kind_check;

alter table public.discord_review_messages
  add constraint discord_review_messages_entity_kind_check
  check (entity_kind in ('ai_review', 'ai_alias', 'report', 'instagram_feed'));

alter table public.discord_review_action_logs
  drop constraint if exists discord_review_action_logs_entity_kind_check;

alter table public.discord_review_action_logs
  add constraint discord_review_action_logs_entity_kind_check
  check (entity_kind in ('ai_review', 'ai_alias', 'report', 'instagram_feed'));
