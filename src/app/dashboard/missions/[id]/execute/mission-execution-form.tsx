'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import styles from './execute.module.css'

type Facility = {
  id: string
  name: string
  address: string
  governorate_id: string | null
}

type Governorate = {
  id: string
  name: string
}

type Mission = {
  id: string
  serial_number: string
  status: string | null
  destination_type: string | null
  visit_purpose: string | null
  target_facility_id: string | null
  target_governorate_id: string | null
  actual_facility_id: string | null
  actual_governorate_id: string | null
  destination_changed: boolean | null
  change_reason: string | null
  execution_notes: string | null
  facilities: { name: string } | null
  governorates: { name: string } | null
}

export function MissionExecutionForm({
  currentUserId,
  facilities,
  governorates,
  mission,
}: {
  currentUserId: string
  facilities: Facility[]
  governorates: Governorate[]
  mission: Mission
}) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [destinationType, setDestinationType] = useState<'facility' | 'governorate'>(
    (mission.destination_type as 'facility' | 'governorate') ?? 'facility',
  )
  const [actualFacilityId, setActualFacilityId] = useState(mission.actual_facility_id ?? mission.target_facility_id ?? '')
  const [actualGovernorateId, setActualGovernorateId] = useState(
    mission.actual_governorate_id ?? mission.target_governorate_id ?? '',
  )
  const [changeReason, setChangeReason] = useState(mission.change_reason ?? '')
  const [executionNotes, setExecutionNotes] = useState(mission.execution_notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === actualFacilityId),
    [actualFacilityId, facilities],
  )

  const changed =
    destinationType !== mission.destination_type ||
    actualFacilityId !== (mission.target_facility_id ?? '') ||
    actualGovernorateId !== (mission.target_governorate_id ?? '')

  async function save(status: 'in_progress' | 'completed') {
    setError('')
    setSuccess('')

    if (!supabase) {
      setError('إعداد Supabase غير مكتمل.')
      return
    }

    if (destinationType === 'facility' && !actualFacilityId) {
      setError('يرجى اختيار المنشأة الفعلية.')
      return
    }

    if (destinationType === 'governorate' && !actualGovernorateId) {
      setError('يرجى اختيار المحافظة الفعلية.')
      return
    }

    if (changed && !changeReason.trim()) {
      setError('عند تغيير الوجهة يجب كتابة سبب التغيير.')
      return
    }

    setLoading(true)

    const now = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('missions')
      .update({
        actual_facility_id: destinationType === 'facility' ? actualFacilityId : null,
        actual_governorate_id:
          destinationType === 'facility' ? ((selectedFacility?.governorate_id ?? actualGovernorateId) || null) : actualGovernorateId,
        destination_changed: changed,
        change_reason: changed ? changeReason.trim() : null,
        execution_notes: executionNotes.trim() || null,
        started_at: mission.status === 'assigned' ? now : undefined,
        completed_at: status === 'completed' ? now : null,
        status,
      })
      .eq('id', mission.id)

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(status === 'completed' ? 'تم إنهاء المأمورية.' : 'تم بدء/تحديث المأمورية.')
    router.refresh()
  }

  return (
    <section className={styles.panel}>
      <div className={styles.summary}>
        <div>
          <span>الوجهة الأصلية</span>
          <strong>{mission.destination_type === 'governorate' ? mission.governorates?.name : mission.facilities?.name}</strong>
        </div>
        <div>
          <span>الغرض من الزيارة</span>
          <strong>{mission.visit_purpose || 'غير مسجل'}</strong>
        </div>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <div className={styles.segmented}>
        <button className={destinationType === 'facility' ? styles.active : ''} type="button" onClick={() => setDestinationType('facility')}>
          منشأة فعلية
        </button>
        <button className={destinationType === 'governorate' ? styles.active : ''} type="button" onClick={() => setDestinationType('governorate')}>
          محافظة فعلية
        </button>
      </div>

      <div className={styles.grid}>
        {destinationType === 'facility' ? (
          <label>
            المنشأة التي تم/سيتم التوجه إليها
            <select value={actualFacilityId} onChange={(event) => setActualFacilityId(event.target.value)}>
              <option value="">اختر المنشأة</option>
              {facilities.map((facility) => (
                <option key={facility.id} value={facility.id}>
                  {facility.name} - {facility.address}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            المحافظة التي تم/سيتم التوجه إليها
            <select value={actualGovernorateId} onChange={(event) => setActualGovernorateId(event.target.value)}>
              <option value="">اختر المحافظة</option>
              {governorates.map((governorate) => (
                <option key={governorate.id} value={governorate.id}>
                  {governorate.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          سبب تغيير الوجهة
          <textarea value={changeReason} onChange={(event) => setChangeReason(event.target.value)} rows={3} placeholder="يُكتب عند اختلاف الوجهة الفعلية عن الأصلية" />
        </label>

        <label className={styles.wide}>
          ملاحظات التنفيذ
          <textarea value={executionNotes} onChange={(event) => setExecutionNotes(event.target.value)} rows={4} />
        </label>
      </div>

      <div className={styles.actions}>
        <button disabled={loading} onClick={() => save('in_progress')} type="button">
          حفظ وبدء التنفيذ
        </button>
        <button className={styles.complete} disabled={loading} onClick={() => save('completed')} type="button">
          إنهاء المأمورية
        </button>
      </div>
    </section>
  )
}
