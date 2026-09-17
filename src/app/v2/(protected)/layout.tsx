import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'

export default function V2ProtectedLayout({
  children,
}: {
  children: ReactNode
}) {
  return <AppShell>{children}</AppShell>
}
