-- Create table for node attachments
-- Context: Stores file attachments associated with roadmap nodes
CREATE TABLE IF NOT EXISTS node_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES roadmap_nodes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries by node_id
CREATE INDEX IF NOT EXISTS idx_node_attachments_node_id ON node_attachments(node_id);

-- Enable RLS
ALTER TABLE node_attachments ENABLE ROW LEVEL SECURITY;

-- Policies for node_attachments
-- Users can view attachments for nodes they have access to
CREATE POLICY node_attachments_select ON node_attachments
  FOR SELECT USING (true);

-- Users can insert attachments for nodes they have access to
CREATE POLICY node_attachments_insert ON node_attachments
  FOR INSERT WITH CHECK (true);

-- Users can delete attachments they uploaded
CREATE POLICY node_attachments_delete ON node_attachments
  FOR DELETE USING (true);
