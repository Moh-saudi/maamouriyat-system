import { redirect } from 'next/navigation'
import { DashboardShell } from '../../system-ui'
import { defaultCorrectionUnits, type CorrectionUnitOption } from '@/lib/correction-units'
import { levelToRole } from '@/lib/roles'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SettingsPortal } from './settings-portal'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  let correctionUnits: CorrectionUnitOption[] = defaultCorrectionUnits.map((name) => ({ name }))
  let centralStoreReady = false
  let currentRole = levelToRole(7)

  if (!supabase) {
    redirect('/login')
  }

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: profile } = await supabase
      .from('users')
      .select('level')
      .eq('auth_id', user.id)
      .maybeSingle<{ level: number }>()

    if (!profile || !['superadmin', 'techadmin'].includes(levelToRole(profile.level))) {
      redirect('/dashboard')
    }
    currentRole = levelToRole(profile.level)

    const { data, error } = await supabase
      .from('correction_units')
      .select('id, name')
      .eq('is_active', true)
      .order('sort_order')
      .order('name')

    if (!error && data?.length) {
      correctionUnits = data
      centralStoreReady = true
    }
  }

  return (
    <DashboardShell role={currentRole} view="settings">
      <SettingsPortal
        initialUnits={correctionUnits}
        centralStoreReady={centralStoreReady}
      />
    </DashboardShell>
  )
}
