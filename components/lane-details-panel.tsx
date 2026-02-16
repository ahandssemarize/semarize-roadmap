"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Users, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { Lane } from "@/components/roadmap-grid"

interface LaneDetailsPanelProps {
  laneId: string
  roadmapId: string
  onClose: () => void
  onUpdate: () => void
  onDelete?: (laneId: string) => void
}

export function LaneDetailsPanel({ laneId, roadmapId, onClose, onUpdate, onDelete }: LaneDetailsPanelProps) {
  const [lane, setLane] = useState<Lane | null>(null)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#3b82f6")
  const [isLoading, setIsLoading] = useState(true)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  // Color presets
  const colorPresets = [
    { name: "Blue", value: "#3b82f6" },
    { name: "Green", value: "#10b981" },
    { name: "Orange", value: "#f59e0b" },
    { name: "Red", value: "#ef4444" },
    { name: "Purple", value: "#8b5cf6" },
    { name: "Pink", value: "#ec4899" },
    { name: "Cyan", value: "#06b6d4" },
    { name: "Lime", value: "#84cc16" },
  ]

  useEffect(() => {
    loadLane()
  }, [laneId])

  const loadLane = async () => {
    const supabase = createClient()
    const { data, error } = await supabase.from("roadmap_lanes").select("*").eq("id", laneId).single()

    if (data) {
      setLane(data as any)
      setName(data.name)
      setDescription(data.description || "")
      setColor(data.color)
    }

    setIsLoading(false)
  }

  const handleSave = async (updates: { name?: string; description?: string; color?: string }) => {
    const supabase = createClient()

    // Update local state immediately for instant UI feedback
    setLane((prev) => (prev ? { ...prev, ...updates } : prev))

    // Save to database
    await supabase.from("roadmap_lanes").update(updates).eq("id", laneId)

    // Notify parent to refresh
    onUpdate()
  }

  // Auto-save on field blur
  const handleNameBlur = () => {
    const trimmedName = name.trim()
    if (trimmedName && trimmedName !== lane?.name) {
      handleSave({ name: trimmedName })
    }
  }

  const handleDescriptionBlur = () => {
    const trimmedDescription = description.trim()
    if (trimmedDescription !== (lane?.description || "")) {
      handleSave({ description: trimmedDescription || null } as any)
    }
  }

  const handleColorChange = async (newColor: string) => {
    setColor(newColor)
    await handleSave({ color: newColor })
  }

  const handleDelete = async () => {
    if (deleteConfirmation !== lane?.name) {
      return
    }

    const supabase = createClient()
    await supabase.from("roadmap_lanes").delete().eq("id", laneId)

    setShowDeleteDialog(false)
    onDelete?.(laneId)
    onClose()
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!lane) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Lane not found</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4">
        <h2 className="text-lg font-semibold">Workstream Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {/* Lane Name */}
        <div className="space-y-2">
          <Label htmlFor="lane-name">Name</Label>
          <Input
            id="lane-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Enter lane name"
          />
        </div>

        {/* Lane Description */}
        <div className="space-y-2">
          <Label htmlFor="lane-description">Description</Label>
          <Textarea
            id="lane-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Add a description for this lane..."
            rows={4}
          />
        </div>

        {/* Color Picker */}
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {colorPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => handleColorChange(preset.value)}
                className="group relative h-10 w-10 rounded-md border-2 transition-all hover:scale-110"
                style={{
                  backgroundColor: preset.value,
                  borderColor: color === preset.value ? "#000" : "transparent",
                }}
                title={preset.name}
              >
                {color === preset.value && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Custom color input */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="color"
              value={color}
              onChange={(e) => handleColorChange(e.target.value)}
              className="h-10 w-16 cursor-pointer rounded border"
            />
            <span className="text-sm text-muted-foreground">Custom color</span>
          </div>
        </div>

        {/* Team Members - Coming soon placeholder */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team Members
          </Label>
          <div className="rounded-lg border border-dashed bg-muted/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">Team member assignment coming soon</p>
          </div>
        </div>
      </div>

      <div className="border-t p-4">
        <Button
          variant="outline"
          className="w-full border-destructive text-destructive hover:bg-destructive/10 bg-transparent"
          onClick={() => setShowDeleteDialog(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Lane
        </Button>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Lane</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All nodes in this lane will also be deleted.
              <br />
              <br />
              Please type <span className="font-semibold">{lane.name}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={`Type "${lane.name}" to confirm`}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirmation !== lane.name}
              className="bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50"
            >
              Delete Lane
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
