import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RoadmapsPageClient } from "@/components/roadmaps-page-client"

// Context: Dashboard page showing all roadmaps user has access to
// Rebranded to "Sage Planner" with archive/account management features
export default async function RoadmapsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: allRoadmaps, error } = await supabase
    .from("roadmaps")
    .select("*")
    .order("updated_at", { ascending: false })

  const hasRLSError = error && error.message?.includes("infinite recursion")

  const activeRoadmaps = allRoadmaps?.filter((r) => !r.archived) || []
  const archivedRoadmaps = allRoadmaps?.filter((r) => r.archived) || []

  return (
    <RoadmapsPageClient
      user={user}
      activeRoadmaps={activeRoadmaps}
      archivedRoadmaps={archivedRoadmaps}
      hasRLSError={hasRLSError}
    />
  )
}
