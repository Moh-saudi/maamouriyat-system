'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { type CorrectionUnitOption } from '@/lib/correction-units'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Camera, Trash2, Building, Check } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { getChecklistByDepartment } from '@/lib/checklist-data'
import styles from './execute.module.css'
import { SearchableAddableSelect } from '@/app/system-ui'

type Facility = {
  id: string
  name: string
  address?: string | null
  governorate?: string | null
  health_admin?: string | null
  facility_type?: string | null
  governorate_id?: string | null
  latitude?: number | null
  longitude?: number | null
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
  started_at?: string | null
  notes?: string | null
  scheduled_date?: string | null
}

// Global list of facility categories for unregistered quick creation
const FACILITY_CATEGORIES = [
  'مستشفى عام',
  'مستشفى تخصصي (أمانة المراكز الطبية)',
  'مستشفى (الهيئة العامة للرعاية الصحية)',
  'مستشفى تعليمي',
  'مستشفى تأمين صحي',
  'مركز رعاية صحية أولية وطب أسرة',
  'مخزن تموين طبي وإمداد دوائي رئيسي'
]

export function MissionExecutionForm({
  currentUserId,
  currentUserDept,
  currentUserOrgUnitId,
  correctionUnits,
  facilities,
  governorates,
  mission,
  users = [],
  currentUserLevel = 7,
  savedResults = [],
  orgUnits = [],
}: {
  currentUserId: string
  currentUserDept?: string
  currentUserOrgUnitId?: string
  correctionUnits: CorrectionUnitOption[]
  facilities: Facility[]
  governorates: Governorate[]
  mission: Mission
  users?: any[]
  currentUserLevel?: number
  savedResults?: any[]
  orgUnits?: any[]
}) {
  const router = useRouter()
  const [bypassLock, setBypassLock] = useState(false)
  const supabase = createBrowserSupabaseClient()
  const [destinationType, setDestinationType] = useState<'facility' | 'governorate'>(
    (mission.destination_type as 'facility' | 'governorate') ?? 'facility',
  )
  const [actualFacilityId, setActualFacilityId] = useState(mission.actual_facility_id ?? mission.target_facility_id ?? '')
  const [actualGovernorateId, setActualGovernorateId] = useState(
    mission.actual_governorate_id ?? mission.target_governorate_id ?? '',
  )
  const [correctionUnit, setCorrectionUnit] = useState('')
  const [localCorrectionUnits, setLocalCorrectionUnits] = useState(correctionUnits)

  const handleAddCorrectionUnit = (newName: string) => {
    const newUnit = { name: newName }
    setLocalCorrectionUnits(prev => [...prev, newUnit])
    setCorrectionUnit(newName)
  }
  const [changeReason, setChangeReason] = useState(mission.change_reason ?? '')

  const facilityOptions = useMemo(() => {
    return facilities.map((f: any) => ({
      value: f.id,
      label: `${f.name} ${f.governorate ? `(${f.governorate} - ${f.health_admin || f.address || f.facility_type || 'منشأة صحية'})` : (f.address ? `(${f.address})` : '')}`
    }))
  }, [facilities])

  // Split execution_notes on load if it contains the divider
  const [executionNotes, setExecutionNotes] = useState(() => {
    const raw = mission.execution_notes ?? ''
    const dividerIndex = raw.indexOf('\n\n---\n\n📋 توصيات المأمورية المعتمدة:\n')
    if (dividerIndex !== -1) {
      return raw.substring(0, dividerIndex)
    }
    return raw
  })
  
  const [recommendations, setRecommendations] = useState(() => {
    const raw = mission.execution_notes ?? ''
    const dividerIndex = raw.indexOf('\n\n---\n\n📋 توصيات المأمورية المعتمدة:\n')
    if (dividerIndex !== -1) {
      return raw.substring(dividerIndex + '\n\n---\n\n📋 توصيات المأمورية المعتمدة:\n'.length)
    }
    return ''
  })

  // Mention State Hooks
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [mentionCursorPos, setMentionCursorPos] = useState(0)

  // Filter users below current user in hierarchy (level > currentUserLevel)
  const lowerUsers = useMemo(() => {
    if (!users) return []
    return users.filter(
      (u) =>
        u.id !== currentUserId &&
        (currentUserLevel === undefined || currentUserLevel === null || u.level > currentUserLevel)
    )
  }, [users, currentUserLevel, currentUserId])

  const filteredUsers = useMemo(() => {
    if (!mentionOpen) return []
    const term = mentionSearch.toLowerCase()
    return lowerUsers.filter((u) => {
      const fullName = u.full_name || ''
      const jobTitle = u.job_title || ''
      const dept = u.department || ''
      return (
        fullName.toLowerCase().includes(term) ||
        jobTitle.toLowerCase().includes(term) ||
        dept.toLowerCase().includes(term)
      )
    })
  }, [mentionOpen, lowerUsers, mentionSearch])

  const handleRecommendationsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setRecommendations(value)

    const selStart = e.target.selectionStart
    if (!selStart) return

    // Find the text before the cursor
    const textBeforeCursor = value.slice(0, selStart)
    
    // Find the last word before the cursor
    const words = textBeforeCursor.split(/[\s\n]/)
    const lastWord = words[words.length - 1]

    if (lastWord.startsWith('@')) {
      const searchTerm = lastWord.slice(1)
      setMentionOpen(true)
      setMentionSearch(searchTerm)
      setMentionActiveIndex(0)
      setMentionCursorPos(selStart)
    } else {
      setMentionOpen(false)
    }
  }

  const insertMention = (user: any) => {
    const textarea = document.getElementById('recommendations-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const value = recommendations
    const selStart = textarea.selectionStart || mentionCursorPos || 0

    // Find text before the cursor
    const textBeforeCursor = value.slice(0, selStart)
    
    // Find the last word before the cursor (which contains the @)
    const lastIndex = textBeforeCursor.lastIndexOf('@')
    
    if (lastIndex !== -1) {
      const beforeMention = value.slice(0, lastIndex)
      const afterMention = value.slice(selStart)
      const mentionText = `@${user.full_name} `
      const newValue = beforeMention + mentionText + afterMention
      
      setRecommendations(newValue)
      setMentionOpen(false)
      
      setTimeout(() => {
        textarea.focus()
        const newCursorPos = lastIndex + mentionText.length
        textarea.setSelectionRange(newCursorPos, newCursorPos)
      }, 10)
    }
  }

  const handleRecommendationsKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!mentionOpen) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionActiveIndex((prev) => (prev + 1) % filteredUsers.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionActiveIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredUsers[mentionActiveIndex]) {
        insertMention(filteredUsers[mentionActiveIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMentionOpen(false)
    }
  }
  const [violationDescription, setViolationDescription] = useState('')
  const [violationPriority, setViolationPriority] = useState<'low' | 'medium' | 'high' | 'critical'>('medium')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Photo & Compression States
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string>('')
  const [photoSizeOriginal, setPhotoSizeOriginal] = useState<string>('')
  const [photoSizeCompressed, setPhotoSizeCompressed] = useState<string>('')
  const [compressing, setCompressing] = useState(false)

  // GPS Verification & Mobile Capture States
  const [gpsLoading, setGpsLoading] = useState(false)
  const [inspectorLat, setInspectorLat] = useState<number | null>(null)
  const [inspectorLng, setInspectorLng] = useState<number | null>(null)
  const [gpsVerified, setGpsVerified] = useState<boolean>(false)
  const [gpsDistance, setGpsDistance] = useState<number | null>(null)
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'success' | 'warn' | 'error'>('idle')

  // Unregistered Facility Form States
  const [isUnregisteredFacility, setIsUnregisteredFacility] = useState(false)
  const [newFacilityName, setNewFacilityName] = useState('')
  const [newFacilityType, setNewFacilityType] = useState('مستشفى عام')
  const [newFacilityAddress, setNewFacilityAddress] = useState('')
  const [newFacilityGovId, setNewFacilityGovId] = useState(mission.target_governorate_id ?? '')
  const [leafletLoaded, setLeafletLoaded] = useState(false)

  // Stepper, Accordion & Mobile Search UX States
  const [selectedStage, setSelectedStage] = useState<number>(0)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState<string>('')

  // --- Dynamic Client-Side Leaflet Ingestion ---
  useEffect(() => {
    if (typeof window === 'undefined') return

    const win = window as any
    if (win.L) {
      setLeafletLoaded(true)
      return
    }

    const existingLink = document.querySelector('link[href*="leaflet.css"]')
    if (!existingLink) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector('script[src*="leaflet.js"]')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js'
      script.crossOrigin = ''
      script.onload = () => {
        setLeafletLoaded(true)
      }
      document.head.appendChild(script)
    } else {
      const interval = setInterval(() => {
        if (win.L) {
          setLeafletLoaded(true)
          clearInterval(interval)
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [])

  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const targetMarkerRef = useRef<any>(null)
  const lineRef = useRef<any>(null)

  function updateCoordsAndVerify(lat: number, lng: number) {
    setInspectorLat(lat)
    setInspectorLng(lng)

    if (!isUnregisteredFacility && actualFacilityId) {
      const fac = facilities.find((f) => f.id === actualFacilityId)
      if (fac && fac.latitude && fac.longitude) {
        const distance = calculateDistance(lat, lng, Number(fac.latitude), Number(fac.longitude))
        setGpsDistance(distance)
        const isNear = distance <= 200
        setGpsVerified(isNear)
        setGpsStatus(isNear ? 'success' : 'warn')
      } else {
        setGpsVerified(true)
        setGpsDistance(null)
        setGpsStatus('success')
      }
    } else {
      setGpsVerified(true)
      setGpsDistance(null)
      setGpsStatus('success')
    }
  }

  useEffect(() => {
    if (!leafletLoaded || !inspectorLat || !inspectorLng) return
    const win = window as any
    const L = win.L
    if (!L) return

    // Find official coords of selected/target facility
    let targetLat: number | null = null
    let targetLng: number | null = null

    if (!isUnregisteredFacility && actualFacilityId) {
      const fac = facilities.find((f) => f.id === actualFacilityId)
      if (fac && fac.latitude && fac.longitude) {
        targetLat = Number(fac.latitude)
        targetLng = Number(fac.longitude)
      }
    }

    const container = document.getElementById('execution-map')
    if (!container) return

    // Initialize Map if not present
    if (!mapRef.current) {
      const centerLat = targetLat ? (targetLat + inspectorLat) / 2 : inspectorLat
      const centerLng = targetLng ? (targetLng + inspectorLng) / 2 : inspectorLng
      
      const map = L.map('execution-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([centerLat, centerLng], 14)

      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(map)

      // Set up click listener on the map to allow placing/moving the pin
      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        updateCoordsAndVerify(lat, lng)
      })
    }

    const map = mapRef.current

    // 1. Draw/Update Inspector Draggable Pin
    const pinColor = gpsVerified ? '#2e7d32' : '#d84315'
    const pinHtml = `<div style="background-color: ${pinColor}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 5px rgba(0,0,0,0.4); cursor: pointer;" title="موقعك الحالي (اسحب لتعديل الدبوس بدقة)"></div>`
    
    const inspectorIcon = L.divIcon({
      className: 'custom-leaflet-icon',
      html: pinHtml,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    })

    if (markerRef.current) {
      markerRef.current.setLatLng([inspectorLat, inspectorLng])
      markerRef.current.setIcon(inspectorIcon)
    } else {
      const marker = L.marker([inspectorLat, inspectorLng], { 
        icon: inspectorIcon,
        draggable: true 
      }).addTo(map)

      markerRef.current = marker

      marker.on('dragend', (e: any) => {
        const { lat, lng } = e.target.getLatLng()
        updateCoordsAndVerify(lat, lng)
      })
    }

    // 2. Draw/Update Target Facility Marker
    if (targetLat && targetLng) {
      const targetIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div style="background-color: #006d77; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);" title="المقر الرسمي للمصادقة"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })

      if (targetMarkerRef.current) {
        targetMarkerRef.current.setLatLng([targetLat, targetLng])
      } else {
        targetMarkerRef.current = L.marker([targetLat, targetLng], { icon: targetIcon })
          .addTo(map)
          .bindPopup(`<strong>المقر الرسمي المعتمد للمستشفى</strong>`)
      }

      // Draw/Update Connecting Line
      const lineColor = gpsVerified ? '#2e7d32' : '#d84315'
      const dashArray = gpsVerified ? '' : '5, 5'

      if (lineRef.current) {
        lineRef.current.setLatLngs([[targetLat, targetLng], [inspectorLat, inspectorLng]])
        lineRef.current.setStyle({ color: lineColor, dashArray: dashArray })
      } else {
        lineRef.current = L.polyline([[targetLat, targetLng], [inspectorLat, inspectorLng]], {
          color: lineColor,
          weight: 3,
          dashArray: dashArray
        }).addTo(map)
      }

      // Auto fit map bounds nicely
      const bounds = L.latLngBounds([[targetLat, targetLng], [inspectorLat, inspectorLng]])
      map.fitBounds(bounds, { padding: [30, 30] })
    } else {
      // Remove target and line if no target
      if (targetMarkerRef.current) {
        targetMarkerRef.current.remove()
        targetMarkerRef.current = null
      }
      if (lineRef.current) {
        lineRef.current.remove()
        lineRef.current = null
      }
      map.setView([inspectorLat, inspectorLng], 15)
    }

  }, [leafletLoaded, inspectorLat, inspectorLng, actualFacilityId, isUnregisteredFacility])

  // Checklist States & Dynamic Resolvers
  const [answers, setAnswers] = useState<Record<string, { answer: any; notes: string }>>(() => {
    const initial: Record<string, { answer: any; notes: string }> = {}
    if (savedResults && savedResults.length > 0) {
      savedResults.forEach((res: any) => {
        let itemId = res.checklist_item_id
        let notes = res.notes || ''
        
        // Handle prefix for static items
        if (!itemId && notes.startsWith('__static_id__:')) {
          const delimiterIdx = notes.indexOf('||')
          if (delimiterIdx !== -1) {
            itemId = notes.substring('__static_id__:'.length, delimiterIdx)
            notes = notes.substring(delimiterIdx + 2)
          }
        }
        
        if (itemId) {
          initial[itemId] = {
            answer: res.answer,
            notes: notes
          }
        }
      })
    }
    return initial
  })

  const answeredStats = useMemo(() => {
    let answered = 0
    let compliant = 0
    let nonCompliant = 0
    Object.values(answers).forEach((ans: any) => {
      if (ans?.answer !== undefined && ans?.answer !== '' && ans?.answer !== null) {
        answered++
        if (ans.answer === 'yes' || ans.answer === true || ans.answer === 'مطابق' || ans.answer === 'ملتزم') compliant++
        if (ans.answer === 'no' || ans.answer === false || ans.answer === 'غير مطابق' || ans.answer === 'غير ملتزم') nonCompliant++
      }
    })
    const rate = answered > 0 ? Math.round((compliant / answered) * 100) : 0
    return { answered, compliant, nonCompliant, rate }
  }, [answers])

  const [localCustomChecklists, setLocalCustomChecklists] = useState<any[]>([])
  const [showChecklistBuilder, setShowChecklistBuilder] = useState(false)
  const [newChecklistTitle, setNewChecklistTitle] = useState('')
  const [newChecklistType, setNewChecklistType] = useState('استثنائي')
  const [newQuestions, setNewQuestions] = useState<Array<{ text: string; type: 'yes_no' | 'dropdown' | 'stars' | 'text'; priority: 'critical' | 'high' | 'medium' | 'low'; correctionDept: string }>>([
    { text: '', type: 'yes_no', priority: 'high', correctionDept: 'إدارة الصيانة والتشغيل' }
  ])
  const [builderSuccess, setBuilderSuccess] = useState('')
  const [builderError, setBuilderError] = useState('')

  // Load official 37 sections & 290 criteria from form_templates API
  useEffect(() => {
    const loadCustomChecklists = async () => {
      try {
        const apiRes = await fetch('/api/admin/checklists')
        if (!apiRes.ok) {
          console.error('Error fetching checklists from server API')
          return
        }
        const resData = await apiRes.json()
        const templates = resData.templates || (Array.isArray(resData) ? resData : [])

        const mappedSections: any[] = []
        templates.forEach((tmpl: any) => {
          (tmpl.sections || []).forEach((sec: any) => {
            const items = (sec.criteria || sec.checklist_items || []).map((c: any) => {
              const maxLabel = c.score_max_label || 'مطابق'
              const midLabel = c.score_mid_label || (c.score_mid_value ? 'مطابق جزئياً' : '')
              const zeroLabel = c.score_0_label || 'غير مطابق'
              const hasMid = Boolean(c.score_mid_value || c.score_type === 'ternary' || c.score_type === '3_level')

              let optionsStr = c.options || ''
              if (!optionsStr) {
                if (hasMid && midLabel) {
                  optionsStr = `${maxLabel}, ${midLabel}, ${zeroLabel}, لا ينطبق`
                } else {
                  optionsStr = `${maxLabel}, ${zeroLabel}, لا ينطبق`
                }
              }

              return {
                id: c.id,
                text: c.criterion_text || c.text,
                answer_type: (hasMid || c.score_type === 'dropdown' || c.score_type === 'ternary') ? 'chips_options' : 'yes_no',
                is_required: true,
                violation_priority: (c.score_max_value >= 4 ? 'high' : 'medium') as any,
                correction_dept: sec.name,
                options: optionsStr,
                score_max_value: c.score_max_value || 2,
                score_mid_value: c.score_mid_value || 1,
                score_0_label: zeroLabel,
                score_mid_label: midLabel,
                score_max_label: maxLabel
              }
            })

            mappedSections.push({
              id: sec.id,
              name: sec.name,
              dept_name: tmpl.name || 'استمارة المرور الموحدة',
              checklist_type: 'دوري',
              org_unit_id: null,
              items
            })
          })
        })

        if (mappedSections.length > 0) {
          setLocalCustomChecklists(mappedSections)
        }
      } catch (e) {
        console.error('Error loading official checklist items:', e)
      }
    }
    loadCustomChecklists()
  }, [])

  // Memoized filter for allowed organizational units recursively matching user profile
  const allowedOrgUnits = useMemo(() => {
    let matchedUnitId = currentUserOrgUnitId

    // Robust Fallback: if org_unit_id is null but department text is set, resolve matching unit by name
    if (!matchedUnitId && currentUserDept) {
      const cleanDept = currentUserDept.replace('ديوان عام الوزارة - ', '').trim()
      const matched = orgUnits.find(u => u.name.includes(cleanDept) || cleanDept.includes(u.name))
      if (matched) {
        matchedUnitId = matched.id
      }
    }

    if (!matchedUnitId) {
      return []
    }

    // Filter to own unit + any subordinate child units recursively
    const ownUnit = orgUnits.find(u => u.id === matchedUnitId)
    const result = ownUnit ? [ownUnit] : []

    const getSubordinates = (parentId: string) => {
      const children = orgUnits.filter(u => u.parent_id === parentId)
      children.forEach(child => {
        result.push(child)
        getSubordinates(child.id)
      })
    }

    getSubordinates(matchedUnitId)
    return result
  }, [orgUnits, currentUserOrgUnitId, currentUserDept])

  const checklistSections = useMemo(() => {
    // 1. Display official checklist sections and criteria directly from form_templates
    if (localCustomChecklists.length > 0) {
      return localCustomChecklists
    }

    // 2. Fallback to built-in department checklist if API is unavailable
    const baseChecklist = getChecklistByDepartment(currentUserDept)
    return baseChecklist
  }, [currentUserDept, localCustomChecklists])

  function addBuilderQuestion() {
    setNewQuestions(prev => [
      ...prev,
      { text: '', type: 'yes_no', priority: 'high', correctionDept: 'إدارة الصيانة والتشغيل' }
    ])
  }

  function removeBuilderQuestion(index: number) {
    if (newQuestions.length === 1) return
    setNewQuestions(prev => prev.filter((_, idx) => idx !== index))
  }

  function updateBuilderQuestion(index: number, key: string, val: any) {
    setNewQuestions(prev => prev.map((q, idx) => {
      if (idx === index) {
        return { ...q, [key]: val }
      }
      return q
    }))
  }

  async function handleDeployChecklist() {
    setBuilderError('')
    setBuilderSuccess('')

    if (!newChecklistTitle.trim()) {
      setBuilderError('يرجى كتابة اسم الاستمارة الجديدة.')
      return
    }

    const invalidQuestion = newQuestions.some(q => !q.text.trim())
    if (invalidQuestion) {
      setBuilderError('يرجى كتابة نص جميع الأسئلة والبنود.')
      return
    }

    if (!supabase) {
      setBuilderError('إعداد Supabase غير مكتمل.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', user?.id)
        .maybeSingle()

      // 1. Create main checklist entry
      const { data: newChk, error: chkErr } = await supabase
        .from('checklists')
        .insert({
          name: newChecklistTitle.trim(),
          facility_type: 'general',
          description: `${currentUserDept || 'المرور العام'}|${newChecklistType}`,
          created_by: profile?.id || null,
          is_active: true
        })
        .select('id')
        .single()

      if (chkErr || !newChk) {
        setBuilderError(`فشل حفظ الاستمارة في قاعدة البيانات: ${chkErr?.message}`)
        return
      }

      // 2. Create checklist section
      const { data: newSec, error: secErr } = await supabase
        .from('checklist_sections')
        .insert({
          checklist_id: newChk.id,
          name: newChecklistTitle.trim(),
          sort_order: 0
        })
        .select('id')
        .single()

      if (secErr || !newSec) {
        setBuilderError(`فشل حفظ أقسام الاستمارة: ${secErr?.message}`)
        return
      }

      // 3. Create items payload
      const itemsPayload = newQuestions.map((q, idx) => ({
        checklist_id: newChk.id,
        section_id: newSec.id,
        text: q.text.trim(),
        answer_type: q.type || 'yes_no',
        is_required: true,
        violation_priority: q.priority || 'medium',
        correction_dept: q.correctionDept || currentUserDept || 'المرور العام',
        sort_order: idx
      }))

      const { data: insertedItems, error: itemsErr } = await supabase
        .from('checklist_items')
        .insert(itemsPayload)
        .select('id, text, answer_type, violation_priority, correction_dept, is_required')

      if (itemsErr || !insertedItems) {
        setBuilderError(`فشل حفظ بنود الاستمارة: ${itemsErr?.message || 'تعذر جلب معرفات الأسئلة الحقيقية'}`)
        return
      }

      // Update state locally so it renders immediately with real Database UUIDs
      const newSection = {
        id: newChk.id,
        name: newChecklistTitle.trim(),
        dept_name: currentUserDept || 'المرور العام',
        checklist_type: newChecklistType,
        items: insertedItems.map((item: any) => ({
          id: item.id,
          text: item.text,
          answer_type: item.answer_type as any,
          violation_priority: item.violation_priority as any,
          correction_dept: item.correction_dept,
          is_required: item.is_required ?? true
        }))
      }

      setLocalCustomChecklists(prev => [newSection, ...prev])
      setBuilderSuccess('🎉 تم إنشاء استمارة المرور المخصصة واعتمادها فوراً لهذه المأمورية!')
      
      setNewChecklistTitle('')
      setNewChecklistType('استثنائي')
      setNewQuestions([{ text: '', type: 'yes_no', priority: 'high', correctionDept: 'إدارة الصيانة والتشغيل' }])

      setTimeout(() => {
        setShowChecklistBuilder(false)
        setBuilderSuccess('')
      }, 1500)
    } catch (err: any) {
      setBuilderError(`خطأ أثناء النشر: ${err.message || err}`)
    }
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3 // Earth radius in metres
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return Math.round(R * c)
  }

  function captureInspectorGPS() {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('جهازك أو متصفحك لا يدعم خاصية تحديد الموقع الجغرافي (GPS).')
      return
    }

    setGpsLoading(true)
    setGpsStatus('idle')
    setError('')

    // Try capturing with High Accuracy first
    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleGpsSuccess(position)
      },
      (err) => {
        console.warn('GPS High Accuracy Capture failed. Retrying with low accuracy...', err)
        // Fallback: Retry with high accuracy disabled (IP/Network based) for instant results indoors or on desktop!
        navigator.geolocation.getCurrentPosition(
          (fallbackPosition) => {
            handleGpsSuccess(fallbackPosition)
          },
          (fallbackErr) => {
            console.error('GPS Fallback Capture failed:', fallbackErr)
            setGpsLoading(false)
            setGpsStatus('error')
            setError('عذراً، فشل التقاط الموقع الجغرافي. يرجى تفعيل الـ GPS بالهاتف ومنح صلاحية الوصول للموقع في المتصفح.')
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 30000 }
        )
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    )
  }

  function handleGpsSuccess(position: GeolocationPosition) {
    const lat = position.coords.latitude
    const lng = position.coords.longitude
    setInspectorLat(lat)
    setInspectorLng(lng)
    setGpsLoading(false)

    // Verify distance against selected facility if registered
    if (!isUnregisteredFacility && actualFacilityId) {
      const fac = facilities.find((f) => f.id === actualFacilityId)
      if (fac && fac.latitude && fac.longitude) {
        const distance = calculateDistance(lat, lng, Number(fac.latitude), Number(fac.longitude))
        setGpsDistance(distance)
        
        // gps radius threshold: 200m
        const isNear = distance <= 200
        setGpsVerified(isNear)
        setGpsStatus(isNear ? 'success' : 'warn')
      } else {
        setGpsVerified(true)
        setGpsDistance(null)
        setGpsStatus('success')
      }
    } else {
      // New unregistered facility or governorate mode
      setGpsVerified(true)
      setGpsDistance(null)
      setGpsStatus('success')
    }
    setSuccess('تم التقاط الموقع الجغرافي الحالي للهاتف بنجاح للتوثيق.')
    setTimeout(() => setSuccess(''), 5000)
  }

  const handleFacilityChange = (facId: string) => {
    setActualFacilityId(facId)
    if (inspectorLat && inspectorLng) {
      const fac = facilities.find((f) => f.id === facId)
      if (fac && fac.latitude && fac.longitude) {
        const distance = calculateDistance(inspectorLat, inspectorLng, Number(fac.latitude), Number(fac.longitude))
        setGpsDistance(distance)
        const isNear = distance <= 200
        setGpsVerified(isNear)
        setGpsStatus(isNear ? 'success' : 'warn')
      } else {
        setGpsVerified(true)
        setGpsDistance(null)
        setGpsStatus('success')
      }
    }
  }

  // Automatically capture location on page load to prevent tampering and enforce security
  useEffect(() => {
    captureInspectorGPS()
  }, [])

  function handleAnswerChange(
    itemId: string,
    answer: 'yes' | 'no' | 'na',
    priority: 'low' | 'medium' | 'high' | 'critical',
    dept: string,
    itemText: string
  ) {
    setAnswers((current) => ({
      ...current,
      [itemId]: { answer, notes: current[itemId]?.notes || '' }
    }))

    // Auto-populate violation description if not compliant
    if (answer === 'no') {
      setViolationDescription((current) => {
        const prefix = `[بند غير ملتزم]: ${itemText}`
        if (current.includes(itemText)) return current
        return current ? `${current}\n${prefix}` : prefix
      })
      setViolationPriority(priority)
      setCorrectionUnit(dept)
      
      setSuccess('تم نسخ بند المخالفة تلقائياً إلى صندوق تسجيل المخالفات أدناه للتفصيل والتوثيق.')
      setTimeout(() => setSuccess(''), 5000)
    }
  }

  function handleAnswerChangeCustom(
    itemId: string,
    answerValue: any,
    isCompliant: boolean,
    priority: 'low' | 'medium' | 'high' | 'critical',
    dept: string,
    itemText: string
  ) {
    setAnswers((current) => ({
      ...current,
      [itemId]: { answer: answerValue, notes: current[itemId]?.notes || '' }
    }))

    // Auto-populate violation description if explicitly marked non-compliant
    if (!isCompliant) {
      setViolationDescription((current) => {
        const prefix = `[بند غير ملتزم]: ${itemText} (التقييم: ${answerValue})`
        if (current.includes(itemText)) return current
        return current ? `${current}\n${prefix}` : prefix
      })
      setViolationPriority(priority)
      setCorrectionUnit(dept)
      
      setSuccess('تم رصد عدم التزام! تم نسخ البند تلقائياً إلى صندوق تسجيل المخالفات أدناه للتوجيه والمتابعة.')
      setTimeout(() => setSuccess(''), 5000)
    }
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setCompressing(true)
    setError('')
    
    const origSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB'
    setPhotoSizeOriginal(origSize)

    const options = {
      maxSizeMB: 0.5, // 500KB max size
      maxWidthOrHeight: 1280, // 1280px max resolution
      useWebWorker: true
    }

    try {
      const compressedBlob = await imageCompression(file, options)
      const compressedFile = new File([compressedBlob], file.name, {
        type: file.type,
        lastModified: Date.now()
      })
      
      setPhotoFile(compressedFile)
      setPhotoPreview(URL.createObjectURL(compressedFile))

      const compSize = (compressedFile.size / 1024).toFixed(0) + ' KB'
      setPhotoSizeCompressed(compSize)
    } catch (err: any) {
      console.error('Compression error:', err)
      setError('حدث خطأ أثناء ضغط الصورة. تم استخدام الصورة الأصلية.')
      setPhotoFile(file)
      setPhotoPreview(URL.createObjectURL(file))
      setPhotoSizeCompressed(origSize)
    } finally {
      setCompressing(false)
    }
  }

  function handleRemovePhoto() {
    setPhotoFile(null)
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview('')
    }
    setPhotoSizeOriginal('')
    setPhotoSizeCompressed('')
  }

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

    if (destinationType === 'facility' && !isUnregisteredFacility && !actualFacilityId) {
      setError('يرجى اختيار المنشأة الفعلية.')
      return
    }

    if (destinationType === 'facility' && isUnregisteredFacility) {
      if (!newFacilityName.trim()) {
        setError('يرجى كتابة اسم المنشأة الجديدة.')
        return
      }
      if (!newFacilityGovId) {
        setError('يرجى اختيار المحافظة التابعة لها المنشأة الجديدة.')
        return
      }
    }

    if (destinationType === 'governorate' && !actualGovernorateId) {
      setError('يرجى اختيار المحافظة الفعلية.')
      return
    }

    if (changed && !changeReason.trim()) {
      setError('عند تغيير الوجهة يجب كتابة سبب التغيير.')
      return
    }

    if (violationDescription.trim() && !correctionUnit.trim()) {
      setError('يرجى اختيار أو كتابة الإدارة المختصة بالتصحيح.')
      return
    }

    setLoading(true)

    if (!supabase) {
      setError('إعداد Supabase غير مكتمل.')
      setLoading(false)
      return
    }

    const now = new Date().toISOString()
    let savedActualFacilityId = actualFacilityId

    if (destinationType === 'facility' && isUnregisteredFacility) {
      // Register new facility live in the database
      const { data: newFac, error: facErr } = await supabase
        .from('facilities')
        .insert({
          name: newFacilityName.trim(),
          facility_type: newFacilityType,
          address: newFacilityAddress.trim() || 'تم تسجيلها أثناء المرور الميداني',
          governorate_id: newFacilityGovId,
          latitude: inspectorLat,
          longitude: inspectorLng,
          is_active: true
        })
        .select('id')
        .single()

      if (facErr || !newFac) {
        setLoading(false)
        setError(`فشل تسجيل المنشأة الجديدة في قاعدة البيانات: ${facErr?.message}`)
        return
      }
      savedActualFacilityId = newFac.id
    }

    const finalExecutionNotes = recommendations.trim()
      ? `${executionNotes.trim()}\n\n---\n\n📋 توصيات المأمورية المعتمدة:\n${recommendations.trim()}`
      : executionNotes.trim()

    let totalScore = 0
    let maxScore = 0
    let criteriaCount = 0
    let computedViolations = 0

    localCustomChecklists.forEach((sec: any) => {
      (sec.items || []).forEach((item: any) => {
        const ans = answers[item.id]?.answer
        if (ans !== undefined && ans !== null && ans !== '') {
          criteriaCount++
          const itemMax = item.score_max_value || 2
          const itemMid = item.score_mid_value || 1

          if (ans === 'yes' || ans === 'مطابق' || ans === 'مطابق بالكامل' || ans === 'ملتزم' || ans === true) {
            totalScore += itemMax
            maxScore += itemMax
          } else if (ans === 'مطابق جزئياً' || ans === 'متوسط' || ans === 'مقبول') {
            totalScore += itemMid
            maxScore += itemMax
          } else if (ans === 'no' || ans === 'غير مطابق' || ans === 'غير مطابق بالكامل' || ans === 'غير ملتزم' || ans === false) {
            totalScore += 0
            maxScore += itemMax
            computedViolations++
          } else if (ans === 'na' || ans === 'لا ينطبق' || ans === 'غير منطبق') {
            // Not applicable
          } else {
            totalScore += itemMax
            maxScore += itemMax
          }
        }
      })
    })

    const scorePct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

    const { error: updateError } = await supabase
      .from('missions')
      .update({
        actual_facility_id: destinationType === 'facility' ? savedActualFacilityId : null,
        actual_governorate_id:
          destinationType === 'facility' 
            ? (isUnregisteredFacility ? newFacilityGovId : (selectedFacility?.governorate_id ?? actualGovernorateId)) 
            : actualGovernorateId,
        destination_changed: changed || isUnregisteredFacility,
        change_reason: (changed || isUnregisteredFacility) 
          ? (changeReason.trim() || (isUnregisteredFacility ? `تسجيل وزيارة منشأة جديدة ميدانياً: ${newFacilityName}` : 'تغيير وجهة المأمورية')) 
          : null,
        execution_notes: finalExecutionNotes || null,
        started_at: mission.status === 'assigned' || !mission.started_at ? now : undefined,
        completed_at: status === 'completed' ? now : null,
        status,
        checkin_lat: inspectorLat,
        checkin_lng: inspectorLng,
        checkin_time: mission.status === 'assigned' || !mission.started_at ? now : undefined,
        checkout_lat: status === 'completed' ? inspectorLat : undefined,
        checkout_lng: status === 'completed' ? inspectorLng : undefined,
        checkout_time: status === 'completed' ? now : undefined,
        gps_verified: gpsVerified,
        total_score: totalScore,
        max_score: maxScore,
        score_pct: scorePct,
        total_criteria: criteriaCount,
        violations_count: computedViolations
      })
      .eq('id', mission.id)

    if (updateError) {
      setLoading(false)
      setError(updateError.message)
      return
    }

    // Handle mention notifications in Live Supabase Mode
    const parsedMentions = lowerUsers.filter((u) => recommendations.includes(`@${u.full_name}`))
    if (parsedMentions.length > 0 && supabase) {
      const notifPayload = parsedMentions.map((u) => ({
        body: `تم الإشارة إليك في توصيات المأمورية رقم ${mission.serial_number}: "${recommendations.substring(0, 100)}..."`,
        mission_id: mission.id,
        title: 'إشارة في توصيات مأمورية',
        type: 'mention',
        user_id: u.id,
      }))
      const { error: notifErr } = await supabase.from('notifications').insert(notifPayload)
      if (notifErr) {
        console.error('Error inserting recommendation notifications:', notifErr)
      }
    }

    const hasViolation = Boolean(violationDescription.trim())

    if (hasViolation) {
      let violationPhotoUrl = null

      if (photoFile) {
        // Upload photo to Supabase Storage
        const fileExt = photoFile.name.split('.').pop() || 'jpg'
        const fileName = `${mission.id}/${Date.now()}_violation.${fileExt}`
        
        try {
          const { data: uploadData, error: uploadError } = await supabase
            .storage
            .from('violation-photos')
            .upload(fileName, photoFile, {
              cacheControl: '3600',
              upsert: true
            })

          if (uploadError) {
            setLoading(false)
            setError(`فشل رفع الصورة: ${uploadError.message}`)
            return
          }

          // Get public URL
          const { data: { publicUrl } } = supabase
            .storage
            .from('violation-photos')
            .getPublicUrl(fileName)

          violationPhotoUrl = publicUrl
        } catch (uploadErr: any) {
          setLoading(false)
          setError(`خطأ أثناء رفع الصورة: ${uploadErr.message || uploadErr}`)
          return
        }
      }

      const { error: violationError } = await supabase.from('violations').insert({
        assigned_to_dept: correctionUnit.trim(),
        description: violationDescription.trim(),
        facility_id: destinationType === 'facility' ? savedActualFacilityId : null,
        mission_id: mission.id,
        priority: violationPriority,
        status: 'new',
        violation_photo_url: violationPhotoUrl,
      })

      if (violationError) {
        setLoading(false)
        setError(violationError.message)
        return
      }

      setCorrectionUnit('')
      setViolationDescription('')
      setViolationPriority('medium')
      handleRemovePhoto()
    }

    // Save dynamic checklist results via our secure backend API route to clear old and write fresh results cleanly
    if (Object.keys(answers).length > 0) {
      const resultsPayload = Object.entries(answers).map(([itemId, val]) => {
        const isStatic = itemId.startsWith('item-')
        const checklist_item_id = isStatic ? null : itemId
        const notes = isStatic 
          ? `__static_id__:${itemId}||${val.notes || ''}` 
          : (val.notes || null)

        return {
          checklist_item_id,
          answer: val.answer,
          notes
        }
      })

      try {
        const resultsRes = await fetch('/api/missions/results', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            mission_id: mission.id,
            results: resultsPayload
          })
        })

        if (!resultsRes.ok) {
          const resultsErr = await resultsRes.json().catch(() => ({}))
          console.error('Error saving mission results via API:', resultsErr.error)
        }
      } catch (err) {
        console.error('Network error saving mission results:', err)
      }
    }

    setLoading(false)
    setSuccess(status === 'completed' ? 'تم إنهاء المأمورية وتوثيق الحضور جغرافياً.' : 'تم بدء/تحديث المأمورية.')
    router.refresh()
  }

  const expectedEndDate = useMemo(() => {
    if (mission.notes) {
      const matches = mission.notes.match(/تاريخ الانتهاء المتوقع:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/g);
      if (matches && matches.length > 0) {
        const lastMatch = matches[matches.length - 1];
        return lastMatch.replace(/تاريخ الانتهاء المتوقع:\s*/, '').trim();
      }
    }
    return mission.scheduled_date || '';
  }, [mission.notes, mission.scheduled_date])

  const targetStartDate = mission.scheduled_date || '';

  const parseLocalDate = (dateStr: string) => {
    if (!dateStr) return null;
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  };

  const sDate = parseLocalDate(targetStartDate);
  const eDate = parseLocalDate(expectedEndDate);
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  const isBefore = sDate ? todayDate < sDate : false;
  const isAfter = eDate ? todayDate > eDate : false;
  const isLocked = isBefore || isAfter;

  if (isLocked && currentUserLevel === 7 && !bypassLock) {
    return (
      <div style={{
        background: 'white',
        border: '1px solid #ffcdd2',
        borderRadius: '16px',
        padding: '40px 24px',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '40px auto',
        boxShadow: '0 10px 30px rgba(198, 40, 40, 0.05)',
        direction: 'rtl'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          background: '#ffebee',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          color: '#c62828',
          fontSize: '36px',
          border: '2px solid #ffcdd2'
        }}>
          🔒
        </div>
        <h2 style={{
          color: '#b71c1c',
          fontSize: '22px',
          fontWeight: '800',
          marginBottom: '12px'
        }}>
          تنبيه أمني وصلاحية: المأمورية مغلقة للتنفيذ
        </h2>
        <p style={{
          color: '#546e7a',
          fontSize: '14.5px',
          lineHeight: '1.6',
          marginBottom: '24px'
        }}>
          عذراً، لقد تم حظر فتح استمارة المرور لهذه المأمورية رقم <strong style={{ color: '#102027' }}>({mission.serial_number})</strong> نظراً لأن تاريخ اليوم يقع خارج النطاق الزمني المصرح به رسمياً للتنفيذ الميداني.
        </p>

        <div style={{
          background: '#f7f9fa',
          borderRadius: '12px',
          padding: '16px 20px',
          border: '1px solid #cfd8dc',
          display: 'grid',
          gap: '10px',
          textAlign: 'right',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#78909c' }}>تاريخ التحرك والبدء:</span>
            <strong style={{ fontSize: '14px', color: '#37474f', direction: 'ltr' }}>{targetStartDate}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#78909c' }}>تاريخ الانتهاء المعتمد (الفعلي):</span>
            <strong style={{ fontSize: '14px', color: '#e53935', direction: 'ltr' }}>{expectedEndDate}</strong>
          </div>
          <div style={{ height: '1px', background: '#cfd8dc', margin: '4px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13.5px', color: '#006d77', fontWeight: 'bold' }}>تاريخ اليوم بالخلفية:</span>
            <strong style={{ fontSize: '14px', color: '#006d77', direction: 'ltr', fontWeight: '800' }}>
              {new Date().toLocaleDateString('en-CA')}
            </strong>
          </div>
        </div>

        <div style={{
          background: '#fff8e1',
          border: '1px solid #ffe082',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '13px',
          color: '#b78103',
          textAlign: 'right',
          lineHeight: '1.5',
          display: 'flex',
          gap: '10px',
          alignItems: 'flex-start',
          marginBottom: '24px'
        }}>
          <span style={{ fontSize: '18px', marginTop: '-2px' }}>💡</span>
          <div>
            <strong>نظام الحوكمة والمطابقة الذكية:</strong> يرتبط تفعيل استمارات المرور وقفلها تلقائياً بالتواريخ المدرجة بقرار التكليف الصادر. لا يسمح للقائم بالمرور (المفتش) بتخطي الصلاحية التاريخية لحماية نزاهة ودقة الجداول الزمنية للزيارات.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => router.push('/dashboard/missions')}
            style={{
              background: '#37474f',
              color: 'white',
              border: 0,
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '13.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            ← العودة لجدول المأموريات
          </button>
        </div>
      </div>
    )
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

      {/* GPS MOBILE CHECK-IN VERIFICATION PANEL */}
      <div style={{
        background: '#f0f9f8',
        border: '1px solid #ccebe6',
        borderRadius: '12px',
        padding: '16px',
        display: 'grid',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 'bold', color: '#006d77' }}>📍 التوثيق الجغرافي التلقائي ومنع التلاعب (Automated GPS Verification & Anti-Tampering)</span>
            <span style={{ fontSize: '11px', color: '#546e7a' }}>يتم التقاط ومطابقة موقعك الجغرافي تلقائياً بالخلفية فور فتح الزيارة لإثبات وتأكيد الحضور الفعلي ميدانياً ومنع أي تلاعب بالتكليفات.</span>
          </div>
          <button
            type="button"
            onClick={captureInspectorGPS}
            disabled={gpsLoading}
            style={{
              background: 'var(--brand)',
              color: 'white',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(0, 109, 119, 0.2)'
            }}
          >
            {gpsLoading ? (
              <>
                <div className={styles.spinner} style={{ borderColor: '#e0f0f1', borderTopColor: 'white' }} />
                جاري تحديد موقعك...
              </>
            ) : (
              '📍 تحديد موقعي والتحقق الجغرافي'
            )}
          </button>
        </div>

        {/* GPS STATE VISUAL FEEDBACK BOX */}
        {gpsStatus !== 'idle' && (
          <div style={{
            background: 'white',
            border: `1px solid ${gpsStatus === 'success' ? '#81c784' : gpsStatus === 'warn' ? '#ffb74d' : '#e57373'}`,
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: gpsStatus === 'success' ? '#e8f5e9' : gpsStatus === 'warn' ? '#fff3e0' : '#ffebee',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              fontWeight: 'bold',
              color: gpsStatus === 'success' ? '#2e7d32' : gpsStatus === 'warn' ? '#e65100' : '#c62828'
            }}>
              {gpsStatus === 'success' ? '✓' : gpsStatus === 'warn' ? '⚠️' : '❌'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <strong style={{ fontSize: '13px', color: gpsStatus === 'success' ? '#2e7d32' : gpsStatus === 'warn' ? '#e65100' : '#c62828' }}>
                  {gpsStatus === 'success' && 'تم توثيق الحضور الجغرافي بنجاح!'}
                  {gpsStatus === 'warn' && 'تنبيه: الموقع بعيد عن إحداثيات المستشفى!'}
                  {gpsStatus === 'error' && 'فشل الاتصال بالـ GPS!'}
                </strong>
                {inspectorLat && (
                  <span style={{ fontSize: '10.5px', background: '#f0f4f8', color: '#455a64', padding: '2px 8px', borderRadius: '4px', direction: 'ltr' }}>
                    Lat: {inspectorLat.toFixed(5)}, Lng: {inspectorLng?.toFixed(5)}
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#455a64', lineHeight: '1.4' }}>
                {gpsStatus === 'success' && (
                  gpsDistance !== null 
                    ? `تطابق رائع! أنت على بُعد ${gpsDistance} متر فقط من الموقع المسجل للمستشفى. تم إثبات الزيارة فعلياً بنجاح.` 
                    : 'تم التقاط إحداثيات موقعك بنجاح. سيتم توثيق هذه الإحداثيات رسمياً لإدراج المنشأة الجديدة في مكانك الحالي.'
                )}
                {gpsStatus === 'warn' && (
                  `يبعد موقعك الحالي مسافة ${gpsDistance} متر عن الإحداثيات الرسمية للمستشفى. سيتم حفظ هذا التباين للتوثيق والحوكمة الإدارية.`
                )}
                {gpsStatus === 'error' && 'تعذر قراءة الـ GPS. يرجى التأكد من تشغيل الموقع الجغرافي بهاتفك ومنح المتصفح صلاحية الوصول لإثبات الزيارة.'}
              </p>
            </div>
          </div>
        )}

        {/* INTERACTIVE GEOLOCATION PIN ADJUSTER MAP */}
        {inspectorLat && inspectorLng && (
          <div style={{ display: 'grid', gap: '6px', background: 'white', border: '1px solid #ccebe6', borderRadius: '10px', padding: '12px', marginTop: '4px' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#006d77', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🗺️ خريطة التحقق الميداني التفاعلية (انقر على الخريطة أو اسحب الدبوس لضبط موقعك بدقة بالغة):
            </span>
            <div id="execution-map" style={{
              height: '240px',
              borderRadius: '8px',
              border: '1px solid #cfdcde',
              overflow: 'hidden',
              background: '#eceff1',
              boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
            }}>
              {!leafletLoaded && (
                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#78909c', fontSize: '12px' }}>
                  جاري تحميل الخريطة التفاعلية...
                </div>
              )}
            </div>
            <span style={{ fontSize: '11px', color: '#546e7a' }}>
              💡 إذا كان استقبال الـ GPS ضعيفاً أو كنت داخل مبنى خرساني مغلق، يمكنك نقر الخريطة أو سحب الدبوس لتحديد مكانك بدقة، وسيعيد النظام احتساب المسافة والمطابقة الجغرافية فوراً لمنع التلاعب الجغرافي.
            </span>
          </div>
        )}
      </div>

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
          <div style={{ gridColumn: '1 / -1', display: 'grid', gap: '14px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', background: '#f8fbfb', border: '1px solid #cfdcde', padding: '12px', borderRadius: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>تسجيل زيارة المنشأة:</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#102027', cursor: 'pointer', margin: 0 }}>
                <input
                  type="radio"
                  name="facility_select_mode"
                  checked={!isUnregisteredFacility}
                  onChange={() => {
                    setIsUnregisteredFacility(false)
                    setGpsStatus('idle')
                  }}
                />
                منشأة مسجلة بالنظام
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#102027', cursor: 'pointer', margin: 0 }}>
                <input
                  type="radio"
                  name="facility_select_mode"
                  checked={isUnregisteredFacility}
                  onChange={() => {
                    setIsUnregisteredFacility(true)
                    setGpsStatus('idle')
                  }}
                />
                <span style={{ color: 'var(--brand)', fontWeight: 'bold' }}>➕ تسجيل منشأة جديدة غير مدرجة</span>
              </label>
            </div>

            {!isUnregisteredFacility ? (
              <div style={{ display: 'grid', gap: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>اختر المنشأة التي تم المرور عليها *</span>
                <SearchableAddableSelect
                  options={facilityOptions}
                  value={actualFacilityId}
                  onChange={(val) => handleFacilityChange(val)}
                  placeholder="🔍 اكتب اسم المنشأة أو المحافظة للبحث الفوري..."
                />
                {selectedFacility && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#006d77', fontWeight: 'bold', background: '#e0f2f1', padding: '6px 12px', borderRadius: '6px', marginTop: '4px' }}>
                    <span>🏥 المنشأة المحددة:</span>
                    <span>{selectedFacility.name} {selectedFacility.address ? `— ${selectedFacility.address}` : ''}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                background: '#fffbf7',
                border: '1px solid #ffe8cc',
                borderRadius: '10px',
                padding: '16px',
                display: 'grid',
                gap: '12px',
                animation: 'fadeIn 0.2s'
              }}>
                <strong style={{ fontSize: '13.5px', color: '#e65100' }}>➕ تسجيل منشأة صحية جديدة ميدانياً وتوثيقها فوراً بالـ GPS:</strong>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px', color: '#37474f' }}>
                    اسم المنشأة الجديدة *
                    <input
                      type="text"
                      value={newFacilityName}
                      onChange={(e) => setNewFacilityName(e.target.value)}
                      placeholder="مثال: وحدة الرعاية الصحية بقرية السلام"
                      style={{ background: 'white' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px', color: '#37474f' }}>
                    نوع وتصنيف المنشأة *
                    <select
                      value={newFacilityType}
                      onChange={(e) => setNewFacilityType(e.target.value)}
                      style={{ background: 'white' }}
                    >
                      {FACILITY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px', color: '#37474f' }}>
                    المحافظة الجغرافية للمنشأة *
                    <select
                      value={newFacilityGovId}
                      onChange={(e) => setNewFacilityGovId(e.target.value)}
                      style={{ background: 'white' }}
                    >
                      <option value="">اختر المحافظة</option>
                      {governorates.map((gov) => (
                        <option key={gov.id} value={gov.id}>{gov.name}</option>
                      ))}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px', color: '#37474f' }}>
                    العنوان التفصيلي
                    <input
                      type="text"
                      value={newFacilityAddress}
                      onChange={(e) => setNewFacilityAddress(e.target.value)}
                      placeholder="الشارع، المنطقة، أو أقرب علامة مميزة"
                      style={{ background: 'white' }}
                    />
                  </label>
                </div>

                <p style={{ margin: 0, fontSize: '11.5px', color: '#e65100', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💡 سيتم التقاط إحداثيات الهاتف الحالية ({inspectorLat ? `خط عرض: ${inspectorLat.toFixed(5)}، خط طول: ${inspectorLng?.toFixed(5)}` : 'يرجى النقر على زر التوثيق الجغرافي بالأعلى'}) لتسجيل هذه المنشأة الجديدة على خريطة الدولة تلقائياً!
                </p>
              </div>
            )}
          </div>
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

        <div style={{ position: 'relative', display: 'grid', gap: '7px' }} className={styles.wide}>
          <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#42555d', fontSize: '14px', fontWeight: 'bold' }}>
            <span>📋 توصيات وقرارات المأمورية الميدانية</span>
            <span style={{ fontSize: '11.5px', color: '#006d77', background: '#e0f2f1', padding: '2px 8px', borderRadius: '12px', fontWeight: 'normal' }}>
              💡 اكتب @ للإشارة لمسؤول بالهيكل الإداري وإشعاره فوراً
            </span>
          </label>
          
          <div style={{ position: 'relative' }}>
            <textarea
              id="recommendations-textarea"
              value={recommendations}
              onChange={handleRecommendationsChange}
              onKeyDown={handleRecommendationsKeyDown}
              rows={4}
              placeholder="مثال: يرجى التنبيه على @د. أحمد عبد الرحمن لتوفير المستلزمات الطبية اللازمة لقسم الطوارئ فوراً..."
              style={{ width: '100%', background: '#f8fbfb', border: '1px solid #cfdcde', borderRadius: '8px', color: '#102027', font: 'inherit', padding: '10px 12px', resize: 'vertical', minHeight: '88px' }}
            />
            
            {mentionOpen && filteredUsers.length > 0 && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                right: '0',
                left: '0',
                zIndex: 50,
                marginBottom: '6px',
                maxHeight: '220px',
                overflowY: 'auto',
                background: 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(8px)',
                border: '1px solid #006d77',
                borderRadius: '8px',
                boxShadow: '0 4px 20px rgba(0, 109, 119, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                padding: '4px'
              }}>
                <div style={{
                  padding: '6px 10px',
                  fontSize: '11px',
                  color: '#546e7a',
                  borderBottom: '1px solid #e0f0f1',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>مسؤولين متاحين للإشعار (مستويات أقل إدارياً):</span>
                  <span>اضغط Tab/Enter أو انقر للاختيار</span>
                </div>
                {filteredUsers.map((u, index) => {
                  const isActive = index === mentionActiveIndex
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => insertMention(u)}
                      onMouseEnter={() => setMentionActiveIndex(index)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        border: 0,
                        borderRadius: '6px',
                        background: isActive ? '#006d77' : 'transparent',
                        color: isActive ? 'white' : '#102027',
                        cursor: 'pointer',
                        textAlign: 'right',
                        width: '100%',
                        transition: 'all 0.1s ease',
                        gap: '8px',
                        font: 'inherit'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', flex: 1 }}>
                        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{u.full_name}</span>
                        <span style={{ fontSize: '11px', color: isActive ? '#b2dfdb' : '#64747d', marginTop: '2px' }}>
                          {u.job_title} • {u.department || 'إدارة غير محددة'}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: isActive ? 'rgba(255,255,255,0.2)' : '#e0f2f1',
                        color: isActive ? '#006d77' : '#006d77',
                        fontWeight: 'bold'
                      }}>
                        مستوى {u.level}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            
            {mentionOpen && filteredUsers.length === 0 && (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                right: '0',
                left: '0',
                zIndex: 50,
                marginBottom: '6px',
                background: 'white',
                border: '1px solid #cfdcde',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                padding: '12px',
                color: '#78909c',
                fontSize: '12.5px',
                textAlign: 'center'
              }}>
                🔍 لم يتم العثور على مسؤولين متوافقين بالمستويات الأدنى...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Specialization Checklist */}
      <section className={styles.checklistSection}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #e0f0f0', paddingBottom: '12px', marginBottom: '16px' }}>
          <div>
            <span className={styles.checklistHeading}>قائمة بنود التفتيش التخصصية والمخصصة ({currentUserDept || 'المرور العام'})</span>
            <p className={styles.checklistSubheading}>يرجى الإجابة وتوثيق بنود الالتزام وتوليد المخالفات تلقائياً عند عدم المطابقة</p>
          </div>
          <button
            type="button"
            onClick={() => setShowChecklistBuilder(!showChecklistBuilder)}
            style={{
              background: showChecklistBuilder ? '#eceff1' : 'linear-gradient(135deg, #006d77 0%, #004d54 100%)',
              color: showChecklistBuilder ? '#37474f' : 'white',
              border: '1px solid ' + (showChecklistBuilder ? '#cfdcde' : 'transparent'),
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              boxShadow: showChecklistBuilder ? 'none' : '0 2px 6px rgba(0,109,119,0.12)'
            }}
          >
            {showChecklistBuilder ? '✕ إغلاق منشئ الاستمارات' : '➕ إنشاء استمارة مرور مخصصة فوراً'}
          </button>
        </div>

        {/* Dynamic Checklist Builder Container */}
        {showChecklistBuilder && (
          <div style={{
            background: 'linear-gradient(180deg, #fdfefe 0%, #f8fbfb 100%)',
            border: '2px dashed #006d77',
            borderRadius: '16px',
            padding: '20px',
            marginBottom: '20px',
            display: 'grid',
            gap: '16px',
            boxShadow: '0 4px 15px rgba(0,109,119,0.04)',
            animation: 'fadeIn 0.2s'
          }}>
            <h4 style={{ margin: 0, fontSize: '15px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #e0f0f0', paddingBottom: '8px' }}>
              🛠️ منشئ استمارات المرور الميدانية التفاعلي السريع (On-the-go Builder)
            </h4>

            {builderError && (
              <div style={{ background: '#fff3f3', border: '1px solid #ffcdd2', borderRadius: '6px', color: '#c62828', padding: '10px 14px', fontSize: '12.5px', fontWeight: 'bold' }}>
                {builderError}
              </div>
            )}
            {builderSuccess && (
              <div style={{ background: '#eaf8f3', border: '1px solid #ccebe6', borderRadius: '6px', color: '#16725a', padding: '10px 14px', fontSize: '12.5px', fontWeight: 'bold' }}>
                {builderSuccess}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                اسم استمارة المرور الجديدة *
                <input
                  type="text"
                  placeholder="مثال: تقييم النظافة والسلامة بقسم الطوارئ..."
                  value={newChecklistTitle}
                  onChange={(e) => setNewChecklistTitle(e.target.value)}
                  style={{ minHeight: '40px', borderRadius: '6px', border: '1px solid #cfdcde', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                نوع استمارة المرور / التصنيف
                <select
                  value={newChecklistType}
                  onChange={(e) => setNewChecklistType(e.target.value)}
                  style={{ minHeight: '40px', borderRadius: '6px', border: '1px solid #cfdcde', padding: '0 10px', fontSize: '13px', background: 'white', outline: 'none' }}
                >
                  <option value="دوري">دوري عادي</option>
                  <option value="مفاجئ">مرور مفاجئ</option>
                  <option value="استثنائي">استثنائي طارئ</option>
                  <option value="توجيهي">توجيهي محوكم</option>
                </select>
              </label>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#006d77' }}>أسئلة وبنود التقييم الفني:</span>
              
              {newQuestions.map((q, idx) => (
                <div key={idx} style={{
                  background: 'white',
                  border: '1px solid #cfdcde',
                  borderRadius: '10px',
                  padding: '14px',
                  display: 'grid',
                  gap: '12px',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#546e7a' }}>البند / السؤال رقم {idx + 1}</span>
                    {newQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBuilderQuestion(idx)}
                        style={{ background: 'transparent', border: 0, color: '#d32f2f', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        ✕ إزالة البند
                      </button>
                    )}
                  </div>

                  <textarea
                    placeholder="اكتب السؤال بوضوح، مثال: هل أجهزة التعقيم تعمل بشكل سليم ويتم توثيق قراءات الضغط؟..."
                    value={q.text}
                    onChange={(e) => updateBuilderQuestion(idx, 'text', e.target.value)}
                    rows={2}
                    style={{ width: '100%', borderRadius: '6px', border: '1px solid #cfdcde', padding: '8px 10px', fontSize: '13px', outline: 'none', resize: 'vertical' }}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px', color: '#546e7a', fontWeight: 'bold' }}>
                      نوع الإجابة المطلوبة
                      <select
                        value={q.type}
                        onChange={(e) => updateBuilderQuestion(idx, 'type', e.target.value)}
                        style={{ minHeight: '34px', borderRadius: '4px', border: '1px solid #cfdcde', fontSize: '12px', background: 'white', outline: 'none' }}
                      >
                        <option value="yes_no">ملتزم / غير ملتزم / لا ينطبق</option>
                        <option value="dropdown">قائمة اختيار مخصصة</option>
                        <option value="stars">تقييم بالنجوم (1 إلى 5 نجوم)</option>
                        <option value="text">ملاحظات نصية حرة</option>
                      </select>
                    </label>

                    <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px', color: '#546e7a', fontWeight: 'bold' }}>
                      مستوى الخطورة عند المخالفة
                      <select
                        value={q.priority}
                        onChange={(e) => updateBuilderQuestion(idx, 'priority', e.target.value)}
                        style={{ minHeight: '34px', borderRadius: '4px', border: '1px solid #cfdcde', fontSize: '12px', background: 'white', outline: 'none' }}
                      >
                        <option value="low">بسيطة (مهلة تصحيح 30 يوم)</option>
                        <option value="medium">متوسطة (مهلة تصحيح 7 أيام)</option>
                        <option value="high">عالية (مهلة تصحيح 3 أيام)</option>
                        <option value="critical">حرجة (تنبيه فوري 24 ساعة)</option>
                      </select>
                    </label>

                    <label style={{ display: 'grid', gap: '4px', fontSize: '11.5px', color: '#546e7a', fontWeight: 'bold' }}>
                      الإدارة المعنية بالتصحيح
                      <select
                        value={q.correctionDept}
                        onChange={(e) => updateBuilderQuestion(idx, 'correctionDept', e.target.value)}
                        style={{ minHeight: '34px', borderRadius: '4px', border: '1px solid #cfdcde', fontSize: '12px', background: 'white', outline: 'none' }}
                      >
                        <option value="إدارة الصيانة والتشغيل">إدارة الصيانة والتشغيل</option>
                        <option value="إدارة مكافحة العدوى">إدارة مكافحة العدوى</option>
                        <option value="إدارة التفتيش الصيدلي">إدارة التفتيش الصيدلي</option>
                        <option value="إدارة الجودة والسلامة">إدارة الجودة والسلامة</option>
                        <option value="إدارة التمريض">إدارة التمريض</option>
                        <option value="أخرى / جهات غير مصنفة">أخرى / جهات غير مصنفة</option>
                      </select>
                    </label>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addBuilderQuestion}
                style={{
                  background: '#eef6f6',
                  color: 'var(--brand)',
                  border: '1px dashed var(--brand)',
                  borderRadius: '8px',
                  minHeight: '38px',
                  fontWeight: 'bold',
                  fontSize: '12.5px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'all 0.15s'
                }}
              >
                ➕ إضافة بند / سؤال تقييمي جديد
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px', borderTop: '1px solid #e0f0f0', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowChecklistBuilder(false)}
                style={{ background: '#eceff1', border: 0, borderRadius: '6px', padding: '8px 16px', fontSize: '12.5px', fontWeight: 'bold', color: '#37474f', cursor: 'pointer' }}
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeployChecklist}
                style={{ background: 'linear-gradient(135deg, #006d77 0%, #004d54 100%)', border: 0, borderRadius: '6px', padding: '8px 24px', fontSize: '12.5px', fontWeight: 'bold', color: 'white', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,109,119,0.15)' }}
              >
                💾 اعتماد ونشر الاستمارة الجارية فورا
              </button>
            </div>
          </div>
        )}

        {/* If no checklists exist at all and builder is closed */}
        {checklistSections.length === 0 && !showChecklistBuilder && (
          <div style={{
            background: '#f8fbfb',
            border: '1px dashed #006d77',
            borderRadius: '12px',
            padding: '30px 20px',
            textAlign: 'center',
            color: '#546e7a',
            display: 'grid',
            gap: '12px',
            justifyItems: 'center',
            marginBottom: '20px'
          }}>
            <strong style={{ fontSize: '14.5px', color: '#102027' }}>لا توجد استمارات مرور جاهزة لتخصصك الجاري ({currentUserDept || 'المرور العام'})</strong>
            <p style={{ margin: 0, fontSize: '12.5px', maxWidth: '400px', lineHeight: '1.6' }}>
              حسابك لا يحتوي على بنود تفتيش معتمدة لهذا التخصص حالياً. يمكنك النقر على زر "➕ إنشاء استمارة مرور مخصصة فوراً" بالأعلى لتصميم وإنشاء استمارة مرور مخصصة ومطابقة فوراً لهذه المأمورية!
            </p>
          </div>
        )}

        {checklistSections.length > 0 && (() => {
          const CHECKLIST_STAGES = [
            { id: 0, title: 'الكل (37 قسماً)', icon: '📋', start: 1, end: 37 },
            { id: 1, title: 'البنية والخدمات', icon: '🏢', start: 1, end: 5 },
            { id: 2, title: 'الحوكمة والمخازن', icon: '📑', start: 6, end: 11 },
            { id: 3, title: 'الطوارئ والعيادات', icon: '🩺', start: 12, end: 17 },
            { id: 4, title: 'الأم والطفل والمبادرات', icon: '👶', start: 18, end: 25 },
            { id: 5, title: 'الخدمات والتعقيم', icon: '💊', start: 26, end: 37 }
          ];

          // Compute total and answered criteria counts
          let totalCriteria = 0;
          let answeredCriteria = 0;
          checklistSections.forEach((s: any) => {
            (s.items || []).forEach((it: any) => {
              totalCriteria++;
              if (answers[it.id]?.answer !== undefined && answers[it.id]?.answer !== '') {
                answeredCriteria++;
              }
            });
          });

          const progressPct = totalCriteria > 0 ? Math.round((answeredCriteria / totalCriteria) * 100) : 0;

          // Filter sections based on selected stage and search query
          const filteredSections = checklistSections.filter((section: any, sIdx: number) => {
            const secNum = sIdx + 1;
            
            if (searchQuery.trim()) {
              const q = searchQuery.trim().toLowerCase();
              const nameMatch = section.name.toLowerCase().includes(q);
              const itemMatch = (section.items || []).some((it: any) => (it.text || '').toLowerCase().includes(q));
              return nameMatch || itemMatch;
            }

            if (selectedStage > 0) {
              const currentStage = CHECKLIST_STAGES[selectedStage];
              return secNum >= currentStage.start && secNum <= currentStage.end;
            }

            return true;
          });

          return (
            <div style={{ display: 'grid', gap: '14px' }}>
              {/* Floating Live Progress Indicator */}
              <div className={styles.progressContainer}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#102027' }}>
                    📈 تقدم إنجاز الاستمارة ({answeredCriteria} من {totalCriteria} بنداً تم تقييمها)
                  </strong>
                  <span style={{ fontSize: '13px', fontWeight: 900, color: progressPct === 100 ? '#2a9d8f' : '#006d77' }}>
                    {progressPct}%
                  </span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                </div>
              </div>

              {/* Stage Stepper Tabs */}
              <div className={styles.stageStepper}>
                {CHECKLIST_STAGES.map((stg) => {
                  const isActive = selectedStage === stg.id;
                  return (
                    <button
                      key={stg.id}
                      type="button"
                      className={`${styles.stageBtn} ${isActive ? styles.stageBtnActive : ''}`}
                      onClick={() => {
                        setSelectedStage(stg.id);
                        setSearchQuery('');
                      }}
                    >
                      <span>{stg.icon}</span>
                      <span>{stg.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Instant Search Bar */}
              <div>
                <input
                  type="text"
                  className={styles.searchBar}
                  placeholder="🔍 بحث سريع في أسئلة وبنود التفتيش (مثلاً: تطعيمات، طوارئ، ألبان، نفايات...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Accordion Sections List */}
              <div className={styles.checklistGrid}>
                {filteredSections.map((section: any, sIdx: number) => {
                  const secId = String(section.id);
                  const isExpanded = expandedSections[secId] !== undefined 
                    ? expandedSections[secId] 
                    : (sIdx === 0 || searchQuery.trim().length > 0);

                  const sectionItems = section.items || [];
                  const secAnswered = sectionItems.filter((it: any) => answers[it.id]?.answer !== undefined && answers[it.id]?.answer !== '').length;
                  const isSecComplete = sectionItems.length > 0 && secAnswered === sectionItems.length;

                  return (
                    <div key={section.id} style={{ background: 'white', border: '1px solid #cfdcde', borderRadius: '12px', overflow: 'hidden', marginBottom: '8px' }}>
                      {/* Clickable Collapsible Accordion Header */}
                      <div
                        className={`${styles.accordionHeader} ${isExpanded ? styles.accordionHeaderOpen : ''}`}
                        onClick={() => {
                          setExpandedSections((prev) => ({
                            ...prev,
                            [secId]: !isExpanded
                          }));
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '14px', fontWeight: 900, color: '#006d77' }}>
                            {sIdx + 1}.
                          </span>
                          <strong style={{ fontSize: '14px', color: '#102027' }}>
                            {section.name}
                          </strong>
                          {isSecComplete ? (
                            <span style={{ fontSize: '11px', background: '#eaf8f3', color: '#16725a', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                              ✅ مكتمل ({secAnswered}/{sectionItems.length})
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', background: '#f0f4f6', color: '#546e7a', padding: '2px 8px', borderRadius: '12px' }}>
                              {secAnswered}/{sectionItems.length} تم الإجابة
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: '#006d77', fontWeight: 'bold' }}>
                            {isExpanded ? 'طي ▲' : 'فتح التقييم ▼'}
                          </span>
                        </div>
                      </div>

                      {/* Collapsible Section Body */}
                      {isExpanded && (
                        <div style={{ padding: '14px', display: 'grid', gap: '12px', background: '#ffffff', borderTop: '1px solid #eef6f6' }}>
                          {sectionItems.map((item: any) => {
                            const currentAnswer = answers[item.id]?.answer || '';
                            const answerType = item.answer_type || 'yes_no';
                            const optionsList = item.options
                              ? item.options.split(',').map((opt: string) => opt.trim()).filter(Boolean)
                              : [];

                            return (
                              <div
                                key={item.id}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  padding: '12px',
                                  background: '#f8fbfb',
                                  border: '1px solid #cfdcde',
                                  borderRadius: '10px',
                                  boxSizing: 'border-box',
                                  width: '100%'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                  <p style={{ margin: 0, fontSize: '13.5px', color: '#37474f', lineHeight: '1.6', fontWeight: 'bold', textAlign: 'right', flex: 1 }}>
                                    {item.text}
                                  </p>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      color: item.violation_priority === 'critical' ? '#d32f2f' : item.violation_priority === 'high' ? '#e65100' : '#f57c00',
                                      background: item.violation_priority === 'critical' ? '#ffebee' : '#fff3e0',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      flexShrink: 0
                                    }}
                                  >
                                    {item.violation_priority === 'critical' ? 'حرجة' : item.violation_priority === 'high' ? 'عالية' : item.violation_priority === 'medium' ? 'متوسطة' : 'بسيطة'}
                                  </span>
                                </div>

                                {/* Answers Touch Grid */}
                                <div style={{ marginTop: '4px', width: '100%' }}>
                                  {answerType === 'yes_no' && optionsList.length <= 3 && (
                                    <div className={styles.radioGroup}>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'yes' || currentAnswer === 'مطابق' || currentAnswer === 'ملتزم') ? styles.yesActive : ''}`}
                                        onClick={() => handleAnswerChange(item.id, 'yes', item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        مطابق
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'no' || currentAnswer === 'غير مطابق' || currentAnswer === 'غير ملتزم') ? styles.noActive : ''}`}
                                        onClick={() => handleAnswerChange(item.id, 'no', item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        غير مطابق
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'na' || currentAnswer === 'لا ينطبق' || currentAnswer === 'غير منطبق') ? styles.naActive : ''}`}
                                        onClick={() => handleAnswerChange(item.id, 'na', item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        لا ينطبق
                                      </button>
                                    </div>
                                  )}

                                  {(answerType === 'chips_options' || answerType === 'dropdown' || (answerType === 'yes_no' && optionsList.length > 3)) && (
                                    <div className={styles.chipsGroup}>
                                      {(optionsList.length > 0 ? optionsList : ['مطابق بالكامل', 'مطابق جزئياً', 'غير مطابق', 'لا ينطبق']).map((opt: string, oIdx: number) => {
                                        const isSelected = currentAnswer === opt;
                                        const isNonCompliant = opt.includes('غير مطابق') || opt.includes('غير ملتزم') || opt.includes('مخالف') || opt.includes('سلبي');
                                        const isPartial = opt.includes('جزئي') || opt.includes('متوسط') || opt.includes('مقبول');
                                        const isNA = opt.includes('ينطبق') || opt.includes('منطبق') || opt.includes('محايد');
                                        
                                        let activeClass = styles.chipActiveSuccess;
                                        if (isNonCompliant) activeClass = styles.chipActiveDanger;
                                        else if (isPartial) activeClass = styles.chipActiveWarn;
                                        else if (isNA) activeClass = styles.chipActiveMuted;

                                        return (
                                          <button
                                            key={oIdx}
                                            type="button"
                                            className={`${styles.chipBtn} ${isSelected ? activeClass : ''}`}
                                            onClick={() => {
                                              handleAnswerChangeCustom(
                                                item.id,
                                                opt,
                                                !isNonCompliant,
                                                item.violation_priority,
                                                item.correction_dept,
                                                item.text
                                              );
                                            }}
                                          >
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {answerType === 'checkbox' && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #cfdcde' }}>
                                      {optionsList.map((opt: string) => {
                                        const isChecked = Array.isArray(currentAnswer) ? currentAnswer.includes(opt) : currentAnswer === opt;
                                        return (
                                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#37474f', cursor: 'pointer', userSelect: 'none' }}>
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={(e) => {
                                                let nextVal: string[];
                                                if (Array.isArray(currentAnswer)) {
                                                  nextVal = e.target.checked
                                                    ? [...currentAnswer, opt]
                                                    : currentAnswer.filter((v) => v !== opt);
                                                } else {
                                                  nextVal = e.target.checked ? [opt] : [];
                                                }
                                                const isNonCompliant = nextVal.some(val => val.includes('غير') || val.includes('لا') || val.includes('مخالف'));
                                                handleAnswerChangeCustom(item.id, nextVal, !isNonCompliant, item.violation_priority, item.correction_dept, item.text);
                                              }}
                                            />
                                            {opt}
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </section>

      <section className={styles.violationBox}>
        <div>
          <span>تسجيل مخالفة وتوجيهها</span>
          <strong>اختر الإدارة المختصة أو اكتب إدارة جديدة</strong>
        </div>
        <div className={styles.grid}>
          <label className={styles.wide}>
            وصف المخالفة
            <textarea
              onChange={(event) => setViolationDescription(event.target.value)}
              placeholder="اكتب وصف المخالفة إن وجدت"
              rows={3}
              value={violationDescription}
            />
          </label>

          <div className={styles.wide}>
            <div className={styles.photoUploadContainer}>
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#42555d' }}>صورة المخالفة (اختياري)</span>
              
              {!photoPreview && !compressing && (
                <label className={styles.photoLabel}>
                  <Camera size={18} />
                  التقاط صورة من كاميرا الهاتف
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoChange}
                  />
                </label>
              )}

              {compressing && (
                <div className={styles.compressionLoader}>
                  <div className={styles.spinner} />
                  <span>جاري معالجة وضغط الصورة لتحسين سرعة الرفع...</span>
                </div>
              )}

              {photoPreview && (
                <div className={styles.photoPreviewContainer}>
                  <img
                    src={photoPreview}
                    alt="معاينة المخالفة"
                    className={styles.photoPreview}
                  />
                  <div className={styles.photoInfo}>
                    <span>تم التقاط الصورة بنجاح</span>
                    <small>
                      الحجم الأصلي: {photoSizeOriginal} | حجم الرفع: {photoSizeCompressed}
                    </small>
                  </div>
                  <button
                    type="button"
                    className={styles.removePhotoBtn}
                    onClick={handleRemovePhoto}
                    title="حذف الصورة"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <label>
            درجة الخطورة
            <select value={violationPriority} onChange={(event) => setViolationPriority(event.target.value as typeof violationPriority)}>
              <option value="low">بسيطة</option>
              <option value="medium">متوسطة</option>
              <option value="high">عالية</option>
              <option value="critical">حرجة</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
            الإدارة المختصة بالتصحيح *
            <SearchableAddableSelect
              options={localCorrectionUnits.map((unit) => ({
                value: unit.name,
                label: unit.name
              }))}
              value={correctionUnit}
              onChange={(val) => setCorrectionUnit(val)}
              placeholder="اختر أو ابحث عن الإدارة للتصحيح..."
              onAdd={handleAddCorrectionUnit}
            />
          </label>
        </div>
      </section>

      <div className={styles.mobileStickyBar}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#102027' }}>
            الامتثال: <strong style={{ color: answeredStats.rate >= 80 ? '#2a9d8f' : '#e76f51', fontSize: '15px' }}>{answeredStats.rate}%</strong>
            <span style={{ fontSize: '11px', color: '#78909c', marginRight: '6px' }}>({answeredStats.answered} بند مُقيّم)</span>
          </span>
          <span style={{ fontSize: '11px', color: answeredStats.nonCompliant > 0 ? '#c62828' : '#2a9d8f', fontWeight: 'bold' }}>
            {answeredStats.nonCompliant > 0 ? `⚠️ ${answeredStats.nonCompliant} مخالفة مرصودة` : '🟢 لا توجد مخالفات مسجلة'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            disabled={loading}
            onClick={() => save('in_progress')}
            style={{
              background: '#f0f4f8',
              color: '#37474f',
              border: '1px solid #cfdcde',
              borderRadius: '8px',
              padding: '10px 14px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            حفظ مسودة
          </button>
          <button
            type="button"
            className={styles.complete}
            disabled={loading}
            onClick={() => save('completed')}
            style={{
              background: 'var(--brand)',
              color: 'white',
              border: 0,
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '13.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 3px 12px rgba(0, 109, 119, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {loading ? 'جاري الإرسال...' : '💾 اعتماد وإرسال التقرير'}
          </button>
        </div>
      </div>
    </section>
  )
}
