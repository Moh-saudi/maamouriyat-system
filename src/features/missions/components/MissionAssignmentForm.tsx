'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Hotel,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from 'lucide-react'

type FacilityOption = {
  id: string
  name: string
  facility_type: string
  organization_id: string
  organization_name: string
  governorate: string | null
  health_admin: string | null
  village_city: string | null
}

type InspectorOption = {
  id: string
  full_name: string
  job_title: string | null
  organization_id: string
  organization_name: string
  org_level: number
}

type TemplateOption = {
  id: string
  name: string
  version: string | null
  description: string | null
  is_base: boolean
  applicable_facility_types: string[] | null
}

type OptionsPayload = {
  success?: boolean
  caller?: {
    id: string
    name: string
    organization_id: string | null
    organization_name: string
  }
  facilities?: FacilityOption[]
  inspectors?: InspectorOption[]
  templates?: TemplateOption[]
  canApprove?: boolean
  error?: string
}

type CreateResponse = {
  success?: boolean
  batch_id?: string | null
  status?: 'approved' | 'pending_approval'
  missions?: Array<{
    batch_id: string
    mission_id: string
    serial_number: string
    facility_id: string
  }>
  message?: string
  error?: string
}

type Step = 1 | 2 | 3

const PURPOSE_SUGGESTIONS = [
  'مرور دوري لمتابعة انتظام العمل وجودة الخدمات المقدمة بالمنشأة.',
  'مرور نوعي للتحقق من الالتزام بالمعايير والإجراءات المعتمدة.',
  'متابعة تنفيذ التوصيات والملاحظات المرصودة في زيارات سابقة.',
] as const

function todayString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function priorityLabel(value: string) {
  if (value === 'urgent') return 'عاجلة'
  if (value === 'high') return 'مرتفعة'
  return 'عادية'
}

function StepPill({
  number,
  label,
  active,
  done,
}: {
  number: number
  label: string
  active: boolean
  done: boolean
}) {
  const circleClass = active
    ? 'bg-teal-700 text-white'
    : done
      ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      : 'bg-slate-100 text-slate-400'

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div
        className={
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black transition ' +
          circleClass
        }
      >
        {done ? <Check className="h-4 w-4" /> : number}
      </div>
      <span
        className={
          'hidden truncate text-xs font-bold sm:block ' +
          (active ? 'text-slate-900' : 'text-slate-400')
        }
      >
        {label}
      </span>
    </div>
  )
}

export function MissionAssignmentForm() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<CreateResponse | null>(null)

  const [caller, setCaller] = useState<OptionsPayload['caller']>()
  const [facilities, setFacilities] = useState<FacilityOption[]>([])
  const [inspectors, setInspectors] = useState<InspectorOption[]>([])
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [canApprove, setCanApprove] = useState(false)

  const [facilitySearch, setFacilitySearch] = useState('')
  const [inspectorSearch, setInspectorSearch] = useState('')
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([])
  const [primaryInspectorId, setPrimaryInspectorId] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [visitPurpose, setVisitPurpose] = useState('')
  const [scheduledDate, setScheduledDate] = useState(todayString())
  const [expectedEndDate, setExpectedEndDate] = useState(todayString())
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>('normal')
  const [requiresOvernight, setRequiresOvernight] = useState(false)
  const [requiresHotelBooking, setRequiresHotelBooking] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadOptions() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/v2/missions/assignment', {
          cache: 'no-store',
          credentials: 'same-origin',
        })
        const payload = (await response.json()) as OptionsPayload

        if (!response.ok) {
          throw new Error(payload.error || 'تعذر تحميل بيانات التكليف')
        }

        if (cancelled) return

        const nextTemplates = payload.templates ?? []
        setCaller(payload.caller)
        setFacilities(payload.facilities ?? [])
        setInspectors(payload.inspectors ?? [])
        setTemplates(nextTemplates)
        setCanApprove(payload.canApprove === true)

        const baseTemplate =
          nextTemplates.find((template) => template.is_base) ??
          nextTemplates[0]
        if (baseTemplate) setTemplateId(baseTemplate.id)
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'تعذر تحميل بيانات التكليف'
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void loadOptions()

    return () => {
      cancelled = true
    }
  }, [])

  const selectedFacilities = useMemo(
    () =>
      selectedFacilityIds
        .map((id) => facilities.find((facility) => facility.id === id))
        .filter((facility): facility is FacilityOption => Boolean(facility)),
    [facilities, selectedFacilityIds]
  )

  const selectedInspectors = useMemo(
    () =>
      selectedInspectorIds
        .map((id) => inspectors.find((inspector) => inspector.id === id))
        .filter((inspector): inspector is InspectorOption => Boolean(inspector)),
    [inspectors, selectedInspectorIds]
  )

  const selectedTemplate = templates.find(
    (template) => template.id === templateId
  )

  const filteredFacilities = useMemo(() => {
    const q = facilitySearch.trim().toLocaleLowerCase('ar')
    if (!q) return facilities.slice(0, 40)

    return facilities
      .filter((facility) =>
        [
          facility.name,
          facility.facility_type,
          facility.organization_name,
          facility.governorate ?? '',
          facility.health_admin ?? '',
          facility.village_city ?? '',
        ].some((value) => value.toLocaleLowerCase('ar').includes(q))
      )
      .slice(0, 60)
  }, [facilities, facilitySearch])

  const filteredInspectors = useMemo(() => {
    const q = inspectorSearch.trim().toLocaleLowerCase('ar')

    return inspectors
      .filter((inspector) => !selectedInspectorIds.includes(inspector.id))
      .filter((inspector) => {
        if (!q) return true
        return [
          inspector.full_name,
          inspector.job_title ?? '',
          inspector.organization_name,
        ].some((value) => value.toLocaleLowerCase('ar').includes(q))
      })
      .slice(0, 40)
  }, [inspectors, inspectorSearch, selectedInspectorIds])

  function toggleFacility(facilityId: string) {
    setSelectedFacilityIds((current) =>
      current.includes(facilityId)
        ? current.filter((id) => id !== facilityId)
        : [...current, facilityId]
    )
  }

  function addInspector(inspectorId: string) {
    setSelectedInspectorIds((current) => {
      if (current.includes(inspectorId)) return current
      const next = [...current, inspectorId]
      if (!primaryInspectorId) setPrimaryInspectorId(inspectorId)
      return next
    })
    setInspectorSearch('')
  }

  function removeInspector(inspectorId: string) {
    setSelectedInspectorIds((current) => {
      const next = current.filter((id) => id !== inspectorId)
      if (primaryInspectorId === inspectorId) {
        setPrimaryInspectorId(next[0] ?? '')
      }
      return next
    })
  }

  function validate(currentStep: Step): string | null {
    if (currentStep === 1) {
      if (!templateId) return 'اختر نموذج المرور.'
      if (selectedFacilityIds.length === 0) {
        return 'اختر منشأة صحية واحدة على الأقل.'
      }
      if (!visitPurpose.trim()) return 'اكتب غرض المأمورية.'
    }

    if (currentStep === 2) {
      if (selectedInspectorIds.length === 0) {
        return 'أضف عضوًا واحدًا على الأقل لفريق المأمورية.'
      }
      if (!primaryInspectorId) return 'حدد رئيس فريق المأمورية.'
      if (!scheduledDate || !expectedEndDate) {
        return 'حدد تاريخ بداية ونهاية المأمورية.'
      }
      if (expectedEndDate < scheduledDate) {
        return 'تاريخ الانتهاء لا يمكن أن يسبق تاريخ البداية.'
      }
      if (scheduledDate < todayString()) {
        return 'لا يمكن إصدار تكليف جديد بتاريخ سابق من V2.'
      }
    }

    return null
  }

  function nextStep() {
    const validation = validate(step)
    if (validation) {
      setError(validation)
      return
    }

    setError(null)
    if (step < 3) setStep((step + 1) as Step)
  }

  function previousStep() {
    setError(null)
    if (step > 1) setStep((step - 1) as Step)
  }

  async function submit() {
    const validation = validate(1) || validate(2)
    if (validation) {
      setError(validation)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/v2/missions/assignment', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          facility_ids: selectedFacilityIds,
          team_user_ids: selectedInspectorIds,
          primary_user_id: primaryInspectorId,
          template_id: templateId,
          scheduled_date: scheduledDate,
          expected_end_date: expectedEndDate,
          priority,
          visit_purpose: visitPurpose.trim(),
          notes: notes.trim(),
          requires_overnight: requiresOvernight,
          requires_hotel_booking:
            requiresOvernight && requiresHotelBooking,
        }),
      })

      const payload = (await response.json()) as CreateResponse

      if (!response.ok) {
        throw new Error(payload.error || 'تعذر إصدار التكليف')
      }

      setSuccess(payload)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'تعذر إصدار التكليف'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تجهيز بيانات التكليف المتاحة داخل نطاقك...
      </div>
    )
  }

  if (success) {
    const missions = success.missions ?? []

    return (
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
        <div className="border-b border-emerald-100 bg-emerald-50/70 px-5 py-5 sm:px-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                {success.status === 'approved'
                  ? 'تم إصدار التكليف واعتماده'
                  : 'تم إنشاء التكليف وإرساله للاعتماد'}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                تم إنشاء {missions.length.toLocaleString('en-US')} مأمورية
                مستقلة ضمن دفعة تكليف واحدة.
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {missions.map((mission) => {
              const facility = facilities.find(
                (item) => item.id === mission.facility_id
              )
              return (
                <div
                  key={mission.mission_id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-3"
                >
                  <p className="font-mono text-[10px] font-bold text-teal-700">
                    {mission.serial_number}
                  </p>
                  <p className="mt-1 text-xs font-extrabold text-slate-800">
                    {facility?.name ?? 'منشأة صحية'}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setSuccess(null)
                setStep(1)
                setSelectedFacilityIds([])
                setSelectedInspectorIds([])
                setPrimaryInspectorId('')
                setVisitPurpose('')
                setNotes('')
              }}
              className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              تكليف جديد
            </button>
            <button
              type="button"
              onClick={() => {
                router.push('/v2/missions')
                router.refresh()
              }}
              className="h-10 rounded-xl bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800"
            >
              عرض المأموريات
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <StepPill
            number={1}
            label="النطاق والمنشآت"
            active={step === 1}
            done={step > 1}
          />
          <div className="h-px flex-1 bg-slate-200" />
          <StepPill
            number={2}
            label="الفريق والموعد"
            active={step === 2}
            done={step > 2}
          />
          <div className="h-px flex-1 bg-slate-200" />
          <StepPill
            number={3}
            label="المراجعة والإصدار"
            active={step === 3}
            done={false}
          />
        </div>
      </section>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs leading-5 text-rose-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {step === 1 && (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <p className="text-[10px] font-bold text-teal-700">
                المرحلة الأولى
              </p>
              <h2 className="mt-1 text-base font-black text-slate-900">
                نطاق المأمورية والمنشآت المستهدفة
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                اختر نموذج المرور ثم المنشآت. اختيار أكثر من منشأة سيصدر مأمورية
                مستقلة لكل منشأة بنفس الفريق والموعد.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    نوع المرور / نموذج التقييم
                  </span>
                  <select
                    value={templateId}
                    onChange={(event) => setTemplateId(event.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  >
                    <option value="">اختر نموذج المرور</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                        {template.is_base ? ' — أساسي' : ''}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedTemplate?.description && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-[11px] leading-5 text-slate-500">
                    {selectedTemplate.description}
                  </div>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    غرض المأمورية
                  </span>
                  <textarea
                    value={visitPurpose}
                    onChange={(event) => setVisitPurpose(event.target.value)}
                    rows={4}
                    placeholder="اكتب الغرض الإداري والفني من الزيارة..."
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>

                <div className="flex flex-wrap gap-1.5">
                  {PURPOSE_SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setVisitPurpose(suggestion)}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-slate-500 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                    >
                      {suggestion.split(' ').slice(0, 4).join(' ')}...
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <label className="block min-w-0 flex-1">
                    <span className="mb-1.5 block text-xs font-bold text-slate-700">
                      البحث عن منشأة
                    </span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={facilitySearch}
                        onChange={(event) =>
                          setFacilitySearch(event.target.value)
                        }
                        placeholder="الاسم، الإدارة الصحية، المحافظة أو النوع..."
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                      />
                    </div>
                  </label>

                  <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-black text-teal-800">
                    {selectedFacilityIds.length.toLocaleString('en-US')} محددة
                  </span>
                </div>

                {selectedFacilities.length > 0 && (
                  <div className="mb-3 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-teal-100 bg-teal-50/50 p-2">
                    {selectedFacilities.map((facility) => (
                      <button
                        key={facility.id}
                        type="button"
                        onClick={() => toggleFacility(facility.id)}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1.5 text-[10px] font-bold text-teal-800 ring-1 ring-teal-100"
                      >
                        {facility.name}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-h-[420px] overflow-y-auto rounded-xl border border-slate-200">
                  {filteredFacilities.map((facility) => {
                    const selected = selectedFacilityIds.includes(facility.id)
                    const rowClass = selected
                      ? 'bg-teal-50'
                      : 'bg-white hover:bg-slate-50'
                    const iconClass = selected
                      ? 'bg-teal-700 text-white'
                      : 'bg-slate-100 text-slate-400'

                    return (
                      <button
                        key={facility.id}
                        type="button"
                        onClick={() => toggleFacility(facility.id)}
                        className={
                          'flex w-full items-start gap-3 border-b border-slate-100 px-3 py-3 text-right transition last:border-b-0 ' +
                          rowClass
                        }
                      >
                        <div
                          className={
                            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ' +
                            iconClass
                          }
                        >
                          {selected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Building2 className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-extrabold text-slate-800">
                            {facility.name}
                          </p>
                          <p className="mt-1 truncate text-[10px] text-slate-400">
                            {facility.health_admin ||
                              facility.organization_name}
                            {facility.governorate
                              ? ' · ' + facility.governorate
                              : ''}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">
                          {facility.facility_type}
                        </span>
                      </button>
                    )
                  })}

                  {filteredFacilities.length === 0 && (
                    <div className="px-4 py-10 text-center text-xs text-slate-400">
                      لا توجد منشآت مطابقة داخل نطاقك.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <p className="text-[10px] font-bold text-teal-700">
                المرحلة الثانية
              </p>
              <h2 className="mt-1 text-base font-black text-slate-900">
                فريق المأمورية والموعد
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                لا تظهر هنا إلا الحسابات النشطة المخولة بتنفيذ مأموريات
                ميدانية والواقعة داخل نطاق تكليفك.
              </p>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    إضافة عضو للفريق
                  </span>
                  <div className="relative">
                    <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={inspectorSearch}
                      onChange={(event) =>
                        setInspectorSearch(event.target.value)
                      }
                      placeholder="ابحث باسم المفتش أو الجهة..."
                      className="h-11 w-full rounded-xl border border-slate-200 pr-9 pl-3 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>
                </label>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredInspectors.map((inspector) => (
                    <button
                      key={inspector.id}
                      type="button"
                      onClick={() => addInspector(inspector.id)}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-right last:border-b-0 hover:bg-slate-50"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-extrabold text-slate-800">
                          {inspector.full_name}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {inspector.job_title || 'مفتش ميداني'} ·{' '}
                          {inspector.organization_name}
                        </p>
                      </div>
                    </button>
                  ))}

                  {filteredInspectors.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-slate-400">
                      لا يوجد مستخدمون آخرون مطابقون.
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {selectedInspectors.map((inspector) => {
                    const primary = primaryInspectorId === inspector.id
                    return (
                      <div
                        key={inspector.id}
                        className={
                          'flex items-center justify-between gap-3 rounded-xl border px-3 py-3 ' +
                          (primary
                            ? 'border-teal-200 bg-teal-50/70'
                            : 'border-slate-200 bg-white')
                        }
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold text-slate-800">
                            {inspector.full_name}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {primary ? 'رئيس الفريق' : 'عضو فريق'} ·{' '}
                            {inspector.organization_name}
                          </p>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          {!primary && (
                            <button
                              type="button"
                              onClick={() =>
                                setPrimaryInspectorId(inspector.id)
                              }
                              className="h-7 rounded-lg border border-teal-200 bg-white px-2 text-[9px] font-bold text-teal-700"
                            >
                              تعيين رئيسًا
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeInspector(inspector.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                            aria-label="إزالة من الفريق"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-700">
                      تاريخ البداية
                    </span>
                    <input
                      type="date"
                      min={todayString()}
                      value={scheduledDate}
                      onChange={(event) => {
                        const next = event.target.value
                        setScheduledDate(next)
                        if (expectedEndDate < next) setExpectedEndDate(next)
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-teal-500"
                    />
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-700">
                      تاريخ الانتهاء
                    </span>
                    <input
                      type="date"
                      min={scheduledDate}
                      value={expectedEndDate}
                      onChange={(event) =>
                        setExpectedEndDate(event.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 px-3 text-xs outline-none focus:border-teal-500"
                    />
                  </label>
                </div>

                <div>
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    أولوية التكليف
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ['normal', 'عادية'],
                        ['high', 'مرتفعة'],
                        ['urgent', 'عاجلة'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPriority(value)}
                        className={
                          'h-10 rounded-xl border text-xs font-bold ' +
                          (priority === value
                            ? 'border-teal-600 bg-teal-50 text-teal-800'
                            : 'border-slate-200 bg-white text-slate-500')
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = !requiresOvernight
                      setRequiresOvernight(next)
                      if (!next) setRequiresHotelBooking(false)
                    }}
                    className={
                      'flex min-h-16 items-center gap-3 rounded-xl border px-3 text-right ' +
                      (requiresOvernight
                        ? 'border-teal-200 bg-teal-50'
                        : 'border-slate-200 bg-white')
                    }
                  >
                    <CalendarDays className="h-5 w-5 shrink-0 text-teal-700" />
                    <div>
                      <p className="text-xs font-extrabold text-slate-800">
                        تتطلب مبيت
                      </p>
                      <p className="mt-1 text-[9px] text-slate-400">
                        فعّلها إذا كانت المأمورية تمتد لإقامة ليلية.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={!requiresOvernight}
                    onClick={() =>
                      setRequiresHotelBooking((current) => !current)
                    }
                    className={
                      'flex min-h-16 items-center gap-3 rounded-xl border px-3 text-right disabled:opacity-40 ' +
                      (requiresHotelBooking
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-slate-200 bg-white')
                    }
                  >
                    <Hotel className="h-5 w-5 shrink-0 text-amber-700" />
                    <div>
                      <p className="text-xs font-extrabold text-slate-800">
                        يلزم حجز فندقي
                      </p>
                      <p className="mt-1 text-[9px] text-slate-400">
                        يستخدم عند الحاجة لتنسيق إقامة رسمي.
                      </p>
                    </div>
                  </button>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    تعليمات إضافية
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={5}
                    placeholder="أي تعليمات خاصة بالفريق أو التوثيق أو الزيارة..."
                    className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs leading-6 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5 p-4 sm:p-6">
            <div>
              <p className="text-[10px] font-bold text-teal-700">
                المرحلة الثالثة
              </p>
              <h2 className="mt-1 text-base font-black text-slate-900">
                مراجعة التكليف قبل الإصدار
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                راجع الفريق والمنشآت والموعد. لا يتم الحفظ إلا بعد الضغط على
                زر الإصدار.
              </p>
            </div>

            <div
              className={
                'flex items-start gap-3 rounded-2xl border p-4 ' +
                (canApprove
                  ? 'border-emerald-200 bg-emerald-50/60'
                  : 'border-amber-200 bg-amber-50/60')
              }
            >
              <ShieldCheck
                className={
                  'mt-0.5 h-5 w-5 shrink-0 ' +
                  (canApprove ? 'text-emerald-700' : 'text-amber-700')
                }
              />
              <div>
                <p className="text-xs font-extrabold text-slate-900">
                  {canApprove
                    ? 'سيصدر التكليف معتمدًا'
                    : 'سيصدر التكليف بانتظار الاعتماد'}
                </p>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">
                  {canApprove
                    ? 'حسابك يملك صلاحية اعتماد المأموريات داخل هذا النطاق.'
                    : 'حسابك يستطيع الإنشاء والتكليف، لكن الاعتماد النهائي يحتاج جهة مخولة.'}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <FileText className="h-4 w-4 text-teal-700" />
                <p className="mt-2 text-[9px] font-bold text-slate-400">
                  نموذج المرور
                </p>
                <p className="mt-1 text-xs font-extrabold text-slate-800">
                  {selectedTemplate?.name || 'غير محدد'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Building2 className="h-4 w-4 text-teal-700" />
                <p className="mt-2 text-[9px] font-bold text-slate-400">
                  عدد المأموريات
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {selectedFacilities.length.toLocaleString('en-US')}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Users className="h-4 w-4 text-teal-700" />
                <p className="mt-2 text-[9px] font-bold text-slate-400">
                  أعضاء الفريق
                </p>
                <p className="mt-1 text-lg font-black text-slate-900">
                  {selectedInspectors.length.toLocaleString('en-US')}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <CalendarDays className="h-4 w-4 text-teal-700" />
                <p className="mt-2 text-[9px] font-bold text-slate-400">
                  الموعد
                </p>
                <p className="mt-1 text-xs font-extrabold text-slate-800">
                  {scheduledDate}
                  {expectedEndDate !== scheduledDate
                    ? ' ← ' + expectedEndDate
                    : ''}
                </p>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-extrabold text-slate-900">
                  المنشآت المستهدفة
                </h3>
                <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                  {selectedFacilities.map((facility, index) => (
                    <div
                      key={facility.id}
                      className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black text-teal-700 shadow-sm">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-extrabold text-slate-800">
                          {facility.name}
                        </p>
                        <p className="mt-0.5 truncate text-[9px] text-slate-400">
                          {facility.health_admin ||
                            facility.organization_name}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="text-xs font-extrabold text-slate-900">
                  فريق المأمورية
                </h3>
                <div className="mt-3 space-y-2">
                  {selectedInspectors.map((inspector) => (
                    <div
                      key={inspector.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-extrabold text-slate-800">
                          {inspector.full_name}
                        </p>
                        <p className="mt-0.5 truncate text-[9px] text-slate-400">
                          {inspector.organization_name}
                        </p>
                      </div>
                      {inspector.id === primaryInspectorId && (
                        <span className="shrink-0 rounded-full bg-teal-100 px-2 py-1 text-[9px] font-black text-teal-800">
                          رئيس الفريق
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-[9px] font-bold text-slate-400">
                غرض المأمورية
              </p>
              <p className="mt-1 text-xs leading-6 text-slate-700">
                {visitPurpose}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold">
                <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                  أولوية {priorityLabel(priority)}
                </span>
                {requiresOvernight && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                    تتطلب مبيت
                  </span>
                )}
                {requiresHotelBooking && (
                  <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-200">
                    حجز فندقي
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6">
          <div className="text-[10px] text-slate-400">
            {caller?.organization_name
              ? 'جهة إصدار التكليف: ' + caller.organization_name
              : 'يتم التحقق من جهة الإصدار على السيرفر'}
          </div>

          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                disabled={submitting}
                onClick={previousStep}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
                السابق
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800"
              >
                التالي
                <ChevronLeft className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-5 text-xs font-black text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                {submitting
                  ? 'جارٍ إصدار التكليف...'
                  : canApprove
                    ? 'إصدار واعتماد ' +
                      selectedFacilityIds.length.toLocaleString('en-US') +
                      ' مأمورية'
                    : 'إرسال ' +
                      selectedFacilityIds.length.toLocaleString('en-US') +
                      ' مأمورية للاعتماد'}
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
