-- Rank trends by the latest scored value while keeping peak_score as the all-time high.

ALTER TABLE public.trends
  ADD COLUMN IF NOT EXISTS current_score double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_scored_at timestamptz;

WITH score_sums AS (
  SELECT
    t.id,
    SUM(
      CASE
        WHEN jsonb_typeof(value) = 'number' THEN (value::text)::double precision
        ELSE 0
      END
    ) AS score,
    COUNT(*) FILTER (WHERE jsonb_typeof(value) = 'number') AS score_count
  FROM public.trends t
  LEFT JOIN LATERAL jsonb_each(
    CASE
      WHEN jsonb_typeof(t.score_breakdown) = 'object' THEN t.score_breakdown
      ELSE '{}'::jsonb
    END
  ) AS breakdown(key, value) ON true
  GROUP BY t.id
)
UPDATE public.trends t
SET
  current_score = CASE
    WHEN score_sums.score_count > 0 THEN COALESCE(score_sums.score, 0)
    ELSE COALESCE(t.peak_score, 0)
  END,
  last_scored_at = COALESCE(t.last_scored_at, t.last_confirmed_at, t.detected_at)
FROM score_sums
WHERE t.id = score_sums.id
  AND (t.last_scored_at IS NULL OR t.current_score = 0);

CREATE INDEX IF NOT EXISTS trends_rank_current_score_idx
  ON public.trends (status, current_score DESC, id ASC);

COMMENT ON COLUMN public.trends.current_score IS 'Latest trend score from the most recent scoring run; public rankings sort by this value.';
COMMENT ON COLUMN public.trends.last_scored_at IS 'Timestamp of the latest current_score calculation.';
COMMENT ON COLUMN public.trends.peak_score IS 'All-time high trend score; not used for public ranking order.';
COMMENT ON COLUMN public.trends.previous_rank IS 'Daily midnight rank baseline (Asia/Seoul, current_score desc, 1-indexed).';
