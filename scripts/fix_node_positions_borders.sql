-- Fix node positions to account for table borders
-- This migration corrects node positions that were stored without accounting for
-- the 1px borders between cells in the roadmap grid.
--
-- Context from chat: Discovered that nodes appear off-center (worse with more columns)
-- because the table uses border-collapse with 1px borders, but position calculations
-- didn't account for the cumulative border width. The formula now includes:
-- borderOffset = BORDER_WIDTH * (col + 1) where BORDER_WIDTH = 1px
--
-- This script subtracts the border offset from existing positions so they work
-- correctly with the updated positioning formula.

-- Constants (must match GRID values in roadmap-grid.tsx)
DO $$
DECLARE
  lane_header_width CONSTANT INTEGER := 200;
  cell_width CONSTANT INTEGER := 360;
  node_width CONSTANT INTEGER := 252;
  border_width CONSTANT INTEGER := 1;
  centering_offset CONSTANT INTEGER := (cell_width - node_width) / 2; -- 54px
BEGIN
  -- Update all nodes to subtract the cumulative border offset
  UPDATE "roadmap_nodes"
  SET "position_x" = "position_x" - (border_width * (
    -- Calculate which column this node is in
    ROUND(("position_x" - lane_header_width - centering_offset)::NUMERIC / cell_width::NUMERIC) + 1
  ))
  WHERE "position_x" IS NOT NULL;
  
  RAISE NOTICE 'Updated % node positions to account for borders', 
    (SELECT COUNT(*) FROM "roadmap_nodes" WHERE "position_x" IS NOT NULL);
END $$;
