'use client'

import { useState, useEffect, ReactNode } from 'react'
import { DesktopSidebar } from './DesktopSidebar'
import { Topbar } from './Topbar'
import { MobileBottomNav } from './MobileBottomNav'
import { MoreNavigationSheet } from './MoreNavigationSheet'
import { V2_NAVIGATION_ITEMS, type NavItem } from '@/config/navigation'
import type { UserMenuProps } from './UserMenu'

const SIDEBAR_PREF_KEY = 'v2_sidebar_collapsed'

export interface AppShellProps {
  children: ReactNode
  items?: readonly NavItem[]
  user?: UserMenuProps
}

export function AppShell({
  children,
  items = V2_NAVIGATION_ITEMS,
  user,
}: AppShellProps) {
  // Sidebar collapsed state (defaults to expanded on desktop, loaded from localStorage if available)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMoreOpen, setIsMoreOpen] = useState(false)
  const homeHref = items[0]?.href ?? '/v2/access-denied'

  // Hydrate sidebar preference from localStorage on client
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_PREF_KEY)
      if (saved !== null) {
        setSidebarCollapsed(saved === 'true')
      }
    } catch {
      // Ignore localStorage errors (e.g. privacy mode / SSR)
    }
  }, [])

  const handleToggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_PREF_KEY, String(next))
      } catch {
        // Ignore
      }
      return next
    })
  }

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#f6f8f8] text-slate-900 antialiased">
      {/* ── Desktop Sidebar & Tablet Navigation Rail ──────────────────────── */}
      <DesktopSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        items={items}
        homeHref={homeHref}
      />

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <div
        className={`flex min-h-screen min-w-0 flex-col transition-[margin] duration-200 ${
          sidebarCollapsed
            ? 'md:mr-[76px]'
            : 'md:mr-[76px] lg:mr-[276px]'
        }`}
      >
        {/* Topbar with user profile wiring */}
        <Topbar user={user} items={items} homeHref={homeHref} />

        {/* Primary Page Content Container */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 w-full pb-24 md:pb-8 focus:outline-hidden"
        >
          {children}
        </main>
      </div>

      {/* ── Mobile Navigation Layer (< 768px) ─────────────────────────────── */}
      <MobileBottomNav
        items={items}
        onOpenMore={() => setIsMoreOpen(true)}
        isMoreOpen={isMoreOpen}
      />

      <MoreNavigationSheet
        isOpen={isMoreOpen}
        onOpenChange={setIsMoreOpen}
        items={items}
      />
    </div>
  )
}
