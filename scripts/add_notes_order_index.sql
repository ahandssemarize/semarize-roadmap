-- Add persistent ordering for notes within each lane.
-- Safe to run multiple times.

BEGIN;

-- 1) Add ordering column
ALTER TABLE public.notes
ADD COLUMN IF NOT EXISTS order_index integer;

-- 2) Backfill deterministic order for existing rows (0-based), per roadmap+lane
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY roadmap_id, lane_id
      ORDER BY created_at, id
    ) - 1 AS new_order
  FROM public.notes
)
UPDATE public.notes n
SET order_index = ranked.new_order
FROM ranked
WHERE n.id = ranked.id
  AND (n.order_index IS NULL OR n.order_index <> ranked.new_order);

-- 3) Enforce and index
ALTER TABLE public.notes
ALTER COLUMN order_index SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notes_roadmap_lane_order
  ON public.notes (roadmap_id, lane_id, order_index);

-- 4) Auto-assign order_index to end of lane on INSERT when not provided
CREATE OR REPLACE FUNCTION public.set_note_order_index_on_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_index IS NULL THEN
    SELECT COALESCE(MAX(n.order_index), -1) + 1
      INTO NEW.order_index
    FROM public.notes n
    WHERE n.roadmap_id = NEW.roadmap_id
      AND n.lane_id IS NOT DISTINCT FROM NEW.lane_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_set_order_index_on_insert ON public.notes;
CREATE TRIGGER notes_set_order_index_on_insert
BEFORE INSERT ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.set_note_order_index_on_insert();

-- 5) If lane changes and caller did not provide a new order_index, place note at end of destination lane
CREATE OR REPLACE FUNCTION public.set_note_order_index_on_lane_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.lane_id IS DISTINCT FROM OLD.lane_id
     AND (NEW.order_index IS NULL OR NEW.order_index = OLD.order_index) THEN
    SELECT COALESCE(MAX(n.order_index), -1) + 1
      INTO NEW.order_index
    FROM public.notes n
    WHERE n.roadmap_id = NEW.roadmap_id
      AND n.lane_id IS NOT DISTINCT FROM NEW.lane_id
      AND n.id <> NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notes_set_order_index_on_lane_change ON public.notes;
CREATE TRIGGER notes_set_order_index_on_lane_change
BEFORE UPDATE OF lane_id ON public.notes
FOR EACH ROW
EXECUTE FUNCTION public.set_note_order_index_on_lane_change();

COMMIT;
