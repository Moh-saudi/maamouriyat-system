'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Plus, Tags, Trash2 } from 'lucide-react'

type Specialty = {
  id: string
  code: string
  name_ar: string
  description_ar: string | null
  sort_order: number
}

type Mapping = {
  organization_id: string
  specialty_id: string
  specialty_code: string | null
  specialty_name_ar: string
  service_scope_org_id: string
  service_scope_name: string
  is_primary: boolean
}

type OrganizationOption = {
  id: string
  name: string
  parent_id: string | null
}

type ResponsePayload = {
  specialties?: Specialty[]
  mappings?: Mapping[]
  error?: string
}

export function OrganizationCorrectionSpecialties({
  organizationId,
  organizationName,
  organizations,
  canManage,
}: {
  organizationId: string
  organizationName: string
  organizations: OrganizationOption[]
  canManage: boolean
}) {
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [mappings, setMappings] = useState<Mapping[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [specialtyId, setSpecialtyId] = useState('')
  const [serviceScopeOrgId, setServiceScopeOrgId] = useState(organizationId)
  const [showEditor, setShowEditor] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<Mapping | null>(null)

  const organizationById = useMemo(
    () => new Map(organizations.map((item) => [item.id, item])),
    [organizations]
  )

  const serviceScopeOptions = useMemo(() => {
    const result: OrganizationOption[] = []
    const visited = new Set<string>()
    let currentId: string | null = organizationId

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId)
      const organization = organizationById.get(currentId)
      if (!organization) break
      result.push(organization)
      currentId = organization.parent_id
    }

    return result
  }, [organizationById, organizationId])

  async function load() {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/correction-specialties?organization_id=${encodeURIComponent(
          organizationId
        )}`,
        { cache: 'no-store', credentials: 'same-origin' }
      )
      const payload = (await response.json()) as ResponsePayload

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل اختصاصات التصحيح')
      }

      const nextSpecialties = payload.specialties ?? []
      setSpecialties(nextSpecialties)
      setMappings(payload.mappings ?? [])
      setSpecialtyId((current) => current || nextSpecialties[0]?.id || '')
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل اختصاصات التصحيح'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setServiceScopeOrgId(organizationId)
    setShowEditor(false)
    setRemoveTarget(null)
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const availableSpecialties = specialties.filter(
    (specialty) =>
      !mappings.some((mapping) => mapping.specialty_id === specialty.id)
  )

  async function addMapping() {
    if (!specialtyId || !serviceScopeOrgId) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/correction-specialties', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization_id: organizationId,
          specialty_id: specialtyId,
          service_scope_org_id: serviceScopeOrgId,
          is_primary: true,
        }),
      })

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر حفظ اختصاص التصحيح')
      }

      setShowEditor(false)
      await load()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'تعذر حفظ اختصاص التصحيح'
      )
    } finally {
      setSaving(false)
    }
  }

  async function removeMapping(mapping: Mapping) {
    setSaving(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        organization_id: organizationId,
        specialty_id: mapping.specialty_id,
        service_scope_org_id: mapping.service_scope_org_id,
      })

      const response = await fetch(
        `/api/admin/correction-specialties?${params.toString()}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
        }
      )

      const payload = (await response.json()) as { error?: string }

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر إيقاف اختصاص التصحيح')
      }

      setRemoveTarget(null)
      await load()
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : 'تعذر إيقاف اختصاص التصحيح'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="mt-5 flex min-h-24 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        جارٍ تحميل اختصاصات جهة التصحيح...
      </div>
    )
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
            <Tags className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900">
              اختصاصات جهة التصحيح
            </h3>
            <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">
              تحدد نوع الملاحظات التي يمكن توجيهها إلى {organizationName}.
              نطاق الخدمة يحدد الجزء من الهيكل الذي تغطيه هذه الجهة.
            </p>
          </div>
        </div>

        {canManage && availableSpecialties.length > 0 && !showEditor && (
          <button
            type="button"
            onClick={() => {
              const first = availableSpecialties[0]
              setSpecialtyId(first?.id ?? '')
              setServiceScopeOrgId(serviceScopeOptions[0]?.id ?? organizationId)
              setShowEditor(true)
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 text-[10px] font-bold text-teal-800 hover:bg-teal-50"
          >
            <Plus className="h-3.5 w-3.5" />
            إضافة اختصاص
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10px] leading-5 text-red-800">
          {error}
        </div>
      )}

      {mappings.length > 0 ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {mappings.map((mapping) => (
            <div
              key={`${mapping.specialty_id}:${mapping.service_scope_org_id}`}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-800">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    {mapping.specialty_name_ar}
                  </p>
                  <p className="mt-1 text-[9px] leading-4 text-slate-400">
                    نطاق الخدمة: {mapping.service_scope_name}
                  </p>
                </div>

                {canManage &&
                  (removeTarget?.specialty_id === mapping.specialty_id &&
                  removeTarget?.service_scope_org_id ===
                    mapping.service_scope_org_id ? (
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void removeMapping(mapping)}
                        className="rounded-md bg-rose-600 px-2 py-1 text-[9px] font-bold text-white disabled:opacity-50"
                      >
                        تأكيد
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setRemoveTarget(null)}
                        className="rounded-md border border-slate-200 px-2 py-1 text-[9px] font-bold text-slate-500"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setRemoveTarget(mapping)}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40"
                      aria-label="إيقاف اختصاص التصحيح"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-4 text-center">
          <p className="text-[11px] font-bold text-slate-600">
            هذه الجهة ليست معرفة كجهة تصحيح حتى الآن
          </p>
          <p className="mt-1 text-[9px] leading-4 text-slate-400">
            يمكن أن تظل جهة إدارية عادية، أو تربط باختصاص واحد أو أكثر عند الحاجة.
          </p>
        </div>
      )}

      {canManage && showEditor && (
        <div className="mt-3 rounded-xl border border-teal-200 bg-white p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold text-slate-600">
                اختصاص التصحيح
              </span>
              <select
                value={specialtyId}
                onChange={(event) => setSpecialtyId(event.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-teal-500"
              >
                {availableSpecialties.map((specialty) => (
                  <option key={specialty.id} value={specialty.id}>
                    {specialty.name_ar}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-bold text-slate-600">
                نطاق الخدمة
              </span>
              <select
                value={serviceScopeOrgId}
                onChange={(event) =>
                  setServiceScopeOrgId(event.target.value)
                }
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] text-slate-700 outline-none focus:border-teal-500"
              >
                {serviceScopeOptions.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="mt-2 text-[9px] leading-4 text-slate-400">
            نطاق الخدمة يجب أن يكون الجهة نفسها أو إحدى الجهات الأعلى منها في
            الهيكل. إذا وُجدت جهة تصحيح أقرب للمنشأة فسوف تكون لها الأولوية في
            التوجيه التلقائي.
          </p>

          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowEditor(false)}
              className="h-8 rounded-lg border border-slate-200 px-3 text-[10px] font-bold text-slate-500 disabled:opacity-40"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={saving || !specialtyId || !serviceScopeOrgId}
              onClick={() => void addMapping()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-teal-700 px-3 text-[10px] font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              حفظ الاختصاص
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
