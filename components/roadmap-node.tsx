"use client"

import type React from "react"

import type { RoadmapNode } from "@/lib/types/roadmap"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface RoadmapNodeComponentProps {
  node: RoadmapNode
  onMouseDown: (e: React.MouseEvent) => void
  onClick: () => void
  onAddConnectedNode?: (direction: "top" | "right" | "bottom" | "left") => void
}

// Visual representation of a roadmap node in the tech tree with status colors and connection buttons
export function RoadmapNodeComponent({ node, onMouseDown, onClick, onAddConnectedNode }: RoadmapNodeComponentProps) {
  const statusColors: Record<RoadmapNode["status"], string> = {
    planned: "border-blue-500 bg-blue-50 dark:bg-blue-950",
    "in-progress": "border-emerald-500 bg-emerald-50 dark:bg-emerald-950",
    completed: "border-slate-500 bg-slate-50 dark:bg-slate-950",
    blocked: "border-red-500 bg-red-50 dark:bg-red-950",
  }

  const handleAddClick = (e: React.MouseEvent, direction: "top" | "right" | "bottom" | "left") => {
    e.stopPropagation()
    onAddConnectedNode?.(direction)
  }

  return (
    <div className="absolute" style={{ left: node.position_x, top: node.position_y }}>
      {onAddConnectedNode && (
        <>
          <Button
            size="icon"
            variant="outline"
            className="absolute -top-8 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-background shadow-md hover:bg-primary hover:text-primary-foreground"
            onClick={(e) => handleAddClick(e, "top")}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="absolute right-[-32px] top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background shadow-md hover:bg-primary hover:text-primary-foreground"
            onClick={(e) => handleAddClick(e, "right")}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="absolute -bottom-8 left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-background shadow-md hover:bg-primary hover:text-primary-foreground"
            onClick={(e) => handleAddClick(e, "bottom")}
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button
            size="icon"
            variant="outline"
            className="absolute left-[-32px] top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-background shadow-md hover:bg-primary hover:text-primary-foreground"
            onClick={(e) => handleAddClick(e, "left")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </>
      )}

      <Card
        className={cn(
          "cursor-move select-none border-2 p-3 transition-shadow hover:shadow-lg",
          statusColors[node.status],
        )}
        style={{ width: "200px" }}
        onMouseDown={onMouseDown}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold leading-tight">{node.title}</h3>

          {node.description && (
            <p
              className="text-xs text-muted-foreground leading-relaxed"
              style={{
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 4, // adjust 3–5 to taste
                overflow: "hidden",
              }}
              title={node.description} // optional: hover shows full text
            >
              {node.description}
            </p>
          )}

          <div className="pt-1">
            <span className="text-xs font-medium capitalize">{node.status.replace("-", " ")}</span>
          </div>
        </div>
      </Card>
    </div>
  )
}
