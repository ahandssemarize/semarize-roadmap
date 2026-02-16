"use client"

/**
 * Node Position Migration Component
 * 
 * Add this component to a page in your app to run the migration.
 * It will update all node positions to use the corrected centering formula.
 * 
 * Usage:
 * 1. Add this file to your components folder
 * 2. Create a page that renders this component (e.g., /app/admin/migrate/page.tsx)
 * 3. Visit the page and click the "Run Migration" button
 * 4. Remove the page/component after migration is complete
 */

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

// Grid configuration - must match your roadmap-grid.tsx
const GRID = {
  CELL_WIDTH: 360,
  CELL_HEIGHT: 360,
  LANE_HEADER_WIDTH: 200,
  COLUMN_HEADER_HEIGHT: 52,
  NODE_WIDTH: Math.round(360 * 0.7), // 252px
  NODE_PADDING: 24,
  BORDER_WIDTH: 1,
}

// OLD formula - how positions were previously calculated (with border offsets)
// x = LANE_HEADER_WIDTH + col * CELL_WIDTH + centering + BORDER_WIDTH * (col + 1)
function getGridCellOld(x: number, y: number): { col: number; row: number } {
  const centeringOffset = (GRID.CELL_WIDTH - GRID.NODE_WIDTH) / 2
  // Old formula added (col+1) border pixels, so effective cell width was 361
  // x = 200 + col * 360 + 54 + (col + 1) = 255 + col * 361
  const col = Math.round((x - 255) / 361)
  const row = Math.round((y - GRID.COLUMN_HEADER_HEIGHT - GRID.NODE_PADDING) / GRID.CELL_HEIGHT)
  return { col: Math.max(0, col), row: Math.max(0, row) }
}

// NEW formula - correct centering for border-collapse tables (no extra border offset)
// x = LANE_HEADER_WIDTH + col * CELL_WIDTH + centering
function getCellPositionNew(col: number, row: number): { x: number; y: number } {
  const centeringOffset = (GRID.CELL_WIDTH - GRID.NODE_WIDTH) / 2
  const x = GRID.LANE_HEADER_WIDTH + col * GRID.CELL_WIDTH + centeringOffset
  const y = GRID.COLUMN_HEADER_HEIGHT + row * GRID.CELL_HEIGHT + GRID.NODE_PADDING
  return { x, y }
}

interface MigrationLog {
  type: "info" | "success" | "error" | "skip"
  message: string
}

interface Roadmap {
  id: string
  title: string
}

function NodePositionMigration() {
  const [isRunning, setIsRunning] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([])
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string>("")
  const [logs, setLogs] = useState<MigrationLog[]>([])
  const [summary, setSummary] = useState<{
    total: number
    updated: number
    skipped: number
    errors: number
  } | null>(null)

  // Load roadmaps on mount
  useEffect(() => {
    const loadRoadmaps = async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("roadmaps")
        .select("id, title")
        .order("title")
      
      if (!error && data) {
        setRoadmaps(data)
      }
      setIsLoading(false)
    }
    loadRoadmaps()
  }, [])

  const addLog = (type: MigrationLog["type"], message: string) => {
    setLogs((prev) => [...prev, { type, message }])
  }

  const runMigration = async () => {
    if (!selectedRoadmapId) {
      alert("Please select a roadmap first")
      return
    }

    setIsRunning(true)
    setLogs([])
    setSummary(null)

    const supabase = createClient()
    const selectedRoadmap = roadmaps.find(r => r.id === selectedRoadmapId)

    addLog("info", `🚀 Starting migration for: ${selectedRoadmap?.title || selectedRoadmapId}`)

    // Fetch nodes for selected roadmap only
    const { data: nodes, error: fetchError } = await supabase
      .from("roadmap_nodes")
      .select("id, title, position_x, position_y, roadmap_id")
      .eq("roadmap_id", selectedRoadmapId)

    if (fetchError) {
      addLog("error", `❌ Error fetching nodes: ${fetchError.message}`)
      setIsRunning(false)
      return
    }

    if (!nodes || nodes.length === 0) {
      addLog("info", "ℹ️ No nodes found in database. Nothing to migrate.")
      setIsRunning(false)
      return
    }

    addLog("info", `📊 Found ${nodes.length} nodes to check`)

    let updatedCount = 0
    let skippedCount = 0
    let errorCount = 0

    for (const node of nodes) {
      // Get the logical grid cell from the old position
      const { col, row } = getGridCellOld(node.position_x, node.position_y)

      // Calculate what the NEW position should be
      const { x: newX, y: newY } = getCellPositionNew(col, row)

      // Check if position actually needs updating
      if (node.position_x === newX && node.position_y === newY) {
        skippedCount++
        continue
      }

      addLog(
        "info",
        `📍 "${node.title}" - Cell (${col}, ${row}): (${node.position_x}, ${node.position_y}) → (${newX}, ${newY})`
      )

      // Update the node position
      const { error: updateError } = await supabase
        .from("roadmap_nodes")
        .update({ position_x: newX, position_y: newY })
        .eq("id", node.id)

      if (updateError) {
        addLog("error", `   ❌ Error: ${updateError.message}`)
        errorCount++
      } else {
        addLog("success", `   ✅ Updated`)
        updatedCount++
      }
    }

    setSummary({
      total: nodes.length,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
    })

    addLog("info", "🎉 Migration complete!")
    setIsRunning(false)
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <p>Loading roadmaps...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Node Position Migration</h1>
      <p className="text-muted-foreground mb-6">
        This tool fixes node positions that appear off-center due to a formula change.
        The old formula added cumulative border offsets that caused nodes to drift right.
      </p>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-2">What this does:</h2>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          <li>Reads nodes from the selected roadmap</li>
          <li>Calculates the grid cell (row, column) each node belongs to</li>
          <li>Recalculates the correct centered position (removing border drift)</li>
          <li>Updates nodes that need new positions</li>
          <li>Skips nodes that are already correctly positioned</li>
        </ul>
      </Card>

      <Card className="p-6 mb-6">
        <h2 className="font-semibold mb-3">Select Roadmap to Migrate</h2>
        <select
          className="w-full p-2 border rounded-md"
          value={selectedRoadmapId}
          onChange={(e) => setSelectedRoadmapId(e.target.value)}
          disabled={isRunning}
        >
          <option value="">-- Select a roadmap --</option>
          {roadmaps.map((roadmap) => (
            <option key={roadmap.id} value={roadmap.id}>
              {roadmap.title}
            </option>
          ))}
        </select>
      </Card>

      <Button 
        onClick={runMigration} 
        disabled={isRunning || !selectedRoadmapId}
        size="lg"
        className="mb-6"
      >
        {isRunning ? "Running Migration..." : "Run Migration"}
      </Button>

      {summary && (
        <Card className="p-4 mb-6 bg-slate-50">
          <h3 className="font-semibold mb-2">Summary</h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-xs text-muted-foreground">Total Nodes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{summary.updated}</div>
              <div className="text-xs text-muted-foreground">Updated</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-500">{summary.skipped}</div>
              <div className="text-xs text-muted-foreground">Skipped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{summary.errors}</div>
              <div className="text-xs text-muted-foreground">Errors</div>
            </div>
          </div>
        </Card>
      )}

      {logs.length > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Migration Log</h3>
          <div className="max-h-96 overflow-y-auto bg-slate-900 text-slate-100 p-4 rounded font-mono text-xs space-y-1">
            {logs.map((log, i) => (
              <div
                key={i}
                className={
                  log.type === "error"
                    ? "text-red-400"
                    : log.type === "success"
                    ? "text-green-400"
                    : log.type === "skip"
                    ? "text-slate-500"
                    : "text-slate-300"
                }
              >
                {log.message}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

export default NodePositionMigration
