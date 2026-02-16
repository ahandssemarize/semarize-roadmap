"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { RoadmapNode, NodeDependency } from "@/lib/types/roadmap"
import { RoadmapGrid, type Lane, type Column, getCellPosition, GRID } from "@/components/roadmap-grid"
import { Button } from "@/components/ui/button"
import { NodeDialog } from "@/components/node-dialog"
import { NodeDetailsPanel } from "@/components/node-details-panel"
import { LaneDetailsPanel } from "@/components/lane-details-panel"
import { Input } from "@/components/ui/input"
import { v4 as uuidv4 } from "uuid"
import { useToast } from "@/hooks/use-toast"
import { Minimize2 } from "lucide-react"

// Default lane definitions (without IDs)
const DEFAULT_LANES_CONFIG = [
  { name: "Core Features", color: "#3b82f6", expanded: false },
  { name: "Infrastructure", color: "#10b981", expanded: false },
  { name: "User Experience", color: "#f59e0b", expanded: false },
]

// Default columns - more columns, mostly empty, with a few time gates
const DEFAULT_COLUMNS_CONFIG = [
  { name: "Q1 2025" },
  { name: "" },
  { name: "" },
  { name: "Q2 2025" },
  { name: "" },
  { name: "" },
  { name: "Q3 2025" },
  { name: "" },
]

export default function RoadmapDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [roadmapTitle, setRoadmapTitle] = useState("")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [nodes, setNodes] = useState<RoadmapNode[]>([])
  const [dependencies, setDependencies] = useState<NodeDependency[]>([])
  const [lanes, setLanes] = useState<Lane[]>([])
  const [columns, setColumns] = useState<Column[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isCompactView, setIsCompactView] = useState(false)
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showNodeDialog, setShowNodeDialog] = useState(false)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null)
  const [pinnedColumnId, setPinnedColumnId] = useState<string | null>(null)
  const [scrollContainerRef, setScrollContainerRef] = useState<HTMLDivElement | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [id])

  useEffect(() => {
    if (roadmapTitle) {
      document.title = roadmapTitle
    }

    // Reset to default title when component unmounts
    return () => {
      document.title = "Product roadmap builder"
    }
  }, [roadmapTitle])

  // Scroll to pinned column on load
  useEffect(() => {
    if (!scrollContainerRef || !pinnedColumnId || columns.length === 0) return

    const columnIndex = columns.findIndex((c) => c.id === pinnedColumnId)
    if (columnIndex === -1) return

    // Calculate the X position of the pinned column
    const scrollX = GRID.LANE_HEADER_WIDTH + columnIndex * GRID.CELL_WIDTH

    // Scroll to show the pinned column as the leftmost visible column
    scrollContainerRef.scrollLeft = scrollX - GRID.LANE_HEADER_WIDTH
  }, [scrollContainerRef, pinnedColumnId, columns])

  const loadData = async () => {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUser(user)

    if (!user) {
      router.push("/auth/login")
      return
    }

    // Load roadmap
    const { data: roadmap } = await supabase.from("roadmaps").select("*").eq("id", id).single()

    if (!roadmap) {
      router.push("/roadmaps")
      return
    }

    setRoadmapTitle(roadmap.title)
    setPinnedColumnId(roadmap.pinned_column_id || null)

    // Load nodes
    const { data: nodesData } = await supabase.from("roadmap_nodes").select("*").eq("roadmap_id", id)

    // Load dependencies
    const nodeIds = nodesData?.map((n) => n.id) || []
    let depsData: NodeDependency[] = []
    if (nodeIds.length > 0) {
      const { data } = await supabase.from("node_dependencies").select("*").in("node_id", nodeIds)
      depsData = data || []
    }

    const { data: lanesData } = await supabase
      .from("roadmap_lanes")
      .select("*")
      .eq("roadmap_id", id)
      .order("order_index")

    const { data: columnsData } = await supabase
      .from("roadmap_columns")
      .select("*")
      .eq("roadmap_id", id)
      .order("order_index")

    setNodes(nodesData || [])
    setDependencies(depsData)

    if (!lanesData || lanesData.length === 0) {
      const defaultLanesToInsert = DEFAULT_LANES_CONFIG.map((lane, index) => ({
        id: uuidv4(),
        roadmap_id: id,
        name: lane.name,
        color: lane.color,
        order_index: index,
        expanded: lane.expanded,
      }))

      const { data: insertedLanes } = await supabase.from("roadmap_lanes").insert(defaultLanesToInsert).select()

      if (insertedLanes) {
        setLanes(
          insertedLanes.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color,
            expanded: l.expanded,
            description: l.description,
          })),
        )
      }
    } else {
      setLanes(
        lanesData.map((l) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          expanded: l.expanded,
          description: l.description,
        })),
      )
    }

    if (!columnsData || columnsData.length === 0) {
      const defaultColumnsToInsert = DEFAULT_COLUMNS_CONFIG.map((col, index) => ({
        id: uuidv4(),
        roadmap_id: id,
        name: col.name,
        order_index: index,
      }))

      const { data: insertedColumns } = await supabase.from("roadmap_columns").insert(defaultColumnsToInsert).select()

      if (insertedColumns) {
        setColumns(insertedColumns.map((c) => ({ id: c.id, name: c.name || "" })))
      }
    } else {
      setColumns(columnsData.map((c) => ({ id: c.id, name: c.name || "" })))
    }

    setIsLoading(false)
  }

  const handleUpdateTitle = async () => {
    if (!roadmapTitle.trim()) return
    setIsEditingTitle(false)

    const supabase = createClient()
    await supabase.from("roadmaps").update({ title: roadmapTitle }).eq("id", id)
  }

  const handleNodeClick = (nodeId: string) => {
    setSelectedLaneId(null)
    setSelectedNodeId(nodeId)
  }

  const handleNodeMove = async (nodeId: string, x: number, y: number) => {
    const previousNodes = [...nodes]
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, position_x: x, position_y: y } : n)))

    try {
      const supabase = createClient()
      const { error } = await supabase.from("roadmap_nodes").update({ position_x: x, position_y: y }).eq("id", nodeId)

      if (error) throw error
    } catch (error) {
      console.error("Error moving node:", error)
      setNodes(previousNodes)

      toast({
        title: "Error moving node",
        description: "Failed to save node position. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAddNode = (laneIndex: number, columnIndex: number) => {
    const { x, y } = getCellPosition(columnIndex, laneIndex)
    setPendingNodePosition({ x, y })
    setShowNodeDialog(true)
  }

  const handleNodeSaved = async (newNode?: RoadmapNode) => {
    setShowNodeDialog(false)
    setPendingNodePosition(null)
    setEditingNodeId(null)

    if (newNode) {
      setNodes((prev) => [...prev, newNode])
    } else {
      await loadData()
    }
  }

  const handleNodeUpdate = (updatedNode: RoadmapNode) => {
    setNodes((prev) => prev.map((n) => (n.id === updatedNode.id ? updatedNode : n)))
  }

  const handleNodeDelete = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId))
    setDependencies((prev) => prev.filter((d) => d.node_id !== nodeId && d.depends_on_node_id !== nodeId))
    setSelectedNodeId(null)
  }

  const handleDependencyCreate = (dependency: NodeDependency) => {
    setDependencies((prev) => [...prev, dependency])
  }

  const handleLaneClick = (laneId: string) => {
    setSelectedNodeId(null)
    setSelectedLaneId(laneId)
  }

  const handleLaneAdd = async () => {
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]

    try {
      const supabase = createClient()
      
      // Fetch current lanes from database to get accurate max order_index
      // This prevents duplicate order_index values that cause lane positioning bugs
      const { data: existingLanes } = await supabase
        .from("roadmap_lanes")
        .select("order_index")
        .eq("roadmap_id", id)
      
      const maxOrderIndex = existingLanes && existingLanes.length > 0 
        ? Math.max(...existingLanes.map(l => l.order_index))
        : -1
      
      const { data: newLaneData } = await supabase
        .from("roadmap_lanes")
        .insert({
          id: uuidv4(),
          roadmap_id: id,
          name: `Lane ${lanes.length + 1}`,
          color: colors[lanes.length % colors.length],
          order_index: maxOrderIndex + 1,
          expanded: false,
        })
        .select()
        .single()

      if (newLaneData) {
        const newLane: Lane = {
          id: newLaneData.id,
          name: newLaneData.name,
          color: newLaneData.color,
          expanded: newLaneData.expanded,
          description: newLaneData.description,
        }
        setLanes((prev) => [...prev, newLane])
      }
    } catch (error) {
      console.error("Error adding lane:", error)
    }
  }

  const handleLaneUpdate = async (laneId: string, name: string) => {
    const previousLanes = [...lanes]
    setLanes((prev) => prev.map((l) => (l.id === laneId ? { ...l, name } : l)))

    try {
      const supabase = createClient()
      const { error } = await supabase.from("roadmap_lanes").update({ name }).eq("id", laneId)

      if (error) throw error
    } catch (error) {
      console.error("Error updating lane:", error)
      setLanes(previousLanes)

      toast({
        title: "Error updating lane",
        description: "Failed to save lane changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleLaneDelete = async (laneId: string) => {
    const previousLanes = [...lanes]
    setLanes((prev) => prev.filter((l) => l.id !== laneId))

    try {
      const supabase = createClient()
      const { error } = await supabase.from("roadmap_lanes").delete().eq("id", laneId)

      if (error) throw error
    } catch (error) {
      console.error("Error deleting lane:", error)
      setLanes(previousLanes)

      toast({
        title: "Error deleting lane",
        description: "Failed to delete lane. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleLaneReorder = async (laneId: string, direction: "up" | "down") => {
    const currentIndex = lanes.findIndex((l) => l.id === laneId)
    if (currentIndex === -1) return

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= lanes.length) return

    const previousLanes = [...lanes]
    const previousNodes = [...nodes]

    // Reorder lanes array
    const newLanes = [...lanes]
    const [movedLane] = newLanes.splice(currentIndex, 1)
    newLanes.splice(targetIndex, 0, movedLane)
    setLanes(newLanes)

    // Helper function to get the Y position range for a lane based on its index
    const getLaneYRange = (laneIndex: number, lanesArray: Lane[]) => {
      let yStart = GRID.COLUMN_HEADER_HEIGHT
      for (let i = 0; i < laneIndex; i++) {
        const laneHeight = lanesArray[i].expanded ? GRID.CELL_HEIGHT * 2 : GRID.CELL_HEIGHT
        yStart += laneHeight
      }
      const currentLaneHeight = lanesArray[laneIndex].expanded ? GRID.CELL_HEIGHT * 2 : GRID.CELL_HEIGHT
      return { yStart, yEnd: yStart + currentLaneHeight }
    }

    // Helper function to determine which lane a node's Y position falls into
    const getNodeLaneIndex = (nodeY: number, lanesArray: Lane[]) => {
      let currentY = GRID.COLUMN_HEADER_HEIGHT
      for (let i = 0; i < lanesArray.length; i++) {
        const laneHeight = lanesArray[i].expanded ? GRID.CELL_HEIGHT * 2 : GRID.CELL_HEIGHT
        if (nodeY >= currentY && nodeY < currentY + laneHeight) {
          return i
        }
        currentY += laneHeight
      }
      return -1
    }

    // Calculate how much each lane needs to shift
    const currentLaneHeight = lanes[currentIndex].expanded ? GRID.CELL_HEIGHT * 2 : GRID.CELL_HEIGHT
    const targetLaneHeight = lanes[targetIndex].expanded ? GRID.CELL_HEIGHT * 2 : GRID.CELL_HEIGHT

    // Update node positions
    const updatedNodes = nodes.map((node) => {
      const nodeLaneIndex = getNodeLaneIndex(node.position_y, lanes)

      if (nodeLaneIndex === currentIndex) {
        // Node is in the lane being moved
        if (direction === "up") {
          // Moving up: subtract the target lane's height
          return { ...node, position_y: node.position_y - targetLaneHeight }
        } else {
          // Moving down: add the target lane's height
          return { ...node, position_y: node.position_y + targetLaneHeight }
        }
      } else if (nodeLaneIndex === targetIndex) {
        // Node is in the lane being swapped with
        if (direction === "up") {
          // Current lane moving up means target lane moves down
          return { ...node, position_y: node.position_y + currentLaneHeight }
        } else {
          // Current lane moving down means target lane moves up
          return { ...node, position_y: node.position_y - currentLaneHeight }
        }
      }
      return node
    })

    setNodes(updatedNodes)

    // Update database
    try {
      const supabase = createClient()

      // Update order_index for both lanes
      await supabase.from("roadmap_lanes").update({ order_index: targetIndex }).eq("id", laneId)
      await supabase.from("roadmap_lanes").update({ order_index: currentIndex }).eq("id", lanes[targetIndex].id)

      // Update node positions
      for (const node of updatedNodes) {
        const originalNode = nodes.find((n) => n.id === node.id)
        if (originalNode && originalNode.position_y !== node.position_y) {
          await supabase.from("roadmap_nodes").update({ position_y: node.position_y }).eq("id", node.id)
        }
      }
    } catch (error) {
      console.error("Error reordering lane:", error)
      setLanes(previousLanes)
      setNodes(previousNodes)

      toast({
        title: "Error reordering lane",
        description: "Failed to move workstream. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleColumnAdd = async (atIndex?: number) => {
    const insertAt = atIndex ?? columns.length

    const insertPixelX = GRID.LANE_HEADER_WIDTH + insertAt * GRID.CELL_WIDTH

    const nodesToShift = nodes.filter((node) => node.position_x >= insertPixelX)

    if (nodesToShift.length > 0) {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.position_x >= insertPixelX) {
            return { ...node, position_x: node.position_x + GRID.CELL_WIDTH }
          }
          return node
        }),
      )
    }

    const supabase = createClient()

    try {
      const { data: newColumnData } = await supabase
        .from("roadmap_columns")
        .insert({
          id: uuidv4(),
          roadmap_id: id,
          name: "",
          order_index: insertAt,
        })
        .select()
        .single()

      if (newColumnData) {
        const newColumn: Column = {
          id: newColumnData.id,
          name: newColumnData.name || "",
        }

        const newColumns = [...columns]
        newColumns.splice(insertAt, 0, newColumn)
        setColumns(newColumns)

        for (let i = insertAt + 1; i < newColumns.length; i++) {
          await supabase.from("roadmap_columns").update({ order_index: i }).eq("id", newColumns[i].id)
        }

        for (const node of nodesToShift) {
          await supabase
            .from("roadmap_nodes")
            .update({ position_x: node.position_x + GRID.CELL_WIDTH })
            .eq("id", node.id)
        }
      }
    } catch (error) {
      console.error("Error adding column:", error)
    }
  }

  const handleColumnUpdate = async (columnId: string, name: string) => {
    const previousColumns = [...columns]
    setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name } : c)))

    try {
      const supabase = createClient()
      const { error } = await supabase.from("roadmap_columns").update({ name }).eq("id", columnId)

      if (error) throw error
    } catch (error) {
      console.error("Error updating column:", error)
      setColumns(previousColumns)

      toast({
        title: "Error updating column",
        description: "Failed to save column changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleColumnDelete = async (columnId: string) => {
    const deleteIndex = columns.findIndex((c) => c.id === columnId)
    if (deleteIndex === -1) return

    const newColumns = columns.filter((c) => c.id !== columnId)

    const deletePixelX = GRID.LANE_HEADER_WIDTH + deleteIndex * GRID.CELL_WIDTH

    setColumns(newColumns)

    const shiftThreshold = deletePixelX + GRID.CELL_WIDTH
    const nodesToShift = nodes.filter((node) => node.position_x >= shiftThreshold)

    if (nodesToShift.length > 0) {
      setNodes((prev) =>
        prev.map((node) => {
          if (node.position_x >= shiftThreshold) {
            return { ...node, position_x: node.position_x - GRID.CELL_WIDTH }
          }
          return node
        }),
      )
    }

    const supabase = createClient()

    try {
      await supabase.from("roadmap_columns").delete().eq("id", columnId)

      for (let i = deleteIndex; i < newColumns.length; i++) {
        await supabase.from("roadmap_columns").update({ order_index: i }).eq("id", newColumns[i].id)
      }

      for (const node of nodesToShift) {
        await supabase
          .from("roadmap_nodes")
          .update({ position_x: node.position_x - GRID.CELL_WIDTH })
          .eq("id", node.id)
      }

      // If deleting the pinned column, clear the pin
      if (columnId === pinnedColumnId) {
        setPinnedColumnId(null)
        await supabase.from("roadmaps").update({ pinned_column_id: null }).eq("id", id)
      }
    } catch (error) {
      console.error("Error deleting column:", error)
    }
  }

  const handleColumnPin = async (columnId: string) => {
    setPinnedColumnId(columnId)

    try {
      const supabase = createClient()
      await supabase.from("roadmaps").update({ pinned_column_id: columnId }).eq("id", id)

      toast({
        title: "Column pinned",
        description: "The view will scroll to this column on page load.",
      })
    } catch (error) {
      console.error("Error pinning column:", error)
      toast({
        title: "Error pinning column",
        description: "Failed to save pin. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleColumnUnpin = async () => {
    setPinnedColumnId(null)

    try {
      const supabase = createClient()
      await supabase.from("roadmaps").update({ pinned_column_id: null }).eq("id", id)

      toast({
        title: "Column unpinned",
        description: "The view will no longer scroll to a specific column.",
      })
    } catch (error) {
      console.error("Error unpinning column:", error)
      toast({
        title: "Error unpinning column",
        description: "Failed to remove pin. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading roadmap...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/roadmaps")}>
            ← Back
          </Button>

          {isEditingTitle ? (
            <Input
              value={roadmapTitle}
              onChange={(e) => setRoadmapTitle(e.target.value)}
              onBlur={handleUpdateTitle}
              onKeyDown={(e) => e.key === "Enter" && handleUpdateTitle()}
              className="w-64"
              autoFocus
            />
          ) : (
            <h1
              className="cursor-pointer text-xl font-semibold hover:text-muted-foreground"
              onClick={() => setIsEditingTitle(true)}
            >
              {roadmapTitle}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCompactView(!isCompactView)}
            className="flex items-center gap-2"
          >
            <Minimize2 className="h-4 w-4" />
            {isCompactView ? "Normal View" : "Compact View"}
          </Button>
          <Button variant="outline" onClick={() => router.push(`/roadmaps/${id}/notepad`)}>
            Notepad
          </Button>
          <Button>Invite</Button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <div ref={setScrollContainerRef} className="flex-1 min-w-0 overflow-auto">
          <RoadmapGrid
            roadmapId={id}
            nodes={nodes}
            dependencies={dependencies}
            lanes={lanes}
            columns={columns}
            onNodeClick={handleNodeClick}
            onNodeMove={handleNodeMove}
            onAddNode={handleAddNode}
            onLaneAdd={handleLaneAdd}
            onLaneUpdate={handleLaneUpdate}
            onLaneDelete={handleLaneDelete}
            onLaneClick={handleLaneClick}
            onLaneReorder={handleLaneReorder}
            onColumnAdd={handleColumnAdd}
            onColumnUpdate={handleColumnUpdate}
            onColumnDelete={handleColumnDelete}
            onColumnPin={handleColumnPin}
            onColumnUnpin={handleColumnUnpin}
            pinnedColumnId={pinnedColumnId}
            onDependencyCreate={handleDependencyCreate}
            isCompactView={isCompactView}
          />
        </div>

        {selectedLaneId && (
          <div className="relative z-50 w-96 shrink-0 border-l bg-white overflow-y-auto">
            <LaneDetailsPanel
              laneId={selectedLaneId}
              roadmapId={id}
              onClose={() => setSelectedLaneId(null)}
              onUpdate={() => loadData()}
              onDelete={handleLaneDelete}
            />
          </div>
        )}

        {selectedNodeId && (
          <div className="relative z-50 w-96 shrink-0 border-l bg-white overflow-y-auto">
            <NodeDetailsPanel
              nodeId={selectedNodeId}
              roadmapId={id}
              onClose={() => setSelectedNodeId(null)}
              onUpdate={(node) => {
                if (node) handleNodeUpdate(node)
                else loadData()
              }}
              onDelete={handleNodeDelete}
            />
          </div>
        )}
      </div>

      <NodeDialog
        open={showNodeDialog}
        onOpenChange={(open) => {
          setShowNodeDialog(open)
          if (!open) setEditingNodeId(null)
        }}
        roadmapId={id}
        nodeId={editingNodeId}
        onSaved={handleNodeSaved}
        userId={user?.id}
        pendingPosition={pendingNodePosition || undefined}
      />
    </div>
  )
}
