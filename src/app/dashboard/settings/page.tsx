import { DashboardShell } from '../../system-ui'
import { defaultCorrectionUnits, type CorrectionUnitOption } from '@/lib/correction-units'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { SettingsPortal } from './settings-portal'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  let correctionUnits: CorrectionUnitOption[] = defaultCorrectionUnits.map((name) => ({ name }))
  let centralStoreReady = false

  if (supabase) {
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
    <DashboardShell view="settings">
      <SettingsPortal
        initialUnits={correctionUnits}
        centralStoreReady={centralStoreReady}
      />
    </DashboardShell>
  )
}
