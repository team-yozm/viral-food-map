alter table public.yomechu_spins
  add column if not exists winner_place_ids uuid[] not null default '{}'::uuid[];

update public.yomechu_spins
set winner_place_ids = array[winner_place_id]
where winner_place_id is not null
  and coalesce(array_length(winner_place_ids, 1), 0) = 0;

alter table public.yomechu_feedback
  drop constraint if exists yomechu_feedback_event_type_check;

alter table public.yomechu_feedback
  add constraint yomechu_feedback_event_type_check
  check (event_type in ('reroll', 'open', 'close', 'share'));
