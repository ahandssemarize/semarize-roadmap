-- Add description column to roadmap_lanes table
ALTER TABLE roadmap_lanes
ADD COLUMN IF NOT EXISTS description TEXT;

-- Update RLS policies remain unchanged
