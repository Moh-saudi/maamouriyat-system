# Phase 3A — Server Authentication Context & Forced Password Security

> **Document Status**: Complete & Authoritative  
> **Phase**: Phase 3A — Server Authentication Context & Forced Password Security  
> **Branch**: `rebuild/v2-auth-context`  
> **Date**: September 2026  
> **Target System**: Maamouriyat Monitoring & Inspection System (Egyptian Ministry of Health & Population)

---

## 1. Identity Provider & Session Authority
- **Identity Provider**: Supabase Auth (`auth.users`) remains the sole identity provider during V2 development.
- **Session Authority**: The cryptographic session token is held in `HttpOnly` cookies and verified strictly on the server via `supabase.auth.getUser()`.
- **Zero Client Trust**: No client React state, `localStorage`, `sessionStorage`, or unverified cookies are trusted to establish identity or active status.
- **Zero Custom Passwords Table**: No custom passwords table, hashing library, or manual token handling is introduced.

---

## 2. Server Trust Boundary & Architecture

```
Browser / HTTP Request (Cookie Jar)
       ↓
Next.js Server Runtime
       ↓
src/server/auth/context.ts (getV2AuthState)
  ├─ 1. createServerSupabaseClient()
  ├─ 2. supabase.auth.getUser() -> cryptographic verification
  ├─ 3. public.users lookup -> id, is_active, full_name, org_id
  ├─ 4. public.organizations lookup -> organization display name
  └─ 5. resolveMustChangePassword() -> app_metadata with legacy fallback
       ↓
src/app/v2/(protected)/layout.tsx (Server Gate)
  ├─ unauthenticated     => redirect('/login')
  ├─ profile_missing     => redirect('/v2/access-denied')
  ├─ inactive            => redirect('/v2/access-denied')
  ├─ mustChangePassword  => redirect('/v2/change-password')
  └─ authenticated valid => render AppShell with minimal display props
       ↓
Client Boundary (AppShell / UserMenu)
  Receives ONLY: { name, jobTitle, organization, initials }
```

---

## 3. Server Authentication Types (`src/server/auth/types.ts`)

```typescript
export interface V2AuthenticatedUser {
  authUserId: string
  profileId: string
  email: string
  fullName: string
  jobTitle: string | null
  organizationId: string | null
  organizationName: string
  sectorId: string | null
  orgLevel: number
  mustChangePassword: boolean
}

export type V2AuthState =
  | { status: 'unauthenticated' }
  | { status: 'profile_missing' }
  | { status: 'inactive' }
  | { status: 'authenticated'; user: V2AuthenticatedUser }
```

### Critical Constraints:
1. **Organizational Hierarchy is NOT Authorization**: `orgLevel` represents organizational pyramid tier (1–7). It is purely organizational context. In Phase 3A, it is never used for `allow`/`deny` decisions.
2. **No Role / Permissions in Context**: `permissions`, `roles`, and `allowedNavigation` are strictly omitted from Phase 3A.

---

## 4. Forced Password Change Security Strategy

### 4.1 Vulnerability in V1
V1 stored `must_change_password: true` in `user.user_metadata.must_change_password`. This is editable by users in standard Supabase setups and relied on a client-side React modal in `system-ui.tsx` that could be bypassed via browser DevTools or direct API requests.

### 4.2 Authoritative Source in V2: `app_metadata`
In V2, the authoritative source is moved to `user.app_metadata.must_change_password`, which can only be modified server-side by a privileged service role key.

### 4.3 Compatibility Resolution Strategy
To support accounts created in V1 during development and transition cleanly:
```typescript
export function resolveMustChangePassword(
  appMetadata?: Record<string, unknown> | null,
  userMetadata?: Record<string, unknown> | null
): boolean {
  if (typeof appMetadata?.must_change_password === 'boolean') {
    return appMetadata.must_change_password
  }
  if (typeof userMetadata?.must_change_password === 'boolean') {
    return userMetadata.must_change_password
  }
  return false
}
```

### 4.4 Verified Compatibility Matrix:
- **Case A (`app=true`, `user=false`)**: Returns `true` (authoritative `app_metadata` wins).
- **Case B (`app=false`, `user=true`)**: Returns `false` (authoritative `app_metadata` wins over legacy flag).
- **Case C (`app=absent`, `user=true`)**: Returns `true` (legacy compatibility fallback).
- **Case D (`app=absent`, `user=false/absent`)**: Returns `false`.

---

## 5. Endpoints & Operations Updated

1. **`src/app/api/admin/create-user/route.ts`**:
   - `admin.createUser`: Writes `app_metadata: { must_change_password: true }` alongside legacy `user_metadata`.
   - `admin.updateUserById`: Preserves existing metadata via spread and updates both `app_metadata` and `user_metadata`.
2. **`src/app/api/admin/reset-password/route.ts`**:
   - `admin.updateUserById`: Sets `app_metadata.must_change_password = true` and `user_metadata.must_change_password = true` with metadata preservation.
3. **`src/app/api/user/change-password/route.ts`**:
   - Upon successful password update, sets both `app_metadata.must_change_password = false` and `user_metadata.must_change_password = false`.
4. **V2 Password Action (`src/server/auth/actions.ts` - `changeOwnPasswordAction`)**:
   - Server Action re-verifies session server-side.
   - Extracts user ID exclusively from session (no trusting client-supplied IDs).
   - Validates against shared password policy: required, $\ge 6$ characters, $\neq \text{'123456'}$, confirmation match.
   - Updates `password` and clears both `app_metadata` and `user_metadata` flags using the server-only admin client.
   - Password is never logged.
   - Redirects to `/v2/dashboard`.
5. **V2 Logout Action (`src/server/auth/actions.ts` - `logoutAction`)**:
   - Calls `supabase.auth.signOut()` on user-scoped client.
   - Redirects to `/login`.
   - Wired cleanly to `UserMenu.tsx` and error screens.

---

## 6. Gated Routes & UI Screens Added

1. **`/v2/change-password`** (`src/app/v2/(auth)/change-password/page.tsx`):
   - Located outside `(protected)` to prevent redirect loops.
   - Gated: unauthenticated $\to$ `/login`; missing/inactive profile $\to$ `/v2/access-denied`; compliant user ($mustChangePassword = false$) $\to$ `/v2/dashboard`.
   - Explains: *"يجب تعيين كلمة مرور جديدة قبل متابعة استخدام المنظومة."* (Temporary password is never shown).
   - NO sidebar, NO bottom nav, NO bypass links.
2. **`/v2/access-denied`** (`src/app/v2/(auth)/access-denied/page.tsx`):
   - Located outside `(protected)`.
   - Generic message: *"تعذر السماح لهذا الحساب بالوصول إلى المنظومة. يرجى التواصل مع مسؤول النظام."*
   - Generic fail-closed screen without leaking database, RLS, or missing profile internals.
   - Includes real logout action button.

---

## 7. Service Role Isolation

- Created `src/server/supabase/admin.ts` guarded by `import 'server-only'`.
- Reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- **Zero Fallback to Anon Key**: If `SUPABASE_SERVICE_ROLE_KEY` is missing, throws an explicit exception rather than failing silently under RLS.
- Never exposed or imported in client component bundles.

---

## 8. What is Explicitly NOT Implemented (Reserved for Phase 3B/3C)

- **Dynamic RBAC tables** (`roles`, `permissions`, `user_roles`, `role_permissions`).
- **Data scoping engine** (Sector/Directorate filtering).
- **Permission evaluation engine** (`hasPermission()`).
- **Route / navigation filtering based on roles** (`V2_NAVIGATION_ITEMS` remains full).
- **Rewriting of V1 middleware** (`src/middleware.ts` left intact).
- **One-time user metadata migration script** (documented for cutover phase).
