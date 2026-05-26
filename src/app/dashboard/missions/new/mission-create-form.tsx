'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { 
  Briefcase, 
  Calendar, 
  MapPin, 
  UserPlus, 
  Users, 
  AlertTriangle, 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  CheckCircle2, 
  Clock, 
  Building,
  X
} from 'lucide-react'
import styles from './new-mission.module.css'

type Employee = {
  id: string
  full_name: string
  job_title: string | null
  level: number
  department: string | null
  org_unit_id?: string | null
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
  latitude?: number
  longitude?: number
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
  assignedUserIds: string[]
  orgUnitId: string
  destinationType: 'facility' | 'governorate'
  targetFacilityId: string
  targetFacilityIds: string[]
  targetGovernorateId: string
  scheduledDate: string
  expectedEndDate: string
  requiresOvernight: boolean
  requiresHotelBooking: boolean
  allowPastDate: boolean
  priority: 'normal' | 'high' | 'urgent'
  visitPurpose: string
  notes: string
}

const initialState: FormState = {
  assignedUserIds: [],
  orgUnitId: '',
  destinationType: 'governorate',
  targetFacilityId: '',
  targetFacilityIds: [],
  targetGovernorateId: '',
  scheduledDate: '',
  expectedEndDate: '',
  requiresOvernight: false,
  requiresHotelBooking: false,
  allowPastDate: false,
  priority: 'normal',
  visitPurpose: '',
  notes: '',
}

function todayString() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

function uniqueText(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))).join('، ')
}

function missionDuration(startDate: string, endDate: string) {
  if (!startDate || !endDate || endDate < startDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const nights = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))
  return {
    days: nights + 1,
    nights,
  }
}

const PURPOSE_TEMPLATES = {
  general: [
    { label: 'مرور مفاجئ وانضباط', text: 'مرور مفاجئ لتقييم انضباط الأطقم الطبية، ومتابعة جودة تقديم الخدمة للمواطنين بالاستقبال والعيادات الخارجية.' },
    { label: 'تقييم كفاءة الطوارئ', text: 'فحص انتظام العمل بنوبتجيات الطوارئ والعمليات، ورصد كفاءة التجهيزات والأجهزة الطبية الحرجة.' },
    { label: 'توجيهات ورصد أداء', text: 'معاينة الخدمات الطبية العلاجية ومطابقة الحضور الفعلي للأطباء الاستشاريين والتأكد من جداول النوبتجية.' }
  ],
  infection: [
    { label: 'بروتوكولات التطهير والنفايات', text: 'تقييم التزام الأقسام الحرجة (الرعاية، العمليات، الحضانات) ببروتوكولات مكافحة العدوى والتعقيم وسياسات التخلص الآمن من النفايات.' },
    { label: 'تعقيم عيادات الجراحة', text: 'متابعة تطبيق شروط السلامة والصحة المهنية وتطهير عيادات الأسنان وأدوات الجراحة الفورية.' }
  ],
  pharmacy: [
    { label: 'جرد العهد والنواقص', text: 'جرد العهد الدوائية ومخازن المستلزمات، وحصر حركة النواقص والبدائل العلاجية المتوفرة بصيدلية الطوارئ.' },
    { label: 'تخزين الأمصال المبرد', text: 'متابعة شروط التخزين الجاف والمبرد للأمصال والطعوم بالصيدليات والمخزن الإقليمي الفرعي.' }
  ],
  maintenance: [
    { label: 'سلامة شبكات الأكسجين', text: 'التفتيش على كفاءة شبكات الغازات والأكسجين وتوافر المولدات البديلة للكهرباء ومحطات معالجة المياه.' },
    { label: 'أعطال الأجهزة والأشعة', text: 'فحص خطط الصيانة الوقائية لأقسام الأشعة والرنين المغناطيسي، ومعاينة الغلايات والمصاعد التالفة.' }
  ]
}

const NOTES_TEMPLATES = [
  { label: 'التوثيق بالـ GPS', text: 'يرجى توثيق الزيارة بالـ GPS وإعداد التقرير الرقابي فور انتهاء المرور وبحد أقصى ٢٤ ساعة.' },
  { label: 'مطابقة دفاتر الحضور', text: 'يجب مطابقة التزام الأطقم الطبية بجدول النوبتجية ومراجعة الدفاتر الورقية للحضور والانصراف.' },
  { label: 'استبيان رضا المرضى', text: 'التركيز التام على استبيان رضا المرضى بالاستقبال وحل مشكلات قوائم الانتظار للجراحات الحرجة.' },
  { label: 'إخطار الشئون العلاجية', text: 'يُرجى إخطار الإدارة المركزية للشئون العلاجية فوراً برصد أي مخالفات جسيمة تهدد سلامة المرضى.' }
]

type DemoStoredMission = {
  destinationName: string
  destinationType: 'facility' | 'governorate'
  employeeNames: string
  endDate: string
  facilityType?: string | null
  id: string
  notes: string
  orgUnitName: string
  priority: string
  scheduledDate: string
  serialNumber: string
  status: string
  visitPurpose: string
}

export function MissionCreateForm({
  currentUserId,
  demoMode = false,
  employees,
  facilities,
  governorates,
  orgUnits,
}: {
  currentUserId: string
  demoMode?: boolean
  employees: Employee[]
  facilities: Facility[]
  governorates: Governorate[]
  orgUnits: OrgUnit[]
}) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  
  // Stepper State
  const [step, setStep] = useState<1 | 2 | 3>(1)
  
  // Form States
  const [form, setForm] = useState<FormState>(initialState)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [pendingPastDate, setPendingPastDate] = useState('')
  
  // Search state for searchable select
  const [facilitySearch, setFacilitySearch] = useState('')
  
  // Active template category for rapid purpose writing
  const [activePurposeCategory, setActivePurposeCategory] = useState<'general' | 'infection' | 'pharmacy' | 'maintenance'>('general')
  
  // Validation feedback
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Preselect org unit from URL query parameter
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const orgParam = params.get('orgUnit')
    if (orgParam) {
      const matched = orgUnits.find(
        (unit) => unit.name.toLowerCase() === orgParam.toLowerCase() || unit.id === orgParam
      )
      if (matched) {
        setForm((prev) => ({
          ...prev,
          orgUnitId: matched.id
        }))
      }
    }
  }, [orgUnits])

  const today = todayString()
  const isPastDate = Boolean(form.scheduledDate && form.scheduledDate < today)
  const duration = missionDuration(form.scheduledDate, form.expectedEndDate)

  // Load existing missions to check employee load status
  const existingMissions: DemoStoredMission[] = useMemo(() => {
    if (typeof window === 'undefined') return []
    const cookieName = 'maamouriyat_demo_missions'
    const value = document.cookie
      .split('; ')
      .find((item) => item.startsWith(`${cookieName}=`))
      ?.split('=')[1]
    if (!value) return []
    try {
      return JSON.parse(decodeURIComponent(value))
    } catch {
      return []
    }
  }, [form.scheduledDate])

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => form.assignedUserIds.includes(employee.id)),
    [employees, form.assignedUserIds],
  )

  const filteredEmployees = useMemo(() => {
    if (!form.orgUnitId) return []
    const exact = employees.filter((employee) => employee.org_unit_id === form.orgUnitId)
    if (exact.length) return exact

    const unit = orgUnits.find((item) => item.id === form.orgUnitId)
    return employees.filter((employee) => employee.department === unit?.name)
  }, [employees, form.orgUnitId, orgUnits])

  const employeeOptions = filteredEmployees.filter((employee) => !form.assignedUserIds.includes(employee.id))

  const filteredFacilities = useMemo(() => {
    if (!form.targetGovernorateId) return []
    
    let base = facilities.filter((facility) => facility.governorate_id === form.targetGovernorateId)
    if (facilitySearch.trim()) {
      base = base.filter(f => f.name.toLowerCase().includes(facilitySearch.toLowerCase()))
    }
    return base
  }, [facilities, form.targetGovernorateId, facilitySearch])

  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === form.targetFacilityId),
    [facilities, form.targetFacilityId],
  )
  const selectedFacilities = useMemo(
    () => facilities.filter((facility) => form.targetFacilityIds?.includes(facility.id)),
    [facilities, form.targetFacilityIds],
  )
  const selectedGovernorate = useMemo(
    () => governorates.find((governorate) => governorate.id === form.targetGovernorateId),
    [governorates, form.targetGovernorateId],
  )
  const selectedOrgUnit = useMemo(
    () => orgUnits.find((unit) => unit.id === form.orgUnitId),
    [form.orgUnitId, orgUnits],
  )

  // Inspector Overload Warning Diagnostician
  const busyInspectorWarning = useMemo(() => {
    if (!selectedEmployeeId || !form.scheduledDate) return ''
    const emp = employees.find(e => e.id === selectedEmployeeId)
    if (!emp) return ''

    // Check if employee is booked on that date in mock cookie
    const isBusy = existingMissions.some(m => 
      m.scheduledDate === form.scheduledDate && 
      m.employeeNames.includes(emp.full_name)
    )

    if (isBusy) {
      return `⚠️ تنبيه هام: الموظف ${emp.full_name} لديه مأمورية تفتيشية نشطة أخرى مجدولة بالفعل في تاريخ ${form.scheduledDate}! يمكنك إضافته ولكن يرجى التحقق الجغرافي لتفادي تعارض التكاليف.`
    }
    return ''
  }, [selectedEmployeeId, form.scheduledDate, existingMissions, employees])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'orgUnitId') {
        next.assignedUserIds = []
        setSelectedEmployeeId('')
      }

      if (key === 'destinationType' || key === 'targetGovernorateId') {
        next.targetFacilityId = ''
        next.targetFacilityIds = []
        setFacilitySearch('')
      }

      if (key === 'scheduledDate' && typeof value === 'string' && value >= today) {
        next.allowPastDate = false
      }

      if (key === 'scheduledDate' && typeof value === 'string' && next.expectedEndDate && next.expectedEndDate < value) {
        next.expectedEndDate = ''
      }

      return next
    })
  }

  function handleDateChange(value: string) {
    if (value && value < today) {
      setPendingPastDate(value)
      return
    }

    update('scheduledDate', value)
  }

  function confirmPastDate() {
    if (!pendingPastDate) return
    setForm((current) => ({
      ...current,
      allowPastDate: true,
      scheduledDate: pendingPastDate,
    }))
    setPendingPastDate('')
  }

  function cancelPastDate() {
    setPendingPastDate('')
  }

  function addEmployee() {
    if (!selectedEmployeeId) return
    setForm((current) => ({
      ...current,
      assignedUserIds: current.assignedUserIds.includes(selectedEmployeeId)
        ? current.assignedUserIds
        : [...current.assignedUserIds, selectedEmployeeId],
    }))
    setSelectedEmployeeId('')
  }

  function removeEmployee(employeeId: string) {
    setForm((current) => ({
      ...current,
      assignedUserIds: current.assignedUserIds.filter((id) => id !== employeeId),
    }))
  }

  function validateStep(currentStep: 1 | 2 | 3): string {
    if (currentStep === 1) {
      if (!form.orgUnitId) return 'يرجى اختيار الإدارة المختصة.'
      if (!form.scheduledDate) return 'يرجى اختيار تاريخ بداية المأمورية.'
      if (!form.expectedEndDate) return 'يرجى اختيار تاريخ الانتهاء المتوقع.'
      if (form.expectedEndDate < form.scheduledDate) return 'تاريخ الانتهاء لا يمكن أن يسبق تاريخ البداية.'
      if (isPastDate && !form.allowPastDate) return 'تاريخ المأمورية قديم. يرجى تأكيد استخدام تاريخ سابق.'
    }
    if (currentStep === 2) {
      if (form.assignedUserIds.length === 0) return 'يرجى إضافة موظف واحد على الأقل لفريق عمل المأمورية.'
    }
    if (currentStep === 3) {
      if (!form.targetGovernorateId) return 'يرجى اختيار المحافظة المستهدفة للمأمورية.'
      if (form.destinationType === 'facility' && (!form.targetFacilityIds || form.targetFacilityIds.length === 0)) return 'يرجى البحث واختيار المنشأة الطبية المستهدفة.'
      if (!form.visitPurpose.trim()) return 'يرجى كتابة الغرض التفصيلي من زيارة المأمورية.'
    }
    return ''
  }

  function handleNextStep() {
    setError('')
    const validationError = validateStep(step)
    if (validationError) {
      setError(validationError)
      return
    }
    if (step < 3) setStep((prev) => (prev + 1) as any)
  }

  function handlePrevStep() {
    setError('')
    if (step > 1) setStep((prev) => (prev - 1) as any)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const step3Error = validateStep(3)
    if (step3Error) {
      setError(step3Error)
      return
    }

    const teamSummary = uniqueText(selectedEmployees.map((employee) => employee.full_name))

    if (demoMode) {
      let selectedFacs = form.destinationType === 'facility'
        ? facilities.filter(fac => form.targetFacilityIds?.includes(fac.id))
        : [];
      
      if (form.destinationType === 'facility' && selectedFacs.length === 0) {
        selectedFacs = [selectedFacility].filter(Boolean) as any;
      }
      
      const newMissions: DemoStoredMission[] = [];
      const newNotifs: any[] = [];
      const count = form.destinationType === 'facility' ? selectedFacs.length : 1;
      
      for (let i = 0; i < count; i++) {
        const fac = form.destinationType === 'facility' ? selectedFacs[i] : null;
        const currentSerial = `MIS-2026-05-${(Date.now() + i).toString().slice(-5)}`;
        
        const missionNoteParts = [
          form.notes.trim(),
          teamSummary ? `فريق المأمورية: ${teamSummary}` : '',
          `تاريخ الانتهاء المتوقع: ${form.expectedEndDate}`,
          duration ? `مدة المأمورية: ${duration.days} يوم / ${duration.nights} ليلة` : '',
          `مبيت: ${form.requiresOvernight ? 'نعم' : 'لا'}`,
          `حجز فندق: ${form.requiresHotelBooking ? 'نعم' : 'لا'}`,
          isPastDate && form.allowPastDate ? 'تم تأكيد المأمورية بتاريخ سابق.' : '',
        ].filter(Boolean);

        const newMission: DemoStoredMission = {
          destinationName: form.destinationType === 'facility'
            ? fac?.name ?? 'منشأة غير محددة'
            : selectedGovernorate?.name ?? 'محافظة غير محددة',
          destinationType: form.destinationType,
          employeeNames: teamSummary,
          endDate: form.expectedEndDate,
          facilityType: fac?.facility_type,
          id: `demo-${currentSerial}`,
          notes: missionNoteParts.join('\n'),
          orgUnitName: selectedOrgUnit?.name ?? 'إدارة التفتيش والمتابعة',
          priority: form.priority,
          scheduledDate: form.scheduledDate,
          serialNumber: currentSerial,
          status: 'assigned',
          visitPurpose: form.visitPurpose.trim(),
        };
        
        newMissions.push(newMission);
        
        newNotifs.push(
          {
            href: '/dashboard/missions',
            meta: 'الآن',
            text: `تم تكليفك بمأمورية تفتيشية جديدة رقم ${currentSerial} إلى ${form.destinationType === 'facility' ? fac?.name : selectedGovernorate?.name} بتاريخ ${form.scheduledDate}.`,
            title: 'تكليف مأمورية جديد',
            tone: 'blue',
            is_read: false
          },
          {
            href: '/dashboard/missions',
            meta: 'الآن',
            text: `تم إرسال مأمورية تفتيشية جديدة رقم ${currentSerial} لفريق العمل للتنفيذ.`,
            title: 'مأمورية قيد المتابعة',
            tone: 'amber',
            is_read: false
          }
        );
      }

      // Save to cookie using existing helper
      const existingCookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith('maamouriyat_demo_missions='))
        ?.split('=')[1]
      let existing: DemoStoredMission[] = []
      try {
        existing = existingCookie ? (JSON.parse(decodeURIComponent(existingCookie)) as DemoStoredMission[]) : []
      } catch {
        existing = []
      }
      
      const next = [...newMissions, ...existing].slice(0, 30)
      document.cookie = `maamouriyat_demo_missions=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=604800; SameSite=Lax`

      // Dynamic local notifications in cookies for real-time bell badge simulation
      const notifCookieName = 'maamouriyat_demo_notifications'
      const existingNotifCookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith(`${notifCookieName}=`))
        ?.split('=')[1]
      let existingNotifs: any[] = []
      try {
        existingNotifs = existingNotifCookie ? JSON.parse(decodeURIComponent(existingNotifCookie)) : []
      } catch {}

      existingNotifs = [...newNotifs, ...existingNotifs].slice(0, 20)
      document.cookie = `${notifCookieName}=${encodeURIComponent(JSON.stringify(existingNotifs))}; path=/; max-age=604800; SameSite=Lax`

      if (count > 1) {
        setSuccess(`تم تكليف عدد ${count} مأموريات تجريبية بنجاح!`)
      } else {
        setSuccess(`تم تكليف المأمورية التجريبية بنجاح برقم تسلسلي: ${newMissions[0].serialNumber}`)
      }
      
      setForm(initialState)
      setStep(1)
      router.push('/dashboard/missions')
      router.refresh()
      return
    }

    if (!supabase) {
      setError('إعداد قاعدة البيانات Supabase غير مكتمل.')
      return
    }

    setLoading(true)

    let selectedFacs = form.destinationType === 'facility'
      ? facilities.filter(fac => form.targetFacilityIds?.includes(fac.id))
      : [];
    
    if (form.destinationType === 'facility' && selectedFacs.length === 0) {
      selectedFacs = [selectedFacility].filter(Boolean) as any;
    }
    
    const count = form.destinationType === 'facility' ? selectedFacs.length : 1;
    let successCount = 0;
    let lastSerial = '';

    for (let i = 0; i < count; i++) {
      const fac = form.destinationType === 'facility' ? selectedFacs[i] : null;

      // Generate real sequential serial number
      const { data: serialData, error: serialError } = await supabase.rpc('generate_serial_number', {
        dept_code: 'MIS',
      })

      if (serialError) {
        setLoading(false)
        setError(`خطأ أثناء إنشاء الرقم التسلسلي للمأمورية ${i + 1}: ${serialError.message}`)
        return
      }

      lastSerial = serialData;

      const missionNoteParts = [
        form.notes.trim(),
        teamSummary ? `فريق المأمورية: ${teamSummary}` : '',
        `تاريخ الانتهاء المتوقع: ${form.expectedEndDate}`,
        duration ? `مدة المأمورية: ${duration.days} يوم / ${duration.nights} ليلة` : '',
        `مبيت: ${form.requiresOvernight ? 'نعم' : 'لا'}`,
        `حجز فندق: ${form.requiresHotelBooking ? 'نعم' : 'لا'}`,
        isPastDate && form.allowPastDate ? 'تم تأكيد المأمورية بتاريخ سابق.' : '',
      ].filter(Boolean);

      const payload = {
        serial_number: serialData,
        assigned_user_id: form.assignedUserIds[0],
        created_by: currentUserId,
        org_unit_id: form.orgUnitId,
        facility_id: form.destinationType === 'facility' ? fac?.id : null,
        destination_type: form.destinationType,
        target_facility_id: form.destinationType === 'facility' ? fac?.id : null,
        target_governorate_id:
          form.destinationType === 'facility' ? fac?.governorate_id ?? form.targetGovernorateId : form.targetGovernorateId,
        priority: form.priority,
        expected_duration_days: duration?.days ?? null,
        expected_nights: duration?.nights ?? null,
        requires_overnight: form.requiresOvernight,
        requires_hotel_booking: form.requiresHotelBooking,
        scheduled_date: form.scheduledDate,
        visit_purpose: form.visitPurpose.trim(),
        notes: missionNoteParts.join('\n') || null,
        status: 'assigned',
      }

      const { data: missionData, error: insertError } = await supabase.from('missions').insert(payload).select('id').single()

      if (insertError) {
        setLoading(false)
        setError(`خطأ أثناء إدراج المأمورية ${i + 1}: ${insertError.message}`)
        return
      }

      // Insert team members if any
      if (missionData?.id && form.assignedUserIds.length) {
        await supabase.from('mission_assignees').insert(
          form.assignedUserIds.map((userId, index) => ({
            is_primary: index === 0,
            mission_id: missionData.id,
            user_id: userId,
          })),
        )

        await supabase.from('notifications').insert(
          form.assignedUserIds.map((userId) => ({
            body: `تم تكليفك بمأمورية رقابة وتفتيش جديدة رقم ${serialData} بتاريخ ${form.scheduledDate}. يرجى تأكيد حضورك وموقعك بالـ GPS فور بدء الزيارة.`,
            mission_id: missionData.id,
            title: 'تكليف مأمورية جديد',
            type: 'mission_assigned',
            user_id: userId,
          })),
        )
      }

      successCount++;
    }

    setLoading(false)
    if (successCount > 1) {
      setSuccess(`تم إنشاء وتكليف عدد ${successCount} مأموريات بنجاح.`)
    } else {
      setSuccess(`تم إنشاء وتكليف المأمورية بنجاح بالرقم التسلسلي: ${lastSerial}`)
    }
    setForm(initialState)
    setStep(1)
    router.push('/dashboard/missions')
    router.refresh()
  }

  return (
    <div style={{ display: 'grid', gap: '20px', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* A. MULTI-STEP PROGRESS STEPPER */}
      <section style={{
        background: 'white',
        border: '1px solid #dce7e8',
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        position: 'relative',
        boxShadow: '0 4px 10px rgba(0,0,0,0.01)'
      }}>
        {/* Step 1 Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: step === 1 ? 'var(--brand)' : '#eaf8f3',
            color: step === 1 ? 'white' : 'var(--brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            border: step === 1 ? 'none' : '1px solid #ccebe6',
            transition: 'all 0.2s'
          }}>
            {step > 1 ? '✓' : '1'}
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: step === 1 ? '#102027' : '#78909c', display: 'block' }}>البيانات والمواعيد</span>
            <small style={{ fontSize: '10px', color: '#90a4ae' }}>الإدارة والتاريخ والجدولة</small>
          </div>
        </div>

        {/* Line 1 */}
        <div style={{ flex: 1, height: '2px', background: step > 1 ? 'var(--brand)' : '#e0f0f0', margin: '0 12px', zIndex: 1 }} />

        {/* Step 2 Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: step === 2 ? 'var(--brand)' : step > 2 ? '#eaf8f3' : '#f0f4f8',
            color: step === 2 ? 'white' : step > 2 ? 'var(--brand)' : '#90a4ae',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            border: step === 2 ? 'none' : step > 2 ? '1px solid #ccebe6' : '1px solid #cfd8dc',
            transition: 'all 0.2s'
          }}>
            {step > 2 ? '✓' : '2'}
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: step === 2 ? '#102027' : '#78909c', display: 'block' }}>فريق العمل والمفتشين</span>
            <small style={{ fontSize: '10px', color: '#90a4ae' }}>تسكين المفتشين والأعضاء</small>
          </div>
        </div>

        {/* Line 2 */}
        <div style={{ flex: 1, height: '2px', background: step > 2 ? 'var(--brand)' : '#e0f0f0', margin: '0 12px', zIndex: 1 }} />

        {/* Step 3 Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', zIndex: 2 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: step === 3 ? 'var(--brand)' : '#f0f4f8',
            color: step === 3 ? 'white' : '#90a4ae',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            border: step === 3 ? 'none' : '1px solid #cfd8dc',
            transition: 'all 0.2s'
          }}>
            3
          </div>
          <div>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: step === 3 ? '#102027' : '#78909c', display: 'block' }}>الوجهة الجغرافية والغرض</span>
            <small style={{ fontSize: '10px', color: '#90a4ae' }}>المنشأة المستهدفة والغرض</small>
          </div>
        </div>
      </section>

      {/* B. MULTI-STEP INTERACTIVE FORM */}
      <form onSubmit={handleSubmit} style={{
        background: '#ffffff',
        border: '1px solid #cfdcde',
        borderRadius: '16px',
        padding: '24px',
        display: 'grid',
        gap: '20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.01)'
      }}>
        {error && (
          <div style={{
            background: '#fff1f1',
            border: '1px solid #ffcdd2',
            borderRadius: '8px',
            color: '#c62828',
            padding: '12px 16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 'bold'
          }}>
            <AlertTriangle size={16} />
            {error}
          </div>
        )}
        
        {success && (
          <div style={{
            background: '#eaf8f3',
            border: '1px solid #ccebe6',
            borderRadius: '8px',
            color: '#16725a',
            padding: '12px 16px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 'bold'
          }}>
            <CheckCircle2 size={16} />
            {success}
          </div>
        )}

        {/* ================= STEP 1: GENERAL & DATES ================= */}
        {step === 1 && (
          <div style={{ display: 'grid', gap: '18px', animation: 'fadeIn 0.2s' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #e0f0f0', paddingBottom: '10px' }}>
              الخطوة 1: تفاصيل الإدارة المختصة ومواعيد المأمورية
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Org Unit */}
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                الإدارة الرقابية المختصة بالتكليف *
                <select 
                  value={form.orgUnitId} 
                  onChange={(event) => update('orgUnitId', event.target.value)} 
                  required
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: form.orgUnitId ? '1px solid #cfdcde' : '2px solid #ffb74d',
                    padding: '0 10px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none'
                  }}
                >
                  <option value="">اختر الإدارة أولاً</option>
                  {orgUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {'-'.repeat(Math.max(0, unit.level))} {unit.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Priority */}
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                درجة أولوية المأمورية *
                <select 
                  value={form.priority} 
                  onChange={(event) => update('priority', event.target.value as FormState['priority'])}
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: '1px solid #cfdcde',
                    padding: '0 10px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none'
                  }}
                >
                  <option value="normal">عادية</option>
                  <option value="high">مرتفعة (متابعة خاصة)</option>
                  <option value="urgent">عاجلة جداً (قرار وزاري طارئ)</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              {/* Start Date */}
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                تاريخ بداية التحرك *
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(event) => handleDateChange(event.target.value)}
                  required
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: form.scheduledDate ? '1px solid #cfdcde' : '2px solid #ffb74d',
                    padding: '0 10px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none'
                  }}
                />
              </label>

              {/* End Date */}
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                تاريخ الانتهاء المتوقع *
                <input
                  min={form.scheduledDate || undefined}
                  type="date"
                  value={form.expectedEndDate}
                  onChange={(event) => update('expectedEndDate', event.target.value)}
                  required
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: form.expectedEndDate ? '1px solid #cfdcde' : '2px solid #ffb74d',
                    padding: '0 10px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none'
                  }}
                />
              </label>
            </div>

            {/* overnight toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                هل تتطلب المأمورية مبيت للمفتشين؟
                <select
                  value={form.requiresOvernight ? 'yes' : 'no'}
                  onChange={(event) => update('requiresOvernight', event.target.value === 'yes')}
                  style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #cfdcde', padding: '0 10px', fontSize: '13px', background: 'white', outline: 'none' }}
                >
                  <option value="no">لا، عودة في نفس اليوم</option>
                  <option value="yes">نعم، تتضمن إقامة ومبيت</option>
                </select>
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                هل يلزم تنسيق وحجز فندقي رسمي؟
                <select
                  value={form.requiresHotelBooking ? 'yes' : 'no'}
                  onChange={(event) => update('requiresHotelBooking', event.target.value === 'yes')}
                  style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #cfdcde', padding: '0 10px', fontSize: '13px', background: 'white', outline: 'none' }}
                >
                  <option value="no">لا، تدبير شخصي</option>
                  <option value="yes">نعم، يلزم حجز إداري رسمي</option>
                </select>
              </label>
            </div>

            {isPastDate && form.allowPastDate && (
              <div style={{ background: '#fff9db', border: '1px solid #f59f00', borderRadius: '8px', color: '#b05c00', padding: '12px', fontSize: '12.5px', fontWeight: 'bold' }}>
                ✓ تم اعتماد إنشاء المأمورية بأثر رجعي وبتاريخ سابق ({form.scheduledDate}).
              </div>
            )}

            {/* Dynamic Gold Duration Panel */}
            {duration && (
              <div style={{
                background: 'linear-gradient(135deg, #fff9db 0%, #fff3bf 100%)',
                border: '1px solid #ffe3e3',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 10px rgba(245,159,0,0.06)'
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Clock size={20} style={{ color: '#f59f00' }} />
                  <div>
                    <span style={{ fontSize: '11px', color: '#868e96', display: 'block' }}>مدة المأمورية الإدارية المقدرة</span>
                    <strong style={{ fontSize: '16px', color: '#f59f00', fontWeight: 'bold' }}>{duration.days} يوم / {duration.nights} ليلة مبيت</strong>
                  </div>
                </div>
                {form.requiresOvernight && (
                  <span style={{ fontSize: '11.5px', background: '#ffe3e3', color: '#d32f2f', padding: '3px 10px', borderRadius: '6px', fontWeight: 'bold' }}>
                    ⚠️ تستحق المأمورية بدلات مبيت وإقامة
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================= STEP 2: TEAM & INSPECTORS ================= */}
        {step === 2 && (
          <div style={{ display: 'grid', gap: '18px', animation: 'fadeIn 0.2s' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #e0f0f0', paddingBottom: '10px' }}>
              الخطوة 2: تشكيل فريق التفتيش الميداني والمفتشين المكلفين
            </h3>

            {/* Inspector Load warning */}
            {busyInspectorWarning && (
              <div style={{
                background: '#ffebee',
                border: '1px solid #ffcdd2',
                borderRadius: '8px',
                color: '#c62828',
                padding: '12px',
                fontSize: '12.5px',
                lineHeight: '1.5',
                display: 'flex',
                gap: '8px'
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{busyInspectorWarning}</span>
              </div>
            )}

            <div style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>اختيار وتكليف مفتش من الإدارة المحددة:</span>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <select
                  disabled={!form.orgUnitId || !employeeOptions.length}
                  onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  value={selectedEmployeeId}
                  style={{
                    flex: 1,
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: '1px solid #cfdcde',
                    padding: '0 10px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none',
                    minWidth: '240px'
                  }}
                >
                  <option value="">اختر الموظف...</option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name} - {employee.job_title ?? employee.department ?? `مستوى ${employee.level}`}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedEmployeeId}
                  onClick={addEmployee}
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: 0,
                    borderRadius: '8px',
                    padding: '0 20px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: selectedEmployeeId ? 'pointer' : 'not-allowed',
                    opacity: selectedEmployeeId ? 1 : 0.6,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minHeight: '44px'
                  }}
                >
                  <UserPlus size={16} />
                  إضافة للفريق
                </button>
              </div>
            </div>

            {/* Team Members List */}
            <div style={{ display: 'grid', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#37474f', display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Users size={16} style={{ color: '#006d77' }} />
                أعضاء فريق المأمورية الحاليين ({selectedEmployees.length} مفتشين):
              </span>

              <div style={{
                background: '#f8fbfb',
                border: '1px solid #cfdcde',
                borderRadius: '12px',
                padding: '16px',
                display: 'grid',
                gap: '10px',
                minHeight: '120px',
                alignContent: 'start'
              }}>
                {!form.orgUnitId && <p style={{ margin: 0, color: '#78909c', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>💡 يرجى اختيار الإدارة المختصة في الخطوة 1 أولاً لعرض وتكليف المفتشين التابعين لها.</p>}
                {form.orgUnitId && !filteredEmployees.length && <p style={{ margin: 0, color: '#78909c', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>لا يوجد موظفين مسجلين حالياً لهذه الإدارة.</p>}
                {form.orgUnitId && filteredEmployees.length > 0 && selectedEmployees.length === 0 && (
                  <p style={{ margin: 0, color: '#78909c', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>💡 اختر موظفاً من القائمة المنسدلة بالأعلى واضغط على زر "إضافة للفريق" لتشكيل الفريق الجاري.</p>
                )}

                {selectedEmployees.map((employee, index) => (
                  <div 
                    key={employee.id} 
                    style={{
                      background: 'white',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.01)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: index === 0 ? 'var(--brand)' : '#eef6f6',
                        color: index === 0 ? 'white' : 'var(--brand)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {index === 0 ? 'رئيس' : 'عضو'}
                      </div>
                      <div>
                        <strong style={{ fontSize: '13.5px', color: '#102027', display: 'block' }}>{employee.full_name}</strong>
                        <small style={{ fontSize: '11px', color: '#78909c' }}>{employee.job_title ?? `مفتش إداري`}</small>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeEmployee(employee.id)}
                      style={{
                        background: '#fff2f1',
                        border: '1px solid #ffcdd2',
                        borderRadius: '6px',
                        color: '#c62828',
                        fontSize: '11.5px',
                        padding: '4px 10px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        transition: 'all 0.15s'
                      }}
                    >
                      إزالة
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= STEP 3: DESTINATION & PURPOSE ================= */}
        {step === 3 && (
          <div style={{ display: 'grid', gap: '18px', animation: 'fadeIn 0.2s' }}>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #e0f0f0', paddingBottom: '10px' }}>
              الخطوة 3: تحديد الوجهة الطبية المستهدفة وتكليف الزيارة
            </h3>

            {/* Destination Type segmented */}
            <div style={{
              background: '#eef5f5',
              border: '1px solid #cfdcde',
              borderRadius: '8px',
              display: 'inline-grid',
              gap: '4px',
              gridTemplateColumns: 'repeat(2, 1fr)',
              padding: '4px',
              width: 'min(100%, 360px)'
            }}>
              <button 
                type="button"
                className={form.destinationType === 'governorate' ? styles.active : ''} 
                onClick={() => update('destinationType', 'governorate')}
                style={{ border: 0, borderRadius: '6px', cursor: 'pointer', minHeight: '36px', background: form.destinationType === 'governorate' ? 'white' : 'transparent', color: form.destinationType === 'governorate' ? '#006d77' : '#546e7a', fontWeight: 'bold', fontSize: '12.5px' }}
              >
                المحافظة بأكملها
              </button>
              <button 
                type="button"
                className={form.destinationType === 'facility' ? styles.active : ''} 
                onClick={() => update('destinationType', 'facility')}
                style={{ border: 0, borderRadius: '6px', cursor: 'pointer', minHeight: '36px', background: form.destinationType === 'facility' ? 'white' : 'transparent', color: form.destinationType === 'facility' ? '#006d77' : '#546e7a', fontWeight: 'bold', fontSize: '12.5px' }}
              >
                منشأة طبية داخل المحافظة
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {/* Target Governorate */}
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                المحافظة المستهدفة بالزيارة *
                <select 
                  value={form.targetGovernorateId} 
                  onChange={(event) => update('targetGovernorateId', event.target.value)} 
                  required
                  style={{
                    minHeight: '44px',
                    borderRadius: '8px',
                    border: form.targetGovernorateId ? '1px solid #cfdcde' : '2px solid #ffb74d',
                    padding: '0 10px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none'
                  }}
                >
                  <option value="">اختر المحافظة</option>
                  {governorates.map((gov) => (
                    <option key={gov.id} value={gov.id}>{gov.name}</option>
                  ))}
                </select>
              </label>

              {/* Target Facility - Searchable select fuzzy search */}
              {form.destinationType === 'facility' && (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>المنشأة الطبية المستهدفة *</span>
                  {!form.targetGovernorateId ? (
                    <div style={{ minHeight: '44px', borderRadius: '8px', border: '1px solid #cfdcde', background: '#eceff1', color: '#78909c', fontSize: '12.5px', display: 'flex', alignItems: 'center', padding: '0 12px' }}>
                      ⚠️ يرجى تحديد المحافظة الجغرافية أولاً لعرض مستشفياتها.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '8px', position: 'relative' }}>
                      {/* Search box input */}
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="🔍 اكتب للبحث في مستشفيات المحافظة (مثال: ناصر، السلام)..."
                          value={facilitySearch}
                          onChange={(e) => setFacilitySearch(e.target.value)}
                          style={{
                            width: '100%',
                            minHeight: '44px',
                            border: (form.targetFacilityIds && form.targetFacilityIds.length > 0) ? '1px solid #cfdcde' : '2px solid #ffb74d',
                            borderRadius: '8px',
                            padding: '0 12px',
                            fontSize: '13px',
                            outline: 'none',
                            background: 'white'
                          }}
                        />
                        {form.targetFacilityIds && form.targetFacilityIds.length > 0 && (
                          <span style={{ position: 'absolute', left: '12px', top: '13px', color: '#2e7d32', fontSize: '11px', background: '#e8f5e9', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                            ✓ تم اختيار {form.targetFacilityIds.length} منشأة
                          </span>
                        )}
                      </div>

                      {/* Selected facilities list with capsule pills */}
                      {form.targetFacilityIds && form.targetFacilityIds.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                          {selectedFacilities.map((fac) => (
                            <span
                              key={fac.id}
                              style={{
                                background: '#eef6f6',
                                border: '1px solid #b2dfdb',
                                color: 'var(--brand)',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px'
                              }}
                            >
                              {fac.name}
                              <X
                                size={14}
                                style={{ cursor: 'pointer', color: '#00796b' }}
                                onClick={() => {
                                  const nextIds = form.targetFacilityIds.filter(id => id !== fac.id);
                                  setForm(prev => ({
                                    ...prev,
                                    targetFacilityIds: nextIds,
                                    targetFacilityId: nextIds[0] || ''
                                  }));
                                }}
                              />
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Filtered suggestions list */}
                      <div style={{
                        background: 'white',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        maxHeight: '160px',
                        overflowY: 'auto',
                        display: 'grid',
                        alignContent: 'start',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
                      }}>
                        {filteredFacilities.map((facility) => {
                          const isSelected = form.targetFacilityIds?.includes(facility.id) ?? false
                          return (
                            <div
                              key={facility.id}
                              onClick={() => {
                                const currentIds = form.targetFacilityIds || []
                                const nextIds = currentIds.includes(facility.id)
                                  ? currentIds.filter(id => id !== facility.id)
                                  : [...currentIds, facility.id]
                                
                                setForm(prev => ({
                                  ...prev,
                                  targetFacilityIds: nextIds,
                                  targetFacilityId: nextIds[0] || ''
                                }))
                              }}
                              style={{
                                padding: '10px 14px',
                                fontSize: '12.5px',
                                color: isSelected ? 'var(--brand)' : '#37474f',
                                background: isSelected ? '#f0fcf9' : 'white',
                                borderBottom: '1px solid #f1f7f7',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.1s'
                              }}
                            >
                              <div>
                                <strong>{facility.name}</strong>
                                <small style={{ display: 'block', color: '#78909c', fontSize: '11px', marginTop: '2px' }}>{facility.facility_type} | {facility.address}</small>
                              </div>
                              {isSelected && <Check size={14} style={{ color: 'var(--brand)' }} />}
                            </div>
                          )
                        })}
                        {filteredFacilities.length === 0 && (
                          <div style={{ padding: '12px', textAlign: 'center', color: '#78909c', fontSize: '12.5px' }}>
                            لا توجد منشآت مطابقة للبحث داخل هذه المحافظة.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Visit Purpose */}
            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                الغرض التفصيلي والتوجيه الرقابي للزيارة *
                <textarea
                  value={form.visitPurpose}
                  onChange={(event) => update('visitPurpose', event.target.value)}
                  required
                  rows={3}
                  placeholder="اكتب الأهداف والبنود المطلوب فحصها بالتفصيل (مثل: مراجعة غرف رعاية الأطفال، التأكد من شروط الوقاية وحصر عهد الأدوية الطارئة)..."
                  style={{
                    borderRadius: '8px',
                    border: form.visitPurpose.trim() ? '1px solid #cfdcde' : '2px solid #ffb74d',
                    padding: '10px 12px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </label>

              {/* Quick Drafting Helper for Purpose */}
              <div style={{ display: 'grid', gap: '4px', background: '#f8fdfd', border: '1px solid #e0f0f0', borderRadius: '8px', padding: '8px 12px' }}>
                <span style={{ fontSize: '11px', color: '#00796b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  💡 كبسولات التوجيه السريعة (اضغط للكتابة التلقائية):
                </span>
                
                {/* Category selector */}
                <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', margin: '4px 0' }}>
                  <button
                    type="button"
                    onClick={() => setActivePurposeCategory('general')}
                    style={{
                      background: activePurposeCategory === 'general' ? '#e0f2f1' : '#f5f5f5',
                      color: activePurposeCategory === 'general' ? 'var(--brand)' : '#546e7a',
                      border: '1px solid ' + (activePurposeCategory === 'general' ? '#80cbc4' : '#e0e0e0'),
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    📋 تفتيش فني وطبي
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePurposeCategory('infection')}
                    style={{
                      background: activePurposeCategory === 'infection' ? '#e0f2f1' : '#f5f5f5',
                      color: activePurposeCategory === 'infection' ? 'var(--brand)' : '#546e7a',
                      border: '1px solid ' + (activePurposeCategory === 'infection' ? '#80cbc4' : '#e0e0e0'),
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🦠 مكافحة عدوى
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePurposeCategory('pharmacy')}
                    style={{
                      background: activePurposeCategory === 'pharmacy' ? '#e0f2f1' : '#f5f5f5',
                      color: activePurposeCategory === 'pharmacy' ? 'var(--brand)' : '#546e7a',
                      border: '1px solid ' + (activePurposeCategory === 'pharmacy' ? '#80cbc4' : '#e0e0e0'),
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    💊 تموين وصيدليات
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePurposeCategory('maintenance')}
                    style={{
                      background: activePurposeCategory === 'maintenance' ? '#e0f2f1' : '#f5f5f5',
                      color: activePurposeCategory === 'maintenance' ? 'var(--brand)' : '#546e7a',
                      border: '1px solid ' + (activePurposeCategory === 'maintenance' ? '#80cbc4' : '#e0e0e0'),
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🔧 صيانة وتشغيل
                  </button>
                </div>

                {/* Templates list */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                  {PURPOSE_TEMPLATES[activePurposeCategory].map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      title={tmpl.text}
                      onClick={() => {
                        const currentText = form.visitPurpose.trim();
                        const separator = currentText ? ' ' : '';
                        update('visitPurpose', currentText + separator + tmpl.text);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px dashed #b2dfdb',
                        color: '#00796b',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'right',
                        transition: 'all 0.15s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      ✍️ {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                ملاحظات وتوجيهات التكليف الإضافية (اختياري)
                <textarea
                  value={form.notes}
                  onChange={(event) => update('notes', event.target.value)}
                  rows={2}
                  placeholder="أي ملاحظات أو بنود إدارية إضافية للفريق..."
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #cfdcde',
                    padding: '10px 12px',
                    fontSize: '13px',
                    background: 'white',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
              </label>

              {/* Notes quick suggestions */}
              <div style={{ display: 'grid', gap: '4px', background: '#fafafa', border: '1px solid #eeeeee', borderRadius: '8px', padding: '8px 12px' }}>
                <span style={{ fontSize: '11px', color: '#455a64', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  📝 توجيهات إدارية عامة (اضغط للإضافة):
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                  {NOTES_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      title={tmpl.text}
                      onClick={() => {
                        const currentText = form.notes.trim();
                        const separator = currentText ? ' ' : '';
                        update('notes', currentText + separator + tmpl.text);
                      }}
                      style={{
                        background: '#ffffff',
                        border: '1px dashed #cfdcde',
                        color: '#37474f',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textAlign: 'right',
                        transition: 'all 0.15s',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      📎 {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= STEPPER ACTIONS ================= */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTop: '1px solid #cfdcde',
          paddingTop: '18px',
          marginTop: '10px'
        }}>
          {/* Back button */}
          {step > 1 ? (
            <button
              type="button"
              onClick={handlePrevStep}
              style={{
                minHeight: '40px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                background: 'white',
                color: '#37474f',
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '0 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ChevronRight size={16} />
              الخطوة السابقة
            </button>
          ) : (
            <div />
          )}

          {/* Next or Submit Button */}
          {step < 3 ? (
            <button
              type="button"
              onClick={handleNextStep}
              style={{
                minHeight: '40px',
                borderRadius: '8px',
                background: 'var(--brand)',
                color: 'white',
                border: 0,
                fontSize: '13px',
                fontWeight: 'bold',
                padding: '0 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(0,109,119,0.2)'
              }}
            >
              الخطوة التالية
              <ChevronLeft size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={loading}
              style={{
                minHeight: '40px',
                borderRadius: '8px',
                background: '#16725a',
                color: 'white',
                border: 0,
                fontSize: '13.5px',
                fontWeight: 'bold',
                padding: '0 24px',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 8px rgba(22,114,90,0.25)'
              }}
            >
              {loading ? (
                <>
                  <div className={styles.spinner} style={{ borderColor: '#e0f0f1', borderTopColor: 'white', marginRight: 0 }} />
                  جاري تسجيل التكليف...
                </>
              ) : (
                '✓ إتمام وتكليف المأمورية الميدانية'
              )}
            </button>
          )}
        </div>
      </form>

      {/* C. PAST-DATE CONFIRMATION MODAL */}
      {pendingPastDate && (
        <div className={styles.modalBackdrop} style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: 'rgba(16, 32, 39, 0.4)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <section aria-modal="true" role="dialog" style={{
            background: 'white',
            borderRadius: '16px',
            border: '1px solid #ffccd2',
            padding: '24px',
            maxWidth: '440px',
            width: 'calc(100% - 32px)',
            display: 'grid',
            gap: '16px',
            textAlign: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: '#fff3e0',
              color: '#e65100',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              margin: '0 auto'
            }}>
              ⚠️
            </div>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#c62828', fontWeight: 'bold' }}>إقرار الجدولة بتاريخ سابق</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#546e7a', lineHeight: '1.5' }}>
              التاريخ المختار لبدء المأمورية هو تاريخ سابق لتاريخ اليوم. يلزم تأكيد الاستخدام للمسؤولية الإدارية والمحاسبة المالية.
            </p>
            <strong style={{ fontSize: '18px', color: '#e65100', fontFamily: 'monospace' }}>{pendingPastDate}</strong>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                onClick={cancelPastDate} 
                type="button"
                style={{ flex: 1, minHeight: '38px', borderRadius: '8px', border: '1px solid #cfdcde', background: 'white', color: '#37474f', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}
              >
                إلغاء وتعديل التاريخ
              </button>
              <button 
                onClick={confirmPastDate} 
                type="button"
                style={{ flex: 1, minHeight: '38px', borderRadius: '8px', border: 'none', background: '#e65100', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '12.5px' }}
              >
                تأكيد التاريخ والمتابعة
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
