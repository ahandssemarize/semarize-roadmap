"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Archive, Trash2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createBrowserClient } from "@/lib/supabase/client"
import { DeleteRoadmapConfirmationModal } from "@/components/delete-roadmap-confirmation-modal"

// Context: Modal for managing roadmap settings (archive/delete)
// Allows archiving active roadmaps or permanently deleting archived roadmaps
interface RoadmapSettingsModalProps {
  roadmap: {
    id: string
    title: string
    archived: boolean
  }
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RoadmapSettingsModal({ roadmap, open, onOpenChange }: RoadmapSettingsModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const router = useRouter()
  const supabase = createBrowserClient()

  const handleArchive = async () => {
    setLoading(true)
    setError(null)

    try {
      const { error: updateError } = await supabase.from("roadmaps").update({ archived: true }).eq("id", roadmap.id)

      if (updateError) throw updateError

      router.refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive roadmap")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    setLoading(true)
    setError(null)

    try {
      // Delete all related data in order
      // Delete node attachments
      const { data: nodes } = await supabase.from("roadmap_nodes").select("id").eq("roadmap_id", roadmap.id)

      if (nodes && nodes.length > 0) {
        const nodeIds = nodes.map((n) => n.id)
        await supabase.from("node_attachments").delete().in("node_id", nodeIds)
        await supabase.from("node_comments").delete().in("node_id", nodeIds)
        await supabase.from("node_dependencies").delete().in("node_id", nodeIds)
      }

      // Delete note attachments
      const { data: notes } = await supabase.from("notes").select("id").eq("roadmap_id", roadmap.id)

      if (notes && notes.length > 0) {
        const noteIds = notes.map((n) => n.id)
        await supabase.from("note_attachments").delete().in("note_id", noteIds)
      }

      // Delete notes
      await supabase.from("notes").delete().eq("roadmap_id", roadmap.id)

      // Delete nodes
      await supabase.from("roadmap_nodes").delete().eq("roadmap_id", roadmap.id)

      // Delete lanes
      await supabase.from("roadmap_lanes").delete().eq("roadmap_id", roadmap.id)

      // Delete columns
      await supabase.from("roadmap_columns").delete().eq("roadmap_id", roadmap.id)

      // Delete collaborators
      await supabase.from("roadmap_collaborators").delete().eq("roadmap_id", roadmap.id)

      // Finally delete the roadmap itself
      const { error: deleteError } = await supabase.from("roadmaps").delete().eq("id", roadmap.id)

      if (deleteError) throw deleteError

      router.refresh()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete roadmap")
      throw err
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roadmap Settings</DialogTitle>
            <DialogDescription>Manage settings for {roadmap.title}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {!roadmap.archived ? (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Archive Roadmap</h4>
                <p className="text-sm text-muted-foreground">
                  Archive this roadmap to hide it from your active roadmaps. You can still access and restore it later
                  from the archived section.
                </p>
                <Button
                  variant="outline"
                  className="w-full justify-start bg-transparent"
                  onClick={handleArchive}
                  disabled={loading}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archive Roadmap
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-destructive">Delete Roadmap</h4>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this archived roadmap and all its content (lanes, nodes, notes, attachments,
                  comments). This action cannot be undone.
                </p>
                <Button
                  variant="destructive"
                  className="w-full justify-start"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Permanently
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DeleteRoadmapConfirmationModal
        roadmapTitle={roadmap.title}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        onConfirm={handleDelete}
      />
    </>
  )
}
