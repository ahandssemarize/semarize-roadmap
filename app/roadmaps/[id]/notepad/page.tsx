// Kanban notepad page
"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/types/note"
import type { Lane } from "@/components/roadmap-grid"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { NoteCard } from "@/components/note-card"
import { NoteDetailsPanel } from "@/components/note-details-panel"
import { v4 as uuidv4 } from "uuid"
import { useToast } from "@/hooks/use-toast"

export default function NotepadPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [roadmapTitle, setRoadmapTitle] = useState("")
  const [notes, setNotes] = useState<Note[]>([])
  const [lanes, setLanes] = useState<(Lane & { isNotepad?: boolean })[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [draggedNote, setDraggedNote] = useState<Note | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadData()
  }, [id])

  const laneKey = (laneId: string | null) => laneId ?? "__notepad__"

  const normalizeOrderIndexes = (list: Note[]) => {
    const laneCounters = new Map<string, number>()

    return list.map((note) => {
      const key = laneKey(note.lane_id)
      const nextOrder = laneCounters.get(key) ?? 0
      laneCounters.set(key, nextOrder + 1)

      if (note.order_index === nextOrder) return note
      return { ...note, order_index: nextOrder }
    })
  }

  const loadData = async () => {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/auth/login")
      return
    }

    // Load roadmap
    const { data: roadmap } = await supabase.from("roadmaps").select("*").eq("id", id).single()

    if (!roadmap) {
      router.push("/roadmaps")
      return
    }

    setRoadmapTitle(roadmap.title)

    // Load notes
    const { data: notesData } = await supabase
      .from("notes")
      .select("*")
      .eq("roadmap_id", id)
      .order("lane_id", { ascending: true })
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true })

    // Load workstream lanes
    const { data: lanesData } = await supabase
      .from("roadmap_lanes")
      .select("*")
      .eq("roadmap_id", id)
      .order("order_index")

    setNotes(notesData || [])

    // Create lanes: Notepad first, then workstreams
    const allLanes: (Lane & { isNotepad?: boolean })[] = [
      { id: "notepad", name: "Notepad", color: "#6b7280", expanded: false, isNotepad: true },
      ...(lanesData?.map((l) => ({ id: l.id, name: l.name, color: l.color, expanded: l.expanded })) || []),
    ]

    setLanes(allLanes)
    setIsLoading(false)
  }

  const handleAddNote = async (laneId: string) => {
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const newNote: Partial<Note> = {
        id: uuidv4(),
        roadmap_id: id,
        lane_id: laneId === "notepad" ? null : laneId,
        title: "",
        description: "",
        created_by: user.id,
      }

      const { data, error } = await supabase.from("notes").insert(newNote).select().single()

      if (error) throw error

      if (data) {
        setNotes((prev) => [...prev, data])
        setSelectedNoteId(data.id)
      }
    } catch (error) {
      console.error("Error adding note:", error)
      toast({
        title: "Error creating note",
        description: "Failed to create note. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleDragStart = (e: React.DragEvent, note: Note) => {
    setDraggedNote(note)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const moveNoteInState = (currentNotes: Note[], draggedNoteId: string, targetLaneId: string | null, beforeNoteId?: string) => {
    const dragged = currentNotes.find((n) => n.id === draggedNoteId)
    if (!dragged) return currentNotes

    const remaining = currentNotes.filter((n) => n.id !== draggedNoteId)
    const movedNote: Note = { ...dragged, lane_id: targetLaneId }

    if (beforeNoteId) {
      const beforeIndex = remaining.findIndex((n) => n.id === beforeNoteId)
      if (beforeIndex >= 0) {
        const updated = [...remaining]
        updated.splice(beforeIndex, 0, movedNote)
        return normalizeOrderIndexes(updated)
      }
    }

    const lastTargetIndex = remaining.reduce(
      (lastIndex, note, index) => (note.lane_id === targetLaneId ? index : lastIndex),
      -1,
    )

    if (lastTargetIndex >= 0) {
      const updated = [...remaining]
      updated.splice(lastTargetIndex + 1, 0, movedNote)
      return normalizeOrderIndexes(updated)
    }

    return normalizeOrderIndexes([...remaining, movedNote])
  }

  const moveDraggedNote = async (targetLaneId: string, beforeNoteId?: string) => {
    if (!draggedNote) return

    if (beforeNoteId && beforeNoteId === draggedNote.id) {
      setDraggedNote(null)
      return
    }

    const actualLaneId = targetLaneId === "notepad" ? null : targetLaneId

    // Optimistic update
    const previousNotes = [...notes]
    const nextNotes = moveNoteInState(previousNotes, draggedNote.id, actualLaneId, beforeNoteId)
    setNotes(nextNotes)

    try {
      const previousById = new Map(previousNotes.map((note) => [note.id, note]))
      const changedNotes = nextNotes.filter((note) => {
        const previous = previousById.get(note.id)
        return !previous || previous.lane_id !== note.lane_id || previous.order_index !== note.order_index
      })

      if (changedNotes.length > 0) {
        const supabase = createClient()
        const now = new Date().toISOString()
        const results = await Promise.all(
          changedNotes.map((note) =>
            supabase
              .from("notes")
              .update({
                lane_id: note.lane_id,
                order_index: note.order_index,
                updated_at: now,
              })
              .eq("id", note.id),
          ),
        )

        const failed = results.find((result) => result.error)
        if (failed?.error) throw failed.error
      }
    } catch (error) {
      console.error("Error moving note:", error)
      setNotes(previousNotes)

      toast({
        title: "Error moving note",
        description: "Failed to move note. Please try again.",
        variant: "destructive",
      })
    }

    setDraggedNote(null)
  }

  const handleDrop = async (e: React.DragEvent, targetLaneId: string) => {
    e.preventDefault()
    await moveDraggedNote(targetLaneId)
  }

  const handleDropOnNote = async (e: React.DragEvent, targetLaneId: string, targetNoteId: string) => {
    e.preventDefault()
    e.stopPropagation()
    await moveDraggedNote(targetLaneId, targetNoteId)
  }

  const handleNoteClick = (note: Note) => {
    setSelectedNoteId(note.id)
  }

  const handleNoteUpdate = (note?: Note) => {
    if (note) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)))
    } else {
      loadData()
    }
  }

  const handleNoteDelete = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId))
    setSelectedNoteId(null)
  }

  const getNotesForLane = (laneId: string) => {
    if (laneId === "notepad") {
      return notes.filter((n) => n.lane_id === null)
    }
    return notes.filter((n) => n.lane_id === laneId)
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading notepad...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-white px-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/roadmaps/${id}`)}>
            ← Back to Roadmap
          </Button>
          <h1 className="text-xl font-semibold">{roadmapTitle} - Notepad</h1>
        </div>
      </header>

      {/* Kanban Board */}
      <div className="flex flex-1 gap-4 overflow-x-auto p-6">
        {lanes.map((lane) => (
          <div
            key={lane.id}
            className="flex w-80 shrink-0 flex-col rounded-lg border bg-muted/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, lane.id)}
          >
            {/* Lane Header */}
            <div className="flex items-center justify-between border-b bg-white p-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: lane.color }} />
                <h3 className="font-semibold">{lane.name}</h3>
                <span className="text-sm text-muted-foreground">{getNotesForLane(lane.id).length}</span>
              </div>
            </div>

            {/* Notes List */}
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {getNotesForLane(lane.id).map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onClick={handleNoteClick}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnNote(e, lane.id, note.id)}
                  onDragEnd={() => setDraggedNote(null)}
                />
              ))}
            </div>

            {/* Add Note Button */}
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => handleAddNote(lane.id)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add note
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Note Details Panel */}
      {selectedNoteId && (
        <div className="fixed right-0 top-14 z-50 h-[calc(100vh-3.5rem)] w-96 border-l bg-white shadow-lg">
          <NoteDetailsPanel
            noteId={selectedNoteId}
            roadmapId={id}
            onClose={() => setSelectedNoteId(null)}
            onUpdate={handleNoteUpdate}
            onDelete={handleNoteDelete}
          />
        </div>
      )}
    </div>
  )
}
