"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Context: Confirmation modal for permanently deleting a roadmap
// Requires typing the exact roadmap name to prevent accidental deletion
interface DeleteRoadmapConfirmationModalProps {
  roadmapTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
}

export function DeleteRoadmapConfirmationModal({
  roadmapTitle,
  open,
  onOpenChange,
  onConfirm,
}: DeleteRoadmapConfirmationModalProps) {
  const [confirmText, setConfirmText] = useState("")
  const [loading, setLoading] = useState(false)

  const isConfirmValid = confirmText === roadmapTitle

  const handleConfirm = async () => {
    if (!isConfirmValid) return

    setLoading(true)
    try {
      await onConfirm()
      setConfirmText("")
      onOpenChange(false)
    } catch (error) {
      // Error handling is done in the parent component
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmText("")
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Delete Roadmap Permanently</DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the roadmap and all its content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will permanently delete:
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                <li>All lanes and workstreams</li>
                <li>All nodes and their dependencies</li>
                <li>All notes and attachments</li>
                <li>All comments</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="confirm-name">
              Please type <span className="font-semibold">{roadmapTitle}</span> to confirm
            </Label>
            <Input
              id="confirm-name"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={roadmapTitle}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!isConfirmValid || loading}>
            {loading ? "Deleting..." : "Delete Permanently"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
