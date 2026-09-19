'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CompactFilterSelect } from '@/components/ui/CompactFilterSelect'
import { getFacilityTypeLabel } from '@/config/facility-types'
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Filter,
  FolderKanban,
  Hotel,
  Loader2,
  MapPinned,
  Search,
  ShieldCheck,
  Target,
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
  assignment_count: number
  visit_count: number
  distinct_primary_inspectors: number
  last_visited_at: string | null
  last_scheduled_date: string | null
}

type InspectorOption = {
  id: string
  full_name: string
  job_title: string | null
  organization_id: string
  organization_name: string
  org_level: number
  can_execute: boolean
}

type TemplateOption = {
  id: string
  name: string
  version: string | null
  description: string | null
  is_base: boolean
  visibility: 'system' | 'organization' | 'private'
  created_by_me: boolean
  in_my_library: boolean
  applicable_facility_types: string[] | null
}

type TargetOption = {
  id: string
  title: string
  period_label: string
  start_date: string
  end_date: string
  target_missions: number
  assigned_user_id: string | null
  assigned_user_name: string | null
  scope_level: 'ministry' | 'sector' | 'governorate' | 'health_admin' | 'user'
  scope_name: string
  target_type: 'aggregate' | 'specific_facilities'
  facility_ids: string[]
  facility_count: number
  visited_count: number
}

type ProgramOption = {
  id: string
  code: string
  name: string
  description: string | null
  program_type: string
  facility_ids: string[]
  facility_count: number
  visited_count: number
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
  targets?: TargetOption[]
  programs?: ProgramOption[]
  canApprove?: boolean
  canUseTemplateLibrary?: boolean
  canManagePrograms?: boolean
  preparationMode?: 'secretariat' | 'issuer'
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
type SourceMode = 'manual' | 'target' | 'program'
type VisitFilter =
  | 'all'
  | 'visited'
  | 'unvisited'
  | 'stale_90'
  | 'stale_180'
type FacilitySort = 'least_visited' | 'most_visited' | 'name' | 'recent'
type TemplateTab = 'mine' | 'available'

const MAX_BATCH_FACILITIES = 50
const FACILITY_PAGE_SIZE = 100

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

function sourceLabel(value: SourceMode) {
  if (value === 'target') return 'مستهدف محدد'
  if (value === 'program') return 'مشروع / مبادرة'
  return 'اختيار حر'
}

function formatVisitDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
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
  const [targets, setTargets] = useState<TargetOption[]>([])
  const [programs, setPrograms] = useState<ProgramOption[]>([])
  const [canApprove, setCanApprove] = useState(false)
  const [canUseTemplateLibrary, setCanUseTemplateLibrary] = useState(false)
  const [canManagePrograms, setCanManagePrograms] = useState(false)
  const [preparationMode, setPreparationMode] = useState<
    'secretariat' | 'issuer'
  >('issuer')

  const [sourceMode, setSourceMode] = useState<SourceMode>('manual')
  const [sourceTargetId, setSourceTargetId] = useState('')
  const [sourceProgramId, setSourceProgramId] = useState('')
  const [facilitySearch, setFacilitySearch] = useState('')
  const [governorateFilter, setGovernorateFilter] = useState('')
  const [healthAdminFilter, setHealthAdminFilter] = useState('')
  const [facilityTypeFilter, setFacilityTypeFilter] = useState('')
  const [visitFilter, setVisitFilter] = useState<VisitFilter>('all')
  const [facilitySort, setFacilitySort] =
    useState<FacilitySort>('least_visited')
  const [visibleFacilityCount, setVisibleFacilityCount] =
    useState(FACILITY_PAGE_SIZE)
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([])

  const [inspectorSearch, setInspectorSearch] = useState('')
  const [selectedInspectorIds, setSelectedInspectorIds] = useState<string[]>([])
  const [primaryInspectorId, setPrimaryInspectorId] = useState('')
  const [scheduledDate, setScheduledDate] = useState(todayString())
  const [expectedEndDate, setExpectedEndDate] = useState(todayString())
  const [priority, setPriority] = useState<'normal' | 'high' | 'urgent'>(
    'normal'
  )
  const [requiresOvernight, setRequiresOvernight] = useState(false)
  const [requiresHotelBooking, setRequiresHotelBooking] = useState(false)

  const [templateTab, setTemplateTab] = useState<TemplateTab>('available')
  const [templateId, setTemplateId] = useState('')
  const [visitPurpose, setVisitPurpose] = useState('')
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
        setTargets(payload.targets ?? [])
        setPrograms(payload.programs ?? [])
        setCanApprove(payload.canApprove === true)
        setCanUseTemplateLibrary(payload.canUseTemplateLibrary === true)
        setCanManagePrograms(payload.canManagePrograms === true)
        setPreparationMode(payload.preparationMode ?? 'issuer')

        if (nextTemplates.some((template) => template.in_my_library)) {
          setTemplateTab('mine')
        }
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

  const facilityById = useMemo(
    () => new Map(facilities.map((facility) => [facility.id, facility])),
    [facilities]
  )

  const selectedTarget = targets.find((target) => target.id === sourceTargetId)
  const selectedProgram = programs.find(
    (program) => program.id === sourceProgramId
  )

  const sourceFacilityIds = useMemo(() => {
    if (sourceMode === 'target') {
      return new Set(selectedTarget?.facility_ids ?? [])
    }
    if (sourceMode === 'program') {
      return new Set(selectedProgram?.facility_ids ?? [])
    }
    return new Set(facilities.map((facility) => facility.id))
  }, [facilities, selectedProgram, selectedTarget, sourceMode])

  const sourceFacilities = useMemo(
    () => facilities.filter((facility) => sourceFacilityIds.has(facility.id)),
    [facilities, sourceFacilityIds]
  )

  const governorates = useMemo(
    () =>
      [...new Set(sourceFacilities.map((facility) => facility.governorate).filter(Boolean))]
        .map(String)
        .sort((a, b) => a.localeCompare(b, 'ar')),
    [sourceFacilities]
  )

  const healthAdmins = useMemo(() => {
    let base = sourceFacilities
    if (governorateFilter) {
      base = base.filter(
        (facility) => facility.governorate === governorateFilter
      )
    }

    return [
      ...new Set(base.map((facility) => facility.health_admin).filter(Boolean)),
    ]
      .map(String)
      .sort((a, b) => a.localeCompare(b, 'ar'))
  }, [sourceFacilities, governorateFilter])

  const facilityTypes = useMemo(
    () =>
      [
        ...new Set(
          sourceFacilities
            .map((facility) => facility.facility_type)
            .filter(Boolean)
        ),
      ].sort((a, b) =>
        getFacilityTypeLabel(a).localeCompare(getFacilityTypeLabel(b), 'ar')
      ),
    [sourceFacilities]
  )

  const filteredFacilities = useMemo(() => {
    const q = facilitySearch.trim().toLocaleLowerCase('ar')
    let rows = sourceFacilities.filter((facility) => {
      if (
        governorateFilter &&
        facility.governorate !== governorateFilter
      ) {
        return false
      }

      if (
        healthAdminFilter &&
        facility.health_admin !== healthAdminFilter
      ) {
        return false
      }

      if (
        facilityTypeFilter &&
        facility.facility_type !== facilityTypeFilter
      ) {
        return false
      }

      if (visitFilter === 'visited' && facility.visit_count <= 0) {
        return false
      }

      if (visitFilter === 'unvisited' && facility.visit_count > 0) {
        return false
      }

      if (visitFilter === 'stale_90') {
        if (!facility.last_visited_at) return true
        const age =
          Date.now() - new Date(facility.last_visited_at).getTime()
        if (age < 90 * 24 * 60 * 60 * 1000) return false
      }

      if (visitFilter === 'stale_180') {
        if (!facility.last_visited_at) return true
        const age =
          Date.now() - new Date(facility.last_visited_at).getTime()
        if (age < 180 * 24 * 60 * 60 * 1000) return false
      }

      if (!q) return true

      return [
        facility.name,
        facility.facility_type,
        facility.organization_name,
        facility.governorate ?? '',
        facility.health_admin ?? '',
        facility.village_city ?? '',
      ].some((value) => value.toLocaleLowerCase('ar').includes(q))
    })

    rows = [...rows].sort((a, b) => {
      if (facilitySort === 'name') {
        return a.name.localeCompare(b.name, 'ar')
      }

      if (facilitySort === 'most_visited') {
        return b.visit_count - a.visit_count || a.name.localeCompare(b.name, 'ar')
      }

      if (facilitySort === 'recent') {
        const aTime = a.last_visited_at
          ? new Date(a.last_visited_at).getTime()
          : 0
        const bTime = b.last_visited_at
          ? new Date(b.last_visited_at).getTime()
          : 0
        return bTime - aTime || a.name.localeCompare(b.name, 'ar')
      }

      return a.visit_count - b.visit_count || a.name.localeCompare(b.name, 'ar')
    })

    return rows
  }, [
    facilitySearch,
    facilitySort,
    facilityTypeFilter,
    governorateFilter,
    healthAdminFilter,
    sourceFacilities,
    visitFilter,
  ])

  useEffect(() => {
    setVisibleFacilityCount(FACILITY_PAGE_SIZE)
  }, [
    sourceMode,
    sourceTargetId,
    sourceProgramId,
    facilitySearch,
    governorateFilter,
    healthAdminFilter,
    facilityTypeFilter,
    visitFilter,
    facilitySort,
  ])

  useEffect(() => {
    if (
      healthAdminFilter &&
      !healthAdmins.includes(healthAdminFilter)
    ) {
      setHealthAdminFilter('')
    }
  }, [healthAdminFilter, healthAdmins])

  const visibleFacilities = filteredFacilities.slice(0, visibleFacilityCount)

  const selectedFacilities = useMemo(
    () =>
      selectedFacilityIds
        .map((id) => facilityById.get(id))
        .filter((facility): facility is FacilityOption => Boolean(facility)),
    [facilityById, selectedFacilityIds]
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

  const selectedFacilityTypes = useMemo(
    () =>
      new Set(
        selectedFacilities.map((facility) => facility.facility_type)
      ),
    [selectedFacilities]
  )

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
      .slice(0, 100)
  }, [inspectors, inspectorSearch, selectedInspectorIds])

  const myTemplates = useMemo(
    () =>
      templates.filter(
        (template) => template.in_my_library || template.created_by_me
      ),
    [templates]
  )

  const templateList =
    templateTab === 'mine' ? myTemplates : templates

  function resetFacilityFilters() {
    setFacilitySearch('')
    setGovernorateFilter('')
    setHealthAdminFilter('')
    setFacilityTypeFilter('')
    setVisitFilter('all')
    setFacilitySort('least_visited')
  }

  function changeSourceMode(mode: SourceMode) {
    setSourceMode(mode)
    setSourceTargetId('')
    setSourceProgramId('')
    setSelectedFacilityIds([])
    resetFacilityFilters()
    setError(null)
  }

  function chooseTarget(target: TargetOption) {
    setSourceMode('target')
    setSourceTargetId(target.id)
    setSourceProgramId('')
    setSelectedFacilityIds([])
    resetFacilityFilters()

    if (
      target.assigned_user_id &&
      inspectors.some(
        (inspector) =>
          inspector.id === target.assigned_user_id && inspector.can_execute
      )
    ) {
      setSelectedInspectorIds((current) => {
        if (current.includes(target.assigned_user_id as string)) return current
        return [...current, target.assigned_user_id as string]
      })
      setPrimaryInspectorId((current) =>
        current || (target.assigned_user_id as string)
      )
    }
  }

  function chooseProgram(program: ProgramOption) {
    if (program.facility_count === 0) return
    setSourceMode('program')
    setSourceProgramId(program.id)
    setSourceTargetId('')
    setSelectedFacilityIds([])
    resetFacilityFilters()
  }

  function toggleFacility(facilityId: string) {
    setSelectedFacilityIds((current) => {
      if (current.includes(facilityId)) {
        return current.filter((id) => id !== facilityId)
      }

      if (current.length >= MAX_BATCH_FACILITIES) {
        setError(
          'الحد الأقصى لدفعة التكليف الواحدة هو ' +
            MAX_BATCH_FACILITIES.toLocaleString('en-US') +
            ' منشأة.'
        )
        return current
      }

      setError(null)
      return [...current, facilityId]
    })
  }

  function selectFilteredFacilities(unvisitedOnly = false) {
    setSelectedFacilityIds((current) => {
      const next = new Set(current)
      for (const facility of filteredFacilities) {
        if (unvisitedOnly && facility.visit_count > 0) continue
        if (next.size >= MAX_BATCH_FACILITIES) break
        next.add(facility.id)
      }
      return [...next]
    })
  }

  function addInspector(inspectorId: string) {
    const candidate = inspectors.find(
      (inspector) => inspector.id === inspectorId
    )
    if (!candidate?.can_execute) {
      setError(
        candidate
          ? 'هذا الحساب ظاهر داخل نطاقك لكنه لا يملك دورًا يسمح بتنفيذ مأمورية ميدانية.'
          : 'تعذر التحقق من أهلية المستخدم.'
      )
      return
    }

    setError(null)
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

  async function toggleTemplateLibrary(template: TemplateOption) {
    if (!canUseTemplateLibrary || template.created_by_me) return

    try {
      const method = template.in_my_library ? 'DELETE' : 'POST'
      const url = template.in_my_library
        ? '/api/v2/checklists/library?template_id=' +
          encodeURIComponent(template.id)
        : '/api/v2/checklists/library'

      const response = await fetch(url, {
        method,
        credentials: 'same-origin',
        headers:
          method === 'POST'
            ? { 'Content-Type': 'application/json' }
            : undefined,
        body:
          method === 'POST'
            ? JSON.stringify({ template_id: template.id })
            : undefined,
      })

      const payload = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(payload.error || 'تعذر تحديث استماراتي')
      }

      setTemplates((current) =>
        current.map((item) =>
          item.id === template.id
            ? { ...item, in_my_library: !item.in_my_library }
            : item
        )
      )
    } catch (libraryError) {
      setError(
        libraryError instanceof Error
          ? libraryError.message
          : 'تعذر تحديث استماراتي'
      )
    }
  }

  function validate(currentStep: Step): string | null {
    if (currentStep === 1) {
      if (sourceMode === 'target' && !sourceTargetId) {
        return 'اختر المستهدف الذي ستصدر منه المأمورية.'
      }

      if (sourceMode === 'program' && !sourceProgramId) {
        return 'اختر المشروع أو المبادرة أولًا.'
      }

      if (selectedFacilityIds.length === 0) {
        return 'اختر منشأة صحية واحدة على الأقل.'
      }
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

      if (
        selectedTarget?.assigned_user_id &&
        !selectedInspectorIds.includes(selectedTarget.assigned_user_id)
      ) {
        return 'المستهدف المحدد مرتبط بمستخدم يجب أن يكون ضمن فريق المأمورية.'
      }
    }

    if (currentStep === 3) {
      if (!templateId) return 'اختر استمارة المرور قبل الإصدار.'
      if (!visitPurpose.trim()) return 'اكتب غرض المأمورية.'
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function previousStep() {
    setError(null)
    if (step > 1) setStep((step - 1) as Step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function submit() {
    const validation = validate(1) || validate(2) || validate(3)
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
          selection_source: sourceMode,
          source_target_id:
            sourceMode === 'target' ? sourceTargetId : null,
          source_program_id:
            sourceMode === 'program' ? sourceProgramId : null,
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

  function renderActions(compact = false) {
    return (
      <div className="flex items-center gap-2">
        {step > 1 && (
          <button
            type="button"
            disabled={submitting}
            onClick={previousStep}
            className={
              'inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 ' +
              (compact ? 'h-9 px-3 text-[11px]' : 'h-10 px-4 text-xs')
            }
          >
            <ChevronRight className="h-4 w-4" />
            السابق
          </button>
        )}

        {step < 3 ? (
          <button
            type="button"
            onClick={nextStep}
            className={
              'inline-flex items-center gap-1.5 rounded-xl bg-teal-700 font-bold text-white hover:bg-teal-800 ' +
              (compact ? 'h-9 px-3 text-[11px]' : 'h-10 px-4 text-xs')
            }
          >
            التالي
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className={
              'inline-flex items-center gap-2 rounded-xl bg-teal-700 font-black text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50 ' +
              (compact ? 'h-9 px-3 text-[11px]' : 'h-10 px-5 text-xs')
            }
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
            {submitting
              ? 'جارٍ الإصدار...'
              : canApprove
                ? 'إصدار واعتماد'
                : 'إرسال للاعتماد'}
          </button>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        جارٍ تجهيز المنشآت والمستهدفات وفريق المرور...
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
              const facility = facilityById.get(mission.facility_id)
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
                changeSourceMode('manual')
                setSelectedInspectorIds([])
                setPrimaryInspectorId('')
                setTemplateId('')
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
      <section className="sticky top-[68px] z-30 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <StepPill
              number={1}
              label="النطاق والمنشآت"
              active={step === 1}
              done={step > 1}
            />
            <div className="h-px min-w-5 flex-1 bg-slate-200" />
            <StepPill
              number={2}
              label="الفريق والموعد"
              active={step === 2}
              done={step > 2}
            />
            <div className="h-px min-w-5 flex-1 bg-slate-200" />
            <StepPill
              number={3}
              label="الاستمارة والإصدار"
              active={step === 3}
              done={false}
            />
          </div>
          {renderActions(true)}
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
          <div className="space-y-5 p-4 sm:p-6">
            <div>
              <p className="text-[10px] font-bold text-teal-700">
                المرحلة الأولى
              </p>
              <h2 className="mt-1 text-base font-black text-slate-900">
                من أين تختار منشآت المرور؟
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                ابدأ بمستهدف محدد، مشروع/مبادرة، أو اختيار حر من كل المنشآت
                المتاحة داخل نطاقك.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {[
                {
                  id: 'target' as SourceMode,
                  title: 'مستهدف محدد',
                  note: 'منشآت مرتبطة بمستهدف دوري أو شخص محدد',
                  icon: Target,
                },
                {
                  id: 'program' as SourceMode,
                  title: 'مشروع / مبادرة',
                  note: 'مثل حياة كريمة أو أي مشروع يضم منشآت محددة',
                  icon: FolderKanban,
                },
                {
                  id: 'manual' as SourceMode,
                  title: 'اختيار حر',
                  note: 'ابدأ بالمحافظة والإدارة والنوع واختر بنفسك',
                  icon: MapPinned,
                },
              ].map((item) => {
                const Icon = item.icon
                const active = sourceMode === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => changeSourceMode(item.id)}
                    className={
                      'rounded-2xl border p-3 text-right transition ' +
                      (active
                        ? 'border-teal-300 bg-teal-50 ring-1 ring-teal-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50')
                    }
                  >
                    <Icon
                      className={
                        'h-5 w-5 ' +
                        (active ? 'text-teal-700' : 'text-slate-400')
                      }
                    />
                    <p className="mt-2 text-xs font-black text-slate-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">
                      {item.note}
                    </p>
                  </button>
                )
              })}
            </div>

            {sourceMode === 'target' && (
              <div className="rounded-2xl border border-teal-100 bg-teal-50/40 p-3">
                <div className="mb-3">
                  <h3 className="text-xs font-black text-slate-900">
                    المستهدفات النشطة ذات المنشآت المحددة
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    عند اختيار مستهدف مرتبط بمستخدم، يضاف هذا المستخدم للفريق
                    تلقائيًا.
                  </p>
                </div>

                {targets.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-teal-200 bg-white px-4 py-6 text-center text-xs text-slate-500">
                    لا توجد مستهدفات نشطة بمنشآت محددة داخل نطاقك حاليًا.
                  </div>
                ) : (
                  <div className="grid gap-2 lg:grid-cols-2">
                    {targets.map((target) => {
                      const active = sourceTargetId === target.id
                      return (
                        <button
                          key={target.id}
                          type="button"
                          onClick={() => chooseTarget(target)}
                          className={
                            'rounded-xl border p-3 text-right ' +
                            (active
                              ? 'border-teal-400 bg-white ring-1 ring-teal-100'
                              : 'border-teal-100 bg-white hover:border-teal-300')
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-extrabold text-slate-900">
                                {target.title}
                              </p>
                              <p className="mt-1 text-[9px] text-slate-400">
                                {target.period_label} · {target.scope_name}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <span
                                  className={
                                    'rounded-full px-2 py-0.5 text-[8px] font-black ' +
                                    (target.scope_level === 'user'
                                      ? 'bg-violet-50 text-violet-700'
                                      : 'bg-blue-50 text-blue-700')
                                  }
                                >
                                  {target.scope_level === 'user'
                                    ? 'مستهدف مستخدم'
                                    : 'مستهدف مكاني'}
                                </span>
                                <span className="text-[9px] font-bold text-slate-500">
                                  {target.target_type === 'specific_facilities'
                                    ? 'منشآت محددة بالاسم'
                                    : 'مستهدف تراكمي بالعدد'}
                                  {' · '}المطلوب{' '}
                                  {target.target_missions.toLocaleString('en-US')}{' '}
                                  مأمورية
                                </span>
                              </div>
                            </div>
                            <span className="shrink-0 rounded-full bg-teal-50 px-2 py-1 text-[9px] font-black text-teal-800">
                              {target.facility_count.toLocaleString('en-US')} منشأة
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px]">
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                              لها سجل مرور سابق: {target.visited_count.toLocaleString('en-US')}
                            </span>
                            {target.assigned_user_name && (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-800">
                                {target.assigned_user_name}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {sourceMode === 'program' && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-3">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-black text-slate-900">
                      المشروعات والمبادرات
                    </h3>
                    <p className="mt-1 text-[10px] text-slate-500">
                      المشروع يحدد مجموعة المنشآت، وبعد اختياره تستطيع التصفية
                      بالمحافظة والإدارة الصحية.
                    </p>
                  </div>
                  {canManagePrograms && (
                    <Link
                      href="/v2/facilities/programs"
                      className="inline-flex h-8 items-center rounded-lg border border-indigo-200 bg-white px-2.5 text-[9px] font-bold text-indigo-700 hover:bg-indigo-50"
                    >
                      إدارة منشآت المشروعات
                    </Link>
                  )}
                </div>

                <div className="grid gap-2 lg:grid-cols-2">
                  {programs.map((program) => {
                    const active = sourceProgramId === program.id
                    const empty = program.facility_count === 0
                    return (
                      <button
                        key={program.id}
                        type="button"
                        disabled={empty}
                        onClick={() => chooseProgram(program)}
                        className={
                          'rounded-xl border p-3 text-right disabled:cursor-not-allowed disabled:opacity-55 ' +
                          (active
                            ? 'border-indigo-400 bg-white ring-1 ring-indigo-100'
                            : 'border-indigo-100 bg-white hover:border-indigo-300')
                        }
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-extrabold text-slate-900">
                              {program.name}
                            </p>
                            {program.description && (
                              <p className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-400">
                                {program.description}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-800">
                            {program.facility_count.toLocaleString('en-US')} منشأة
                          </span>
                        </div>
                        {empty && (
                          <p className="mt-2 text-[9px] font-bold text-amber-700">
                            لم يتم ربط منشآت معتمدة بهذا المشروع بعد.
                          </p>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {(sourceMode === 'manual' ||
              (sourceMode === 'target' && sourceTargetId) ||
              (sourceMode === 'program' && sourceProgramId)) && (
              <>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-teal-700" />
                      <div>
                        <p className="text-xs font-black text-slate-900">
                          فلاتر المنشآت
                        </p>
                        <p className="text-[9px] text-slate-400">
                          {sourceFacilities.length.toLocaleString('en-US')} منشأة
                          متاحة من المصدر الحالي
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={resetFacilityFilters}
                      className="text-[10px] font-bold text-slate-500 hover:text-teal-700"
                    >
                      مسح الفلاتر
                    </button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
                    <div className="relative xl:col-span-2">
                      <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={facilitySearch}
                        onChange={(event) =>
                          setFacilitySearch(event.target.value)
                        }
                        placeholder="اسم المنشأة، المدينة، الإدارة..."
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white pr-9 pl-3 text-xs outline-none focus:border-teal-500"
                      />
                    </div>

                    <CompactFilterSelect
                      value={governorateFilter}
                      onChange={(value) => {
                        setGovernorateFilter(value)
                        setHealthAdminFilter('')
                      }}
                      placeholder="كل المحافظات"
                      options={governorates.map((value) => ({
                        value,
                        label: value,
                      }))}
                    />

                    <CompactFilterSelect
                      value={healthAdminFilter}
                      onChange={setHealthAdminFilter}
                      placeholder="كل الإدارات الصحية"
                      options={healthAdmins.map((value) => ({
                        value,
                        label: value,
                      }))}
                    />

                    <CompactFilterSelect
                      value={facilityTypeFilter}
                      onChange={setFacilityTypeFilter}
                      placeholder="كل أنواع المنشآت"
                      options={facilityTypes.map((value) => ({
                        value,
                        label: getFacilityTypeLabel(value),
                        meta:
                          sourceFacilities
                            .filter(
                              (facility) => facility.facility_type === value
                            )
                            .length.toLocaleString('en-US'),
                      }))}
                    />

                    <CompactFilterSelect
                      value={visitFilter === 'all' ? '' : visitFilter}
                      onChange={(value) =>
                        setVisitFilter(
                          value === 'visited' ||
                            value === 'unvisited' ||
                            value === 'stale_90' ||
                            value === 'stale_180'
                            ? value
                            : 'all'
                        )
                      }
                      placeholder="كل حالات المرور"
                      options={[
                        { value: 'unvisited', label: 'لم يتم المرور مطلقًا' },
                        {
                          value: 'stale_180',
                          label: 'لم يتم المرور منذ 6 أشهر',
                        },
                        {
                          value: 'stale_90',
                          label: 'لم يتم المرور منذ 3 أشهر',
                        },
                        { value: 'visited', label: 'تم المرور سابقًا' },
                      ]}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <CompactFilterSelect
                      value={facilitySort}
                      onChange={(value) =>
                        setFacilitySort(
                          (value || 'least_visited') as FacilitySort
                        )
                      }
                      placeholder="الأقل مرورًا أولًا"
                      className="w-48"
                      options={[
                        {
                          value: 'least_visited',
                          label: 'الأقل مرورًا أولًا',
                        },
                        {
                          value: 'most_visited',
                          label: 'الأكثر مرورًا أولًا',
                        },
                        { value: 'recent', label: 'الأحدث زيارة أولًا' },
                        { value: 'name', label: 'بالاسم' },
                      ]}
                    />

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => selectFilteredFacilities(true)}
                        className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-[9px] font-bold text-slate-600"
                      >
                        تحديد غير المزارة
                      </button>
                      <button
                        type="button"
                        onClick={() => selectFilteredFacilities(false)}
                        className="h-8 rounded-lg border border-teal-200 bg-white px-2.5 text-[9px] font-bold text-teal-700"
                      >
                        تحديد النتائج
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedFacilityIds([])}
                        className="h-8 rounded-lg px-2.5 text-[9px] font-bold text-slate-500"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-700">
                      النتائج: {filteredFacilities.length.toLocaleString('en-US')} ·
                      المحدد: {selectedFacilityIds.length.toLocaleString('en-US')}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      الحد الأقصى للدفعة الواحدة{' '}
                      {MAX_BATCH_FACILITIES.toLocaleString('en-US')} منشأة
                    </p>
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

                  <div className="max-h-[560px] overflow-y-auto rounded-xl border border-slate-200">
                    {visibleFacilities.map((facility) => {
                      const selected = selectedFacilityIds.includes(facility.id)
                      const visited = facility.visit_count > 0
                      return (
                        <button
                          key={facility.id}
                          type="button"
                          onClick={() => toggleFacility(facility.id)}
                          className={
                            'grid w-full gap-2 border-b border-slate-100 px-3 py-3 text-right transition last:border-b-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] ' +
                            (selected
                              ? 'bg-teal-50'
                              : 'bg-white hover:bg-slate-50')
                          }
                        >
                          <div
                            className={
                              'mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ' +
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
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-xs font-extrabold text-slate-800">
                                {facility.name}
                              </p>
                              <span
                                className={
                                  'rounded-full px-2 py-0.5 text-[9px] font-black ' +
                                  (visited
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-slate-100 text-slate-500')
                                }
                              >
                                {visited
                                  ? facility.visit_count.toLocaleString('en-US') +
                                    ' زيارة منفذة'
                                  : 'لم يتم المرور'}
                              </span>
                              {facility.assignment_count > facility.visit_count && (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-700">
                                  تكليفات قائمة/سابقة{' '}
                                  {facility.assignment_count.toLocaleString('en-US')}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 truncate text-[10px] text-slate-400">
                              {facility.governorate || '—'} ·{' '}
                              {facility.health_admin || facility.organization_name}
                              {facility.village_city
                                ? ' · ' + facility.village_city
                                : ''}
                            </p>
                            <div className="mt-1.5 flex flex-wrap gap-2 text-[9px] text-slate-400">
                              <span>{getFacilityTypeLabel(facility.facility_type)}</span>
                              {facility.last_visited_at && (
                                <span>
                                  آخر مرور: {formatVisitDate(facility.last_visited_at)}
                                </span>
                              )}
                              {facility.distinct_primary_inspectors > 0 && (
                                <span>
                                  رؤساء فرق مختلفون:{' '}
                                  {facility.distinct_primary_inspectors.toLocaleString(
                                    'en-US'
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="hidden text-left sm:block">
                            <span className="text-[9px] font-bold text-slate-400">
                              #{facility.assignment_count.toLocaleString('en-US')}
                            </span>
                          </div>
                        </button>
                      )
                    })}

                    {visibleFacilities.length === 0 && (
                      <div className="px-4 py-10 text-center text-xs text-slate-400">
                        لا توجد منشآت مطابقة لهذه الفلاتر.
                      </div>
                    )}
                  </div>

                  {visibleFacilityCount < filteredFacilities.length && (
                    <div className="mt-3 flex justify-center">
                      <button
                        type="button"
                        onClick={() =>
                          setVisibleFacilityCount(
                            (current) => current + FACILITY_PAGE_SIZE
                          )
                        }
                        className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-600 hover:bg-slate-50"
                      >
                        عرض المزيد · المتبقي{' '}
                        {(
                          filteredFacilities.length - visibleFacilityCount
                        ).toLocaleString('en-US')}
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
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
                تظهر الحسابات التشغيلية التي يمكن أن تشارك في مأمورية داخل
                نطاق تكليفك. المشاركة تمنح التنفيذ للمأمورية المسندة فقط.
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
                      placeholder="ابحث بالاسم أو المسمى أو الجهة..."
                      className="h-11 w-full rounded-xl border border-slate-200 pr-9 pl-3 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                    />
                  </div>
                </label>

                <div className="mb-1 flex items-center justify-between text-[9px] text-slate-400">
                  <span>
                    داخل نطاقك: {inspectors.length.toLocaleString('en-US')} حساب · مؤهل للفريق{' '}
                    {inspectors
                      .filter((inspector) => inspector.can_execute)
                      .length.toLocaleString('en-US')}
                  </span>
                  {selectedTarget?.assigned_user_name && (
                    <span className="font-bold text-amber-700">
                      المستهدف مرتبط بـ {selectedTarget.assigned_user_name}
                    </span>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredInspectors.map((inspector) => (
                    <button
                      key={inspector.id}
                      type="button"
                      disabled={!inspector.can_execute}
                      onClick={() => addInspector(inspector.id)}
                      className={
                        'flex w-full items-center gap-3 border-b border-slate-100 px-3 py-3 text-right last:border-b-0 ' +
                        (inspector.can_execute
                          ? 'hover:bg-slate-50'
                          : 'cursor-not-allowed bg-slate-50/70 opacity-70')
                      }
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="truncate text-xs font-extrabold text-slate-800">
                            {inspector.full_name}
                          </p>
                          {!inspector.can_execute && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[8px] font-bold text-amber-700">
                              غير مؤهل للتنفيذ
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-[10px] text-slate-400">
                          {inspector.job_title || 'مستخدم تشغيلي'} ·{' '}
                          {inspector.organization_name}
                        </p>
                        {!inspector.can_execute && (
                          <p className="mt-1 text-[9px] text-amber-700">
                            يحتاج دورًا تشغيليًا أو صلاحية missions.execute قبل إضافته للفريق.
                          </p>
                        )}
                      </div>
                    </button>
                  ))}

                  {filteredInspectors.length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-slate-400">
                      لا توجد حسابات أخرى مطابقة للبحث.
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
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 p-4 sm:p-6">
            <div>
              <p className="text-[10px] font-bold text-teal-700">
                المرحلة الثالثة
              </p>
              <h2 className="mt-1 text-base font-black text-slate-900">
                استمارة المرور والغرض ثم المراجعة
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                بعد أن حددت المنشآت والفريق، اختر الآن الاستمارة المناسبة
                للمهمة بدل فرضها في بداية التكليف.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900">
                    استمارة المرور
                  </h3>
                  <p className="mt-1 text-[10px] text-slate-400">
                    استماراتك الشخصية أو النماذج المتاحة في المنظومة.
                  </p>
                </div>
                <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setTemplateTab('mine')}
                    className={
                      'h-8 rounded-lg px-3 text-[10px] font-bold ' +
                      (templateTab === 'mine'
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-slate-500')
                    }
                  >
                    استماراتي ({myTemplates.length.toLocaleString('en-US')})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTemplateTab('available')}
                    className={
                      'h-8 rounded-lg px-3 text-[10px] font-bold ' +
                      (templateTab === 'available'
                        ? 'bg-white text-teal-800 shadow-sm'
                        : 'text-slate-500')
                    }
                  >
                    النماذج المتاحة ({templates.length.toLocaleString('en-US')})
                  </button>
                </div>
              </div>

              {templateList.length === 0 ? (
                <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-4 py-7 text-center text-xs text-slate-400">
                  لا توجد استمارات محفوظة في «استماراتي». افتح النماذج
                  المتاحة واحفظ ما تستخدمه باستمرار.
                </div>
              ) : (
                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  {templateList.map((template) => {
                    const selected = template.id === templateId
                    const incompatible =
                      Array.isArray(template.applicable_facility_types) &&
                      template.applicable_facility_types.length > 0 &&
                      [...selectedFacilityTypes].some(
                        (type) =>
                          !template.applicable_facility_types?.includes(type)
                      )

                    return (
                      <div
                        key={template.id}
                        className={
                          'rounded-xl border p-3 ' +
                          (selected
                            ? 'border-teal-300 bg-teal-50/60'
                            : incompatible
                              ? 'border-slate-100 bg-slate-50 opacity-60'
                              : 'border-slate-200 bg-white')
                        }
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            disabled={incompatible}
                            onClick={() => setTemplateId(template.id)}
                            className="min-w-0 flex-1 text-right disabled:cursor-not-allowed"
                          >
                            <div className="flex items-center gap-2">
                              <FileText
                                className={
                                  'h-4 w-4 shrink-0 ' +
                                  (selected
                                    ? 'text-teal-700'
                                    : 'text-slate-400')
                                }
                              />
                              <p className="truncate text-xs font-extrabold text-slate-900">
                                {template.name}
                              </p>
                            </div>
                            <p className="mt-1 text-[9px] text-slate-400">
                              {template.created_by_me
                                ? 'أنشأتها أنت'
                                : template.is_base
                                  ? 'نموذج أساسي'
                                  : template.visibility === 'system'
                                    ? 'نموذج مشترك'
                                    : 'نموذج جهة'}
                              {template.version
                                ? ' · إصدار ' + template.version
                                : ''}
                            </p>
                            {incompatible && (
                              <p className="mt-1 text-[9px] font-bold text-rose-700">
                                غير مخصص لنوع إحدى المنشآت المحددة.
                              </p>
                            )}
                          </button>

                          {canUseTemplateLibrary &&
                            !template.created_by_me && (
                              <button
                                type="button"
                                onClick={() =>
                                  void toggleTemplateLibrary(template)
                                }
                                className={
                                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ' +
                                  (template.in_my_library
                                    ? 'border-teal-200 bg-teal-50 text-teal-700'
                                    : 'border-slate-200 bg-white text-slate-400')
                                }
                                title={
                                  template.in_my_library
                                    ? 'إزالة من استماراتي'
                                    : 'حفظ في استماراتي'
                                }
                              >
                                {template.in_my_library ? (
                                  <BookmarkCheck className="h-4 w-4" />
                                ) : (
                                  <Bookmark className="h-4 w-4" />
                                )}
                              </button>
                            )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    غرض المأمورية
                  </span>
                  <textarea
                    value={visitPurpose}
                    onChange={(event) => setVisitPurpose(event.target.value)}
                    rows={5}
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

                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-slate-700">
                    تعليمات إضافية
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={4}
                    placeholder="تعليمات خاصة بالفريق أو التوثيق أو الزيارة..."
                    className="w-full resize-none rounded-xl border border-slate-200 p-3 text-xs leading-6 outline-none focus:border-teal-500"
                  />
                </label>
              </div>

              <div className="space-y-3">
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
                        : preparationMode === 'secretariat'
                          ? 'سيتم إرسال التكليف للاعتماد'
                          : 'سيصدر التكليف بانتظار الاعتماد'}
                    </p>
                    <p className="mt-1 text-[10px] leading-5 text-slate-500">
                      {canApprove
                        ? 'حسابك يملك صلاحية اعتماد المأموريات داخل هذا النطاق.'
                        : preparationMode === 'secretariat'
                          ? 'أنت تعد التكليف وتقترح الفريق فقط؛ لا تصل إشعارات للفريق قبل اعتماد جهة مخولة.'
                          : 'الاعتماد النهائي يحتاج جهة مخولة.'}
                    </p>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold text-slate-400">
                      مصدر الاختيار
                    </p>
                    <p className="mt-1 text-xs font-extrabold text-slate-800">
                      {sourceLabel(sourceMode)}
                    </p>
                    {selectedTarget && (
                      <p className="mt-1 truncate text-[9px] text-slate-400">
                        {selectedTarget.title}
                      </p>
                    )}
                    {selectedProgram && (
                      <p className="mt-1 truncate text-[9px] text-slate-400">
                        {selectedProgram.name}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold text-slate-400">
                      المأموريات الناتجة
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {selectedFacilities.length.toLocaleString('en-US')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold text-slate-400">
                      أعضاء الفريق
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">
                      {selectedInspectors.length.toLocaleString('en-US')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[9px] font-bold text-slate-400">
                      الاستمارة
                    </p>
                    <p className="mt-1 line-clamp-2 text-[11px] font-extrabold text-slate-800">
                      {selectedTemplate?.name || 'لم تحدد بعد'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-3">
                  <h3 className="text-[10px] font-black text-slate-900">
                    عينة من المنشآت المحددة
                  </h3>
                  <div className="mt-2 space-y-1.5">
                    {selectedFacilities.slice(0, 6).map((facility) => (
                      <div
                        key={facility.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2"
                      >
                        <p className="truncate text-[10px] font-bold text-slate-700">
                          {facility.name}
                        </p>
                        <span className="shrink-0 text-[9px] text-slate-400">
                          {facility.visit_count.toLocaleString('en-US')} زيارة
                        </span>
                      </div>
                    ))}
                    {selectedFacilities.length > 6 && (
                      <p className="text-center text-[9px] text-slate-400">
                        +{' '}
                        {(selectedFacilities.length - 6).toLocaleString(
                          'en-US'
                        )}{' '}
                        منشأة أخرى
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-[10px] text-slate-500">
                  الموعد: {scheduledDate}
                  {expectedEndDate !== scheduledDate
                    ? ' ← ' + expectedEndDate
                    : ''}{' '}
                  · أولوية {priorityLabel(priority)}
                  {requiresOvernight ? ' · تتطلب مبيت' : ''}
                  {requiresHotelBooking ? ' · حجز فندقي' : ''}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-6">
          <div className="text-[10px] text-slate-400">
            {caller?.organization_name
              ? 'جهة إعداد التكليف: ' + caller.organization_name
              : 'يتم التحقق من جهة الإصدار على السيرفر'}
          </div>
          {renderActions(false)}
        </div>
      </section>
    </div>
  )
}
