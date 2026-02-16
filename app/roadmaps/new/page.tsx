"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"

// Default lane definitions matching the detail page
const DEFAULT_LANES_CONFIG = [
  { name: "Core Features", color: "#3b82f6", expanded: false },
  { name: "Infrastructure", color: "#10b981", expanded: false },
  { name: "User Experience", color: "#f59e0b", expanded: false },
]

// Default columns
const DEFAULT_COLUMNS_CONFIG = [
  { name: "Q1 2025" },
  { name: "" },
  { name: "" },
  { name: "Q2 2025" },
  { name: "" },
  { name: "" },
  { name: "Q3 2025" },
  { name: "" },
]

export default function NewRoadmapPage() {
  const router = useRouter()

  useEffect(() => {
    createAndRedirect()
  }, [])

  const createAndRedirect = async () => {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push("/auth/login")
      return
    }

    const { data: roadmap, error } = await supabase
      .from("roadmaps")
      .insert({
        title: "Untitled Roadmap",
        description: "",
        created_by: user.id,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating roadmap:", error)
      alert("Failed to create roadmap")
      router.push("/roadmaps")
      return
    }

    // Create default lanes
    const defaultLanesToInsert = DEFAULT_LANES_CONFIG.map((lane, index) => ({
      id: uuidv4(),
      roadmap_id: roadmap.id,
      name: lane.name,
      color: lane.color,
      order_index: index,
      expanded: lane.expanded,
    }))

    await supabase.from("roadmap_lanes").insert(defaultLanesToInsert)

    // Create default columns
    const defaultColumnsToInsert = DEFAULT_COLUMNS_CONFIG.map((col, index) => ({
      id: uuidv4(),
      roadmap_id: roadmap.id,
      name: col.name,
      order_index: index,
    }))

    await supabase.from("roadmap_columns").insert(defaultColumnsToInsert)

    // Redirect to the newly created roadmap's detail page
    router.push(`/roadmaps/${roadmap.id}`)
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <p>Creating new roadmap...</p>
    </div>
  )
}
