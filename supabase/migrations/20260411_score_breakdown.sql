-- 트렌드/리뷰에 점수 내역 저장
ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.trend_reviews
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb DEFAULT '{}'::jsonb;
