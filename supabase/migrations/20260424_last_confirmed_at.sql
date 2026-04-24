-- trends 테이블에 last_confirmed_at 컬럼 추가
-- detected_at은 최초 발견 시각으로 보존하고,
-- TTL 계산 기준은 last_confirmed_at (마지막 확인 시각)으로 분리한다.

ALTER TABLE trends
    ADD COLUMN IF NOT EXISTS last_confirmed_at TIMESTAMPTZ;

-- 기존 행: detected_at이 곧 마지막 확인 시각이었으므로 그대로 backfill
UPDATE trends
SET last_confirmed_at = detected_at
WHERE last_confirmed_at IS NULL;
