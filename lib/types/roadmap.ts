// Context: TypeScript types for the roadmap builder domain models with grid layout support
export type RoadmapStatus = "planned" | "in-progress" | "completed" | "blocked"

export type CollaboratorRole = "owner" | "editor" | "viewer"

export interface Roadmap {
  id: string
  title: string
  description: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface RoadmapNode {
  id: string
  roadmap_id: string
  title: string
  description: string | null
  status: RoadmapStatus
  position_x: number
  position_y: number
  // Grid position (row = lane, column = time period)
  grid_row?: number
  grid_column?: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface NodeDependency {
  id: string
  node_id: string
  depends_on_node_id: string
  created_at: string
}

export interface NodeComment {
  id: string
  node_id: string
  user_id: string
  comment: string
  created_at: string
  updated_at: string
}

export interface RoadmapCollaborator {
  id: string
  roadmap_id: string
  user_id: string
  role: CollaboratorRole
  created_at: string
}

// Grid layout types
export interface Lane {
  id: string
  roadmap_id: string
  name: string
  color: string
  order_index: number
  created_at: string
}

export interface TimeColumn {
  id: string
  roadmap_id: string
  name: string
  order_index: number
  created_at: string
}

// Grid configuration constants
export const GRID_CONFIG = {
  CELL_WIDTH: 280,        // Width of each grid cell
  CELL_HEIGHT: 140,       // Height of each grid cell
  NODE_WIDTH: 220,        // Width of node cards
  NODE_HEIGHT: 100,       // Height of node cards
  LANE_HEADER_WIDTH: 160, // Width of lane labels
  COLUMN_HEADER_HEIGHT: 48, // Height of column headers
  PADDING: 24,            // Padding within cells
} as const

// Helper to calculate pixel position from grid coordinates
export function gridToPixelPosition(col: number, row: number): { x: number; y: number } {
  const x = GRID_CONFIG.LANE_HEADER_WIDTH + col * GRID_CONFIG.CELL_WIDTH + 
            (GRID_CONFIG.CELL_WIDTH - GRID_CONFIG.NODE_WIDTH) / 2
  const y = GRID_CONFIG.COLUMN_HEADER_HEIGHT + row * GRID_CONFIG.CELL_HEIGHT + 
            (GRID_CONFIG.CELL_HEIGHT - GRID_CONFIG.NODE_HEIGHT) / 2
  return { x, y }
}

// Helper to calculate grid position from pixel coordinates
export function pixelToGridPosition(x: number, y: number): { col: number; row: number } {
  const col = Math.max(0, Math.floor((x - GRID_CONFIG.LANE_HEADER_WIDTH) / GRID_CONFIG.CELL_WIDTH))
  const row = Math.max(0, Math.floor((y - GRID_CONFIG.COLUMN_HEADER_HEIGHT) / GRID_CONFIG.CELL_HEIGHT))
  return { col, row }
}
