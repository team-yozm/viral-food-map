-- previous_rank now stores the rank baseline captured at midnight KST.
COMMENT ON COLUMN public.trends.previous_rank IS '당일 자정 기준 순위 (Asia/Seoul, peak_score 내림차순 기준, 1-indexed)';
