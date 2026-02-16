"use client"

import type React from "react"
import { useCallback, useState, useRef, useEffect } from "react"
import type { RoadmapNode, NodeDependency } from "@/lib/types/roadmap"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  Plus,
  Trash2,
  MoreHorizontal,
  Play,
  Calendar,
  ChevronsUpDown,
  Minimize2,
  Paperclip,
  ChevronUp,
  ChevronDown,
  Pin,
  PinOff,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

// Grid configuration - 50% larger than previous
const GRID = {
  CELL_WIDTH: 360,
  CELL_HEIGHT: 360,
  LANE_HEADER_WIDTH: 200,
  COLUMN_HEADER_HEIGHT: 52,
  NODE_WIDTH: Math.round(360 * 0.7), // 252px
  NODE_HEIGHT: Math.round(360 * 0.7), // 252px
  NODE_PADDING: 24, // Padding from top/bottom of lane
  COMPACT_LANE_HEIGHT: 200, // Height to fit 4 lines of title + full status chip
  COMPACT_NODE_HEIGHT: 152, // 200 - (24*2) for padding
}

export interface Lane {
  id: string
  name: string
  color: string
  description?: string
}

export interface Column {
  id: string
  name: string
}

interface RoadmapGridProps {
  roadmapId: string
  nodes: RoadmapNode[]
  dependencies: NodeDependency[]
  lanes: Lane[]
  columns: Column[]
  onNodeClick: (nodeId: string) => void
  onNodeMove: (nodeId: string, x: number, y: number) => void
  onAddNode: (laneIndex: number, columnIndex: number) => void
  onLaneAdd: () => void
  onLaneUpdate: (laneId: string, name: string) => void
  onLaneDelete: (laneId: string) => void
  onLaneClick?: (laneId: string) => void
  onLaneReorder?: (laneId: string, direction: "up" | "down") => void
  onColumnAdd: (atIndex?: number) => void
  onColumnUpdate: (columnId: string, name: string) => void
  onColumnDelete: (columnId: string) => void
  onColumnPin?: (columnId: string) => void
  onColumnUnpin?: () => void
  pinnedColumnId?: string | null
  onDependencyCreate?: (dependency: NodeDependency) => void
  isCompactView?: boolean
}

// Status badge config
const statusBadge = {
  planned: { bg: "bg-white/80", text: "text-slate-600", label: "Planned" },
  "in-progress": { bg: "bg-white/80", text: "text-emerald-700", label: "In Progress" },
  completed: { bg: "bg-white/80", text: "text-slate-700", label: "Complete" },
  blocked: { bg: "bg-white/80", text: "text-red-700", label: "Blocked" },
}

// Helper to blend a hex color with white to create an opaque equivalent
// This prevents cell backgrounds from showing through semi-transparent node backgrounds
function blendWithWhite(hexColor: string, opacity: number): string {
  // Parse hex color (supports #RGB and #RRGGBB)
  let r: number, g: number, b: number
  const hex = hexColor.replace('#', '')
  
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16)
    g = parseInt(hex[1] + hex[1], 16)
    b = parseInt(hex[2] + hex[2], 16)
  } else {
    r = parseInt(hex.slice(0, 2), 16)
    g = parseInt(hex.slice(2, 4), 16)
    b = parseInt(hex.slice(4, 6), 16)
  }
  
  // Blend with white (255, 255, 255)
  const blendedR = Math.round(r * opacity + 255 * (1 - opacity))
  const blendedG = Math.round(g * opacity + 255 * (1 - opacity))
  const blendedB = Math.round(b * opacity + 255 * (1 - opacity))
  
  return `rgb(${blendedR}, ${blendedG}, ${blendedB})`
}

// CRITICAL: These functions use BASE cell height (360px) to interpret stored positions.
// Node positions are ALWAYS stored using base heights, regardless of view mode.
// This ensures nodes stay in their correct logical row when switching views.

// Helper to get grid cell (row/col) from pixel position using BASE cell height
// This is the CANONICAL way to interpret stored node positions
// Note: Table uses border-collapse so borders don't add extra width
export function getGridCell(x: number, y: number): { col: number; row: number } {
  const centeringOffset = (GRID.CELL_WIDTH - GRID.NODE_WIDTH) / 2
  
  // Simple formula: x = LANE_HEADER_WIDTH + col * CELL_WIDTH + centeringOffset
  const col = Math.round((x - GRID.LANE_HEADER_WIDTH - centeringOffset) / GRID.CELL_WIDTH)
  const row = Math.round((y - GRID.COLUMN_HEADER_HEIGHT - GRID.NODE_PADDING) / GRID.CELL_HEIGHT)
  return { col: Math.max(0, col), row: Math.max(0, row) }
}

// Helper to get centered pixel position for a grid cell using BASE height
// Use this for STORING positions in the database
// Note: Table uses border-collapse so borders don't add extra width
export function getCellPosition(col: number, row: number): { x: number; y: number } {
  const centeringOffset = (GRID.CELL_WIDTH - GRID.NODE_WIDTH) / 2
  const x = GRID.LANE_HEADER_WIDTH + col * GRID.CELL_WIDTH + centeringOffset
  const y = GRID.COLUMN_HEADER_HEIGHT + row * GRID.CELL_HEIGHT + GRID.NODE_PADDING
  return { x, y }
}

// Snap a position to the nearest grid cell (returns base position for storage)
export function snapToGrid(x: number, y: number): { x: number; y: number } {
  const { col, row } = getGridCell(x, y)
  return getCellPosition(col, row)
}

// Editable text for column headers
function ColumnHeader({
  column,
  onUpdate,
  onDelete,
  onPin,
  onUnpin,
  isPinned,
}: {
  column: Column
  onUpdate: (name: string) => void
  onDelete: () => void
  onPin?: () => void
  onUnpin?: () => void
  isPinned?: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(column.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setText(column.name)
  }, [column.name])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    setIsEditing(false)
    onUpdate(text.trim())
  }

  const hasLabel = column.name.trim() !== ""

  if (isEditing) {
    return (
      <div className="flex items-center justify-center gap-1 px-2">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave()
            if (e.key === "Escape") {
              setText(column.name)
              setIsEditing(false)
            }
          }}
          placeholder="e.g. Q1 2025"
          className="h-7 text-sm text-center"
        />
      </div>
    )
  }

  return (
    <div className="group relative flex h-full items-center justify-center px-3">
      {hasLabel ? (
        <>
          <div className="flex items-center gap-1">
            {isPinned && (
              <Pin className="h-3 w-3 text-primary shrink-0" />
            )}
            <span
              className="cursor-pointer truncate text-sm font-semibold hover:text-primary"
              onDoubleClick={() => setIsEditing(true)}
              title="Double-click to edit"
            >
              {column.name}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 absolute right-2"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white shadow-lg border">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Calendar className="mr-2 h-4 w-4" />
                Edit date
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUpdate("")}>Clear date</DropdownMenuItem>
              <DropdownMenuSeparator />
              {onPin && onUnpin && (
                <>
                  {isPinned ? (
                    <DropdownMenuItem onClick={onUnpin}>
                      <PinOff className="mr-2 h-4 w-4" />
                      Unpin column
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onPin}>
                      <Pin className="mr-2 h-4 w-4" />
                      Pin column
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : (
        <>
          {isPinned && (
            <Pin className="h-3 w-3 text-primary shrink-0 mr-2" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="bg-white shadow-lg border">
              <DropdownMenuItem onClick={() => setIsEditing(true)}>
                <Calendar className="mr-2 h-4 w-4" />
                Add date
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {onPin && onUnpin && (
                <>
                  {isPinned ? (
                    <DropdownMenuItem onClick={onUnpin}>
                      <PinOff className="mr-2 h-4 w-4" />
                      Unpin column
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={onPin}>
                      <Pin className="mr-2 h-4 w-4" />
                      Pin column
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete column
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

// Editable lane name
function EditableLaneName({
  value,
  onSave,
}: {
  value: string
  onSave: (value: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [text, setText] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = () => {
    setIsEditing(false)
    if (text.trim() && text !== value) {
      onSave(text.trim())
    } else {
      setText(value)
    }
  }

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave()
          if (e.key === "Escape") {
            setText(value)
            setIsEditing(false)
          }
        }}
        className="h-7 text-sm"
      />
    )
  }

  return (
    <span
      className="cursor-pointer truncate text-sm font-medium hover:text-primary"
      onDoubleClick={() => setIsEditing(true)}
      title="Click to edit lane details"
    >
      {value}
    </span>
  )
}

// Node card - colored by lane, height can vary
function NodeCard({
  node,
  laneColor,
  nodeHeight,
  style,
  onClick,
  onDragStart,
  onDragEnd,
  isExpanded,
  isCompactView,
}: {
  node: RoadmapNode
  laneColor: string
  nodeHeight: number
  style: React.CSSProperties
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  isExpanded?: boolean
  isCompactView?: boolean
}) {
  const status = statusBadge[node.status]

  // Context: Load attachment count for this node
  const [attachmentCount, setAttachmentCount] = useState(0)

  useEffect(() => {
    const loadAttachmentCount = async () => {
      const supabase = createClient()
      const { count } = await supabase
        .from("node_attachments")
        .select("*", { count: "exact", head: true })
        .eq("node_id", node.id)

      setAttachmentCount(count || 0)
    }

    loadAttachmentCount()
  }, [node.id])

  // Use opaque background (blended with white) so cell backgrounds don't show through
  const bgColor = blendWithWhite(laneColor, 0.12)

  // Determine the border style based on status
  let borderStyle = {
    borderColor: `${laneColor}CC`,
    borderWidth: "2px",
    borderStyle: "solid",
  }

  if (node.status === "planned") {
    borderStyle = {
      borderColor: `${laneColor}60`,
      borderWidth: "2px",
      borderStyle: "dashed",
    }
  } else if (node.status === "completed") {
    borderStyle = {
      borderColor: "#64748b", // slate-500
      borderWidth: "3px",
      borderStyle: "solid",
    }
  } else if (node.status === "in-progress") {
    borderStyle = {
      borderColor: `${laneColor}CC`,
      borderWidth: "4px",
      borderStyle: "solid",
    }
  } else if (node.status === "blocked") {
    // For blocked, we'll use a black dashed border and add red via pseudo-element
    borderStyle = {
      borderColor: "#000", // Black dashed base
      borderWidth: "3px",
      borderStyle: "dashed",
    }
  }

  const cardClassName = `absolute cursor-grab active:cursor-grabbing p-4 shadow-sm transition-all select-none hover:shadow-lg hover:z-10 ${
    node.status === "blocked" ? "blocked-node" : ""
  }`

  return (
    <Card
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cardClassName}
      style={{
        ...style,
        width: GRID.NODE_WIDTH,
        height: nodeHeight,
        backgroundColor: bgColor,
        ...borderStyle,
      }}
      onMouseDown={(e) => {
        // If clicking on a drag handle or other interactive element, prevent card drag
        const target = e.target as HTMLElement
        if (target.closest("[data-dependency-handle]")) {
          e.preventDefault()
        }
      }}
    >
      <div className="flex h-full flex-col gap-2 overflow-hidden">
        <div className="flex items-start gap-2">
          {node.status === "in-progress" && !isCompactView && (
            <Play className="mt-0.5 h-4 w-4 shrink-0 fill-current text-emerald-500" />
          )}
          <h3
            className={cn(
              "text-base font-semibold leading-tight text-slate-800",
              isCompactView ? "line-clamp-4" : "line-clamp-3",
            )}
          >
            {node.title}
          </h3>
        </div>
        {!isCompactView && (
          <div
            className={cn(
              "flex-1 text-sm text-slate-600",
              node.description
                ? isExpanded
                  ? "overflow-y-auto [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-400"
                  : "overflow-hidden"
                : "",
            )}
            style={
              node.description && !isExpanded
                ? {
                    display: "-webkit-box",
                    WebkitLineClamp: Math.max(2, Math.floor(nodeHeight / 80)),
                    WebkitBoxOrient: "vertical",
                  }
                : undefined
            }
          >
            {node.description}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap mt-auto">
          <span className={cn("w-fit rounded-full border px-2.5 py-1 text-xs font-medium", status.bg, status.text)}>
            {status.label}
          </span>
          {attachmentCount > 0 && !isCompactView && (
            <span className="w-fit rounded-full border border-slate-300 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-600 flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {attachmentCount}
            </span>
          )}
        </div>
      </div>
    </Card>
  )
}

export function RoadmapGrid({
  roadmapId,
  nodes,
  dependencies,
  lanes,
  columns,
  onNodeClick,
  onNodeMove,
  onAddNode,
  onLaneAdd,
  onLaneUpdate,
  onLaneDelete,
  onLaneClick,
  onLaneReorder,
  onColumnAdd,
  onColumnUpdate,
  onColumnDelete,
  onColumnPin,
  onColumnUnpin,
  pinnedColumnId,
  onDependencyCreate,
  isCompactView = false,
}: RoadmapGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ row: number; col: number } | null>(null)

  const [dependencyDrag, setDependencyDrag] = useState<{
    sourceNodeId: string
    currentX: number
    currentY: number
  } | null>(null)

  // Track expanded lanes
  const [expandedLanes, setExpandedLanes] = useState<Set<string>>(new Set())

  const toggleLaneExpanded = (laneId: string) => {
    setExpandedLanes((prev) => {
      const next = new Set(prev)
      if (next.has(laneId)) {
        next.delete(laneId)
      } else {
        next.add(laneId)
      }
      return next
    })
  }

  const getLaneHeight = useCallback(
    (laneId: string) => {
      if (isCompactView) {
        return GRID.COMPACT_LANE_HEIGHT
      }
      return expandedLanes.has(laneId) ? GRID.CELL_HEIGHT * 2 : GRID.CELL_HEIGHT
    },
    [isCompactView, expandedLanes],
  )

  // Calculate Y position accounting for expanded lanes above
  const getLaneYOffset = useCallback(
    (laneIndex: number) => {
      let y = GRID.COLUMN_HEADER_HEIGHT
      for (let i = 0; i < laneIndex; i++) {
        y += getLaneHeight(lanes[i].id)
      }
      return y
    },
    [lanes, getLaneHeight],
  )

  // This function determines which row/col a stored position belongs to.
  // CRITICAL: Uses BASE cell heights because positions are stored using base heights.
  // The context-aware part is only for display, not for interpreting stored positions.
  const getGridCellWithContext = useCallback(
    (x: number, y: number): { col: number; row: number } => {
      // ALWAYS use base cell heights to interpret stored positions
      // This ensures nodes stay in their correct logical row regardless of view mode
      return getGridCell(x, y)
    },
    [],
  )

  // This ensures nodes are positioned correctly in the current view mode
  // Note: Table uses border-collapse so borders don't add extra width
  const getCellPositionWithContext = useCallback(
    (col: number, row: number): { x: number; y: number } => {
      const centeringOffset = (GRID.CELL_WIDTH - GRID.NODE_WIDTH) / 2
      const x = GRID.LANE_HEADER_WIDTH + col * GRID.CELL_WIDTH + centeringOffset
      const y = getLaneYOffset(row) + GRID.NODE_PADDING
      
      return { x, y }
    },
    [getLaneYOffset],
  )

  const snapToGridWithContext = useCallback(
    (x: number, y: number): { x: number; y: number } => {
      const { col, row } = getGridCellWithContext(x, y)
      return getCellPositionWithContext(col, row)
    },
    [getGridCellWithContext, getCellPositionWithContext],
  )

  // Calculate total dimensions
  const totalWidth = GRID.LANE_HEADER_WIDTH + columns.length * GRID.CELL_WIDTH + 48
  const totalHeight = lanes.reduce((sum, lane) => sum + getLaneHeight(lane.id), GRID.COLUMN_HEADER_HEIGHT) + 48

  // Handle drag over cells
  const handleCellDragOver = useCallback((e: React.DragEvent, row: number, col: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDropTarget({ row, col })
  }, [])

  // Handle drop on cell - ALWAYS store positions using BASE heights
  // This ensures consistent position interpretation across view modes
  const handleCellDrop = useCallback(
    (e: React.DragEvent, row: number, col: number) => {
      e.preventDefault()
      if (draggedNodeId) {
        // Use BASE getCellPosition for STORING, not view-dependent position
        const { x, y } = getCellPosition(col, row)
        onNodeMove(draggedNodeId, x, y)
      }
      setDraggedNodeId(null)
      setDropTarget(null)
    },
    [draggedNodeId, onNodeMove],
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggedNodeId(null)
    setDropTarget(null)
  }, [])

  // Get the logical row/col for a node (based on stored position)
  const getNodeGridCell = (node: RoadmapNode) => {
    return getGridCellWithContext(node.position_x, node.position_y)
  }

  // Calculate actual render position accounting for expanded lanes
  const getNodeRenderPosition = useCallback(
    (row: number, col: number) => {
      return getCellPositionWithContext(col, row)
    },
    [getCellPositionWithContext],
  )

  const getNodeHeight = useCallback(
    (laneId: string) => {
      const laneHeight = getLaneHeight(laneId)
      // Subtract padding from top and bottom
      return laneHeight - GRID.NODE_PADDING * 2
    },
    [getLaneHeight],
  )

  // Helper to get all info needed for rendering a node
  const getNodeInfo = useCallback(
    (node: RoadmapNode) => {
      const { row, col } = getGridCellWithContext(node.position_x, node.position_y)
      const { x, y } = getNodeRenderPosition(row, col)
      const laneId = lanes[row]?.id || ""
      const laneColor = lanes[row]?.color || "#64748b"
      const nodeHeight = getNodeHeight(laneId)
      const isExpanded = expandedLanes.has(laneId) // Check if this lane is expanded

      return {
        style: {
          left: x,
          top: y,
        },
        laneColor,
        nodeHeight,
        isExpanded,
      }
    },
    [lanes, expandedLanes, isCompactView, getGridCellWithContext, getNodeRenderPosition, getNodeHeight],
  )

  // FIXED: Calculate path using logical grid cells directly, not by searching Y offsets
  const calculatePath = useCallback(
    (
      source: RoadmapNode,
      target: RoadmapNode,
      allDependencies: typeof dependencies,
      currentDepIndex: number,
    ): string => {
      // Get logical positions using the context-aware grid cell calculation
      const sourceCell = getGridCellWithContext(source.position_x, source.position_y)
      const targetCell = getGridCellWithContext(target.position_x, target.position_y)

      // Use the logical row directly - this is the key fix
      const sourceRow = Math.min(sourceCell.row, lanes.length - 1)
      const targetRow = Math.min(targetCell.row, lanes.length - 1)

      const sourceLaneId = lanes[sourceRow]?.id || ""
      const targetLaneId = lanes[targetRow]?.id || ""
      const sourceNodeHeight = getNodeHeight(sourceLaneId)
      const targetNodeHeight = getNodeHeight(targetLaneId)

      // Get actual render positions
      const sourceRenderPos = getNodeRenderPosition(sourceRow, sourceCell.col)
      const targetRenderPos = getNodeRenderPosition(targetRow, targetCell.col)

      // Arrow starts from right edge middle of source
      const startX = sourceRenderPos.x + GRID.NODE_WIDTH
      const startY = sourceRenderPos.y + sourceNodeHeight / 2

      // Arrow ends at left edge middle of target
      const endX = targetRenderPos.x
      const endY = targetRenderPos.y + targetNodeHeight / 2

      // Calculate which vertical channel this arrow should use
      const channel = calculateArrowChannel(source, target, allDependencies, currentDepIndex, nodes)

      // Exit horizontally from source (20% of the gap)
      const exitDistance = 40
      const exitX = startX + exitDistance

      // Calculate the Y position for this arrow's dedicated horizontal segment
      // The channel determines how far up or down from the direct path
      const directMidY = (startY + endY) / 2
      const channelOffset = channel * 30 // 30px per channel
      const routeY = directMidY + channelOffset

      // Entry distance before target
      const entryDistance = 40
      const entryX = endX - entryDistance

      // Build the stepped path:
      // 1. Exit horizontally from source
      // 2. Go vertical to the routing channel
      // 3. Travel horizontally through the channel
      // 4. Go vertical to target height
      // 5. Enter horizontally to target
      return `M ${startX} ${startY} L ${exitX} ${startY} L ${exitX} ${routeY} L ${entryX} ${routeY} L ${entryX} ${endY} L ${endX} ${endY}`
    },
    [lanes, nodes, getNodeHeight, getNodeRenderPosition, getGridCellWithContext],
  )

  const calculateArrowChannel = (
    source: RoadmapNode,
    target: RoadmapNode,
    allDependencies: typeof dependencies,
    currentDepIndex: number,
    allNodes: RoadmapNode[],
  ): number => {
    const targetId = target.id

    // Find all arrows that point to the same target
    const arrowsToSameTarget: Array<{ sourceId: string; index: number }> = []

    for (let i = 0; i < allDependencies.length; i++) {
      const dep = allDependencies[i]
      if (dep.node_id === targetId) {
        arrowsToSameTarget.push({
          sourceId: dep.depends_on_node_id,
          index: i,
        })
      }
    }

    // If only one arrow to this target, use channel 0 (direct path)
    if (arrowsToSameTarget.length === 1) {
      return 0
    }

    // Find which position this arrow is among arrows to the same target
    const currentSourceId = source.id
    const positionIndex = arrowsToSameTarget.findIndex((a) => a.sourceId === currentSourceId)

    // Distribute channels evenly: -n, -n+1, ..., -1, 0, 1, ..., n
    const totalArrows = arrowsToSameTarget.length
    const centerOffset = Math.floor(totalArrows / 2)
    return positionIndex - centerOffset
  }

  // Handle add node - needs to account for expanded lanes
  const handleAddNodeInCell = (rowIndex: number, colIndex: number) => {
    onAddNode(rowIndex, colIndex)
  }

  // Handle cell click to add nodes using context-aware position calculation
  const handleCellClick = useCallback(
    (laneIndex: number, columnIndex: number) => {
      if (draggedNodeId || dependencyDrag) return

      const { x, y } = getCellPositionWithContext(columnIndex, laneIndex)

      // Check if there's already a node at this position
      const hasNode = nodes.some((node) => {
        const nodeCell = getGridCellWithContext(node.position_x, node.position_y)
        return nodeCell.row === laneIndex && nodeCell.col === columnIndex
      })

      if (!hasNode) {
        onAddNode(laneIndex, columnIndex)
      }
    },
    [draggedNodeId, dependencyDrag, nodes, onAddNode, getCellPositionWithContext, getGridCellWithContext],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dependencyDrag || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      // Adjust coordinates to account for container's scroll position
      const x = e.clientX - rect.left + containerRef.current.scrollLeft
      const y = e.clientY - rect.top + containerRef.current.scrollTop

      setDependencyDrag((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null))
    },
    [dependencyDrag],
  )

  // Handle dependency drag end
  const handleDependencyDragEnd = useCallback(
    async (targetNodeId: string | null) => {
      if (!dependencyDrag) return

      // Capture the current drag state before clearing
      const dragState = { ...dependencyDrag }

      // Clear drag state immediately to prevent double-triggers
      setDependencyDrag(null)

      if (!targetNodeId || targetNodeId === dragState.sourceNodeId) {
        return
      }

      // Check if dependency already exists (both directions)
      const exists = dependencies.some(
        (dep) =>
          (dep.node_id === targetNodeId && dep.depends_on_node_id === dragState.sourceNodeId) ||
          (dep.node_id === dragState.sourceNodeId && dep.depends_on_node_id === targetNodeId),
      )

      if (exists) {
        console.log("[v0] Dependency already exists")
        return
      }

      const newDep: NodeDependency = {
        node_id: targetNodeId,
        depends_on_node_id: dragState.sourceNodeId,
      }

      if (onDependencyCreate) {
        onDependencyCreate(newDep)
      }

      // Then persist to database
      try {
        const supabase = createClient()
        const { error } = await supabase.from("node_dependencies").insert([newDep])

        if (error) {
          console.error("[v0] Failed to create dependency:", error.message)
          // TODO: Remove from local state on error if we implement rollback
        }
      } catch (err) {
        console.error("[v0] Failed to create dependency:", err)
      }
    },
    [dependencyDrag, dependencies, onDependencyCreate],
  )

  return (
    <div
      ref={containerRef}
      className="relative bg-slate-50"
      style={{
        minWidth: totalWidth,
        minHeight: totalHeight,
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={() => {
        if (dependencyDrag) {
          setDependencyDrag(null)
        }
      }}
    >
      {/* Arrows layer - render dependencies */}
      <svg className="absolute left-0 top-0 pointer-events-none z-5" style={{ width: totalWidth, height: totalHeight }}>
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L0,6 L9,3 z" fill="#64748b" />
          </marker>
        </defs>
        {dependencies.map((dep, depIndex) => {
          const sourceNode = nodes.find((n) => n.id === dep.depends_on_node_id)
          const targetNode = nodes.find((n) => n.id === dep.node_id)
          if (!sourceNode || !targetNode) return null

          const pathD = calculatePath(sourceNode, targetNode, dependencies, depIndex)
          return (
            <path
              key={`${dep.depends_on_node_id}-${dep.node_id}`}
              d={pathD}
              fill="none"
              stroke="#64748b"
              strokeWidth="2"
              markerEnd="url(#arrowhead)"
            />
          )
        })}
        {/* Temporary line while dragging dependency */}
        {dependencyDrag &&
          (() => {
            const sourceNode = nodes.find((n) => n.id === dependencyDrag.sourceNodeId)
            if (!sourceNode) return null
            const { row, col } = getNodeGridCell(sourceNode)
            const { x, y } = getNodeRenderPosition(row, col)
            const laneId = lanes[row]?.id || ""
            const nodeHeight = getNodeHeight(laneId)
            const startX = x + GRID.NODE_WIDTH
            const startY = y + nodeHeight / 2
            return (
              <line
                x1={startX}
                y1={startY}
                x2={dependencyDrag.currentX}
                y2={dependencyDrag.currentY}
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
            )
          })()}
      </svg>

      {/* Grid table */}
      <table className="border-collapse" style={{ tableLayout: "fixed" }}>
        {/* Column headers */}
        <thead>
          <tr>
            {/* Top-left corner cell */}
            <th
              className="sticky left-0 top-0 z-30 border-b border-r bg-white"
              style={{ width: GRID.LANE_HEADER_WIDTH, height: GRID.COLUMN_HEADER_HEIGHT }}
            >
              <span className="text-xs font-medium text-muted-foreground">Workstream</span>
            </th>

            {/* Column headers */}
            {columns.map((column) => (
              <th
                key={column.id}
                className="sticky top-0 z-20 border-b border-r bg-white p-0"
                style={{ width: GRID.CELL_WIDTH, height: GRID.COLUMN_HEADER_HEIGHT }}
              >
                <ColumnHeader
                  column={column}
                  onUpdate={(name) => onColumnUpdate(column.id, name)}
                  onDelete={() => onColumnDelete(column.id)}
                  onPin={onColumnPin ? () => onColumnPin(column.id) : undefined}
                  onUnpin={onColumnUnpin}
                  isPinned={pinnedColumnId === column.id}
                />
              </th>
            ))}

            {/* Add column button header */}
            <th
              className="sticky top-0 z-10 border-b bg-white"
              style={{ width: 48, height: GRID.COLUMN_HEADER_HEIGHT }}
            >
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onColumnAdd()} title="Add column">
                <Plus className="h-4 w-4" />
              </Button>
            </th>
          </tr>
        </thead>

        <tbody>
          {lanes.map((lane, rowIndex) => {
            const isExpanded = expandedLanes.has(lane.id)
            const laneHeight = getLaneHeight(lane.id)

            return (
              <tr key={lane.id}>
                {/* Lane header cell */}
                <td
                  className="group sticky left-0 z-20 border-b border-r bg-white p-0"
                  style={{
                    width: GRID.LANE_HEADER_WIDTH,
                    height: laneHeight,
                    verticalAlign: "top",
                  }}
                >
                  <div className="relative flex h-full flex-col cursor-pointer" onClick={() => onLaneClick?.(lane.id)}>
                    {/* Lane color indicator */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: lane.color }} />

                    {/* Lane reorder buttons on right edge */}
                    {onLaneReorder && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        {rowIndex > 0 && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 rounded-full bg-white shadow-md"
                            onClick={(e) => {
                              e.stopPropagation()
                              onLaneReorder(lane.id, "up")
                            }}
                            title="Move lane up"
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                        )}
                        {rowIndex < lanes.length - 1 && (
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6 rounded-full bg-white shadow-md"
                            onClick={(e) => {
                              e.stopPropagation()
                              onLaneReorder(lane.id, "down")
                            }}
                            title="Move lane down"
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Lane content */}
                    <div className="flex-none px-3 pt-3 pb-2">
                      <div className="flex items-start gap-2">
                        <div
                          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: lane.color }}
                        />
                        <div className="min-w-0 flex-1">
                          <EditableLaneName value={lane.name} onSave={(name) => onLaneUpdate(lane.id, name)} />
                          {lane.description && !isCompactView && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lane.description}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Spacer to push expand button to bottom */}
                    <div className="flex-1" />

                    {/* Expand/Collapse button at bottom - only show in normal view */}
                    {!isCompactView && (
                      <div className="border-t border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full h-8 rounded-none text-xs text-muted-foreground hover:text-foreground gap-1"
                          onClick={() => toggleLaneExpanded(lane.id)}
                        >
                          {isExpanded ? (
                            <>
                              <Minimize2 className="h-3 w-3" />
                              Collapse
                            </>
                          ) : (
                            <>
                              <ChevronsUpDown className="h-3 w-3" />
                              Expand
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </td>

                {/* Grid cells */}
                {columns.map((column, colIndex) => {
                  const isDropTarget = dropTarget?.row === rowIndex && dropTarget?.col === colIndex

                  const hasNodeInCell = nodes.some((node) => {
                    const nodeGridCell = getGridCell(node.position_x, node.position_y)
                    return nodeGridCell.row === rowIndex && nodeGridCell.col === colIndex
                  })

                  // Check if there's an in-progress node in this cell
                  const inProgressNode = nodes.find((node) => {
                    const nodeGridCell = getGridCell(node.position_x, node.position_y)
                    return nodeGridCell.row === rowIndex && nodeGridCell.col === colIndex && node.status === "in-progress"
                  })

                  // Calculate cell background style
                  const cellStyle: React.CSSProperties = {
                    width: GRID.CELL_WIDTH,
                    height: laneHeight,
                  }

                  // If there's an in-progress node, add lane color as background
                  if (inProgressNode) {
                    // Append 0A hex (~4% opacity) for very subtle highlight behind node
                    cellStyle.backgroundColor = `${lane.color}0A`
                  }

                  return (
                    <td
                      key={`${lane.id}-${column.id}`}
                      className={cn(
                        "relative border-b border-r transition-colors",
                        !inProgressNode && (rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50"),
                        isDropTarget && "bg-blue-100",
                      )}
                      style={cellStyle}
                      onDragOver={(e) => handleCellDragOver(e, rowIndex, colIndex)}
                      onDrop={(e) => handleCellDrop(e, rowIndex, colIndex)}
                      onDoubleClick={() => handleAddNodeInCell(rowIndex, colIndex)}
                    >
                      {!hasNodeInCell && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-12 w-12 rounded-full bg-white shadow-md"
                            onClick={() => handleAddNodeInCell(rowIndex, colIndex)}
                          >
                            <Plus className="h-6 w-6" />
                          </Button>
                        </div>
                      )}
                    </td>
                  )
                })}

                {/* Empty cell for add column */}
                <td
                  className={cn("border-b", rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50")}
                  style={{ width: 48, height: laneHeight }}
                />
              </tr>
            )
          })}

          {/* Add lane row */}
          <tr>
            <td colSpan={columns.length + 2} className="bg-white" style={{ height: 48 }}>
              <Button
                variant="ghost"
                className="h-full w-full justify-start gap-2 rounded-none px-4 text-muted-foreground hover:text-foreground"
                onClick={onLaneAdd}
              >
                <Plus className="h-4 w-4" />
                Add Lane
              </Button>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Nodes layer - highest z-index */}
      <div className="absolute left-0 top-0 z-10">
        {nodes.map((node) => {
          const { style, laneColor, nodeHeight, isExpanded } = getNodeInfo(node)
          return (
            <div key={node.id} className="relative">
              <NodeCard
                node={node}
                laneColor={laneColor}
                nodeHeight={nodeHeight}
                isExpanded={isExpanded}
                style={style}
                onClick={() => onNodeClick(node.id)}
                onDragStart={(e) => {
                  setDraggedNodeId(node.id)
                  e.dataTransfer.effectAllowed = "move"
                  const rect = e.currentTarget.getBoundingClientRect()
                  e.dataTransfer.setDragImage(e.currentTarget, rect.width / 2, rect.height / 2)
                }}
                onDragEnd={handleDragEnd}
                isCompactView={isCompactView}
              />
              <div
                data-dependency-handle
                className="absolute top-0 right-0 h-full w-4 cursor-crosshair group/handle z-20"
                style={{
                  left: style.left
                    ? typeof style.left === "number"
                      ? style.left + GRID.NODE_WIDTH - 8
                      : style.left
                    : 0,
                  top: style.top,
                  height: nodeHeight,
                  pointerEvents: dependencyDrag ? "none" : "auto",
                }}
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const rect = containerRef.current?.getBoundingClientRect()
                  if (rect) {
                    setDependencyDrag({
                      sourceNodeId: node.id,
                      currentX: e.clientX - rect.left,
                      currentY: e.clientY - rect.top,
                    })
                  }
                }}
              >
                <div className="absolute top-1/2 right-0 -translate-y-1/2 h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center shadow-lg opacity-0 group-hover/handle:opacity-100 transition-opacity pointer-events-none">
                  <div className="h-3 w-3 rounded-full bg-white" />
                </div>
              </div>
              {dependencyDrag && dependencyDrag.sourceNodeId !== node.id && (
                <div
                  className="absolute inset-0 border-4 border-blue-500 rounded-lg pointer-events-auto z-30"
                  style={{
                    left: style.left,
                    top: style.top,
                    width: GRID.NODE_WIDTH,
                    height: nodeHeight,
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDependencyDragEnd(node.id)
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.classList.add("bg-blue-100/50")
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.classList.remove("bg-blue-100/50")
                  }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Column insert buttons overlay - positioned between columns */}
      <div className="absolute top-0 left-0 z-50 pointer-events-none" style={{ height: GRID.COLUMN_HEADER_HEIGHT }}>
        {/* Insert buttons after each column */}
        {columns.map((column, colIndex) => (
          <div
            key={`insert-${column.id}`}
            className="absolute top-0 flex items-center justify-center pointer-events-auto group"
            style={{
              left: GRID.LANE_HEADER_WIDTH + (colIndex + 1) * GRID.CELL_WIDTH - 8,
              width: 16,
              height: GRID.COLUMN_HEADER_HEIGHT,
            }}
          >
            <button
              type="button"
              className="h-6 w-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50 hover:border-slate-300 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onColumnAdd(colIndex + 1)}
              title="Insert column"
            >
              <Plus className="h-3 w-3 text-slate-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Export grid config for use in page
export { GRID }
