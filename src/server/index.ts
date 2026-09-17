/**
 * V2 Server Layer Architecture
 * 
 * Sub-directories:
 * - auth: Server-side session verification & token inspection (Phase 3)
 * - authorization: Dynamic RBAC evaluation & data scoping engine (Phase 3)
 * - repositories: Direct PostgreSQL & Supabase query wrappers (Phase 3/4)
 * - services: Cross-domain business transactions & domain workflows (Phase 5/6)
 * - supabase: Hardened server client factory (service-role only on backend)
 */
export const SERVER_LAYER_VERSION = '2.0.0-foundation'
