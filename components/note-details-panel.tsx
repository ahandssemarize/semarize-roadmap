"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/types/note"
import { X, Trash2, Paperclip, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

interface NoteDetailsPanelProps {
  noteId: string
  roadmapId: string
  onClose: () => void
  onUpdate: (note?: Note) => void
  onDelete: (noteId: string) => void
}

export function NoteDetailsPanel({ noteId, roadmapId, onClose, onUpdate, onDelete }: NoteDetailsPanelProps) {
  const [note, setNote] = useState<Note | null>(null)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [attachments, setAttachments] = useState<any[]>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadNote()
    loadAttachments()
  }, [noteId])

  const loadNote = async () => {
    const supabase = createClient()
    const { data } = await supabase.from("notes").select("*").eq("id", noteId).single()

    if (data) {
      setNote(data)
      setTitle(data.title ?? "")
      setDescription(data.description || "")
    }
  }

  const loadAttachments = async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from("note_attachments")
      .select("*")
      .eq("note_id", noteId)
      .order("created_at", { ascending: false })

    if (data) {
      setAttachments(data)
    }
  }

  const handleUpdate = async (field: keyof Note, value: any) => {
    if (!note) return

    const updatedNote = { ...note, [field]: value }
    setNote(updatedNote)
    onUpdate(updatedNote)

    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("notes")
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq("id", noteId)

      if (error) throw error
    } catch (error) {
      console.error("Error updating note:", error)
      setNote(note)
      onUpdate(note)

      toast({
        title: "Error updating note",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle)
    handleUpdate("title", newTitle)
  }

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription)
    handleUpdate("description", newDescription)
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingFile(true)
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("User not authenticated")

      const fileExt = file.name.split(".").pop()
      const fileName = `${noteId}/${Date.now()}.${fileExt}`

      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("node-attachments")
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from("node-attachments").getPublicUrl(fileName)

      const { error: dbError } = await supabase.from("note_attachments").insert({
        note_id: noteId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user.id,
      })

      if (dbError) throw dbError

      loadAttachments()

      toast({
        title: "File uploaded",
        description: `${file.name} has been uploaded successfully.`,
      })
    } catch (error) {
      console.error("Error uploading file:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload file",
        variant: "destructive",
      })
    } finally {
      setUploadingFile(false)
      e.target.value = ""
    }
  }

  const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
    if (!confirm("Are you sure you want to delete this attachment?")) return

    try {
      const supabase = createClient()

      const { error: dbError } = await supabase.from("note_attachments").delete().eq("id", attachmentId)

      if (dbError) throw dbError

      const fileName = fileUrl.split("/").slice(-2).join("/")
      await supabase.storage.from("node-attachments").remove([fileName])

      loadAttachments()

      toast({
        title: "Attachment deleted",
        description: "The attachment has been removed successfully.",
      })
    } catch (error) {
      console.error("Error deleting attachment:", error)
      toast({
        title: "Error deleting attachment",
        description: "Failed to delete attachment. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDeleteNote = async () => {
    if (!confirm("Are you sure you want to delete this note?")) return

    try {
      const supabase = createClient()
      const { error } = await supabase.from("notes").delete().eq("id", noteId)

      if (error) throw error

      onDelete(noteId)
      onClose()

      toast({
        title: "Note deleted",
        description: "The note has been deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting note:", error)
      toast({
        title: "Error deleting note",
        description: "Failed to delete note. Please try again.",
        variant: "destructive",
      })
    }
  }

  if (!note) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-lg font-semibold">Note Details</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="note-title">Title</Label>
          <Input
            id="note-title"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Enter note title..."
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="note-description">Description</Label>
          <Textarea
            id="note-description"
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder="Add a description..."
            rows={6}
          />
        </div>

        {/* Attachments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" />
              Attachments
            </Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => document.getElementById("note-file-upload")?.click()}
              disabled={uploadingFile}
            >
              {uploadingFile ? "Uploading..." : "+ Add"}
            </Button>
            <input id="note-file-upload" type="file" className="hidden" onChange={handleFileUpload} />
          </div>

          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="flex items-center justify-between rounded-lg border p-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{attachment.file_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {attachment.file_size ? `${(attachment.file_size / 1024).toFixed(1)} KB` : "Unknown size"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => window.open(attachment.file_url, "_blank")}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteAttachment(attachment.id, attachment.file_url)}
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

        {/* Metadata */}
        <div className="space-y-2 text-sm text-muted-foreground">
          <div>
            <span className="font-medium">Created</span>
            <div>{new Date(note.created_at).toLocaleString()}</div>
          </div>
          <div>
            <span className="font-medium">Last Updated</span>
            <div>{new Date(note.updated_at).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Delete Button */}
      <div className="border-t p-4">
        <Button
          variant="outline"
          className="w-full border-destructive text-destructive hover:bg-destructive/10 bg-transparent"
          onClick={handleDeleteNote}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Note
        </Button>
      </div>
    </div>
  )
}
