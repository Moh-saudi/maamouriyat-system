'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import styles from './new-mission.module.css'

type Employee = {
  id: string
  full_name: string
  job_title: string | null
  level: number
  department: string | null
}

type OrgUnit = {
  id: string
  code: string
  name: string
  unit_type: string
  parent_id: string | null
  level: number
}

type Facility = {
  id: string
  name: string
  facility_type: string
  address: string
  governorate_id: string | null
  org_unit_id: string | null
}

type Governorate = {
  id: string
  name: string
  region: string | null
}

export type MissionOption = {
  employees: Employee[]
  orgUnits: OrgUnit[]
  facilities: Facility[]
  governorates: Governorate[]
}

type FormState = {
  assignedUserId: string
  orgUnitId: string
  destinationType: 'facility' | 'governorate'
  targetFacilityId: string
  targetGovernorateId: string
  scheduledDate: string
  priority: 'normal' | 'high' | 'urgent'
  visitPurpose: string
  notes: string
}

const initialState: FormState = {
  assignedUserId: '',
  orgUnitId: '',
  destinationType: 'facility',
  targetFacilityId: '',
  targetGovernorateId: '',
  scheduledDate: '',
  priority: 'normal',
  visitPurpose: '',
  notes: '',
}

export function MissionCreateForm({
  currentUserId,
  employees,
  facilities,
  governorates,
  orgUnits,
}: {
  currentUserId: string
  employees: Employee[]
  facilities: Facility[]
  governorates: Governorate[]
  orgUnits: OrgUnit[]
}) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === form.targetFacilityId),
    [facilities, form.targetFacilityId],
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'destinationType') {
        next.targetFacilityId = ''
        next.targetGovernorateId = ''
      }

      if (key === 'targetFacilityId') {
        const facility = facilities.find((item) => item.id === value)
        next.targetGovernorateId = facility?.governorate_id ?? ''
        next.orgUnitId = next.orgUnitId || facility?.org_unit_id || ''
      }

      return next
    })
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!supabase) {
      setError('إعداد Supabase غير مكتمل.')
      return
    }

    if (!form.assignedUserId || !form.orgUnitId || !form.scheduledDate || !form.visitPurpose.trim()) {
      setError('يرجى استكمال الموظف والإدارة والتاريخ والغرض من الزيارة.')
      return
    }

    if (form.destinationType === 'facility' && !form.targetFacilityId) {
      setError('يرجى اختيار المنشأة المستهدفة.')
      return
    }

    if (form.destinationType === 'governorate' && !form.targetGovernorateId) {
      setError('يرجى اختيار المحافظة المستهدفة.')
      return
    }

    setLoading(true)

    const { data: serialData, error: serialError } = await supabase.rpc('generate_serial_number', {
      dept_code: 'TH',
    })

    if (serialError) {
      setLoading(false)
      setError(serialError.message)
      return
    }

    const payload = {
      serial_number: serialData,
      assigned_user_id: form.assignedUserId,
      created_by: currentUserId,
      org_unit_id: form.orgUnitId,
      facility_id: form.destinationType === 'facility' ? form.targetFacilityId : null,
      destination_type: form.destinationType,
      target_facility_id: form.destinationType === 'facility' ? form.targetFacilityId : null,
      target_governorate_id:
        form.destinationType === 'facility' ? selectedFacility?.governorate_id ?? null : form.targetGovernorateId,
      priority: form.priority,
      scheduled_date: form.scheduledDate,
      visit_purpose: form.visitPurpose.trim(),
      notes: form.notes.trim() || null,
      status: 'assigned',
    }

    const { error: insertError } = await supabase.from('missions').insert(payload)

    setLoading(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSuccess(`تم إنشاء المأمورية رقم ${serialData}`)
    setForm(initialState)
    router.refresh()
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      <section className={styles.section}>
        <h2>بيانات التكليف</h2>
        <div className={styles.grid}>
          <label>
            الموظف القائم بالمأمورية
            <select value={form.assignedUserId} onChange={(event) => update('assignedUserId', event.target.value)} required>
              <option value="">اختر الموظف</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name} - {employee.job_title ?? employee.department ?? `مستوى ${employee.level}`}
                </option>
              ))}
            </select>
          </label>

          <label>
            الإدارة المختصة
            <select value={form.orgUnitId} onChange={(event) => update('orgUnitId', event.target.value)} required>
              <option value="">اختر الإدارة</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {'—'.repeat(Math.max(0, unit.level))} {unit.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            تاريخ المأمورية
            <input type="date" value={form.scheduledDate} onChange={(event) => update('scheduledDate', event.target.value)} required />
          </label>

          <label>
            الأولوية
            <select value={form.priority} onChange={(event) => update('priority', event.target.value as FormState['priority'])}>
              <option value="normal">عادية</option>
              <option value="high">مرتفعة</option>
              <option value="urgent">عاجلة</option>
            </select>
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <h2>وجهة المأمورية</h2>
        <div className={styles.segmented}>
          <button className={form.destinationType === 'facility' ? styles.active : ''} type="button" onClick={() => update('destinationType', 'facility')}>
            منشأة محددة
          </button>
          <button className={form.destinationType === 'governorate' ? styles.active : ''} type="button" onClick={() => update('destinationType', 'governorate')}>
            محافظة
          </button>
        </div>

        <div className={styles.grid}>
          {form.destinationType === 'facility' ? (
            <label>
              المنشأة المتوجه إليها
              <select value={form.targetFacilityId} onChange={(event) => update('targetFacilityId', event.target.value)} required>
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
              المحافظة المتوجه إليها
              <select value={form.targetGovernorateId} onChange={(event) => update('targetGovernorateId', event.target.value)} required>
                <option value="">اختر المحافظة</option>
                {governorates.map((governorate) => (
                  <option key={governorate.id} value={governorate.id}>
                    {governorate.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className={styles.wide}>
            الغرض من الزيارة
            <textarea value={form.visitPurpose} onChange={(event) => update('visitPurpose', event.target.value)} required rows={3} />
          </label>

          <label className={styles.wide}>
            ملاحظات التكليف
            <textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} rows={3} />
          </label>
        </div>
      </section>

      <div className={styles.actions}>
        <button disabled={loading} type="submit">
          {loading ? 'جاري الإنشاء...' : 'إنشاء المأمورية'}
        </button>
      </div>
    </form>
  )
}
