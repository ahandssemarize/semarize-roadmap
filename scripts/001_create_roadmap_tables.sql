-- Create roadmaps table
-- Context: Main table to store product roadmaps with ownership tracking
CREATE TABLE IF NOT EXISTS "roadmaps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "description" TEXT,
  "created_by" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create roadmap_nodes table
-- Context: Individual feature/product nodes in the tech tree with positioning and status
CREATE TABLE IF NOT EXISTS "roadmap_nodes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roadmap_id" UUID NOT NULL REFERENCES "roadmaps"(id) ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'completed', 'blocked')),
  "position_x" REAL NOT NULL DEFAULT 0,
  "position_y" REAL NOT NULL DEFAULT 0,
  "created_by" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create node_dependencies table
-- Context: Tracks dependencies between nodes (what must be completed before this node can start)
CREATE TABLE IF NOT EXISTS "node_dependencies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "node_id" UUID NOT NULL REFERENCES "roadmap_nodes"(id) ON DELETE CASCADE,
  "depends_on_node_id" UUID NOT NULL REFERENCES "roadmap_nodes"(id) ON DELETE CASCADE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("node_id", "depends_on_node_id"),
  CHECK ("node_id" != "depends_on_node_id")
);

-- Create node_comments table
-- Context: Collaborative comments on specific nodes for team discussion
CREATE TABLE IF NOT EXISTS "node_comments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "node_id" UUID NOT NULL REFERENCES "roadmap_nodes"(id) ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "comment" TEXT NOT NULL,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create roadmap_collaborators table
-- Context: Tracks who has access to collaborate on each roadmap
CREATE TABLE IF NOT EXISTS "roadmap_collaborators" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roadmap_id" UUID NOT NULL REFERENCES "roadmaps"(id) ON DELETE CASCADE,
  "user_id" UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  "role" TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE("roadmap_id", "user_id")
);

-- Enable Row Level Security
ALTER TABLE "roadmaps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roadmap_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "node_dependencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "node_comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "roadmap_collaborators" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roadmaps
-- Context: Users can view roadmaps they own or are collaborators on
CREATE POLICY "roadmaps_select_own_or_collaborator"
  ON "roadmaps" FOR SELECT
  USING (
    created_by = auth.uid() OR
    id IN (
      SELECT roadmap_id FROM "roadmap_collaborators" WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "roadmaps_insert_own"
  ON "roadmaps" FOR INSERT
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "roadmaps_update_own_or_editor"
  ON "roadmaps" FOR UPDATE
  USING (
    created_by = auth.uid() OR
    id IN (
      SELECT roadmap_id FROM "roadmap_collaborators" 
      WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
    )
  );

CREATE POLICY "roadmaps_delete_own"
  ON "roadmaps" FOR DELETE
  USING (created_by = auth.uid());

-- RLS Policies for roadmap_nodes
-- Context: Node access follows roadmap access permissions
CREATE POLICY "roadmap_nodes_select_via_roadmap"
  ON "roadmap_nodes" FOR SELECT
  USING (
    roadmap_id IN (
      SELECT id FROM "roadmaps" 
      WHERE created_by = auth.uid() OR id IN (
        SELECT roadmap_id FROM "roadmap_collaborators" WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "roadmap_nodes_insert_via_roadmap"
  ON "roadmap_nodes" FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    roadmap_id IN (
      SELECT id FROM "roadmaps" 
      WHERE created_by = auth.uid() OR id IN (
        SELECT roadmap_id FROM "roadmap_collaborators" 
        WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
      )
    )
  );

CREATE POLICY "roadmap_nodes_update_via_roadmap"
  ON "roadmap_nodes" FOR UPDATE
  USING (
    roadmap_id IN (
      SELECT id FROM "roadmaps" 
      WHERE created_by = auth.uid() OR id IN (
        SELECT roadmap_id FROM "roadmap_collaborators" 
        WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
      )
    )
  );

CREATE POLICY "roadmap_nodes_delete_via_roadmap"
  ON "roadmap_nodes" FOR DELETE
  USING (
    roadmap_id IN (
      SELECT id FROM "roadmaps" 
      WHERE created_by = auth.uid() OR id IN (
        SELECT roadmap_id FROM "roadmap_collaborators" 
        WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
      )
    )
  );

-- RLS Policies for node_dependencies
-- Context: Dependencies follow node access permissions
CREATE POLICY "node_dependencies_select_via_node"
  ON "node_dependencies" FOR SELECT
  USING (
    node_id IN (SELECT id FROM "roadmap_nodes")
  );

CREATE POLICY "node_dependencies_insert_via_node"
  ON "node_dependencies" FOR INSERT
  WITH CHECK (
    node_id IN (SELECT id FROM "roadmap_nodes")
  );

CREATE POLICY "node_dependencies_delete_via_node"
  ON "node_dependencies" FOR DELETE
  USING (
    node_id IN (SELECT id FROM "roadmap_nodes")
  );

-- RLS Policies for node_comments
-- Context: Anyone who can view a node can comment on it
CREATE POLICY "node_comments_select_via_node"
  ON "node_comments" FOR SELECT
  USING (
    node_id IN (SELECT id FROM "roadmap_nodes")
  );

CREATE POLICY "node_comments_insert_own"
  ON "node_comments" FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND
    node_id IN (SELECT id FROM "roadmap_nodes")
  );

CREATE POLICY "node_comments_update_own"
  ON "node_comments" FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "node_comments_delete_own"
  ON "node_comments" FOR DELETE
  USING (user_id = auth.uid());

-- RLS Policies for roadmap_collaborators
-- Context: Only roadmap owners can manage collaborators
CREATE POLICY "roadmap_collaborators_select_via_roadmap"
  ON "roadmap_collaborators" FOR SELECT
  USING (
    roadmap_id IN (SELECT id FROM "roadmaps" WHERE created_by = auth.uid()) OR
    user_id = auth.uid()
  );

CREATE POLICY "roadmap_collaborators_insert_owner"
  ON "roadmap_collaborators" FOR INSERT
  WITH CHECK (
    roadmap_id IN (SELECT id FROM "roadmaps" WHERE created_by = auth.uid())
  );

CREATE POLICY "roadmap_collaborators_delete_owner"
  ON "roadmap_collaborators" FOR DELETE
  USING (
    roadmap_id IN (SELECT id FROM "roadmaps" WHERE created_by = auth.uid())
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "idx_roadmap_nodes_roadmap_id" ON "roadmap_nodes"("roadmap_id");
CREATE INDEX IF NOT EXISTS "idx_node_dependencies_node_id" ON "node_dependencies"("node_id");
CREATE INDEX IF NOT EXISTS "idx_node_dependencies_depends_on" ON "node_dependencies"("depends_on_node_id");
CREATE INDEX IF NOT EXISTS "idx_node_comments_node_id" ON "node_comments"("node_id");
CREATE INDEX IF NOT EXISTS "idx_roadmap_collaborators_roadmap_id" ON "roadmap_collaborators"("roadmap_id");
CREATE INDEX IF NOT EXISTS "idx_roadmap_collaborators_user_id" ON "roadmap_collaborators"("user_id");
