// Type definitions for notes in the kanban notepad
export interface Note {
  id: string
  roadmap_id: string
  lane_id: string | null
  order_index: number
  title: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
