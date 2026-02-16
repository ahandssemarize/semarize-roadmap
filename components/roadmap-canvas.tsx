"use client"

import type React from "react"

import type { RoadmapNode, NodeDependency } from "@/lib/types/roadmap"
import { useCallback, useRef, useState } from "react"
import { RoadmapNodeComponent } from "./roadmap-node"

interface RoadmapCanvasProps {
  roadmapId: string
  nodes: RoadmapNode[]
  dependencies: NodeDependency[]
  onNodeMove: (nodeId: string, x: number, y: number) => Promise<void>
  onNodeClick: (nodeId: string) => void
  onAddConnectedNode?: (sourceNodeId: string, direction: "top" | "right" | "bottom" | "left") => void
}

// Context: Main canvas component for tech tree visualization with drag-and-drop
export function RoadmapCanvas({
  roadmapId,
  nodes,
  dependencies,
  onNodeMove,
  onNodeClick,
  onAddConnectedNode,
}: RoadmapCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })

  const handleNodeMouseDown = useCallback(
    (nodeId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      const node = nodes.find((n) => n.id === nodeId)
      if (!node) return

      setDraggingNodeId(nodeId)
      setDragOffset({
        x: e.clientX - node.position_x,
        y: e.clientY - node.position_y,
      })
    },
    [nodes],
  )

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true)
      setPanStart({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingNodeId) {
        const newX = e.clientX - dragOffset.x
        const newY = e.clientY - dragOffset.y
        const node = nodes.find((n) => n.id === draggingNodeId)
        if (node && canvasRef.current) {
          const rect = canvasRef.current.getBoundingClientRect()
          const relativeX = newX - rect.left - panOffset.x
          const relativeY = newY - rect.top - panOffset.y
          onNodeMove(draggingNodeId, relativeX, relativeY)
        }
      } else if (isPanning) {
        const deltaX = e.clientX - panStart.x
        const deltaY = e.clientY - panStart.y
        setPanOffset((prev) => ({
          x: prev.x + deltaX,
          y: prev.y + deltaY,
        }))
        setPanStart({ x: e.clientX, y: e.clientY })
      }
    },
    [draggingNodeId, dragOffset, nodes, onNodeMove, isPanning, panStart, panOffset],
  )

  const handleMouseUp = useCallback(() => {
    setDraggingNodeId(null)
    setIsPanning(false)
  }, [])

  return (
    <div
      ref={canvasRef}
      className="relative h-full w-full overflow-hidden bg-muted/30"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
            className="fill-muted-foreground"
          >
            <polygon points="0 0, 10 3, 0 6" />
          </marker>
        </defs>
        {dependencies.map((dep) => {
          const sourceNode = nodes.find((n) => n.id === dep.depends_on_node_id)
          const targetNode = nodes.find((n) => n.id === dep.node_id)

          console.log("[v0] Rendering dependency:", {
            depId: dep.id,
            sourceNodeId: dep.depends_on_node_id,
            targetNodeId: dep.node_id,
            sourceFound: !!sourceNode,
            targetFound: !!targetNode,
          })

          if (!sourceNode || !targetNode) {
            console.log("[v0] Skipping dependency - missing node:", {
              sourceNode: sourceNode?.title,
              targetNode: targetNode?.title,
            })
            return null
          }

          // Calculate edge points (right edge of source, left edge of target)
          const x1 = sourceNode.position_x + 200 + panOffset.x // Node width is ~200px
          const y1 = sourceNode.position_y + 40 + panOffset.y // Node height is ~80px, center is 40
          const x2 = targetNode.position_x + panOffset.x
          const y2 = targetNode.position_y + 40 + panOffset.y

          // Create a smooth curve using cubic bezier
          const midX = (x1 + x2) / 2
          const curveOffset = Math.abs(x2 - x1) * 0.3 // Make curve more pronounced for longer distances

          const pathData = `M ${x1} ${y1} C ${x1 + curveOffset} ${y1}, ${x2 - curveOffset} ${y2}, ${x2} ${y2}`

          console.log("[v0] Drawing path:", {
            from: `${sourceNode.title} (${x1}, ${y1})`,
            to: `${targetNode.title} (${x2}, ${y2})`,
            pathData,
          })

          return (
            <path
              key={dep.id}
              d={pathData}
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="2"
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          )
        })}
      </svg>

      <div
        className="relative"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
        }}
      >
        {nodes.map((node) => (
          <RoadmapNodeComponent
            key={node.id}
            node={node}
            onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
            onClick={() => onNodeClick(node.id)}
            onAddConnectedNode={onAddConnectedNode ? (direction) => onAddConnectedNode(node.id, direction) : undefined}
          />
        ))}
      </div>
    </div>
  )
}
