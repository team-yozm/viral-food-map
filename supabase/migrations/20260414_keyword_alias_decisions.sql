-- keyword_aliases 테이블에 decision_type 컬럼 추가
-- 'merge': 관리자가 확인한 동의어, 'separate': 관리자가 분리 결정한 쌍, NULL: AI 자동 감지
alter table public.keyword_aliases
  add column if not exists decision_type text
  check (decision_type in ('merge', 'separate'));

-- 기존 alias_normalized 단일 unique → (alias_normalized, canonical_normalized) 쌍 unique로 변경
-- separate 결정과 merge 결정이 같은 alias에 대해 공존할 수 있도록 함
alter table public.keyword_aliases
  drop constraint if exists keyword_aliases_alias_normalized_key;
drop index if exists keyword_aliases_alias_normalized_key;

create unique index if not exists keyword_aliases_pair_uq
  on public.keyword_aliases (alias_normalized, canonical_normalized);
