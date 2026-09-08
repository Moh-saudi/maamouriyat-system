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
  Target,
  Info,
  X
} from 'lucide-react'
import styles from './new-mission.module.css'
import { SearchableAddableSelect } from '@/app/system-ui'
import { formatFacilityType } from '@/lib/facility-types'

type Employee = {
  id: string
  full_name: string
  job_title: string | null
  org_level?: number
  organization_id?: string | null
  org_unit_id?: string | null
  level?: number
  department?: string | null
  is_active?: boolean
}

type Facility = {
  id: string
  name: string
  facility_type: string
  governorate?: string
  health_admin?: string
  village_city?: string | null
  organization_id?: string | null
  sector_id?: string | null
  governorate_id?: string | null
  address?: string
  latitude?: number
  longitude?: number
}

type Governorate = {
  id: string
  name: string
  region?: string | null
}

export type MissionOption = {
  employees: Employee[]
  facilities: Facility[]
  governorates: Governorate[]
  organizations?: any[]
  templates?: any[]
  orgUnits?: any[]
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
    { label: 'مرور مفاجئ وانضباط', text: 'مرور ميداني مفاجئ لمتابعة الانضباط وتواجد الأطقم الطبية والإدارية، وتقييم جودة تقديم الخدمات للمواطنين.' },
    { label: 'متابعة سير العمل والخدمات', text: 'متابعة انتظام تقديم الخدمات الصحية للمنتفعين، ورصد الاحتياجات والمعوقات الميدانية وسرعة تلافيها.' },
    { label: 'مؤشرات الأداء والتردد', text: 'متابعة معدلات التردد اليومي للمواطنين، ومراجعة سجلات الكشف الطبي والخدمات المقدمة.' }
  ],
  primary_care: [
    { label: 'طب الأسرة والمبادرات', text: 'متابعة انتظام خدمات طب الأسرة والمبادرات الرئاسية الصحية والتسجيل الإلكتروني للملفات العائلية.' },
    { label: 'التطعيمات وصحة الأم والطفل', text: 'متابعة جلسات التطعيمات الروتينية للأطفال، وخدمات رعاية الحوامل ومتابعة النمو لحديثي الولادة.' },
    { label: 'مكاتب الصحة والخدمات الوقائية', text: 'متابعة تسجيل المواليد والوفيات، وتوافر السجلات الدفترية ومطابقتها مع الأنظمة الإلكترونية المعتمدة.' }
  ],
  pharmacy: [
    { label: 'الأدوية والمستلزمات الأساسية', text: 'فحص توافر الأدوية والمستلزمات الأساسية، وحصر أي نواقص مع توفير البدائل العلاجية المعتمدة.' },
    { label: 'سلسلة التبريد للطعوم والأمصال', text: 'متابعة كفاءة سلسلة التبريد وثلاجات حفظ الطعوم والأمصال وتسجيل درجات الحرارة مرتين يومياً.' },
    { label: 'جرد العهد ومطابقة الأرصدة', text: 'مطابقة الأرصدة الفعلية بصيدليات ومخازن المنشأة مع السجلات الدفترية ومنظومة الصرف.' }
  ],
  infection: [
    { label: 'معايير مكافحة العدوى والتعقيم', text: 'متابعة الالتزام بمعايير مكافحة العدوى والتطهير اليومي، والتخلص الآمن والمنضبط من النفايات الطبية الخطرة.' },
    { label: 'السلامة والصحة المهنية', text: 'معاينة النظافة العامة والبيئة الصحية للمنشأة وتوافر مهمات الوقاية الشخصية للأطقم العاملة.' }
  ]
}

const NOTES_TEMPLATES = [
  { label: 'التوثيق بالـ GPS', text: 'يرجى توثيق الزيارة بموقع المنشأة بالـ GPS وإعداد التقرير الميداني فور انتهاء المرور وبحد أقصى ٢٤ ساعة.' },
  { label: 'مطابقة دفاتر الحضور', text: 'مراجعة الالتزام بجداول ونوبتجيات العمل ومطابقة الحضور الفعلي للأطقم الطبية والإدارية بالدفاتر المعتمدة.' },
  { label: 'استبيان رضا المواطنين', text: 'الاستماع للمواطنين والمنتفعين واستطلاع آرائهم حول جودة الخدمة المقدمة والتعامل الفوري مع أي ملاحظات.' },
  { label: 'إخطار الإدارة المشرفة', text: 'يُرجى إخطار الإدارة والقيادات المشرفة فوراً برصد أي معوقات أو ملاحظات حرجة لسرعة اتخاذ اللازم.' }
]

type StoredMission = {
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

function checkEmployeeMatchesTarget(t: any, emp: Employee): boolean {
  if (!t || !emp) return false

  // 1. Direct ID match
  if (t.assigned_user_id && (t.assigned_user_id === emp.id || t.assigned_user_id === (emp as any).auth_id)) {
    return true
  }

  // 2. Name matching on assigned_user_name, scope_name, or title
  const empName = (emp.full_name || '').trim().toLowerCase()
  if (!empName) return false

  const cleanEmp = empName.replace(/^(د\.|دكتور|أ\.|أستاذ|م\.|مهندس)\s*/g, '').trim()

  if (t.assigned_user_name) {
    const tName = t.assigned_user_name.trim().toLowerCase()
    const cleanT = tName.replace(/^(د\.|دكتور|أ\.|أستاذ|م\.|مهندس)\s*/g, '').trim()
    if (tName === empName || (cleanEmp && cleanT && (cleanEmp.includes(cleanT) || cleanT.includes(cleanEmp)))) {
      return true
    }
  }

  if (t.scope_name) {
    const sName = t.scope_name.trim().toLowerCase()
    const cleanS = sName.replace(/^(د\.|دكتور|أ\.|أستاذ|م\.|مهندس)\s*/g, '').trim()
    if (sName === empName || (cleanEmp && cleanS && (cleanEmp.includes(cleanS) || cleanS.includes(cleanEmp)))) {
      return true
    }
  }

  if (t.title) {
    const title = t.title.toLowerCase()
    const parts = cleanEmp.split(' ').filter(p => p.length >= 3)
    if (parts.length >= 2) {
      if (title.includes(`${parts[0]} ${parts[1]}`)) return true
    } else if (parts.length === 1) {
      if (title.includes(parts[0])) return true
    }
  }

  return false
}

export function MissionCreateForm({
  currentUserId,
  userOrgLevel = 1,
  userSectorId = null,
  userOrgId = null,
  userGovernorate = '',
  employees,
  facilities,
  governorates,
  organizations = [],
  templates = [],
  orgUnits = [],
  facilityVisitStats,
  initialTargets = [],
}: {
  currentUserId: string
  userOrgLevel?: number
  userSectorId?: string | null
  userOrgId?: string | null
  userGovernorate?: string
  employees: Employee[]
  facilities: Facility[]
  governorates: Governorate[]
  organizations?: any[]
  templates?: any[]
  orgUnits?: any[]
  facilityVisitStats?: Record<string, { visited: boolean; count: number }>
  initialTargets?: any[]
}) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  
  const initialOrgs = (organizations && organizations.length > 0) ? organizations : (orgUnits || [])
  const [localOrgUnits, setLocalOrgUnits] = useState(initialOrgs)
  const [localGovernorates, setLocalGovernorates] = useState(governorates)

  // Stepper State
  const [step, setStep] = useState<1 | 2 | 3>(1)
  
  // Form States
  const [form, setForm] = useState<FormState>(initialState)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [pendingPastDate, setPendingPastDate] = useState('')
  
  // Search state for searchable select
  const [facilitySearch, setFacilitySearch] = useState('')
  
  // Active template category for rapid purpose writing
  const [activePurposeCategory, setActivePurposeCategory] = useState<'general' | 'primary_care' | 'pharmacy' | 'infection'>('general')
  
  // Validation feedback
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Auto-select governorate for Directorate level (Level 5)
  useEffect(() => {
    if (userGovernorate && governorates.length > 0) {
      const matched = governorates.find(g => g.name === userGovernorate || (g as any).id === userGovernorate)
      if (matched) {
        setForm(prev => ({
          ...prev,
          targetGovernorateId: matched.id
        }))
      }
    }
  }, [userGovernorate, governorates])

  // Sync state if props load asynchronously
  useEffect(() => {
    if (organizations && organizations.length > 0) {
      setLocalOrgUnits(organizations)
    } else if (orgUnits && orgUnits.length > 0) {
      setLocalOrgUnits(orgUnits)
    }
  }, [organizations, orgUnits])

  useEffect(() => {
    if (governorates && governorates.length > 0) {
      setLocalGovernorates(governorates)
    }
  }, [governorates])

  // Auto-preselect user's organization if not already set
  useEffect(() => {
    if (userOrgId && !form.orgUnitId) {
      update('orgUnitId', userOrgId)
      const selectedOrg = localOrgUnits.find(u => u.id === userOrgId)
      if (selectedOrg?.governorate) {
        const matchedGov = localGovernorates.find(
          g => g.name.trim().toLowerCase() === selectedOrg.governorate?.trim().toLowerCase() ||
               (g as any).id === selectedOrg.governorate
        )
        if (matchedGov) {
          update('targetGovernorateId', matchedGov.id)
        }
      }
    }
  }, [userOrgId, localOrgUnits, localGovernorates])

  // Load active targets to link target facilities with the mission
  const [missionTargets, setMissionTargets] = useState<any[]>(initialTargets || [])

  useEffect(() => {
    fetch('/api/admin/mission-targets?for_mission=true')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.targets && data.targets.length > 0) setMissionTargets(data.targets)
      })
      .catch(err => console.error('Failed to load targets in mission form:', err))
  }, [])

  // Hierarchical scoping: user only sees their organization and units subordinate to them
  const hierarchicalOrgUnits = useMemo(() => {
    return localOrgUnits.filter(unit => {
      // 1. Level 1: superadmin sees all units
      if (userOrgLevel <= 1) return true

      // Users cannot assign on behalf of higher levels unless it is their exact organization
      if (unit.level < userOrgLevel && unit.id !== userOrgId) return false

      // 2. Level 2, 3, 4: Sector / General Administration level
      if (userOrgLevel >= 2 && userOrgLevel <= 4) {
        if (userOrgId && unit.id === userOrgId) return true
        if (userSectorId) {
          return unit.sector_id === userSectorId
        }
        return true
      }

      // 3. Level 5: Directorate level (مديرية الشئون الصحية)
      if (userOrgLevel === 5) {
        if (userOrgId && unit.id === userOrgId) return true
        const matchesGov = Boolean(
          userGovernorate && (
            (unit.governorate && unit.governorate.trim().toLowerCase() === userGovernorate.trim().toLowerCase()) ||
            unit.name.includes(userGovernorate)
          )
        )
        return matchesGov && unit.level >= 5
      }

      // 4. Level 6: Health Admin level (إدارة صحية)
      if (userOrgLevel === 6) {
        if (userOrgId && unit.id === userOrgId) return true
        return unit.id === userOrgId
      }

      return unit.id === userOrgId || unit.level >= userOrgLevel
    })
  }, [localOrgUnits, userOrgLevel, userSectorId, userOrgId, userGovernorate])

  const handleOrgUnitChange = (val: string) => {
    update('orgUnitId', val)
    const selectedOrg = localOrgUnits.find(u => u.id === val)
    if (selectedOrg?.governorate) {
      const matchedGov = localGovernorates.find(
        g => g.name.trim().toLowerCase() === selectedOrg.governorate?.trim().toLowerCase() ||
             (g as any).id === selectedOrg.governorate
      )
      if (matchedGov) {
        update('targetGovernorateId', matchedGov.id)
      }
    }
  }

  // Selected team employees from Step 2
  const selectedTeamEmployees = useMemo(() => {
    return employees.filter(e => form.assignedUserIds.includes(e.id))
  }, [employees, form.assignedUserIds])

  // Effective users to match: If team is chosen in Step 2, match STRICTLY the chosen team members!
  // If no team is chosen in Step 2 yet, fallback to current logged-in user.
  const targetEmployees = useMemo(() => {
    if (selectedTeamEmployees.length > 0) return selectedTeamEmployees
    if (currentUserId) {
      const me = employees.find(e => e.id === currentUserId)
      if (me) return [me]
      return [{ id: currentUserId, full_name: '' } as Employee]
    }
    return []
  }, [selectedTeamEmployees, currentUserId, employees])

  // Targeted facilities available for the period and inspector/creator
  const availableTargetFacilities = useMemo(() => {
    if (!missionTargets.length || !targetEmployees.length) return []

    const dateToMatch = form.scheduledDate || ''
    const endToMatch = form.expectedEndDate || dateToMatch

    // Filter targets that STRICTLY belong to any of the targetEmployees
    const matchedTargets = missionTargets.filter(t => {
      // Must have target facilities
      if (!t.target_facilities || !t.target_facilities.length) return false
      return targetEmployees.some(emp => checkEmployeeMatchesTarget(t, emp))
    })

    // NO FALLBACK TO UNRELATED TARGETS!
    if (!matchedTargets.length) return []

    // Filter by dates if scheduledDate is entered
    let activeTargets = matchedTargets
    if (dateToMatch) {
      const dateFiltered = matchedTargets.filter(t => {
        if (t.start_date && t.end_date) {
          return !(t.end_date < dateToMatch || (endToMatch && t.start_date > endToMatch))
        }
        return true
      })
      if (dateFiltered.length > 0) {
        activeTargets = dateFiltered
      }
    }

    // Collect deduplicated facilities
    const facMap = new Map<string, {
      id: string
      name: string
      facility_type?: string
      governorate?: string
      health_admin?: string
      is_visited?: boolean
      target_title?: string
    }>()

    activeTargets.forEach(t => {
      const facs = (t.target_facilities || []) as Array<{
        id: string
        name: string
        facility_type?: string
        governorate?: string
        health_admin?: string
        is_visited?: boolean
      }>
      facs.forEach(f => {
        if (f && f.id && !facMap.has(f.id)) {
          facMap.set(f.id, {
            ...f,
            target_title: t.title || t.period_label
          })
        }
      })
    })

    return Array.from(facMap.values())
  }, [missionTargets, targetEmployees, form.scheduledDate, form.expectedEndDate])

  const targetedFacilitiesForEmployee = availableTargetFacilities

  const toggleTargetFacility = (tf: { id: string; name: string; governorate?: string; facility_type?: string; health_admin?: string }) => {
    const currentIds = form.targetFacilityIds || []
    const isAdded = currentIds.includes(tf.id)
    const nextIds = isAdded ? currentIds.filter(id => id !== tf.id) : [...currentIds, tf.id]

    setForm(prev => {
      const next: FormState = {
        ...prev,
        destinationType: 'facility',
        targetFacilityIds: nextIds,
        targetFacilityId: nextIds[0] || ''
      }
      if (tf.governorate) {
        const matchedGov = localGovernorates.find(
          g => g.name.trim().toLowerCase() === tf.governorate?.trim().toLowerCase() ||
               (g as any).id === tf.governorate
        )
        if (matchedGov) {
          next.targetGovernorateId = matchedGov.id
        }
      }
      return next
    })
  }

  const addAllPendingTargets = () => {
    const currentIds = new Set(form.targetFacilityIds || [])
    availableTargetFacilities.forEach(tf => {
      currentIds.add(tf.id)
    })
    const nextIds = Array.from(currentIds)
    setForm(prev => {
      const next: FormState = {
        ...prev,
        destinationType: 'facility',
        targetFacilityIds: nextIds,
        targetFacilityId: nextIds[0] || ''
      }
      const firstGov = availableTargetFacilities.find(tf => tf.governorate)?.governorate
      if (firstGov) {
        const matchedGov = localGovernorates.find(
          g => g.name.trim().toLowerCase() === firstGov.trim().toLowerCase() ||
               (g as any).id === firstGov
        )
        if (matchedGov) {
          next.targetGovernorateId = matchedGov.id
        }
      }
      return next
    })
  }

  const handleAddOrgUnit = (newName: string) => {
    const newId = `new-unit-${Date.now()}`
    const newUnit = { id: newId, code: `NEW-${Date.now()}`, name: newName, unit_type: 'قسم', parent_id: null, level: 1 }
    setLocalOrgUnits(prev => [newUnit, ...prev])
    update('orgUnitId', newId)
  }

  const handleAddGovernorate = (newName: string) => {
    const newId = `new-gov-${Date.now()}`
    const newGov = { id: newId, name: newName, region: null }
    setLocalGovernorates(prev => [newGov, ...prev])
    update('targetGovernorateId', newId)
  }

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
        if (matched.governorate) {
          const matchedGov = localGovernorates.find(g => g.name === matched.governorate)
          if (matchedGov) {
            setForm((prev) => ({
              ...prev,
              targetGovernorateId: matchedGov.id
            }))
          }
        }
      }
    }
  }, [orgUnits, localGovernorates])

  const today = todayString()
  const isPastDate = Boolean(form.scheduledDate && form.scheduledDate < today)
  const duration = missionDuration(form.scheduledDate, form.expectedEndDate)

  // Load existing busy inspectors from live database to check conflicts
  const [busyInspectors, setBusyInspectors] = useState<string[]>([])

  useEffect(() => {
    if (!supabase || !form.scheduledDate) return
    
    const fetchBusyInspectors = async () => {
      try {
        const { data } = await supabase
          .from('missions')
          .select('id, assigned_user_id')
          .eq('scheduled_date', form.scheduledDate)
          .neq('status', 'cancelled')

        if (data) {
          const userIds: string[] = []
          data.forEach((m: any) => {
            if (m.assigned_user_id) userIds.push(m.assigned_user_id)
          })
          setBusyInspectors(userIds)
        }
      } catch (err) {
        console.error('Error checking busy inspectors:', err)
      }
    }
    fetchBusyInspectors()
  }, [supabase, form.scheduledDate])

  const selectedEmployees = useMemo(
    () => employees.filter((employee) => form.assignedUserIds.includes(employee.id)),
    [employees, form.assignedUserIds],
  )

  const filteredEmployees = useMemo(() => {
    if (!form.orgUnitId) return employees
    const exact = employees.filter((employee) => 
      employee.organization_id === form.orgUnitId ||
      employee.org_unit_id === form.orgUnitId
    )
    if (exact.length) return exact

    const unit = localOrgUnits.find((item) => item.id === form.orgUnitId)
    const deptMatches = employees.filter((employee) => employee.department === unit?.name)
    if (deptMatches.length) return deptMatches

    return employees
  }, [employees, form.orgUnitId, localOrgUnits])

  const employeeOptions = filteredEmployees.filter((employee) => !form.assignedUserIds.includes(employee.id))

  const filteredFacilities = useMemo(() => {
    let base = facilities
    const org = organizations.find(o => o.id === form.orgUnitId)

    // 1. If targetGovernorateId is selected
    if (form.targetGovernorateId) {
      const govObj = governorates.find(g => g.id === form.targetGovernorateId || g.name === form.targetGovernorateId)
      const govName = (govObj?.name || form.targetGovernorateId).trim().toLowerCase()
      base = base.filter(f => {
        const fGov = (f.governorate || '').trim().toLowerCase()
        return fGov === govName || f.governorate_id === form.targetGovernorateId || f.organization_id === form.targetGovernorateId
      })
      // If the selected org unit has a specific health_admin, filter by it too!
      if (org?.health_admin) {
        const admName = org.health_admin.trim().toLowerCase()
        base = base.filter(f => (f.health_admin || '').trim().toLowerCase() === admName)
      }
    } else if (org) {
      // If no governorate explicitly chosen yet, use orgUnit's governorate or health_admin
      if (org.health_admin) {
        const admName = org.health_admin.trim().toLowerCase()
        base = base.filter(f => (f.health_admin || '').trim().toLowerCase() === admName)
      } else if (org.governorate) {
        const govName = org.governorate.trim().toLowerCase()
        base = base.filter(f => (f.governorate || '').trim().toLowerCase() === govName)
      }
    }

    // 2. Search query filter (matches name, village_city, health_admin, or type)
    const q = facilitySearch.trim().toLowerCase()
    if (q) {
      base = base.filter(f =>
        f.name.toLowerCase().includes(q) ||
        (f.village_city || '').toLowerCase().includes(q) ||
        (f.health_admin || '').toLowerCase().includes(q) ||
        (f.facility_type || '').toLowerCase().includes(q)
      )
    }

    return base
  }, [facilities, form.targetGovernorateId, form.orgUnitId, governorates, organizations, facilitySearch])

  const selectedFacility = useMemo(
    () => facilities.find((facility) => facility.id === form.targetFacilityId),
    [facilities, form.targetFacilityId],
  )
  const selectedFacilities = useMemo(() => {
    const ids = form.targetFacilityIds || []
    return ids.map(id => {
      const fac = facilities.find(f => f.id === id)
      if (fac) return fac
      const targetFac = availableTargetFacilities.find(t => t.id === id)
      if (targetFac) {
        return {
          id: targetFac.id,
          name: targetFac.name,
          governorate: targetFac.governorate,
          health_admin: targetFac.health_admin,
          facility_type: targetFac.facility_type,
          village_city: null,
          latitude: null,
          longitude: null,
          organization_id: null,
          sector_id: null
        } as any
      }
      return { id, name: id } as any
    })
  }, [facilities, form.targetFacilityIds, availableTargetFacilities])
  const selectedGovernorate = useMemo(
    () => governorates.find((governorate) => governorate.id === form.targetGovernorateId || governorate.name === form.targetGovernorateId),
    [governorates, form.targetGovernorateId],
  )
  const selectedOrgUnit = useMemo(
    () => organizations.find((unit) => unit.id === form.orgUnitId) || orgUnits.find((unit) => unit.id === form.orgUnitId),
    [form.orgUnitId, organizations, orgUnits],
  )

  // Inspector Overload Warning Diagnostician
  const busyInspectorWarning = useMemo(() => {
    if (!selectedEmployeeId || !form.scheduledDate) return ''
    const emp = employees.find(e => e.id === selectedEmployeeId)
    if (!emp) return ''

    const isBusy = busyInspectors.includes(selectedEmployeeId)

    if (isBusy) {
      return `⚠️ تنبيه هام: الموظف ${emp.full_name} لديه مأمورية تفتيشية نشطة أخرى مجدولة بالفعل في تاريخ ${form.scheduledDate}! يمكنك إضافته ولكن يرجى التحقق الجغرافي لتفادي تعارض التكاليف.`
    }
    return ''
  }, [selectedEmployeeId, form.scheduledDate, busyInspectors, employees])

  // Inactive Inspector Warning Checker
  const inactiveInspectorWarning = useMemo(() => {
    if (!selectedEmployeeId) return ''
    const emp = employees.find(e => e.id === selectedEmployeeId)
    if (!emp) return ''
    if (emp.is_active === false) {
      return `❌ تنبيه أمني: حساب المفتش (${emp.full_name}) موقف حالياً أو غير نشط في المنظومة. لا يمكن إسناد أي مأموريات تفتيشية له حتى يتم تفعيله من قبل شؤون العاملين.`
    }
    return ''
  }, [selectedEmployeeId, employees])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === 'orgUnitId') {
        next.assignedUserIds = []
        setSelectedEmployeeId('')
        // Auto-resolve governorate if selected organization has governorate
        const org = organizations.find(o => o.id === value)
        if (org?.governorate) {
          const matchedGov = governorates.find(g => g.name === org.governorate || g.id === org.id)
          if (matchedGov) {
            next.targetGovernorateId = matchedGov.id
          }
        }
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
    const emp = employees.find(e => e.id === selectedEmployeeId)
    if (emp && emp.is_active === false) {
      setError(`❌ عذراً، لا يمكن إضافة المفتش (${emp.full_name}) لفريق المأمورية لأن حسابه موقف حالياً أو غير نشط بقرار إداري.`)
      return
    }
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
    
    const count = form.destinationType === 'facility' ? Math.max(1, selectedFacs.length) : 1;
    let successCount = 0;
    let lastSerial = '';

    const defaultOrgId = '00000000-0000-0000-0000-000000000001';
    const defaultSectorId = '00000000-0000-0000-0000-000000000010';
    const defaultTemplateId = templates[0]?.id || '00000000-0000-0000-0000-000000001000';

    for (let i = 0; i < count; i++) {
      const fac = form.destinationType === 'facility' ? selectedFacs[i] : null;
      let targetFacId = fac?.id || form.targetFacilityId || null;

      // If governorate-wide inspection, resolve representative facility if needed
      if (!targetFacId) {
        const govFac = facilities.find(f => 
          (form.targetGovernorateId && (f.governorate_id === form.targetGovernorateId || f.governorate === selectedGovernorate?.name))
        );
        targetFacId = govFac?.id || facilities[0]?.id || '00000000-0000-0000-0000-000000001000';
      }

      // Generate real sequential serial number
      const { data: serialData, error: serialError } = await supabase.rpc('generate_serial_number', {
        dept_code: 'MIS',
      })

      const finalSerial = serialData || `MIS-${Date.now()}-${i + 1}`;
      lastSerial = finalSerial;

      const missionNoteParts = [
        form.notes.trim(),
        teamSummary ? `فريق المأمورية: ${teamSummary}` : '',
        `تاريخ الانتهاء المتوقع: ${form.expectedEndDate}`,
        duration ? `مدة المأمورية: ${duration.days} يوم / ${duration.nights} ليلة` : '',
        `مبيت: ${form.requiresOvernight ? 'نعم' : 'لا'}`,
        `حجز فندق: ${form.requiresHotelBooking ? 'نعم' : 'لا'}`,
        isPastDate && form.allowPastDate ? 'تم تأكيد المأمورية بتاريخ سابق.' : '',
      ].filter(Boolean);

      const resolvedInspectorOrg = selectedEmployees[0]?.organization_id || userOrgId || defaultOrgId;
      const resolvedCreatedByOrg = userOrgId || defaultOrgId;
      const resolvedSectorId = fac?.sector_id || userSectorId || defaultSectorId;

      const payload: any = {
        serial_number: finalSerial,
        facility_id: targetFacId,
        target_facility_id: targetFacId,
        target_governorate_id: form.targetGovernorateId || null,
        template_id: defaultTemplateId,
        sector_id: resolvedSectorId,
        primary_inspector_id: form.assignedUserIds[0] || currentUserId,
        assigned_user_id: form.assignedUserIds[0] || currentUserId,
        inspector_org_id: resolvedInspectorOrg,
        inspector_level: selectedEmployees[0]?.org_level ?? selectedEmployees[0]?.level ?? 7,
        created_by: currentUserId,
        created_by_org: resolvedCreatedByOrg,
        scheduled_date: form.scheduledDate,
        expected_end_date: form.expectedEndDate || form.scheduledDate,
        visit_purpose: form.visitPurpose.trim() || 'تفتيش دوري محوكم',
        priority: form.priority || 'normal',
        requires_overnight: form.requiresOvernight || false,
        requires_hotel_booking: form.requiresHotelBooking || false,
        expected_duration_days: duration?.days ?? 1,
        expected_nights: duration?.nights ?? 0,
        notes: missionNoteParts.join('\n') || null,
        status: 'approved',
        destination_type: form.destinationType || 'facility',
      }

      let missionData = null
      let insertError = null

      const firstTry = await supabase.from('missions').insert(payload).select('id').single()
      missionData = firstTry.data
      insertError = firstTry.error

      if (insertError) {
        console.error('Mission insert error details:', insertError)
        setLoading(false)
        setError(`خطأ أثناء إدراج المأمورية ${i + 1}: ${insertError.message}`)
        return
      }

      // Insert team members into mission_team and mission_assignees
      if (missionData?.id && form.assignedUserIds.length) {
        await supabase.from('mission_team').insert(
          form.assignedUserIds.map((userId, index) => ({
            is_primary: index === 0,
            mission_id: missionData.id,
            user_id: userId,
          }))
        )

        await supabase.from('notifications').insert(
          form.assignedUserIds.map((userId) => ({
            body: `تم تكليفك بمأمورية حوكمة وتفتيش جديدة رقم ${serialData} بتاريخ ${form.scheduledDate}. يرجى تأكيد حضورك وموقعك بالـ GPS فور بدء الزيارة.`,
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
                الإدارة المحوكمة المختصة بالتكليف *
                <SearchableAddableSelect
                  options={hierarchicalOrgUnits.map((unit) => {
                    let badge = ''
                    if (unit.level === 1) badge = '🏛️ '
                    else if (unit.level === 2) badge = '🏢 '
                    else if (unit.level === 5) badge = '📍 '
                    else if (unit.level === 6) badge = '🏥 '
                    
                    const govText = unit.governorate && unit.level === 6 ? ` (${unit.governorate})` : ''
                    return {
                      value: unit.id,
                      label: `${badge}${unit.name}${govText}`
                    }
                  })}
                  value={form.orgUnitId}
                  onChange={handleOrgUnitChange}
                  placeholder="اختر أو ابحث عن الإدارة أو القطاع..."
                  onAdd={handleAddOrgUnit}
                />
                {selectedOrgUnit?.governorate && (
                  <span style={{ fontSize: '11.5px', color: '#006d77', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    🔗 مرتبطة بمحافظة {selectedOrgUnit.governorate} (ستربط تلقائياً بالوجهة في الخطوة 3)
                  </span>
                )}
              </label>

              {/* Priority */}
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                درجة أولوية المأمورية *
                <SearchableAddableSelect
                  options={[
                    { value: 'normal', label: 'عادية' },
                    { value: 'high', label: 'مرتفعة (متابعة خاصة)' },
                    { value: 'urgent', label: 'عاجلة جداً (قرار وزاري طارئ)' }
                  ]}
                  value={form.priority}
                  onChange={(val) => update('priority', val as FormState['priority'])}
                  placeholder="اختر درجة الأولوية..."
                />
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

            {/* Inactive Inspector Warning Alert */}
            {inactiveInspectorWarning && (
              <div style={{
                background: '#fff3f3',
                border: '1px solid #ffcdd2',
                borderRadius: '8px',
                color: '#c62828',
                padding: '12px',
                fontSize: '12.5px',
                lineHeight: '1.5',
                display: 'flex',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(198,40,40,0.04)'
              }}>
                <AlertTriangle size={18} style={{ flexShrink: 0 }} />
                <span>{inactiveInspectorWarning}</span>
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
                    <option key={employee.id} value={employee.id} style={{ color: employee.is_active === false ? '#c62828' : 'inherit', fontWeight: employee.is_active === false ? 'bold' : 'normal' }}>
                      {employee.full_name} {employee.is_active === false ? '🔴 (حساب موقوف / غير نشط)' : '🟢'} - {employee.job_title ?? employee.department ?? `مستوى ${employee.level}`}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                          <small style={{ fontSize: '11px', color: '#78909c' }}>{employee.job_title ?? `مفتش إداري`}</small>
                          {missionTargets.some(t => checkEmployeeMatchesTarget(t, employee)) && (
                            <span style={{
                              fontSize: '10.5px',
                              background: '#e0f2f1',
                              color: '#00796b',
                              padding: '1px 8px',
                              borderRadius: '10px',
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px'
                            }}>
                              🎯 لديه مستهدف شهري (سيتاح بالخطوة 3)
                            </span>
                          )}
                        </div>
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
                <SearchableAddableSelect
                  options={localGovernorates.map((gov) => ({
                    value: gov.id,
                    label: gov.name
                  }))}
                  value={form.targetGovernorateId}
                  onChange={(val) => update('targetGovernorateId', val)}
                  placeholder="اختر أو ابحث عن محافظة..."
                  onAdd={handleAddGovernorate}
                />
              </label>

            {/* Targeted Facilities Panel — ALWAYS visible in Step 3 when targets exist for this period / user */}
            {availableTargetFacilities.length > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)',
                border: '1.5px solid #0d9488',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'grid',
                gap: '10px',
                boxShadow: '0 2px 8px rgba(13, 148, 136, 0.08)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Target size={18} color="#0f766e" />
                    <div>
                      <strong style={{ fontSize: '13.5px', color: '#0f766e', display: 'block' }}>
                        🎯 منشآت ووحدات المستهدف الميداني {selectedTeamEmployees.length > 0 ? `للمفتش المكلّف (${selectedTeamEmployees.map(e => e.full_name).join('، ')})` : `لهذا الحساب (${targetEmployees.map(e => e.full_name).filter(Boolean).join('، ') || 'المستخدم الحالي'})`} ({availableTargetFacilities.length} منشأة):
                      </strong>
                      <span style={{ fontSize: '11.5px', color: '#115e59' }}>
                        اضغط على أي وحدة لإضافتها فوراً لقائمة المرور وتحديد وجهتها ومحافظتها تلقائياً:
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addAllPendingTargets}
                    style={{
                      background: '#0f766e',
                      color: 'white',
                      border: 0,
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 4px rgba(15, 118, 110, 0.25)'
                    }}
                  >
                    ⚡ إضافة كل منشآت المستهدف المتبقية ({availableTargetFacilities.filter(t => !(form.targetFacilityIds || []).includes(t.id)).length})
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '220px', overflowY: 'auto', padding: '4px 0' }}>
                  {availableTargetFacilities.map(tf => {
                    const isAdded = (form.targetFacilityIds || []).includes(tf.id)
                    return (
                      <button
                        key={tf.id}
                        type="button"
                        onClick={() => toggleTargetFacility(tf)}
                        title={isAdded ? 'اضغط لإلغاء التحديد' : 'اضغط لإضافة المنشأة للمأمورية'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: isAdded ? 'bold' : '600',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          border: isAdded ? '1.5px solid #0f766e' : '1px solid #99f6e4',
                          background: isAdded ? '#0f766e' : 'white',
                          color: isAdded ? 'white' : '#0f766e',
                          boxShadow: isAdded ? '0 2px 5px rgba(15, 118, 110, 0.25)' : 'none'
                        }}
                      >
                        <span>{isAdded ? '✓ مضافة' : '➕'}</span>
                        <span>{tf.name}</span>
                        {tf.health_admin && (
                          <span style={{ opacity: isAdded ? 0.9 : 0.75, fontSize: '10.5px' }}>({tf.health_admin})</span>
                        )}
                        {tf.governorate && (
                          <span style={{ opacity: isAdded ? 0.9 : 0.65, fontSize: '10px' }}>- {tf.governorate}</span>
                        )}
                        {tf.is_visited && (
                          <span style={{
                            fontSize: '10px',
                            background: isAdded ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                            color: isAdded ? 'white' : '#475569',
                            padding: '1px 6px',
                            borderRadius: '8px'
                          }}>
                            تم المرور
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {form.assignedUserIds.length > 0 && availableTargetFacilities.length === 0 && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#475569',
                fontSize: '12.5px'
              }}>
                <Info size={18} style={{ flexShrink: 0, color: '#006d77' }} />
                <span>
                  لم يتم تسجيل منشآت مستهدفة بالاسم للمفتش المكلّف ({selectedTeamEmployees.map(e => e.full_name).join('، ')}) خلال هذه الفترة (أو أن مستهدفه تراكمي بالعدد الإجمالي). يمكنك اختيار المنشآت الطبية من حقل البحث أدناه.
                </span>
              </div>
            )}

            {/* Selected facilities list with capsule pills (shows whenever facilities are added) */}
            {form.targetFacilityIds && form.targetFacilityIds.length > 0 && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'grid',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#1e293b' }}>
                    ✓ المنشآت المحددة في خط سير المأمورية ({form.targetFacilityIds.length} منشأة):
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, targetFacilityIds: [], targetFacilityId: '' }))}
                    style={{ background: 'none', border: 0, color: '#e53e3e', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    مسح الكل
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                      {fac.name} {fac.governorate ? `(${fac.governorate})` : ''}
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
              </div>
            )}

            {/* Target Facility - Searchable select fuzzy search */}
            {form.destinationType === 'facility' && (
              <div style={{ display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>إضافة منشأة أخرى من خلال البحث:</span>
                  <span style={{ fontSize: '11px', color: '#006d77', background: '#e0f2f1', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold' }}>
                    {filteredFacilities.length} منشأة متاحة
                  </span>
                </div>

                  <div style={{ display: 'grid', gap: '8px', position: 'relative' }}>
                    {/* Search box input */}
                    <div style={{ position: 'relative' }}>
                      <input
                        type="text"
                        placeholder="🔍 ابحث بالاسم، الإدارة، أو القرية (مثال: ناصر، ديروط، أبنوب)..."
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


                    {/* Filtered suggestions list */}
                    <div style={{
                      background: 'white',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      display: 'grid',
                      alignContent: 'start',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
                    }}>
                      {filteredFacilities.slice(0, 100).map((facility) => {
                        const isSelected = form.targetFacilityIds?.includes(facility.id) ?? false
                        return (
                          <div
                            key={facility.id}
                            onClick={() => {
                              const currentIds = form.targetFacilityIds || []
                              const nextIds = currentIds.includes(facility.id)
                                ? currentIds.filter(id => id !== facility.id)
                                : [...currentIds, facility.id]
                              
                              setForm(prev => {
                                const next = {
                                  ...prev,
                                  targetFacilityIds: nextIds,
                                  targetFacilityId: nextIds[0] || ''
                                }
                                // Auto-sync governorate if empty
                                if (!prev.targetGovernorateId && facility.governorate) {
                                  const matchedGov = localGovernorates.find(g => g.name === facility.governorate)
                                  if (matchedGov) next.targetGovernorateId = matchedGov.id
                                }
                                return next
                              })
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
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong>{facility.name}</strong>
                                {targetedFacilitiesForEmployee.some(tf => tf.id === facility.id) && (
                                  <span style={{
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fde68a',
                                    padding: '2px 8px',
                                    borderRadius: '12px',
                                    fontSize: '11px',
                                    fontWeight: 'bold',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    🎯 مستهدفة للمفتش
                                  </span>
                                )}
                                {facilityVisitStats && (
                                  facilityVisitStats[facility.id]?.count > 0 ? (
                                    <span style={{
                                      background: '#dcfce7',
                                      color: '#15803d',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 'bold'
                                    }}>
                                      🟢 تم المرور ({facilityVisitStats[facility.id].count} مأمورية)
                                    </span>
                                  ) : (
                                    <span style={{
                                      background: '#f1f5f9',
                                      color: '#64748b',
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 'bold'
                                    }}>
                                      ⚪ لم يتم المرور بعد
                                    </span>
                                  )
                                )}
                              </div>
                              <small style={{ display: 'block', color: '#78909c', fontSize: '11px', marginTop: '2px' }}>
                                {formatFacilityType(facility.facility_type)} • {facility.governorate ? `محافظة ${facility.governorate}` : ''} {facility.health_admin ? `• إدارة ${facility.health_admin}` : ''} {facility.village_city ? `• ${facility.village_city}` : ''}
                              </small>
                            </div>
                            {isSelected && <Check size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />}
                          </div>
                        )
                      })}
                      {filteredFacilities.length === 0 && (
                        <div style={{ padding: '12px', textAlign: 'center', color: '#78909c', fontSize: '12.5px' }}>
                          لا توجد منشآت مطابقة للبحث داخل هذا النطاق.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Visit Purpose */}
            <div style={{ display: 'grid', gap: '6px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                الغرض التفصيلي والتوجيه المحوكم للزيارة *
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
                    📋 مرور ومتابعة عامة
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePurposeCategory('primary_care')}
                    style={{
                      background: activePurposeCategory === 'primary_care' ? '#e0f2f1' : '#f5f5f5',
                      color: activePurposeCategory === 'primary_care' ? 'var(--brand)' : '#546e7a',
                      border: '1px solid ' + (activePurposeCategory === 'primary_care' ? '#80cbc4' : '#e0e0e0'),
                      borderRadius: '20px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🩺 رعاية أساسية وطب أسرة
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
                    💊 أدوية وطعوم ومستلزمات
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
                    🛡️ مكافحة عدوى وبيئة العمل
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
