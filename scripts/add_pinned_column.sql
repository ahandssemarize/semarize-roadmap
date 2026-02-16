-- Add pinned_column_id to roadmaps table
-- Context: Allow users to pin a single column to scroll to on page load
-- Only one column can be pinned at a time per roadmap

ALTER TABLE "roadmaps" 
ADD COLUMN IF NOT EXISTS "pinned_column_id" UUID REFERENCES "roadmap_columns"(id) ON DELETE SET NULL;

COMMIT;
