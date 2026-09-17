import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let adminClient: SupabaseClient | null = null

/**
 * Creates or retrieves the privileged server-side Supabase Admin Client (Service Role).
 *
 * SECURITY CONSTRAINTS:
 * - Available exclusively on the server (protected by 'server-only').
 * - Must NEVER fall back to anon or publishable keys.
 * - Used exclusively for administrative metadata/user maintenance where user-scoped client lacks privilege.
 */
export function getAdminSupabaseClient(): SupabaseClient {
  if (adminClient) {
    return adminClient
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      '[V2 Auth Admin] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing on the server. Privileged operations are rejected.'
    )
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return adminClient
}
