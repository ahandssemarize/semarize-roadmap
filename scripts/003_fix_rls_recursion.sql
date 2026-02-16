-- Drop all existing RLS policies to start fresh
-- Context: The previous policies had circular dependencies causing infinite recursion
DROP POLICY IF EXISTS "roadmaps_select_own_or_collaborator" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_insert_own" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_update_own_or_editor" ON "roadmaps";
DROP POLICY IF EXISTS "roadmaps_delete_own" ON "roadmaps";

DROP POLICY IF EXISTS "roadmap_nodes_select_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_insert_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_update_via_roadmap" ON "roadmap_nodes";
DROP POLICY IF EXISTS "roadmap_nodes_delete_via_roadmap" ON "roadmap_nodes";

DROP POLICY IF EXISTS "node_dependencies_select_via_node" ON "node_dependencies";
DROP POLICY IF EXISTS "node_dependencies_insert_via_node" ON "node_dependencies";
DROP POLICY IF EXISTS "node_dependencies_delete_via_node" ON "node_dependencies";

DROP POLICY IF EXISTS "node_comments_select_via_node" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_insert_own" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_update_own" ON "node_comments";
DROP POLICY IF EXISTS "node_comments_delete_own" ON "node_comments";

DROP POLICY IF EXISTS "roadmap_collaborators_select_via_roadmap" ON "roadmap_collaborators";
DROP POLICY IF EXISTS "roadmap_collaborators_insert_owner" ON "roadmap_collaborators";
DROP POLICY IF EXISTS "roadmap_collaborators_delete_owner" ON "roadmap_collaborators";

-- New simplified RLS Policies for roadmaps
-- Context: Direct ownership check without recursion
CREATE POLICY "roadmaps_select"
  ON "roadmaps" FOR SELECT
  USING (
    created_by = auth.uid()
  );

CREATE POLICY "roadmaps_insert"
  ON "roadmaps" FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "roadmaps_update"
  ON "roadmaps" FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "roadmaps_delete"
  ON "roadmaps" FOR DELETE
  USING (created_by = auth.uid());

-- New simplified RLS Policies for roadmap_nodes
-- Context: Check roadmap ownership directly without nested queries to avoid recursion
CREATE POLICY "roadmap_nodes_select"
  ON "roadmap_nodes" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE "roadmaps".id = "roadmap_nodes".roadmap_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_nodes_insert"
  ON "roadmap_nodes" FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE "roadmaps".id = roadmap_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_nodes_update"
  ON "roadmap_nodes" FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE "roadmaps".id = "roadmap_nodes".roadmap_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_nodes_delete"
  ON "roadmap_nodes" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE "roadmaps".id = "roadmap_nodes".roadmap_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

-- New simplified RLS Policies for node_dependencies
-- Context: Check if user owns the roadmap that contains the node
CREATE POLICY "node_dependencies_select"
  ON "node_dependencies" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" 
      JOIN "roadmaps" ON "roadmaps".id = "roadmap_nodes".roadmap_id
      WHERE "roadmap_nodes".id = "node_dependencies".node_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "node_dependencies_insert"
  ON "node_dependencies" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" 
      JOIN "roadmaps" ON "roadmaps".id = "roadmap_nodes".roadmap_id
      WHERE "roadmap_nodes".id = node_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "node_dependencies_delete"
  ON "node_dependencies" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" 
      JOIN "roadmaps" ON "roadmaps".id = "roadmap_nodes".roadmap_id
      WHERE "roadmap_nodes".id = "node_dependencies".node_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

-- New simplified RLS Policies for node_comments
-- Context: Check if user owns the roadmap that contains the node being commented on
CREATE POLICY "node_comments_select"
  ON "node_comments" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" 
      JOIN "roadmaps" ON "roadmaps".id = "roadmap_nodes".roadmap_id
      WHERE "roadmap_nodes".id = "node_comments".node_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "node_comments_insert"
  ON "node_comments" FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM "roadmap_nodes" 
      JOIN "roadmaps" ON "roadmaps".id = "roadmap_nodes".roadmap_id
      WHERE "roadmap_nodes".id = node_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "node_comments_update"
  ON "node_comments" FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "node_comments_delete"
  ON "node_comments" FOR DELETE
  USING (user_id = auth.uid());

-- New simplified RLS Policies for roadmap_collaborators
-- Context: Simplified to remove recursion - for now just owner can manage
CREATE POLICY "roadmap_collaborators_select"
  ON "roadmap_collaborators" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE "roadmaps".id = "roadmap_collaborators".roadmap_id 
      AND "roadmaps".created_by = auth.uid()
    ) OR user_id = auth.uid()
  );

CREATE POLICY "roadmap_collaborators_insert"
  ON "roadmap_collaborators" FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE "roadmaps".id = roadmap_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );

CREATE POLICY "roadmap_collaborators_delete"
  ON "roadmap_collaborators" FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM "roadmaps" 
      WHERE "roadmaps".id = "roadmap_collaborators".roadmap_id 
      AND "roadmaps".created_by = auth.uid()
    )
  );
