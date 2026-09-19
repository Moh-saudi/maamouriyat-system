'use client'

import { useEffect, useMemo, useState } from 'react'
import { CompactFilterSelect } from '@/components/ui/CompactFilterSelect'
import { getFacilityTypeLabel } from '@/config/facility-types'
import {
  AlertTriangle,
  Building2,
  Check,
  FolderKanban,
  Loader2,
  Plus,
  Save,
  Search,
} from 'lucide-react'

type Program = {
  id: string
  code: string
  name: string
  description: string | null
  program_type: 'program' | 'initiative' | 'project' | 'campaign'
  scope_organization_id: string | null
  is_active: boolean
  facility_ids: string[]
  facility_count: number
  hidden_facility_count: number
}

type Facility = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  governorate: string | null
  health_admin: string | null
  village_city: string | null
}

type Payload = {
  programs?: Program[]
  facilities?: Facility[]
  can_manage_national?: boolean
  error?: string
}

export function FacilityProgramsManager() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [programType, setProgramType] =
    useState<Program['program_type']>('program')
  const [isActive, setIsActive] = useState(true)
  const [search, setSearch] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [healthAdmin, setHealthAdmin] = useState('')
  const [facilityType, setFacilityType] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load(preferredProgramId?: string) {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/v2/facility-programs', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const payload = (await response.json()) as Payload
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحميل المشروعات')
      }

      const nextPrograms = payload.programs ?? []
      const nextFacilities = payload.facilities ?? []
      setPrograms(nextPrograms)
      setFacilities(nextFacilities)

      const nextId =
        preferredProgramId ||
        selectedProgramId ||
        nextPrograms[0]?.id ||
        ''

      if (nextId) {
        const program = nextPrograms.find((item) => item.id === nextId)
        if (program) {
          selectProgram(program)
        }
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل المشروعات'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function selectProgram(program: Program) {
    setSelectedProgramId(program.id)
    setName(program.name)
    setDescription(program.description ?? '')
    setProgramType(program.program_type)
    setIsActive(program.is_active)
    setSelectedFacilityIds(program.facility_ids)
    setError(null)
  }

  function newProgram() {
    setSelectedProgramId('')
    setName('')
    setDescription('')
    setProgramType('program')
    setIsActive(true)
    setSelectedFacilityIds([])
    setError(null)
  }

  const governorates = useMemo(
    () =>
      [...new Set(facilities.map((facility) => facility.governorate).filter(Boolean))]
        .map(String)
        .sort((a, b) => a.localeCompare(b, 'ar')),
    [facilities]
  )

  const healthAdmins = useMemo(() => {
    const base = governorate
      ? facilities.filter((facility) => facility.governorate === governorate)
      : facilities

    return [...new Set(base.map((facility) => facility.health_admin).filter(Boolean))]
      .map(String)
      .sort((a, b) => a.localeCompare(b, 'ar'))
  }, [facilities, governorate])

  const facilityTypes = useMemo(
    () =>
      [...new Set(facilities.map((facility) => facility.facility_type))]
        .filter(Boolean)
        .sort((a, b) =>
          getFacilityTypeLabel(a).localeCompare(getFacilityTypeLabel(b), 'ar')
        ),
    [facilities]
  )

  const filteredFacilities = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('ar')
    return facilities.filter((facility) => {
      if (governorate && facility.governorate !== governorate) return false
      if (healthAdmin && facility.health_admin !== healthAdmin) return false
      if (facilityType && facility.facility_type !== facilityType) return false

      if (!q) return true
      return [
        facility.name,
        facility.health_admin ?? '',
        facility.governorate ?? '',
        facility.village_city ?? '',
        facility.facility_type,
      ].some((value) => value.toLocaleLowerCase('ar').includes(q))
    })
  }, [facilities, facilityType, governorate, healthAdmin, search])

  function toggleFacility(id: string) {
    setSelectedFacilityIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  function selectFiltered() {
    setSelectedFacilityIds((current) => [
      ...new Set([...current, ...filteredFacilities.map((facility) => facility.id)]),
    ])
  }

  async function saveProgram() {
    if (!name.trim()) {
      setError('اسم المشروع أو المبادرة مطلوب.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/v2/facility-programs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_program',
          id: selectedProgramId || undefined,
          name: name.trim(),
          description: description.trim(),
          program_type: programType,
          is_active: isActive,
        }),
      })
      const payload = (await response.json()) as {
        program?: Program
        error?: string
      }

      if (!response.ok || !payload.program?.id) {
        throw new Error(payload.error || 'تعذر حفظ المشروع')
      }

      const programId = payload.program.id

      const membershipResponse = await fetch('/api/v2/facility-programs', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_facilities',
          program_id: programId,
          facility_ids: selectedFacilityIds,
        }),
      })
      const membershipPayload = (await membershipResponse.json()) as {
        error?: string
      }

      if (!membershipResponse.ok) {
        throw new Error(
          membershipPayload.error || 'تم حفظ المشروع وتعذر حفظ منشآته'
        )
      }

      await load(programId)
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'تعذر حفظ المشروع'
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تحميل برامج المنشآت...
      </div>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-900">
              المشروعات والمبادرات
            </h2>
            <p className="mt-1 text-[10px] text-slate-400">
              {programs.length.toLocaleString('en-US')} مجموعة معرفة
            </p>
          </div>
          <button
            type="button"
            onClick={newProgram}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white"
            aria-label="مشروع جديد"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {programs.map((program) => (
            <button
              key={program.id}
              type="button"
              onClick={() => selectProgram(program)}
              className={
                'w-full rounded-xl border p-3 text-right ' +
                (selectedProgramId === program.id
                  ? 'border-teal-300 bg-teal-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50')
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-slate-900">
                    {program.name}
                  </p>
                  <p className="mt-1 text-[9px] text-slate-400">
                    {program.code}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">
                  {program.facility_count.toLocaleString('en-US')}
                </span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <FolderKanban className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-black text-slate-900">
                {selectedProgramId ? 'بيانات المجموعة' : 'مجموعة منشآت جديدة'}
              </h2>
              <p className="mt-1 text-[10px] text-slate-400">
                المجموعة لا تغير تبعية المنشأة؛ هي فقط تصنيف تشغيلي لاستخدامه
                في التكليفات والتقارير.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <label>
              <span className="mb-1 block text-[10px] font-bold text-slate-600">
                الاسم
              </span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="مثال: حياة كريمة"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-teal-500"
              />
            </label>

            <label>
              <span className="mb-1 block text-[10px] font-bold text-slate-600">
                النوع
              </span>
              <select
                value={programType}
                onChange={(event) =>
                  setProgramType(
                    event.target.value as Program['program_type']
                  )
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none"
              >
                <option value="program">برنامج</option>
                <option value="initiative">مبادرة</option>
                <option value="project">مشروع</option>
                <option value="campaign">حملة</option>
              </select>
            </label>

            <label className="lg:col-span-2">
              <span className="mb-1 block text-[10px] font-bold text-slate-600">
                الوصف
              </span>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs outline-none focus:border-teal-500"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
              />
              المجموعة نشطة وتظهر في شاشة التكليف
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-slate-900">
                المنشآت التابعة للمجموعة
              </h3>
              <p className="mt-1 text-[10px] text-slate-400">
                محدد {selectedFacilityIds.length.toLocaleString('en-US')} من{' '}
                {facilities.length.toLocaleString('en-US')} منشأة متاحة
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectFiltered}
                className="h-8 rounded-lg border border-teal-200 px-2.5 text-[9px] font-bold text-teal-700"
              >
                تحديد نتائج الفلتر
              </button>
              <button
                type="button"
                onClick={() => setSelectedFacilityIds([])}
                className="h-8 rounded-lg border border-slate-200 px-2.5 text-[9px] font-bold text-slate-500"
              >
                مسح التحديد
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="بحث عن منشأة..."
                className="h-10 w-full rounded-xl border border-slate-200 pr-9 pl-3 text-xs outline-none"
              />
            </div>
            <CompactFilterSelect
              value={governorate}
              onChange={(value) => {
                setGovernorate(value)
                setHealthAdmin('')
              }}
              placeholder="كل المحافظات"
              options={governorates.map((item) => ({
                value: item,
                label: item,
              }))}
            />
            <CompactFilterSelect
              value={healthAdmin}
              onChange={setHealthAdmin}
              placeholder="كل الإدارات الصحية"
              options={healthAdmins.map((item) => ({
                value: item,
                label: item,
              }))}
            />
            <CompactFilterSelect
              value={facilityType}
              onChange={setFacilityType}
              placeholder="كل أنواع المنشآت"
              options={facilityTypes.map((item) => ({
                value: item,
                label: getFacilityTypeLabel(item),
              }))}
            />
          </div>

          <div className="mt-3 max-h-[520px] overflow-y-auto rounded-xl border border-slate-200">
            {filteredFacilities.map((facility) => {
              const selected = selectedFacilityIds.includes(facility.id)
              return (
                <button
                  key={facility.id}
                  type="button"
                  onClick={() => toggleFacility(facility.id)}
                  className={
                    'grid w-full grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-slate-100 px-3 py-3 text-right last:border-b-0 ' +
                    (selected ? 'bg-teal-50' : 'bg-white hover:bg-slate-50')
                  }
                >
                  <span
                    className={
                      'flex h-7 w-7 items-center justify-center rounded-lg ' +
                      (selected
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-400')
                    }
                  >
                    {selected ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Building2 className="h-4 w-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-extrabold text-slate-800">
                      {facility.name}
                    </p>
                    <p className="mt-1 truncate text-[9px] text-slate-400">
                      {facility.governorate || '—'} ·{' '}
                      {facility.health_admin || '—'} · {getFacilityTypeLabel(facility.facility_type)}
                    </p>
                  </div>
                </button>
              )
            })}

            {filteredFacilities.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-slate-400">
                لا توجد منشآت مطابقة.
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProgram()}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              حفظ المجموعة والمنشآت
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
