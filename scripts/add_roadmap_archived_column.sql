-- Add archived column to roadmaps table to support archiving functionality
-- Archived roadmaps will be shown separately and can be deleted permanently

ALTER TABLE roadmaps 
ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Create index for better query performance when filtering archived roadmaps
CREATE INDEX IF NOT EXISTS idx_roadmaps_archived ON roadmaps(archived);
