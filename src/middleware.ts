import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { normalizeDemoRole, roleDefinitions, type DemoRole, type NavigationKey, getUserNavigation } from './lib/roles'

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
  const demoRole = normalizeDemoRole(req.cookies.get('maamouriyat_demo_session')?.value)
  const hasDemoSession = Boolean(demoRole)

  const dynamicPermissionsRaw = req.cookies.get('maamouriyat_dynamic_permissions')?.value
  const userPermissionsRaw = req.cookies.get('maamouriyat_user_permissions')?.value

  if (demoRole && !isLoginPage) {
    const demoEmail = `${demoRole}@${demoRole}.com`
    if (!canUserOpenPath(demoEmail, demoRole, req.nextUrl.pathname, dynamicPermissionsRaw, userPermissionsRaw)) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (!supabaseUrl || !supabasePublishableKey || supabasePublishableKey === 'your-anon-key-here') {
    if (!isLoginPage) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }

    return NextResponse.next({ request: req })
  }

  let supabaseResponse = NextResponse.next({ request: req })

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return req.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request: req })
        cookiesToSet.forEach(({ name, value, options }) => {
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

  if (!user && !hasDemoSession && !isLoginPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if ((user || hasDemoSession) && isLoginPage) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/dashboard'
    return NextResponse.redirect(redirectUrl)
  }

  if (user && !isLoginPage) {
    const userRoleCookie = req.cookies.get('maamouriyat_user_role')?.value as DemoRole | undefined
    const activeRole = userRoleCookie || 'inspector'
    if (!canUserOpenPath(user.email || user.id, activeRole, req.nextUrl.pathname, dynamicPermissionsRaw, userPermissionsRaw)) {
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/dashboard'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}

function canUserOpenPath(
  emailOrId: string | null | undefined,
  role: DemoRole,
  pathname: string,
  dynamicPermissionsRaw?: string | null,
  userPermissionsRaw?: string | null
) {
  if (pathname === '/dashboard') return true

  const routeKey = Object.entries(routePrefixes)
    .filter(([, prefix]) => prefix !== '/dashboard')
    .find(([, prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[0] as NavigationKey | undefined

  if (!routeKey) return true
  return getUserNavigation(emailOrId, role, dynamicPermissionsRaw, userPermissionsRaw).includes(routeKey)
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
