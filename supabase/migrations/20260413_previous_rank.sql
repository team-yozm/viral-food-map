-- 트렌드 순위 변동 추적을 위한 previous_rank 컬럼 추가
ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS previous_rank integer;

COMMENT ON COLUMN public.trends.previous_rank IS '직전 감지 사이클의 순위 (peak_score 내림차순 기준, 1-indexed)';
