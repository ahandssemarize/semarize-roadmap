"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RoadmapNode } from "@/lib/types/roadmap"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"

interface DependencyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeId: string
  roadmapId: string
  onSaved: (dep?: any) => void
  availableNodes?: RoadmapNode[]
  isTemp?: boolean
}

// Context: Dialog for adding dependencies between nodes in the tech tree
// Supports temporary mode for building roadmaps before saving to database
// Updated to support multi-select for adding multiple dependencies at once
export function DependencyDialog({
  open,
  onOpenChange,
  nodeId,
  roadmapId,
  onSaved,
  availableNodes: providedNodes,
  isTemp,
}: DependencyDialogProps) {
  const [availableNodes, setAvailableNodes] = useState<RoadmapNode[]>([])
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      if (isTemp && providedNodes) {
        const available = providedNodes.filter((n) => n.id !== nodeId)
        setAvailableNodes(available)
        setSelectedNodeIds([])
      } else {
        loadAvailableNodes()
      }
    }
  }, [open, nodeId, roadmapId, isTemp, providedNodes])

  const loadAvailableNodes = async () => {
    const supabase = createClient()

    const { data: allNodes } = await supabase.from("roadmap_nodes").select("*").eq("roadmap_id", roadmapId)

    const { data: existingDeps } = await supabase
      .from("node_dependencies")
      .select("depends_on_node_id")
      .eq("node_id", nodeId)

    const existingDepIds = existingDeps?.map((d) => d.depends_on_node_id) || []

    const available = allNodes?.filter((n) => n.id !== nodeId && !existingDepIds.includes(n.id)) || []

    setAvailableNodes(available)
    setSelectedNodeIds([])
  }

  const handleToggle = (nodeId: string, checked: boolean) => {
    if (checked) {
      setSelectedNodeIds((prev) => [...prev, nodeId])
    } else {
      setSelectedNodeIds((prev) => prev.filter((id) => id !== nodeId))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    if (selectedNodeIds.length === 0) {
      setError("Please select at least one node")
      setIsLoading(false)
      return
    }

    try {
      if (isTemp) {
        // Context: For temp mode, create multiple dependency objects and notify parent
        const newDeps = selectedNodeIds.map((selectedId) => ({
          id: `temp-dep-${Date.now()}-${selectedId}`,
          node_id: nodeId,
          depends_on_node_id: selectedId,
          created_at: new Date().toISOString(),
        }))

        // Call onSaved for each dependency
        newDeps.forEach((dep) => onSaved(dep))
        onOpenChange(false)
        setIsLoading(false)
        return
      }

      const supabase = createClient()

      // Context: Batch insert multiple dependencies in a single database call
      const dependenciesToInsert = selectedNodeIds.map((selectedId) => ({
        node_id: nodeId,
        depends_on_node_id: selectedId,
      }))

      const { error } = await supabase.from("node_dependencies").insert(dependenciesToInsert)

      if (error) throw error

      onSaved()
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Dependencies</DialogTitle>
          <DialogDescription>
            Select one or more nodes that must be completed before this node can start. This creates visual connections
            in your tech tree.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Depends On</Label>
              {availableNodes.length > 0 ? (
                <ScrollArea className="h-64 rounded-md border p-4">
                  <div className="space-y-3">
                    {availableNodes.map((node) => (
                      <div key={node.id} className="flex items-start space-x-3">
                        <Checkbox
                          id={node.id}
                          checked={selectedNodeIds.includes(node.id)}
                          onCheckedChange={(checked) => handleToggle(node.id, checked === true)}
                        />
                        <label
                          htmlFor={node.id}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {node.title}
                          {node.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{node.description}</p>
                          )}
                        </label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground">No available nodes to add as dependencies</p>
              )}
              {selectedNodeIds.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {selectedNodeIds.length} {selectedNodeIds.length === 1 ? "dependency" : "dependencies"} selected
                </p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || availableNodes.length === 0}>
              {isLoading ? "Adding..." : `Add ${selectedNodeIds.length > 0 ? `(${selectedNodeIds.length})` : ""}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
