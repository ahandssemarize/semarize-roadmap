-- Revert the incorrect border offset fix that was applied to node positions
-- This migration reverses the changes made by fix_node_positions_borders.sql
-- which incorrectly subtracted border offsets from node positions

-- The issue wasn't borders at all - it was duplicate order_index values in lanes
-- causing unpredictable lane ordering which made nodes appear misaligned

DO $$
DECLARE
  node_record RECORD;
  old_x INTEGER;
  col INTEGER;
  border_offset INTEGER;
  new_x INTEGER;
  cell_width INTEGER := 360;
  lane_header_width INTEGER := 200;
  node_width INTEGER := 252;
  border_width INTEGER := 1;
  centering_offset INTEGER;
BEGIN
  centering_offset := (cell_width - node_width) / 2;
  
  RAISE NOTICE 'Reverting incorrect border offset fix...';
  RAISE NOTICE 'This adds back the border offset that was incorrectly subtracted';
  
  -- Loop through all nodes and reverse the border offset subtraction
  FOR node_record IN
    SELECT id, position_x, position_y
    FROM roadmap_nodes
    ORDER BY position_x
  LOOP
    old_x := node_record.position_x;
    
    -- Calculate which column this node is in (reverse of getGridCell)
    col := ROUND((old_x - lane_header_width - centering_offset)::numeric / cell_width);
    
    -- Calculate the border offset that was subtracted
    border_offset := border_width * (col + 1);
    
    -- Add it back to restore original position
    new_x := old_x + border_offset;
    
    -- Update the node position
    UPDATE roadmap_nodes
    SET position_x = new_x
    WHERE id = node_record.id;
    
  END LOOP;
  
  RAISE NOTICE 'Reverted positions for all nodes';
END $$;

-- Show sample of updated positions
SELECT 
  title,
  position_x,
  position_y,
  ROUND((position_x - 200 - 54)::numeric / 360) as calculated_col
FROM roadmap_nodes
ORDER BY position_x
LIMIT 10;
