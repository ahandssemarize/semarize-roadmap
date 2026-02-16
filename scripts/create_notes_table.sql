-- Create notes table for the kanban notepad feature
-- Notes are similar to nodes but simpler: no status, no dependencies, stored in lanes
CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  lane_id uuid REFERENCES public.roadmap_lanes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notes (matching the pattern of roadmap_nodes)
CREATE POLICY notes_select ON public.notes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = notes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY notes_insert ON public.notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = notes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY notes_update ON public.notes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = notes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY notes_delete ON public.notes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = notes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );
