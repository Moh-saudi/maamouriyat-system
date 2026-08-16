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

    const { data: orgData } = await supabase
      .from('organizations')
      .select('id, name, code, level, level_label, parent_id, sector_id, governorate, health_admin, can_issue_missions, can_approve_missions, can_view_all_governorate, can_view_sector_facilities, is_active, created_at')
      .order('level')
      .order('name')

    if (!error && data?.length) {
      correctionUnits = data
      centralStoreReady = true
    }
  }

  const { data: allOrgs } = supabase ? await supabase
    .from('organizations')
    .select('id, name, code, level, level_label, parent_id, sector_id, governorate, health_admin, can_issue_missions, can_approve_missions, can_view_all_governorate, can_view_sector_facilities, is_active, created_at')
    .order('level')
    .order('name') : { data: [] }

  return (
    <DashboardShell role={currentRole} view="settings">
      <SettingsPortal
        initialUnits={correctionUnits}
        initialOrganizations={allOrgs ?? []}
        centralStoreReady={centralStoreReady}
      />
    </DashboardShell>
  )
}
