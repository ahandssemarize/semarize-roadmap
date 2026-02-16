"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RoadmapStatus } from "@/lib/types/roadmap"
import type { Note } from "@/lib/types/note"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileUp, Paperclip, Download, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface NodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  roadmapId: string
  nodeId: string | null
  onSaved: (node?: any) => void
  userId?: string
  isTemp?: boolean
  pendingPosition?: { x: number; y: number }
}

// Context: Dialog for creating and editing roadmap nodes with enhanced status descriptions
// Supports temporary mode for building roadmaps before saving to database
export function NodeDialog({
  open,
  onOpenChange,
  roadmapId,
  nodeId,
  onSaved,
  userId,
  isTemp,
  pendingPosition,
}: NodeDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [status, setStatus] = useState<RoadmapStatus>("planned")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [attachments, setAttachments] = useState<any[]>([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedLaneFilter, setSelectedLaneFilter] = useState<string>("all")
  const [lanes, setLanes] = useState<any[]>([])
  const { toast } = useToast()

  useEffect(() => {
    if (open && nodeId && !nodeId.startsWith("new-")) {
      loadNode()
    } else if (open && (!nodeId || nodeId.startsWith("new-"))) {
      setTitle("")
      setDescription("")
      setStatus("planned")
    }
  }, [open, nodeId])

  const loadNode = async () => {
    if (!nodeId || nodeId.startsWith("new-")) return

    const supabase = createClient()
    const { data } = await supabase.from("roadmap_nodes").select("*").eq("id", nodeId).single()

    if (data) {
      setTitle(data.title)
      setDescription(data.description || "")
      setStatus(data.status)
    }
  }

  const loadNotes = async () => {
    const supabase = createClient()
    const [notesData, lanesData] = await Promise.all([
      supabase.from("notes").select("*").eq("roadmap_id", roadmapId).order("created_at", { ascending: false }),
      supabase.from("roadmap_lanes").select("*").eq("roadmap_id", roadmapId).order("order_index", { ascending: true }),
    ])

    if (notesData.data) {
      setNotes(notesData.data)
    }
    if (lanesData.data) {
      setLanes(lanesData.data)
    }
  }

  const handleImportNote = async () => {
    if (!selectedNoteId) return

    setIsImporting(true)
    try {
      const selectedNote = notes.find((n) => n.id === selectedNoteId)
      if (!selectedNote) return

      // Set title and description from note
      setTitle(selectedNote.title)
      setDescription(selectedNote.description || "")

      // Load note attachments
      const supabase = createClient()
      const { data: noteAttachments } = await supabase
        .from("note_attachments")
        .select("*")
        .eq("note_id", selectedNoteId)
        .order("created_at", { ascending: true })

      if (noteAttachments) {
        setAttachments(noteAttachments)
      }

      setShowImportDialog(false)
      toast({
        title: "Note imported",
        description: "The note has been imported successfully.",
      })
    } catch (error) {
      console.error("Error importing note:", error)
      toast({
        title: "Error",
        description: "Failed to import note.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
      setSelectedNoteId(null)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploadingAttachment(true)
    try {
      const supabase = createClient()

      // Generate unique file path
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `${roadmapId}/${fileName}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("node-attachments")
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("node-attachments").getPublicUrl(filePath)

      // Add to local attachments array (will be saved when node is created)
      const newAttachment = {
        file_name: file.name,
        file_path: filePath,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
      }

      setAttachments([...attachments, newAttachment])

      toast({
        title: "File uploaded",
        description: `${file.name} has been uploaded.`,
      })
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload failed",
        description: "Failed to upload file. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const handleRemoveAttachment = async (index: number) => {
    const attachment = attachments[index]

    try {
      const supabase = createClient()

      // Delete from storage
      await supabase.storage.from("node-attachments").remove([attachment.file_path])

      // Remove from local array
      setAttachments(attachments.filter((_, i) => i !== index))

      toast({
        title: "Attachment removed",
        description: "The attachment has been removed.",
      })
    } catch (error) {
      console.error("Error removing attachment:", error)
      toast({
        title: "Error",
        description: "Failed to remove attachment.",
        variant: "destructive",
      })
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      if (nodeId && !nodeId.startsWith("new-")) {
        const { error } = await supabase
          .from("roadmap_nodes")
          .update({ title, description, status, updated_at: new Date().toISOString() })
          .eq("id", nodeId)

        if (error) throw error
        onSaved()
      } else {
        if (!userId) throw new Error("User not authenticated")

        const position = pendingPosition || {
          x: Math.random() * 400 + 100,
          y: Math.random() * 300 + 100,
        }

        const { data: newNode, error } = await supabase
          .from("roadmap_nodes")
          .insert({
            roadmap_id: roadmapId,
            title,
            description,
            status,
            position_x: position.x,
            position_y: position.y,
            created_by: userId,
          })
          .select()
          .single()

        if (error) throw error

        if (attachments.length > 0 && newNode) {
          const attachmentRecords = attachments.map((att) => ({
            node_id: newNode.id,
            file_name: att.file_name,
            file_path: att.file_path,
            file_url: att.file_url,
            file_size: att.file_size,
            file_type: att.file_type,
            uploaded_by: userId,
          }))

          await supabase.from("node_attachments").insert(attachmentRecords)
        }

        onSaved(newNode)
      }
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const statusDescriptions: Record<RoadmapStatus, string> = {
    planned: "Feature is in the planning phase",
    "in-progress": "Currently being worked on",
    completed: "Feature is complete and shipped",
    blocked: "Waiting on dependencies or external factors",
  }

  const getStatusDisplayName = (status: RoadmapStatus): string => {
    const names: Record<RoadmapStatus, string> = {
      planned: "Planned",
      "in-progress": "In Progress",
      completed: "Completed",
      blocked: "Blocked",
    }
    return names[status]
  }

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLane =
      selectedLaneFilter === "all" ||
      (selectedLaneFilter === "notepad" && !note.lane_id) ||
      note.lane_id === selectedLaneFilter
    return matchesSearch && matchesLane
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{nodeId ? "Edit Node" : "Create Node"}</DialogTitle>
            <DialogDescription>
              {nodeId ? "Update the node details" : "Add a new feature or milestone to your roadmap"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Feature name"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe this feature..."
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setStatus(value as RoadmapStatus)}>
                  <SelectTrigger>
                    <SelectValue>{getStatusDisplayName(status)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">
                      <div className="flex flex-col">
                        <span>Planned</span>
                        <span className="text-xs text-muted-foreground">{statusDescriptions.planned}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="in-progress">
                      <div className="flex flex-col">
                        <span>In Progress</span>
                        <span className="text-xs text-muted-foreground">{statusDescriptions["in-progress"]}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="completed">
                      <div className="flex flex-col">
                        <span>Completed</span>
                        <span className="text-xs text-muted-foreground">{statusDescriptions.completed}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="blocked">
                      <div className="flex flex-col">
                        <span>Blocked</span>
                        <span className="text-xs text-muted-foreground">{statusDescriptions.blocked}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!nodeId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Attachments</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => document.getElementById("attachment-upload")?.click()}
                      disabled={isUploadingAttachment}
                    >
                      <Paperclip className="mr-2 h-4 w-4" />
                      {isUploadingAttachment ? "Uploading..." : "Add"}
                    </Button>
                    <input id="attachment-upload" type="file" className="hidden" onChange={handleFileUpload} />
                  </div>
                  {attachments.length > 0 ? (
                    <div className="space-y-2">
                      {attachments.map((attachment, index) => (
                        <div key={index} className="flex items-center justify-between rounded-md border p-2">
                          <div className="flex items-center gap-2">
                            <Paperclip className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">{attachment.file_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {(attachment.file_size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(attachment.file_url, "_blank")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveAttachment(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No attachments</p>
                  )}
                </div>
              )}

              {!nodeId && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 bg-transparent"
                  onClick={() => {
                    loadNotes()
                    setShowImportDialog(true)
                  }}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Import from Notepad
                </Button>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Import from Notepad</DialogTitle>
            <DialogDescription>
              Select a note to import its title, description, and attachments into this node.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 p-4 border-b">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={selectedLaneFilter} onValueChange={setSelectedLaneFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by lane" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Lanes</SelectItem>
                  <SelectItem value="notepad">Notepad</SelectItem>
                  {lanes.map((lane) => (
                    <SelectItem key={lane.id} value={lane.id}>
                      {lane.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <ScrollArea className="flex-1 px-4">
            <div className="space-y-2 py-2">
              {filteredNotes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  {searchQuery || selectedLaneFilter !== "all"
                    ? "No notes match your filters"
                    : "No notes available to import"}
                </p>
              ) : (
                filteredNotes.map((note) => (
                  <div
                    key={note.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selectedNoteId === note.id ? "border-blue-500 bg-blue-50" : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{note.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="border-t pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowImportDialog(false)
                setSearchQuery("")
                setSelectedLaneFilter("all")
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleImportNote} disabled={!selectedNoteId || isImporting}>
              {isImporting ? "Importing..." : "Import Selected Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
