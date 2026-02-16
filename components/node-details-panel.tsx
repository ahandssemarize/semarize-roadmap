"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { RoadmapNode, RoadmapStatus, NodeDependency, NodeComment, Note } from "@/lib/types/roadmap"
import { Button } from "@/components/ui/button"
import { X, Trash2, Plus, LinkIcon, MessageSquare, Paperclip, Download } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { DependencyDialog } from "./dependency-dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

// Context: Interface for node attachments
interface NodeAttachment {
  id: string
  node_id: string
  file_name: string
  file_url: string
  file_size: number
  file_type: string
  uploaded_by: string
  created_at: string
}

interface NodeDetailsPanelProps {
  nodeId: string
  roadmapId: string
  onClose: () => void
  onUpdate: (node?: any) => void
  onDelete?: (nodeId: string) => void
  nodes?: RoadmapNode[]
  dependencies?: NodeDependency[]
  setDependencies?: (deps: NodeDependency[] | ((prev: NodeDependency[]) => NodeDependency[])) => void
  isTemp?: boolean
}

export function NodeDetailsPanel({ nodeId, roadmapId, onClose, onUpdate, onDelete }: NodeDetailsPanelProps) {
  const [node, setNode] = useState<RoadmapNode | null>(null)
  const [dependencies, setDependencies] = useState<NodeDependency[]>([])
  const [dependencyNodes, setDependencyNodes] = useState<RoadmapNode[]>([])
  const [comments, setComments] = useState<NodeComment[]>([])
  const [newComment, setNewComment] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showDependencyDialog, setShowDependencyDialog] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)

  // Context: State for attachments feature
  const [attachments, setAttachments] = useState<NodeAttachment[]>([])
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)

  // Declare variables for editing node details
  const [editedTitle, setEditedTitle] = useState("")
  const [editedDescription, setEditedDescription] = useState("")
  const [editedStatus, setEditedStatus] = useState<RoadmapStatus>("")

  useEffect(() => {
    loadNode()
    loadDependencies()
    loadUser()
    loadComments()
    loadAttachments() // Added attachment loading
    loadNotes()
  }, [nodeId])

  useEffect(() => {
    if (node) {
      setEditedTitle(node.title)
      setEditedDescription(node.description || "")
      setEditedStatus(node.status)
    }
  }, [node])

  const loadUser = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setUser(user)
  }

  const loadNode = async () => {
    const supabase = createClient()
    const { data } = await supabase.from("roadmap_nodes").select("*").eq("id", nodeId).single()

    if (data) {
      setNode(data)
    }
  }

  const loadDependencies = async () => {
    const supabase = createClient()

    const { data: depsData } = await supabase.from("node_dependencies").select("*").eq("node_id", nodeId)

    if (depsData && depsData.length > 0) {
      setDependencies(depsData)

      const nodeIds = depsData.map((d) => d.depends_on_node_id)
      const { data: nodesData } = await supabase.from("roadmap_nodes").select("*").in("id", nodeIds)

      setDependencyNodes(nodesData || [])
    } else {
      setDependencies([])
      setDependencyNodes([])
    }
  }

  const loadComments = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("node_comments")
      .select("*")
      .eq("node_id", nodeId)
      .order("created_at", { ascending: true })

    setComments(data || [])
  }

  // Context: Load attachments for the current node
  const loadAttachments = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("node_attachments")
      .select("*")
      .eq("node_id", nodeId)
      .order("created_at", { ascending: false })

    setAttachments(data || [])
  }

  const loadNotes = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("notes")
      .select("*")
      .eq("roadmap_id", roadmapId)
      .order("created_at", { ascending: false })

    if (data) {
      setNotes(data)
    }
  }

  const handleDelete = async () => {
    if (onDelete) {
      onDelete(nodeId)
    }

    const supabase = createClient()
    await supabase.from("roadmap_nodes").delete().eq("id", nodeId)
    setShowDeleteDialog(false)
    onClose()
    onUpdate()
  }

  const { toast } = useToast()

  const handleSave = async (field: "title" | "description" | "status", value: any) => {
    if (!node) return

    // Save previous state for rollback
    const previousNode = { ...node }

    // Update local state immediately for instant UI feedback
    const updatedNode = {
      ...node,
      [field]: value,
      updated_at: new Date().toISOString(), // Update timestamp
    }
    setNode(updatedNode)

    // Notify parent immediately with optimistic update
    onUpdate(updatedNode)

    // Save to database in background
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("roadmap_nodes")
        .update({
          [field]: value,
        })
        .eq("id", nodeId)

      if (error) throw error
    } catch (error) {
      // If save fails, revert to previous state
      console.error("Error saving node:", error)
      setNode(previousNode)
      onUpdate(previousNode)

      toast({
        title: "Error saving changes",
        description: "Failed to save your changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleTitleBlur = () => {
    if (editedTitle !== node?.title) {
      handleSave("title", editedTitle)
    }
  }

  const handleDescriptionBlur = () => {
    if (editedDescription !== node?.description) {
      handleSave("description", editedDescription)
    }
  }

  const handleStatusChange = (newStatus: RoadmapStatus) => {
    setEditedStatus(newStatus)
    handleSave("status", newStatus)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0 || !user) return

    setIsUploadingAttachment(true)

    try {
      const file = files[0]

      const supabase = createClient()

      // Generate unique filename
      const timestamp = Date.now()
      const uniqueFilename = `${timestamp}-${file.name}`

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("node-attachments")
        .upload(uniqueFilename, file, {
          contentType: file.type,
          upsert: false,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("node-attachments").getPublicUrl(uploadData.path)

      // Save attachment metadata to database
      const { error } = await supabase.from("node_attachments").insert({
        node_id: nodeId,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
      })

      if (error) throw error

      // Reload attachments and notify parent
      loadAttachments()
      onUpdate()

      toast({
        title: "Attachment uploaded",
        description: `${file.name} has been attached successfully.`,
      })
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload attachment. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsUploadingAttachment(false)
      // Reset input
      if (e.target) {
        e.target.value = ""
      }
    }
  }

  // Context: Delete attachment from storage and database
  const handleDeleteAttachment = async (attachmentId: string) => {
    // Save previous state for rollback
    const previousAttachments = [...attachments]

    // Update local state immediately
    setAttachments((prev) => prev.filter((a) => a.id !== attachmentId))

    // Notify parent
    onUpdate()

    // Delete from database in background
    try {
      const supabase = createClient()
      const { error } = await supabase.from("node_attachments").delete().eq("id", attachmentId)

      if (error) throw error

      toast({
        title: "Attachment removed",
        description: "The attachment has been deleted.",
      })
    } catch (error) {
      // If delete fails, revert to previous state
      console.error("Error deleting attachment:", error)
      setAttachments(previousAttachments)

      toast({
        title: "Error removing attachment",
        description: "Failed to remove attachment. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleAddDependency = () => {
    setShowDependencyDialog(true)
  }

  const handleDependencySaved = (newDep?: any) => {
    setShowDependencyDialog(false)
    loadDependencies()
    onUpdate()
  }

  const handleRemoveDependency = async (dependencyId: string) => {
    // Save previous state for rollback
    const previousDeps = [...dependencies]
    const previousDepNodes = [...dependencyNodes]

    // Update local state immediately
    setDependencies((prev) => prev.filter((d) => d.id !== dependencyId))
    setDependencyNodes((prev) =>
      prev.filter((n) => {
        const dep = dependencies.find((d) => d.id === dependencyId)
        return dep ? n.id !== dep.depends_on_node_id : true
      }),
    )

    // Notify parent
    onUpdate()

    // Delete from database in background
    try {
      const supabase = createClient()
      const { error } = await supabase.from("node_dependencies").delete().eq("id", dependencyId)

      if (error) throw error
    } catch (error) {
      // If delete fails, revert to previous state
      console.error("Error removing dependency:", error)
      setDependencies(previousDeps)
      setDependencyNodes(previousDepNodes)

      toast({
        title: "Error removing dependency",
        description: "Failed to remove dependency. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !user) return

    setIsSubmittingComment(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.from("node_comments").insert({
        node_id: nodeId,
        user_id: user.id,
        comment: newComment.trim(),
      })

      if (error) throw error

      setNewComment("")
      loadComments()
    } catch (error) {
      console.error("Error submitting comment:", error)
    } finally {
      setIsSubmittingComment(false)
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    const supabase = createClient()
    await supabase.from("node_comments").delete().eq("id", commentId)
    loadComments()
  }

  const handleImportNote = async () => {
    if (!selectedNoteId) return

    setIsImporting(true)
    try {
      const supabase = createClient()

      // Get the note data
      const { data: note } = await supabase.from("notes").select("*").eq("id", selectedNoteId).single()

      if (!note) throw new Error("Note not found")

      // Get note attachments
      const { data: noteAttachments } = await supabase
        .from("note_attachments")
        .select("*")
        .eq("note_id", selectedNoteId)

      // Update node with note data (optimistic)
      const updatedNode = {
        ...node,
        title: note.title,
        description: note.description,
      }
      setNode(updatedNode)
      setEditedTitle(note.title)
      setEditedDescription(note.description || "")
      onUpdate(updatedNode)

      // Save to database
      const { error: nodeError } = await supabase
        .from("roadmap_nodes")
        .update({
          title: note.title,
          description: note.description,
          updated_at: new Date().toISOString(),
        })
        .eq("id", nodeId)

      if (nodeError) throw nodeError

      // Copy attachments if any
      if (noteAttachments && noteAttachments.length > 0) {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        for (const attachment of noteAttachments) {
          await supabase.from("node_attachments").insert({
            node_id: nodeId,
            file_name: attachment.file_name,
            file_url: attachment.file_url,
            file_size: attachment.file_size,
            file_type: attachment.file_type,
            uploaded_by: user?.id,
          })
        }

        // Reload attachments
        loadAttachments()
      }

      setShowImportDialog(false)
      setSelectedNoteId(null)

      toast({
        title: "Note imported",
        description: "The note content and attachments have been imported successfully.",
      })
    } catch (error) {
      console.error("Error importing note:", error)
      toast({
        title: "Error importing note",
        description: "Failed to import note. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsImporting(false)
    }
  }

  if (!node) return null

  const statusColors: Record<RoadmapStatus, string> = {
    planned: "bg-blue-500",
    "in-progress": "bg-amber-500",
    completed: "bg-emerald-500",
    blocked: "bg-red-500",
  }

  return (
    <>
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-semibold">Node Details</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {/* Node Name */}
          <div className="space-y-2">
            <Label htmlFor="node-title">Name</Label>
            <Input
              id="node-title"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Enter node name"
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="node-status">Status</Label>
            <Select value={editedStatus} onValueChange={handleStatusChange}>
              <SelectTrigger id="node-status">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        editedStatus === "planned"
                          ? "bg-blue-500"
                          : editedStatus === "in-progress"
                            ? "bg-amber-500"
                            : editedStatus === "completed"
                              ? "bg-emerald-500"
                              : "bg-red-500"
                      }`}
                    />
                    <span>
                      {editedStatus === "planned"
                        ? "Planned"
                        : editedStatus === "in-progress"
                          ? "In Progress"
                          : editedStatus === "completed"
                            ? "Completed"
                            : "Blocked"}
                    </span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="planned">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <div className="flex flex-col">
                      <span>Planned</span>
                      <span className="text-xs text-muted-foreground">Feature is in the planning phase</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="in-progress">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <div className="flex flex-col">
                      <span>In Progress</span>
                      <span className="text-xs text-muted-foreground">Currently being worked on</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="completed">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <div className="flex flex-col">
                      <span>Completed</span>
                      <span className="text-xs text-muted-foreground">Feature is complete and shipped</span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="blocked">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <div className="flex flex-col">
                      <span>Blocked</span>
                      <span className="text-xs text-muted-foreground">Waiting on dependencies or external factors</span>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="node-description">Description</Label>
            <Textarea
              id="node-description"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              rows={4}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </Label>
              <div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isUploadingAttachment}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => document.getElementById("file-upload")?.click()}
                  disabled={isUploadingAttachment}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {isUploadingAttachment ? "Uploading..." : "Add"}
                </Button>
              </div>
            </div>
            {attachments.length > 0 ? (
              <div className="space-y-2">
                {attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{attachment.file_name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        ({(attachment.file_size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(attachment.file_url, "_blank")}
                        title="Download"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteAttachment(attachment.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No attachments</p>
            )}
          </div>

          {/* Dependencies */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Dependencies</Label>
              <Button variant="ghost" size="sm" onClick={handleAddDependency}>
                <Plus className="mr-1 h-3 w-3" />
                Add
              </Button>
            </div>
            {dependencies.length > 0 ? (
              <div className="space-y-2">
                {dependencies.map((dep) => {
                  const depNode = dependencyNodes.find((n) => n.id === dep.depends_on_node_id)
                  return (
                    <div key={dep.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                      <div className="flex items-center gap-2">
                        <LinkIcon className="h-3 w-3 text-muted-foreground" />
                        <span>{depNode?.title || "Unknown"}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveDependency(dep.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No dependencies</p>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments
              <Badge variant="secondary">{comments.length}</Badge>
            </Label>

            <div className="space-y-3">
              {comments.map((comment) => (
                <div key={comment.id} className="rounded-md border bg-muted/50 p-3">
                  <div className="mb-1 flex items-start justify-between">
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                    {user && comment.user_id === user.id && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteComment(comment.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm">{comment.comment}</p>
                </div>
              ))}

              {comments.length === 0 && (
                <p className="text-sm text-muted-foreground">No comments yet. Be the first to comment!</p>
              )}
            </div>

            <form onSubmit={handleSubmitComment} className="mt-3 space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <Button type="submit" size="sm" disabled={!newComment.trim() || isSubmittingComment}>
                {isSubmittingComment ? "Posting..." : "Post Comment"}
              </Button>
            </form>
          </div>

          {/* Timestamps */}
          <div className="space-y-2">
            <div>
              <h4 className="mb-1 text-sm font-medium">Created</h4>
              <p className="text-sm text-muted-foreground">{new Date(node.created_at).toLocaleString()}</p>
            </div>

            <div>
              <h4 className="mb-1 text-sm font-medium">Last Updated</h4>
              <p className="text-sm text-muted-foreground">{new Date(node.updated_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Footer with Delete button only */}
        <div className="border-t p-4">
          <Button
            variant="outline"
            className="w-full border-destructive text-destructive hover:bg-destructive/10 bg-transparent"
            onClick={handleDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Node
          </Button>
        </div>
      </div>

      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import from Notepad</DialogTitle>
            <DialogDescription>
              Select a note to import its title, description, and attachments into this node.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2 p-4">
              {notes.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No notes available to import</p>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                      selectedNoteId === note.id ? "border-blue-500 bg-blue-50" : "border-border hover:bg-muted"
                    }`}
                    onClick={() => setSelectedNoteId(note.id)}
                  >
                    <div className="font-medium">{note.title}</div>
                    {note.description && (
                      <div className="mt-1 text-sm text-muted-foreground line-clamp-2">{note.description}</div>
                    )}
                    <div className="mt-2 text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
          <div className="flex justify-end gap-2 p-4 border-t">
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportNote} disabled={!selectedNoteId || isImporting}>
              {isImporting ? "Importing..." : "Import Selected Note"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <DependencyDialog
        open={showDependencyDialog}
        onOpenChange={setShowDependencyDialog}
        nodeId={nodeId}
        roadmapId={roadmapId}
        onSaved={handleDependencySaved}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this node? This will also remove all dependencies and comments associated
              with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete Node
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
