-- Drop existing policies to fix infinite recursion
-- Context: The original policies had circular dependencies causing infinite recursion
DROP POLICY IF EXISTS "roadmaps_select_own_or_collaborator" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_update_own_or_editor" ON "roadmaps";
DROP POLICY IF EXISTS "roadmap_nodes_select_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_insert_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_update_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_delete_via_roadmap" ON "roadmap_nodes";

-- Simpler RLS Policies for roadmaps without circular dependencies
-- Context: Direct checks without subqueries that reference back to roadmaps table
CREATE POLICY "roadmaps_select_policy"
  ON "roadmaps" FOR SELECT
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM "roadmap_collaborators" 
      WHERE roadmap_collaborators.roadmap_id = roadmaps.id 
      AND roadmap_collaborators.user_id = auth.uid()
    )
  );

CREATE POLICY "roadmaps_update_policy"
  ON "roadmaps" FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM "roadmap_collaborators" 
      WHERE roadmap_collaborators.roadmap_id = roadmaps.id 
      AND roadmap_collaborators.user_id = auth.uid() 
      AND roadmap_collaborators.role IN ('owner', 'editor')
    )
  );

-- Simpler RLS Policies for roadmap_nodes
-- Context: Check permissions directly via joins, not nested subqueries
CREATE POLICY "roadmap_nodes_select_policy"
  ON "roadmap_nodes" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE roadmaps.id = roadmap_nodes.roadmap_id 
      AND (
        roadmaps.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM "roadmap_collaborators"
          WHERE roadmap_collaborators.roadmap_id = roadmaps.id
          AND roadmap_collaborators.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "roadmap_nodes_insert_policy"
  ON "roadmap_nodes" FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE roadmaps.id = roadmap_nodes.roadmap_id 
      AND (
        roadmaps.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM "roadmap_collaborators"
          WHERE roadmap_collaborators.roadmap_id = roadmaps.id
          AND roadmap_collaborators.user_id = auth.uid()
          AND roadmap_collaborators.role IN ('owner', 'editor')
        )
      )
    )
  );

CREATE POLICY "roadmap_nodes_update_policy"
  ON "roadmap_nodes" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE roadmaps.id = roadmap_nodes.roadmap_id 
      AND (
        roadmaps.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM "roadmap_collaborators"
          WHERE roadmap_collaborators.roadmap_id = roadmaps.id
          AND roadmap_collaborators.user_id = auth.uid()
          AND roadmap_collaborators.role IN ('owner', 'editor')
        )
      )
    )
  );

CREATE POLICY "roadmap_nodes_delete_policy"
  ON "roadmap_nodes" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE roadmaps.id = roadmap_nodes.roadmap_id 
      AND (
        roadmaps.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM "roadmap_collaborators"
          WHERE roadmap_collaborators.roadmap_id = roadmaps.id
          AND roadmap_collaborators.user_id = auth.uid()
          AND roadmap_collaborators.role IN ('owner', 'editor')
        )
      )
    )
  );
