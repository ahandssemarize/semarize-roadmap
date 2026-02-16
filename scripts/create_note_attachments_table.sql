-- Create note_attachments table for file uploads on notes
-- Context: Similar to node_attachments but for notes in the notepad kanban
CREATE TABLE IF NOT EXISTS note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE note_attachments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view note attachments
CREATE POLICY note_attachments_select ON note_attachments
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert note attachments
CREATE POLICY note_attachments_insert ON note_attachments
  FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

-- Allow authenticated users to delete their own note attachments
CREATE POLICY note_attachments_delete ON note_attachments
  FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON note_attachments(note_id);
