"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, AlertCircle, MoreVertical, Settings, Archive } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { RoadmapSettingsModal } from "@/components/roadmap-settings-modal"
import { AccountSettingsModal } from "@/components/account-settings-modal"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { createBrowserClient } from "@/lib/supabase/client"

// Context: Client component for roadmaps dashboard with Sage Planner branding
// Handles archive/account management features
interface RoadmapsPageClientProps {
  user: {
    email?: string
  }
  activeRoadmaps: Array<{
    id: string
    title: string
    description: string | null
    updated_at: string
    archived: boolean
  }>
  archivedRoadmaps: Array<{
    id: string
    title: string
    description: string | null
    updated_at: string
    archived: boolean
  }>
  hasRLSError: boolean
}

export function RoadmapsPageClient({ user, activeRoadmaps, archivedRoadmaps, hasRLSError }: RoadmapsPageClientProps) {
  const [selectedRoadmap, setSelectedRoadmap] = useState<{
    id: string
    title: string
    archived: boolean
  } | null>(null)
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const router = useRouter()

  const handleCreateRoadmap = async () => {
    try {
      setIsCreating(true)
      const supabase = createBrowserClient()

      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !authUser) {
        console.error("Error getting user:", userError)
        setIsCreating(false)
        return
      }

      const { data, error } = await supabase
        .from("roadmaps")
        .insert({
          title: "Untitled Roadmap",
          description: null,
          created_by: authUser.id,
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        router.push(`/roadmaps/${data.id}`)
      }
    } catch (error) {
      console.error("Error creating roadmap:", error)
      setIsCreating(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-semibold">Sage Planner</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={() => setAccountSettingsOpen(true)}>
              <Settings className="h-4 w-4" />
            </Button>
            <form action="/auth/sign-out" method="post">
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="container mx-auto flex-1 px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Your Roadmaps</h2>
            <p className="text-sm text-muted-foreground">Create and manage product roadmaps</p>
          </div>
          <Button onClick={handleCreateRoadmap} disabled={isCreating}>
            <Plus className="mr-2 h-4 w-4" />
            {isCreating ? "Creating..." : "New Roadmap"}
          </Button>
        </div>

        {hasRLSError && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Database Setup Required</AlertTitle>
            <AlertDescription>
              The database RLS policies need to be fixed. Please run the SQL scripts in the scripts folder:
              <code className="ml-2 rounded bg-muted px-2 py-1 text-sm">scripts/003_fix_rls_recursion.sql</code>
              <br />
              <span className="mt-2 block text-sm">You can still create new roadmaps - click "New Roadmap" above.</span>
            </AlertDescription>
          </Alert>
        )}

        {activeRoadmaps && activeRoadmaps.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeRoadmaps.map((roadmap) => (
              <Card key={roadmap.id} className="relative transition-colors hover:bg-accent">
                <div className="absolute right-2 top-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.preventDefault()}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          setSelectedRoadmap({
                            id: roadmap.id,
                            title: roadmap.title,
                            archived: roadmap.archived,
                          })
                        }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <Link href={`/roadmaps/${roadmap.id}`}>
                  <CardHeader>
                    <CardTitle>{roadmap.title}</CardTitle>
                    <CardDescription>{roadmap.description || "No description"}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Updated {new Date(roadmap.updated_at).toLocaleDateString()}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            ))}
          </div>
        ) : !hasRLSError ? (
          <Card>
            <CardHeader>
              <CardTitle>No roadmaps yet</CardTitle>
              <CardDescription>Create your first roadmap to get started</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {archivedRoadmaps && archivedRoadmaps.length > 0 && (
          <div className="mt-12">
            <h3 className="mb-4 text-lg font-semibold">Archived Roadmaps</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {archivedRoadmaps.map((roadmap) => (
                <Card key={roadmap.id} className="relative opacity-60 transition-opacity hover:opacity-80">
                  <div className="absolute right-2 top-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => e.preventDefault()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault()
                            setSelectedRoadmap({
                              id: roadmap.id,
                              title: roadmap.title,
                              archived: roadmap.archived,
                            })
                          }}
                          className="text-destructive"
                        >
                          <Settings className="mr-2 h-4 w-4" />
                          Manage
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Link href={`/roadmaps/${roadmap.id}`}>
                    <CardHeader>
                      <CardTitle>{roadmap.title}</CardTitle>
                      <CardDescription>{roadmap.description || "No description"}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(roadmap.updated_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Link>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      {selectedRoadmap && (
        <RoadmapSettingsModal
          roadmap={selectedRoadmap}
          open={!!selectedRoadmap}
          onOpenChange={(open) => !open && setSelectedRoadmap(null)}
        />
      )}

      <AccountSettingsModal
        open={accountSettingsOpen}
        onOpenChange={setAccountSettingsOpen}
        userEmail={user.email || ""}
      />
    </div>
  )
}
