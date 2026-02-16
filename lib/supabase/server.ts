import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

// Context: Server-side Supabase client with cookie management for auth
// Always create a new client for each request (important for Fluid compute)
export async function createClient() {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log("[v0] Supabase Server Client - URL present:", !!supabaseUrl, "Key present:", !!supabaseAnonKey)

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not set. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.")
  }

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // setAll called from Server Component, can be ignored with proxy refreshing
        }
      },
    },
  })
}
