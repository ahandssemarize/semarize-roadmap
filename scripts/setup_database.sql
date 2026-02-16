-- Complete database setup for Roadmapper application
-- This script creates all tables, indexes, and RLS policies needed for the app

-- ============================================
-- STEP 1: Create main roadmap tables
-- ============================================

-- Create roadmaps table
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  archived boolean DEFAULT false
);

-- Create roadmap_nodes table
CREATE TABLE IF NOT EXISTS public.roadmap_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'completed', 'blocked')),
  position_x real NOT NULL DEFAULT 0,
  position_y real NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create node_dependencies table
CREATE TABLE IF NOT EXISTS public.node_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.roadmap_nodes(id) ON DELETE CASCADE,
  depends_on_node_id uuid NOT NULL REFERENCES public.roadmap_nodes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(node_id, depends_on_node_id),
  CHECK (node_id != depends_on_node_id)
);

-- Create node_comments table
CREATE TABLE IF NOT EXISTS public.node_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.roadmap_nodes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create roadmap_collaborators table
CREATE TABLE IF NOT EXISTS public.roadmap_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(roadmap_id, user_id)
);

-- ============================================
-- STEP 2: Create lanes table for notepad feature
-- ============================================

CREATE TABLE IF NOT EXISTS public.roadmap_lanes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  lane_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- STEP 3: Create notes table
-- ============================================

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES public.roadmaps(id) ON DELETE CASCADE,
  lane_id uuid REFERENCES public.roadmap_lanes(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  pinned boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- STEP 4: Create attachments tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.node_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id uuid NOT NULL REFERENCES public.roadmap_nodes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.note_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  file_type text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- STEP 5: Enable Row Level Security
-- ============================================

ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmap_lanes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.node_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 6: Drop existing policies (if any)
-- ============================================

DROP POLICY IF EXISTS roadmaps_select ON public.roadmaps;
DROP POLICY IF EXISTS roadmaps_insert ON public.roadmaps;
DROP POLICY IF EXISTS roadmaps_update ON public.roadmaps;
DROP POLICY IF EXISTS roadmaps_delete ON public.roadmaps;

DROP POLICY IF EXISTS roadmap_nodes_select ON public.roadmap_nodes;
DROP POLICY IF EXISTS roadmap_nodes_insert ON public.roadmap_nodes;
DROP POLICY IF EXISTS roadmap_nodes_update ON public.roadmap_nodes;
DROP POLICY IF EXISTS roadmap_nodes_delete ON public.roadmap_nodes;

DROP POLICY IF EXISTS node_dependencies_select ON public.node_dependencies;
DROP POLICY IF EXISTS node_dependencies_insert ON public.node_dependencies;
DROP POLICY IF EXISTS node_dependencies_delete ON public.node_dependencies;

DROP POLICY IF EXISTS node_comments_select ON public.node_comments;
DROP POLICY IF EXISTS node_comments_insert ON public.node_comments;
DROP POLICY IF EXISTS node_comments_update ON public.node_comments;
DROP POLICY IF EXISTS node_comments_delete ON public.node_comments;

DROP POLICY IF EXISTS roadmap_collaborators_select ON public.roadmap_collaborators;
DROP POLICY IF EXISTS roadmap_collaborators_insert ON public.roadmap_collaborators;
DROP POLICY IF EXISTS roadmap_collaborators_delete ON public.roadmap_collaborators;

DROP POLICY IF EXISTS roadmap_lanes_select ON public.roadmap_lanes;
DROP POLICY IF EXISTS roadmap_lanes_insert ON public.roadmap_lanes;
DROP POLICY IF EXISTS roadmap_lanes_update ON public.roadmap_lanes;
DROP POLICY IF EXISTS roadmap_lanes_delete ON public.roadmap_lanes;

DROP POLICY IF EXISTS notes_select ON public.notes;
DROP POLICY IF EXISTS notes_insert ON public.notes;
DROP POLICY IF EXISTS notes_update ON public.notes;
DROP POLICY IF EXISTS notes_delete ON public.notes;

DROP POLICY IF EXISTS node_attachments_select ON public.node_attachments;
DROP POLICY IF EXISTS node_attachments_insert ON public.node_attachments;
DROP POLICY IF EXISTS node_attachments_delete ON public.node_attachments;

DROP POLICY IF EXISTS note_attachments_select ON public.note_attachments;
DROP POLICY IF EXISTS note_attachments_insert ON public.note_attachments;
DROP POLICY IF EXISTS note_attachments_delete ON public.note_attachments;

-- ============================================
-- STEP 7: Create RLS Policies for roadmaps
-- ============================================

CREATE POLICY roadmaps_select ON public.roadmaps
  FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.roadmap_collaborators rc
      WHERE rc.roadmap_id = roadmaps.id AND rc.user_id = auth.uid()
    )
  );

CREATE POLICY roadmaps_insert ON public.roadmaps
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY roadmaps_update ON public.roadmaps
  FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.roadmap_collaborators rc
      WHERE rc.roadmap_id = roadmaps.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
    )
  );

CREATE POLICY roadmaps_delete ON public.roadmaps
  FOR DELETE
  USING (created_by = auth.uid());

-- ============================================
-- STEP 8: Create RLS Policies for roadmap_nodes
-- ============================================

CREATE POLICY roadmap_nodes_select ON public.roadmap_nodes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_nodes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY roadmap_nodes_insert ON public.roadmap_nodes
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_nodes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

CREATE POLICY roadmap_nodes_update ON public.roadmap_nodes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_nodes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

CREATE POLICY roadmap_nodes_delete ON public.roadmap_nodes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_nodes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

-- ============================================
-- STEP 9: Create RLS Policies for node_dependencies
-- ============================================

CREATE POLICY node_dependencies_select ON public.node_dependencies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_dependencies.node_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY node_dependencies_insert ON public.node_dependencies
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_dependencies.node_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

CREATE POLICY node_dependencies_delete ON public.node_dependencies
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_dependencies.node_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

-- ============================================
-- STEP 10: Create RLS Policies for node_comments
-- ============================================

CREATE POLICY node_comments_select ON public.node_comments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_comments.node_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY node_comments_insert ON public.node_comments
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_comments.node_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY node_comments_update ON public.node_comments
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY node_comments_delete ON public.node_comments
  FOR DELETE
  USING (user_id = auth.uid());

-- ============================================
-- STEP 11: Create RLS Policies for roadmap_collaborators
-- ============================================

CREATE POLICY roadmap_collaborators_select ON public.roadmap_collaborators
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_collaborators.roadmap_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY roadmap_collaborators_insert ON public.roadmap_collaborators
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_collaborators.roadmap_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY roadmap_collaborators_delete ON public.roadmap_collaborators
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_collaborators.roadmap_id AND r.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 12: Create RLS Policies for roadmap_lanes
-- ============================================

CREATE POLICY roadmap_lanes_select ON public.roadmap_lanes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_lanes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY roadmap_lanes_insert ON public.roadmap_lanes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_lanes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

CREATE POLICY roadmap_lanes_update ON public.roadmap_lanes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_lanes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

CREATE POLICY roadmap_lanes_delete ON public.roadmap_lanes
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmaps r
      WHERE r.id = roadmap_lanes.roadmap_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

-- ============================================
-- STEP 13: Create RLS Policies for notes
-- ============================================

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
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
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
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
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
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

-- ============================================
-- STEP 14: Create RLS Policies for attachments
-- ============================================

CREATE POLICY node_attachments_select ON public.node_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_attachments.node_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY node_attachments_insert ON public.node_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_attachments.node_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

CREATE POLICY node_attachments_delete ON public.node_attachments
  FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.roadmap_nodes rn
      JOIN public.roadmaps r ON r.id = rn.roadmap_id
      WHERE rn.id = node_attachments.node_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY note_attachments_select ON public.note_attachments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.notes n
      JOIN public.roadmaps r ON r.id = n.roadmap_id
      WHERE n.id = note_attachments.note_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid()
      ))
    )
  );

CREATE POLICY note_attachments_insert ON public.note_attachments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.notes n
      JOIN public.roadmaps r ON r.id = n.roadmap_id
      WHERE n.id = note_attachments.note_id
      AND (r.created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.roadmap_collaborators rc
        WHERE rc.roadmap_id = r.id AND rc.user_id = auth.uid() AND rc.role IN ('owner', 'editor')
      ))
    )
  );

CREATE POLICY note_attachments_delete ON public.note_attachments
  FOR DELETE
  USING (
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.notes n
      JOIN public.roadmaps r ON r.id = n.roadmap_id
      WHERE n.id = note_attachments.note_id AND r.created_by = auth.uid()
    )
  );

-- ============================================
-- STEP 15: Create indexes for better performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_roadmap_nodes_roadmap_id ON public.roadmap_nodes(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_node_dependencies_node_id ON public.node_dependencies(node_id);
CREATE INDEX IF NOT EXISTS idx_node_dependencies_depends_on ON public.node_dependencies(depends_on_node_id);
CREATE INDEX IF NOT EXISTS idx_node_comments_node_id ON public.node_comments(node_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_collaborators_roadmap_id ON public.roadmap_collaborators(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_collaborators_user_id ON public.roadmap_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_roadmap_lanes_roadmap_id ON public.roadmap_lanes(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_notes_roadmap_id ON public.notes(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_notes_lane_id ON public.notes(lane_id);
CREATE INDEX IF NOT EXISTS idx_node_attachments_node_id ON public.node_attachments(node_id);
CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id ON public.note_attachments(note_id);
