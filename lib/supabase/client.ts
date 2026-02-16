import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr"

// Context: Singleton pattern for browser Supabase client to prevent multiple instances
let client: ReturnType<typeof createSupabaseBrowserClient> | undefined

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  console.log("[v0] Supabase Browser Client - URL present:", !!supabaseUrl, "Key present:", !!supabaseAnonKey)

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not set. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.")
  }

  if (!client) {
    client = createSupabaseBrowserClient(supabaseUrl, supabaseAnonKey)
  }
  return client
}

export function createBrowserClient() {
  return createClient()
}
