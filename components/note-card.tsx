// Note card component for the kanban view
"use client"

import type React from "react"

import type { Note } from "@/lib/types/note"
import { Card } from "@/components/ui/card"
import { Circle } from "lucide-react"

interface NoteCardProps {
  note: Note
  onClick: (note: Note) => void
  onDragStart?: (e: React.DragEvent, note: Note) => void
  onDragOver?: (e: React.DragEvent) => void
  onDrop?: (e: React.DragEvent) => void
  onDragEnd?: () => void
}

export function NoteCard({ note, onClick, onDragStart, onDragOver, onDrop, onDragEnd }: NoteCardProps) {
  const title = note.title ?? ""
  const hasTitle = title.trim().length > 0

  return (
    <Card
      className="p-3 cursor-pointer hover:shadow-md transition-shadow bg-white border border-border"
      draggable
      onDragStart={(e) => onDragStart?.(e, note)}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => onClick(note)}
    >
      <div className="flex items-start gap-2">
        <Circle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className={`text-sm flex-1 ${hasTitle ? "text-foreground" : "text-muted-foreground italic"}`}>
          {hasTitle ? title : "Untitled"}
        </p>
      </div>
    </Card>
  )
}
