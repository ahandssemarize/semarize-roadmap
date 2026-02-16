-- Drop all existing RLS policies to avoid conflicts
-- Context: Removing broken policies that cause infinite recursion

DROP POLICY IF EXISTS "roadmaps_select_own_or_collaborator" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_insert_own" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_update_own_or_editor" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_delete_own" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_select" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_insert" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_update" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_delete" ON "roadmaps";

DROP POLICY IF EXISTS "roadmap_nodes_select_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_insert_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_update_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_delete_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_select" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_insert" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_update" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_delete" ON "roadmap_nodes";

DROP POLICY IF EXISTS "node_dependencies_select_via_node" ON "node_dependencies";
DROP POLICY IF EXISTS "node_dependencies_insert_via_node" ON "node_dependencies";
DROP POLICY IF EXISTS "node_dependencies_delete_via_node" ON "node_dependencies";
DROP POLICY IF EXISTS "node_dependencies_select" ON "node_dependencies";
DROP POLICY IF EXISTS "node_dependencies_insert" ON "node_dependencies";
DROP POLICY IF EXISTS "node_dependencies_delete" ON "node_dependencies";

DROP POLICY IF EXISTS "node_comments_select_via_node" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_insert_own" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_update_own" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_delete_own" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_select" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_insert" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_update" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_delete" ON "node_comments";

DROP POLICY IF EXISTS "roadmap_collaborators_select_via_roadmap" ON "roadmap_collaborators";
DROP POLICY IF EXISTS "roadmap_collaborators_insert_owner" ON "roadmap_collaborators";
DROP POLICY IF EXISTS "roadmap_collaborators_delete_owner" ON "roadmap_collaborators";
DROP POLICY IF EXISTS "roadmap_collaborators_select" ON "roadmap_collaborators";
DROP POLICY IF EXISTS "roadmap_collaborators_insert" ON "roadmap_collaborators";
DROP POLICY IF EXISTS "roadmap_collaborators_delete" ON "roadmap_collaborators";

-- Create simplified RLS policies without circular dependencies
-- Context: New policies use direct ownership checks to avoid infinite recursion

-- Roadmaps policies - only check direct ownership
CREATE POLICY "roadmaps_select" ON "roadmaps" 
  FOR SELECT 
  USING (created_by = auth.uid());

CREATE POLICY "roadmaps_insert" ON "roadmaps" 
  FOR INSERT 
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "roadmaps_update" ON "roadmaps" 
  FOR UPDATE 
  USING (created_by = auth.uid());

CREATE POLICY "roadmaps_delete" ON "roadmaps" 
  FOR DELETE 
  USING (created_by = auth.uid());

-- Roadmap nodes policies - check ownership via direct roadmap lookup
CREATE POLICY "roadmap_nodes_select" ON "roadmap_nodes"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" r 
      WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_nodes_insert" ON "roadmap_nodes"
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM "roadmaps" r 
      WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_nodes_update" ON "roadmap_nodes"
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" r 
      WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_nodes_delete" ON "roadmap_nodes"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" r 
      WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
  );

-- Node dependencies policies - check via node ownership
CREATE POLICY "node_dependencies_select" ON "node_dependencies"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" n
      JOIN "roadmaps" r ON r.id = n.roadmap_id
      WHERE n.id = node_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "node_dependencies_insert" ON "node_dependencies"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" n
      JOIN "roadmaps" r ON r.id = n.roadmap_id
      WHERE n.id = node_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "node_dependencies_delete" ON "node_dependencies"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" n
      JOIN "roadmaps" r ON r.id = n.roadmap_id
      WHERE n.id = node_id AND r.created_by = auth.uid()
    )
  );

-- Node comments policies - check via node ownership
CREATE POLICY "node_comments_select" ON "node_comments"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" n
      JOIN "roadmaps" r ON r.id = n.roadmap_id
      WHERE n.id = node_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "node_comments_insert" ON "node_comments"
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" n
      JOIN "roadmaps" r ON r.id = n.roadmap_id
      WHERE n.id = node_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "node_comments_update" ON "node_comments"
  FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "node_comments_delete" ON "node_comments"
  FOR DELETE
  USING (user_id = auth.uid());

-- Roadmap collaborators policies - only owners can manage
CREATE POLICY "roadmap_collaborators_select" ON "roadmap_collaborators"
  FOR SELECT
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM "roadmaps" r 
      WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_collaborators_insert" ON "roadmap_collaborators"
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "roadmaps" r 
      WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_collaborators_delete" ON "roadmap_collaborators"
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" r 
      WHERE r.id = roadmap_id AND r.created_by = auth.uid()
    )
  );
