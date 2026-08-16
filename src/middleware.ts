import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { type UserRole, type NavigationKey, getRoleNavigation, normalizeNavigationKeys } from './lib/roles'

const routePrefixes: Record<NavigationKey, string> = {
  dashboard: '/dashboard',
  facilities: '/dashboard/facilities',
  missions: '/dashboard/missions',
  settings: '/dashboard/settings',
  users: '/dashboard/users',
  violations: '/dashboard/violations',
  checklists: '/dashboard/checklists',
}

export async function middleware(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  const isLoginPage = req.nextUrl.pathname === '/login'

  const hasSupabaseCreds = Boolean(
    supabaseUrl &&
      supabasePublishableKey &&
      supabasePublishableKey !== 'your-anon-key-here' &&
      !supabaseUrl.includes('your-project')
  )

  // Real-time server logging
  console.log(
    `[MOHP Middleware] Path: ${req.nextUrl.pathname} | HasSupabase: ${hasSupabaseCreds}`
  )

  if (!hasSupabaseCreds) {
    if (!isLoginPage) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
    return NextResponse.next({ request: req })
  }

  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(supabaseUrl!, supabasePublishableKey!, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet: any[]) {
        cookiesToSet.forEach(({ name, value }: any) => req.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request: req })
        cookiesToSet.forEach(({ name, value, options }: any) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // network/auth failure → treat as unauthenticated
  }

  if (!user && !isLoginPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isLoginPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && !isLoginPage) {
    let activeRole: UserRole = 'inspector'
    let allowedPagesOverride: NavigationKey[] | null = null
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('id, org_level, level, job_title')
        .eq('auth_id', user.id)
        .maybeSingle()

      if (profile) {
        const { orgLevelToRole } = await import('./lib/roles')
        activeRole = orgLevelToRole(profile.level ?? profile.org_level ?? 7, profile.job_title)
      }
    } catch {
      activeRole = 'inspector'
    }

    if (!canUserOpenPath(activeRole, req.nextUrl.pathname, allowedPagesOverride)) {
      console.log(`[MOHP Middleware] ACCESS DENIED: Server-verified role for ${user.email} is ${activeRole}. Redirecting ${req.nextUrl.pathname} to /dashboard`)
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

function canUserOpenPath(role: UserRole, pathname: string, allowedPagesOverride?: readonly NavigationKey[] | null) {
  if (pathname === '/dashboard') return true
  if (pathname === '/dashboard/missions/new' || pathname.startsWith('/dashboard/missions/new/')) {
    // المستويات 1-6 يمكنها إنشاء مأموريات؛ المستوى 7 (ميداني) لا ينشئ
    return role !== 'inspector'
  }

  const routeKey = Object.entries(routePrefixes)
    .filter(([, prefix]) => prefix !== '/dashboard')
    .find(([, prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[0] as NavigationKey | undefined

  if (!routeKey) return true
  return (allowedPagesOverride ?? getRoleNavigation(role)).includes(routeKey)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
