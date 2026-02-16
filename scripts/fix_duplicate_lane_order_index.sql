-- Fix duplicate order_index values in roadmap_lanes table
-- This script identifies and corrects lanes with duplicate order_index values
-- within the same roadmap, ensuring each lane has a unique sequential order_index

-- First, identify roadmaps with duplicate order_index values
DO $$
DECLARE
  roadmap_record RECORD;
  lane_record RECORD;
  new_order_index INTEGER;
BEGIN
  -- Loop through each roadmap that has duplicate order_index values
  FOR roadmap_record IN 
    SELECT roadmap_id
    FROM roadmap_lanes
    GROUP BY roadmap_id
    HAVING COUNT(*) > COUNT(DISTINCT order_index)
  LOOP
    RAISE NOTICE 'Fixing roadmap: %', roadmap_record.roadmap_id;
    
    -- Reset order_index for this roadmap's lanes sequentially
    new_order_index := 0;
    
    FOR lane_record IN
      SELECT id
      FROM roadmap_lanes
      WHERE roadmap_id = roadmap_record.roadmap_id
      ORDER BY order_index, created_at
    LOOP
      UPDATE roadmap_lanes
      SET order_index = new_order_index
      WHERE id = lane_record.id;
      
      new_order_index := new_order_index + 1;
    END LOOP;
  END LOOP;
END $$;

-- Verify no duplicates remain
SELECT 
  roadmap_id,
  COUNT(*) as total_lanes,
  COUNT(DISTINCT order_index) as unique_order_indices,
  CASE 
    WHEN COUNT(*) = COUNT(DISTINCT order_index) THEN '✓ Fixed'
    ELSE '⚠ Still has duplicates'
  END as status
FROM roadmap_lanes
GROUP BY roadmap_id
ORDER BY roadmap_id;
