'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { defaultCorrectionUnits, type CorrectionUnitOption } from '@/lib/correction-units'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Camera, Trash2, Building, Check, Star } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { getChecklistByDepartment } from '@/lib/checklist-data'
import styles from './execute.module.css'
import { SearchableAddableSelect } from '@/app/system-ui'
import { formatFacilityType } from '@/lib/facility-types'

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
  const [showChangeDestination, setShowChangeDestination] = useState(Boolean(mission.destination_changed || mission.change_reason))
  const [showMap, setShowMap] = useState(false)
  const [availableTemplates, setAvailableTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [correctionUnit, setCorrectionUnit] = useState('')
  const [localCorrectionUnits, setLocalCorrectionUnits] = useState(correctionUnits)

  const handleAddCorrectionUnit = (newName: string) => {
    const newUnit = { name: newName }
    setLocalCorrectionUnits(prev => [...prev, newUnit])
    setCorrectionUnit(newName)
  }

  // Selected Facility object helper
  const selectedFacility = useMemo(() => {
    if (!actualFacilityId) return null
    return facilities.find((f) => f.id === actualFacilityId) ?? null
  }, [facilities, actualFacilityId])

  // Filter and deduplicate correction units strictly by current facility's governorate
  const correctionUnitOptions = useMemo(() => {
    const currentGov = selectedFacility?.governorate || mission.governorates?.name || ''

    const list: { name: string }[] = defaultCorrectionUnits.map((name) => ({ name }))

    if (orgUnits && orgUnits.length > 0) {
      orgUnits.forEach((org: any) => {
        if (!org.name) return
        const isCentral = org.level && org.level <= 4
        const matchesGov =
          !currentGov ||
          !org.governorate ||
          org.governorate === currentGov ||
          (org.governorate_id && org.governorate_id === mission.target_governorate_id)

        if (isCentral || matchesGov) {
          list.push({ name: org.name })
        }
      })
    }

    localCorrectionUnits.forEach((u: any) => {
      if (u.name) list.push({ name: u.name })
    })

    // Deduplicate strictly by name
    const seen = new Set<string>()
    const uniqueOptions: { value: string; label: string }[] = []

    list.forEach((u) => {
      const trimmed = (u.name || '').trim()
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed)
        uniqueOptions.push({ value: trimmed, label: trimmed })
      }
    })

    return uniqueOptions
  }, [orgUnits, selectedFacility?.governorate, mission.governorates?.name, mission.target_governorate_id, localCorrectionUnits])

  const [changeReason, setChangeReason] = useState(mission.change_reason ?? '')

  const facilityOptions = useMemo(() => {
    return facilities.map((f: any) => ({
      value: f.id,
      label: `${f.name} ${f.governorate ? `(${f.governorate} - ${f.health_admin || f.address || formatFacilityType(f.facility_type)})` : (f.address ? `(${f.address})` : '')}`
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
  const [showLiveScoreModal, setShowLiveScoreModal] = useState<boolean>(false)
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false)
  const [showConfirmSubmitModal, setShowConfirmSubmitModal] = useState<boolean>(false)

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
    if (!leafletLoaded || !inspectorLat || !inspectorLng || !showMap) return
    const win = window as any
    const L = win.L
    if (!L) return

    const container = document.getElementById('execution-map')
    if (!container) return

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

    // If map already exists on a previous or detached container, remove it
    if (mapRef.current) {
      try {
        const mapContainer = mapRef.current.getContainer()
        if (!container.contains(mapContainer) && mapContainer !== container) {
          mapRef.current.remove()
          mapRef.current = null
          markerRef.current = null
          targetMarkerRef.current = null
          lineRef.current = null
        }
      } catch (err) {
        mapRef.current = null
      }
    }

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

    // Ensure map size is accurately calculated after browser DOM repaint
    const timer = setTimeout(() => {
      if (mapRef.current) {
        try {
          mapRef.current.invalidateSize()
        } catch (e) {}
      }
    }, 150)

    return () => clearTimeout(timer)

  }, [leafletLoaded, inspectorLat, inspectorLng, actualFacilityId, isUnregisteredFacility, showMap])

  // Checklist States & Dynamic Resolvers
  const [answers, setAnswers] = useState<Record<string, { answer: any; notes: string; photo_url?: string }>>(() => {
    const initial: Record<string, { answer: any; notes: string; photo_url?: string }> = {}
    if (savedResults && savedResults.length > 0) {
      savedResults.forEach((res: any) => {
        let itemId = res.checklist_item_id || res.item_id
        let notes = res.notes || ''
        
        // Handle prefix for custom/static items
        if (notes) {
          if (notes.startsWith('__item_id__:')) {
            const delimiterIdx = notes.indexOf('||')
            if (delimiterIdx !== -1) {
              itemId = notes.substring('__item_id__:'.length, delimiterIdx)
              notes = notes.substring(delimiterIdx + 2)
            }
          } else if (notes.startsWith('__static_id__:')) {
            const delimiterIdx = notes.indexOf('||')
            if (delimiterIdx !== -1) {
              itemId = notes.substring('__static_id__:'.length, delimiterIdx)
              notes = notes.substring(delimiterIdx + 2)
            }
          }
        }
        
        if (itemId) {
          initial[itemId] = {
            answer: res.answer,
            notes: notes,
            photo_url: res.photo_url || undefined
          }
        }
      })
    }
    return initial
  })

  // Per-question Note and Photo upload states
  const [uploadingItemPhoto, setUploadingItemPhoto] = useState<Record<string, boolean>>({})
  const [expandedItemNotes, setExpandedItemNotes] = useState<Record<string, boolean>>({})

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

  // Load official form templates and criteria from form_templates API
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

        const mappedTemplates: any[] = []
        templates.forEach((tmpl: any) => {
          const mappedSections: any[] = []
          ;(tmpl.sections || []).forEach((sec: any) => {
            const items = (sec.criteria || sec.checklist_items || [])
              .filter((c: any) => {
                const t = (c.criterion_text || c.text || '').trim()
                return !(
                  t === 'المجموع' ||
                  t.startsWith('المجموع الكلي') ||
                  t.startsWith('المجموع') ||
                  t === 'المعيار' ||
                  t === 'الدرجة' ||
                  t.includes('إجمالي الدرجات') ||
                  t === 'ملاحظات' ||
                  t === 'البيان' ||
                  t === 'م'
                )
              })
              .map((c: any) => {
                const scoreType = c.score_type || 'compliance_3level'
                const maxLabel = c.score_max_label || (scoreType === 'availability' ? 'متوفر ومطابق' : scoreType === 'yes_no' ? 'نعم' : 'مطابق')
                const midLabel = c.score_mid_label || (c.score_mid_value ? 'مطابق جزئياً' : '')
                const zeroLabel = c.score_0_label || (scoreType === 'availability' ? 'غير متوفر' : scoreType === 'yes_no' ? 'لا' : 'غير مطابق')
                const hasMid = Boolean(c.score_mid_value || scoreType === 'ternary' || scoreType === '3_level' || scoreType === 'compliance_3level')

                let optionsStr = c.options || ''
                if (!optionsStr) {
                  if (scoreType === 'availability') {
                    optionsStr = 'متوفر ومطابق, متوفر وغير مطابق, غير متوفر, لا ينطبق'
                  } else if (scoreType === 'yes_no') {
                    optionsStr = 'نعم, لا, لا ينطبق'
                  } else if (hasMid && midLabel) {
                    optionsStr = `${maxLabel}, ${midLabel}, ${zeroLabel}, لا ينطبق`
                  } else {
                    optionsStr = `${maxLabel}, ${zeroLabel}, لا ينطبق`
                  }
                }

                let computedAnswerType = 'yes_no'
                if (scoreType === 'rating_5') {
                  computedAnswerType = 'rating_5'
                } else if (scoreType === 'percentage') {
                  computedAnswerType = 'percentage'
                } else if (scoreType === 'availability') {
                  computedAnswerType = 'availability'
                } else if (scoreType === 'yes_no') {
                  computedAnswerType = 'yes_no'
                } else if (hasMid || scoreType === 'dropdown' || scoreType === 'ternary' || scoreType === 'compliance_3level') {
                  computedAnswerType = 'chips_options'
                }

                return {
                  id: c.id,
                  text: c.criterion_text || c.text,
                  answer_type: computedAnswerType,
                  score_type: scoreType,
                  is_required: true,
                  violation_priority: (c.score_max_value >= 4 ? 'high' : 'medium') as any,
                  correction_dept: sec.name,
                  options: optionsStr,
                  score_max_value: Number(c.score_max_value) || 2,
                  score_mid_value: Number(c.score_mid_value) || ((Number(c.score_max_value) || 2) * 0.5),
                  score_0_label: zeroLabel,
                  score_mid_label: midLabel,
                  score_max_label: maxLabel,
                  requires_photo: Boolean(c.requires_photo),
                  requires_note: Boolean(c.requires_note)
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

          mappedTemplates.push({
            id: tmpl.id,
            name: tmpl.name,
            version: tmpl.version,
            is_base: tmpl.is_base,
            sections: mappedSections
          })
        })

        if (mappedTemplates.length > 0) {
          setAvailableTemplates(mappedTemplates)
          const baseTmpl = mappedTemplates.find((t: any) => t.is_base) || mappedTemplates[0]
          setSelectedTemplateId(prev => prev || baseTmpl.id)
          setLocalCustomChecklists(baseTmpl.sections || [])
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
    // 1. Display official checklist sections and criteria from selected template
    if (availableTemplates.length > 0) {
      const activeTmpl = availableTemplates.find(t => t.id === selectedTemplateId) || availableTemplates[0]
      if (activeTmpl && activeTmpl.sections.length > 0) {
        return activeTmpl.sections
      }
    }

    if (localCustomChecklists.length > 0) {
      return localCustomChecklists
    }

    // 2. Fallback to built-in department checklist if API is unavailable
    const baseChecklist = getChecklistByDepartment(currentUserDept)
    return baseChecklist
  }, [currentUserDept, availableTemplates, selectedTemplateId, localCustomChecklists])

  // Live Real-Time Evaluation Metrics Computation
  const liveScoreStats = useMemo(() => {
    let totalScore = 0
    let maxScore = 0
    let answeredCount = 0
    let totalCount = 0
    let violationsCount = 0

    const sectionScores: Array<{
      id: string | number
      name: string
      earned: number
      max: number
      pct: number
      answered: number
      total: number
    }> = []

    checklistSections.forEach((sec: any) => {
      let secEarned = 0
      let secMax = 0
      let secAnswered = 0
      const secTotal = (sec.items || []).length

      ;(sec.items || []).forEach((item: any) => {
        totalCount++
        const ans = answers[item.id]?.answer
        if (ans !== undefined && ans !== null && ans !== '') {
          answeredCount++
          secAnswered++
          const itemMax = item.score_max_value || 2
          const itemMid = item.score_mid_value || 1

          if (ans === 'yes' || ans === 'مطابق' || ans === 'مطابق بالكامل' || ans === 'ملتزم' || ans === true || ans === 'متوفر' || ans === 'متوفر ومطابق' || ans === 'available') {
            totalScore += itemMax
            maxScore += itemMax
            secEarned += itemMax
            secMax += itemMax
          } else if (ans === 'مطابق جزئياً' || ans === 'متوسط' || ans === 'مقبول' || ans === 'partial' || ans === 'متوفر وغير مطابق') {
            totalScore += itemMid
            maxScore += itemMax
            secEarned += itemMid
            secMax += itemMax
            violationsCount++
          } else if (typeof ans === 'number') {
            let earned = 0
            if (item.answer_type === 'rating_5' || item.score_type === 'rating_5') {
              earned = (ans / 5) * itemMax
              if (ans <= 2) violationsCount++
            } else if (item.answer_type === 'percentage' || item.score_type === 'percentage') {
              earned = (ans / 100) * itemMax
              if (ans < 50) violationsCount++
            } else {
              earned = Math.min(itemMax, Math.max(0, ans))
            }
            totalScore += earned
            maxScore += itemMax
            secEarned += earned
            secMax += itemMax
          } else if (ans === 'no' || ans === 'غير مطابق' || ans === 'غير مطابق بالكامل' || ans === 'غير ملتزم' || ans === false || ans === 'غير متوفر' || ans === 'not_available') {
            maxScore += itemMax
            secMax += itemMax
            violationsCount++
          } else if (ans === 'na' || ans === 'لا ينطبق' || ans === 'غير منطبق') {
            // NA
          } else {
            totalScore += itemMax
            maxScore += itemMax
            secEarned += itemMax
            secMax += itemMax
          }
        }
      })

      const secPct = secMax > 0 ? Math.round((secEarned / secMax) * 100) : 0
      sectionScores.push({
        id: sec.id,
        name: sec.name,
        earned: secEarned,
        max: secMax,
        pct: secPct,
        answered: secAnswered,
        total: secTotal
      })
    })

    const overallPct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0

    return {
      totalScore,
      maxScore,
      answeredCount,
      totalCount,
      violationsCount,
      overallPct,
      sectionScores
    }
  }, [checklistSections, answers])

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
      [itemId]: {
        ...(current[itemId] || {}),
        answer,
        notes: current[itemId]?.notes || ''
      }
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
      [itemId]: {
        ...(current[itemId] || {}),
        answer: answerValue,
        notes: current[itemId]?.notes || ''
      }
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

  const handleItemNoteChange = (itemId: string, noteText: string) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { answer: '' }),
        notes: noteText
      }
    }))
  }

  const handleUploadItemPhoto = async (itemId: string, file: File) => {
    if (!file) return
    setUploadingItemPhoto((prev) => ({ ...prev, [itemId]: true }))
    setError('')
    try {
      let finalFile = file
      try {
        finalFile = await imageCompression(file, {
          maxSizeMB: 0.8,
          maxWidthOrHeight: 1600,
          useWebWorker: true
        })
      } catch (e) {
        console.warn('Image compression fallback for item photo:', e)
      }

      const ext = (finalFile.name.split('.').pop() || 'jpg').toLowerCase()
      const storagePath = `${mission.id}/items/${itemId}_${Date.now()}.${ext}`

      const formData = new FormData()
      formData.append('file', finalFile)
      formData.append('bucket', 'violation-photos')
      formData.append('path', storagePath)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error('فشل رفع الصورة على خادم التخزين السحابي')
      }

      const data = await res.json()
      const publicUrl = data.url

      setAnswers((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || { answer: '' }),
          photo_url: publicUrl
        }
      }))
      setSuccess('تم رفع صورة توثيق المعيار وحفظها بنجاح.')
      setTimeout(() => setSuccess(''), 4000)
    } catch (err: any) {
      alert('خطأ أثناء رفع الصورة: ' + (err.message || 'فشل الرفع'))
    } finally {
      setUploadingItemPhoto((prev) => ({ ...prev, [itemId]: false }))
    }
  }

  const handleRemoveItemPhoto = (itemId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { answer: '' }),
        photo_url: undefined
      }
    }))
  }

  function validateChecklistCompletion(): { valid: boolean; error?: string; targetItemId?: string; targetSectionId?: string } {
    const allSections = checklistSections
    if (!allSections || allSections.length === 0) {
      return { valid: true }
    }

    const unansweredList: { id: string; text: string; sectionName: string; sectionId: string }[] = []
    const missingPhotoList: { id: string; text: string; sectionName: string; sectionId: string }[] = []
    const missingNoteList: { id: string; text: string; sectionName: string; sectionId: string }[] = []
    let totalCriteria = 0

    allSections.forEach((sec: any) => {
      const items = sec.items || []
      items.forEach((item: any) => {
        totalCriteria++
        const ansObj = answers[item.id]
        const hasAnswer = ansObj?.answer !== undefined && ansObj?.answer !== null && ansObj?.answer !== ''

        if (!hasAnswer) {
          unansweredList.push({
            id: item.id,
            text: item.text,
            sectionName: sec.name || `القسم ${sec.section_number || ''}`,
            sectionId: sec.id
          })
        } else {
          if (item.requires_photo && !ansObj?.photo_url) {
            missingPhotoList.push({
              id: item.id,
              text: item.text,
              sectionName: sec.name || `القسم ${sec.section_number || ''}`,
              sectionId: sec.id
            })
          }
          if (item.requires_note && (!ansObj?.notes || !ansObj.notes.trim())) {
            missingNoteList.push({
              id: item.id,
              text: item.text,
              sectionName: sec.name || `القسم ${sec.section_number || ''}`,
              sectionId: sec.id
            })
          }
        }
      })
    })

    if (unansweredList.length > 0) {
      const first = unansweredList[0]
      return {
        valid: false,
        error: `⚠️ لا يمكن اعتماد المأمورية كمنتهية لوجود (${unansweredList.length}) معيار/سؤال لم تتم الإجابة عليه بعد (من إجمالي ${totalCriteria} معيار).\nيجب الإجابة على جميع المعايير أولاً.\nأول معيار غير مجاب: "${first.text}" في [${first.sectionName}].`,
        targetItemId: first.id,
        targetSectionId: first.sectionId
      }
    }

    if (missingPhotoList.length > 0) {
      const first = missingPhotoList[0]
      return {
        valid: false,
        error: `📷 المعيار "${first.text}" في [${first.sectionName}] يتطلب إرفاق صورة توثيقية إلزامية قبل اعتماد الاستمارة كمنتهية.`,
        targetItemId: first.id,
        targetSectionId: first.sectionId
      }
    }

    if (missingNoteList.length > 0) {
      const first = missingNoteList[0]
      return {
        valid: false,
        error: `📝 المعيار "${first.text}" في [${first.sectionName}] يتطلب كتابة ملاحظة توضيحية إلزامية قبل اعتماد الاستمارة كمنتهية.`,
        targetItemId: first.id,
        targetSectionId: first.sectionId
      }
    }

    return { valid: true }
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

  const changed =
    destinationType !== mission.destination_type ||
    actualFacilityId !== (mission.target_facility_id ?? '') ||
    actualGovernorateId !== (mission.target_governorate_id ?? '')

  function handleInitiateComplete() {
    setError('')
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

    if (!recommendations.trim()) {
      setError('حقل "توصيات وقرارات المأمورية الميدانية" إلزامي. يرجى كتابة التوصيات قبل الحفظ أو اعتماد التقرير.')
      return
    }

    if (violationDescription.trim() && !correctionUnit.trim()) {
      setError('يرجى اختيار أو كتابة الإدارة المختصة بالتصحيح.')
      return
    }

    // Strict validation: Do not allow completing the mission if any question is unanswered or missing required attachments
    const validation = validateChecklistCompletion()
    if (!validation.valid) {
      setError(validation.error || 'يرجى الإجابة على جميع المعايير والأسئلة أولاً.')
      if (validation.targetSectionId) {
        setExpandedSections((prev) => ({ ...prev, [validation.targetSectionId!]: true }))
      }
      if (validation.targetItemId) {
        setTimeout(() => {
          const el = document.getElementById(`criterion-card-${validation.targetItemId}`)
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 120)
      }
      return
    }

    setShowConfirmSubmitModal(true)
  }

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

    if (!recommendations.trim()) {
      setError('حقل "توصيات وقرارات المأمورية الميدانية" إلزامي. يرجى كتابة التوصيات قبل الحفظ أو اعتماد التقرير.')
      return
    }

    if (violationDescription.trim() && !correctionUnit.trim()) {
      setError('يرجى اختيار أو كتابة الإدارة المختصة بالتصحيح.')
      return
    }

    // Strict enforcement on final completion
    if (status === 'completed') {
      const validation = validateChecklistCompletion()
      if (!validation.valid) {
        setError(validation.error || 'لا يمكن اعتماد المأمورية كمنتهية قبل الإجابة على جميع المعايير.')
        if (validation.targetSectionId) {
          setExpandedSections((prev) => ({ ...prev, [validation.targetSectionId!]: true }))
        }
        if (validation.targetItemId) {
          setTimeout(() => {
            const el = document.getElementById(`criterion-card-${validation.targetItemId}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
          }, 120)
        }
        return
      }
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

    const finalFacilityId = (destinationType === 'facility' && savedActualFacilityId && String(savedActualFacilityId).trim()) 
      ? String(savedActualFacilityId).trim() 
      : ((mission as any).facility_id || mission.target_facility_id || null)

    const missionUpdatePayload: Record<string, any> = {
      facility_id: finalFacilityId,
      notes: finalExecutionNotes || mission.notes || null,
      status,
      gps_verified: gpsVerified,
      total_score: totalScore,
      max_score: maxScore,
      score_pct: scorePct,
      total_criteria: criteriaCount,
      violations_count: computedViolations,
      violation_count: computedViolations
    }

    if (mission.status === 'assigned' || !(mission as any).checkin_time) {
      missionUpdatePayload.checkin_time = now
    }

    if (inspectorLat !== null && inspectorLat !== undefined) {
      missionUpdatePayload.checkin_lat = inspectorLat
    }
    if (inspectorLng !== null && inspectorLng !== undefined) {
      missionUpdatePayload.checkin_lng = inspectorLng
    }

    if (status === 'completed') {
      missionUpdatePayload.completed_at = now
      missionUpdatePayload.checkout_time = now
      if (inspectorLat !== null && inspectorLat !== undefined) {
        missionUpdatePayload.checkout_lat = inspectorLat
      }
      if (inspectorLng !== null && inspectorLng !== undefined) {
        missionUpdatePayload.checkout_lng = inspectorLng
      }
    }

    const { error: updateError } = await supabase
      .from('missions')
      .update(missionUpdatePayload)
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
        // Upload photo via secure backend route with auto-bucket creation and service role
        const fileExt = photoFile.name.split('.').pop() || 'jpg'
        const fileName = `${mission.id}/${Date.now()}_violation.${fileExt}`
        
        try {
          const uploadFd = new FormData()
          uploadFd.append('file', photoFile)
          uploadFd.append('bucket', 'violation-photos')
          uploadFd.append('path', fileName)

          const upRes = await fetch('/api/upload', {
            method: 'POST',
            body: uploadFd
          })

          if (upRes.ok) {
            const upJson = await upRes.json()
            if (upJson.publicUrl) {
              violationPhotoUrl = upJson.publicUrl
            }
          } else {
            console.warn('Backend storage upload returned status:', upRes.status)
            // Fallback to local preview URL if server upload had an issue
            if (photoPreview) {
              violationPhotoUrl = photoPreview
            }
          }
        } catch (uploadErr: any) {
          console.error('Error during photo upload:', uploadErr)
          if (photoPreview) {
            violationPhotoUrl = photoPreview
          }
        }
      }

      const violationFacId = (destinationType === 'facility' && savedActualFacilityId && String(savedActualFacilityId).trim()) 
        ? String(savedActualFacilityId).trim() 
        : null

      const { error: violationError } = await supabase.from('violations').insert({
        assigned_to_dept: correctionUnit.trim() || null,
        description: violationDescription.trim(),
        facility_id: violationFacId,
        mission_id: mission.id,
        priority: violationPriority || 'medium',
        status: 'new',
        violation_photo_url: violationPhotoUrl || null,
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
      const resultsPayload = Object.entries(answers).map(([itemId, val]) => ({
        item_id: itemId,
        checklist_item_id: itemId,
        answer: val.answer,
        notes: val.notes || null,
        photo_url: val.photo_url || null
      }))

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
    if (status === 'completed') {
      setSuccess('تم اعتماد المأمورية وتوثيق الحضور والنتائج بنجاح.')
      setShowSuccessModal(true)
    } else {
      setSuccess('تم حفظ مسودة نتائج المأمورية بنجاح.')
    }
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
      <div className={styles.summary} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <span>الوجهة الأصلية</span>
            <strong>{mission.destination_type === 'governorate' ? mission.governorates?.name : mission.facilities?.name}</strong>
          </div>
          <div>
            <span>الغرض من الزيارة</span>
            <strong>{mission.visit_purpose || 'غير مسجل'}</strong>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/missions')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#ffffff',
            color: '#1e293b',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '7px 14px',
            fontSize: '12.5px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }}
        >
          ← العودة لجدول المأموريات
        </button>
      </div>

      {error && <div className={styles.error}>{error}</div>}
      {success && <div className={styles.success}>{success}</div>}

      {/* 2-COLUMN BALANCED TOP DASHBOARD (SIDE-BY-SIDE / متجاورة) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '14px',
        alignItems: 'start',
        marginBottom: '16px'
      }}>
        {/* Column 1: Official Target Facility & Emergency Destination Change */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {/* Target Facility Card */}
          <div style={{
            background: 'linear-gradient(135deg, #f0fdfa 0%, #e6fffa 100%)',
            border: '1px solid #99f6e4',
            borderRadius: '12px',
            padding: '16px',
            display: 'grid',
            gap: '10px',
            boxShadow: '0 2px 8px rgba(0,109,119,0.04)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>🏥</span>
                <div>
                  <span style={{ fontSize: '11px', color: '#0d9488', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    المنشأة المستهدفة بالمرور (المعتمدة بالتكليف)
                  </span>
                  <h3 style={{ margin: '2px 0 0', fontSize: '16px', fontWeight: 'bold', color: '#134e4a' }}>
                    {selectedFacility ? selectedFacility.name : (mission?.facilities?.name || 'منشأة تابعة للمحافظة')}
                  </h3>
                </div>
              </div>
              <span style={{
                background: '#ccfbf1',
                color: '#0f766e',
                border: '1px solid #5eead4',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 'bold',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                🔒 وجهة معتمدة بالتكليف
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '12px', color: '#334155', borderTop: '1px solid #ccfbf1', paddingTop: '8px' }}>
              {selectedFacility?.facility_type && (
                <span><strong>النوع:</strong> {selectedFacility.facility_type}</span>
              )}
              {selectedFacility?.governorate && (
                <span><strong>المحافظة:</strong> {selectedFacility.governorate}</span>
              )}
              {selectedFacility?.health_admin && (
                <span><strong>الإدارة الصحية:</strong> {selectedFacility.health_admin}</span>
              )}
              {selectedFacility?.address && (
                <span><strong>العنوان:</strong> {selectedFacility.address}</span>
              )}
            </div>
          </div>

          {/* Collapsible Destination Change Accordion */}
          <div style={{
            background: '#ffffff',
            border: showChangeDestination ? '1px solid #f59e0b' : '1px solid #e2e8f0',
            borderRadius: '12px',
            overflow: 'hidden',
            transition: 'all 0.2s ease'
          }}>
            <button
              type="button"
              onClick={() => setShowChangeDestination(!showChangeDestination)}
              style={{
                width: '100%',
                padding: '12px 14px',
                background: showChangeDestination ? '#fffbeb' : '#f8fafc',
                border: 'none',
                borderBottom: showChangeDestination ? '1px solid #fde68a' : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                textAlign: 'right'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px' }}>🔄</span>
                <div>
                  <strong style={{ fontSize: '12.5px', color: showChangeDestination ? '#b45309' : '#475569' }}>
                    طلب تغيير الوجهة أو تسجيل منشأة بديلة اضطرارياً (اختياري)
                  </strong>
                  <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>
                    {showChangeDestination ? 'انقر للطي والالتزام بالمنشأة المعتمدة' : 'في حال تعذر الوصول للمنشأة المقررة'}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: '12px', color: showChangeDestination ? '#b45309' : '#94a3b8', fontWeight: 'bold' }}>
                {showChangeDestination ? '▲ طي' : '▼ فتح'}
              </span>
            </button>

            {showChangeDestination && (
              <div style={{ padding: '14px', display: 'grid', gap: '12px', background: '#fffefc' }}>
                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400e' }}>
                  ⚠️ <strong>تنبيه إداري:</strong> تغيير الوجهة عن التكليف المعتمد يتطلب كتابة سبب التغيير وسيتم توثيقه في تقرير الحوكمة.
                </div>

                <div className={styles.segmented}>
                  <button className={destinationType === 'facility' ? styles.active : ''} type="button" onClick={() => setDestinationType('facility')}>
                    منشأة بديلة
                  </button>
                  <button className={destinationType === 'governorate' ? styles.active : ''} type="button" onClick={() => setDestinationType('governorate')}>
                    محافظة بديلة
                  </button>
                </div>

                {destinationType === 'facility' ? (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 12px', borderRadius: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>نوع المنشأة البديلة:</span>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1e293b', cursor: 'pointer', margin: 0 }}>
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
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#1e293b', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="radio"
                          name="facility_select_mode"
                          checked={isUnregisteredFacility}
                          onChange={() => {
                            setIsUnregisteredFacility(true)
                            setGpsStatus('idle')
                          }}
                        />
                        <span style={{ color: '#d97706', fontWeight: 'bold' }}>➕ تسجيل منشأة جديدة غير مدرجة</span>
                      </label>
                    </div>

                    {!isUnregisteredFacility ? (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#334155' }}>اختر المنشأة البديلة *</span>
                        <SearchableAddableSelect
                          options={facilityOptions}
                          value={actualFacilityId}
                          onChange={(val) => handleFacilityChange(val)}
                          placeholder="🔍 اكتب اسم المنشأة أو المحافظة للبحث الفوري..."
                        />
                      </div>
                    ) : (
                      <div style={{
                        background: '#fffbf7',
                        border: '1px solid #ffe8cc',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'grid',
                        gap: '10px'
                      }}>
                        <strong style={{ fontSize: '12.5px', color: '#ea580c' }}>➕ تسجيل منشأة صحية جديدة ميدانياً وتوثيقها فوراً بالـ GPS:</strong>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#334155' }}>
                            اسم المنشأة الجديدة *
                            <input
                              type="text"
                              value={newFacilityName}
                              onChange={(e) => setNewFacilityName(e.target.value)}
                              placeholder="مثال: وحدة الرعاية الصحية بقرية السلام"
                              style={{ background: 'white' }}
                            />
                          </label>
                          <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#334155' }}>
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

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#334155' }}>
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
                          <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#334155' }}>
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
                      </div>
                    )}
                  </div>
                ) : (
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px', color: '#334155' }}>
                    المحافظة البديلة التي تم التوجه إليها *
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

                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#334155' }}>
                  <span style={{ fontWeight: 'bold', color: '#b45309' }}>سبب تغيير الوجهة *</span>
                  <textarea
                    value={changeReason}
                    onChange={(event) => setChangeReason(event.target.value)}
                    rows={2}
                    placeholder="يرجى كتابة سبب تغيير المنشأة أو المحافظة المقررة في أمر التكليف..."
                    style={{ width: '100%', borderRadius: '6px', border: '1px solid #cbd5e1', padding: '8px' }}
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Column 2: GPS Attendance & Interactive Verification Map */}
        <div style={{ display: 'grid', gap: '10px' }}>
          {/* GPS Check-in Card */}
          <div style={{
            background: '#ffffff',
            border: '1px solid #ccebe6',
            borderRadius: '12px',
            padding: '14px',
            display: 'grid',
            gap: '10px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#006d77' }}>
                  📍 إثبات الحضور والموقع الميداني (GPS)
                </span>
                <span style={{ fontSize: '11px', color: '#546e7a' }}>
                  مطابقة موقعك تلقائياً لإثبات الحضور ومنع التلاعب
                </span>
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
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(0, 109, 119, 0.15)'
                }}
              >
                {gpsLoading ? (
                  <>
                    <div className={styles.spinner} style={{ borderColor: '#e0f0f1', borderTopColor: 'white' }} />
                    جاري التحديد...
                  </>
                ) : (
                  '📍 تحديث موقعي'
                )}
              </button>
            </div>

            {/* GPS Feedback Box */}
            {gpsStatus !== 'idle' && (
              <div style={{
                background: gpsStatus === 'success' ? '#f0fdf4' : gpsStatus === 'warn' ? '#fffbeb' : '#fef2f2',
                border: `1px solid ${gpsStatus === 'success' ? '#86efac' : gpsStatus === 'warn' ? '#fde68a' : '#fca5a5'}`,
                borderRadius: '8px',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '16px' }}>
                  {gpsStatus === 'success' ? '✅' : gpsStatus === 'warn' ? '⚠️' : '❌'}
                </span>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                  <strong style={{ fontSize: '12px', color: gpsStatus === 'success' ? '#15803d' : gpsStatus === 'warn' ? '#b45309' : '#b91c1c' }}>
                    {gpsStatus === 'success' && 'تم توثيق الحضور الجغرافي بنجاح!'}
                    {gpsStatus === 'warn' && (gpsDistance !== null ? `تنبيه: يبعد ${gpsDistance}م عن إحداثيات المستشفى!` : 'تنبيه: الموقع بعيد عن المستشفى!')}
                    {gpsStatus === 'error' && 'تعذر تحديد الموقع بدقة!'}
                  </strong>
                  {inspectorLat && (
                    <span style={{ fontSize: '10px', background: 'white', border: '1px solid #e2e8f0', color: '#475569', padding: '1px 6px', borderRadius: '4px', direction: 'ltr' }}>
                      Lat: {inspectorLat.toFixed(5)}, Lng: {inspectorLng?.toFixed(5)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Collapsible Interactive Map Toggle & Content */}
            {inspectorLat && inspectorLng && (
              <div style={{ marginTop: '2px' }}>
                <button
                  type="button"
                  onClick={() => setShowMap(!showMap)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    background: '#f0f9f8',
                    border: '1px solid #b2dfdb',
                    borderRadius: showMap ? '8px 8px 0 0' : '8px',
                    color: '#006d77',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🗺️ خريطة التحقق والمطابقة الجغرافية التفاعلية
                  </span>
                  <span style={{ fontSize: '11px', color: '#006d77', background: '#e0f2f1', padding: '2px 6px', borderRadius: '10px' }}>
                    {showMap ? 'إخفاء الخريطة ▲' : 'عرض الخريطة وضبط الدبوس ▼'}
                  </span>
                </button>

                {showMap && (
                  <div style={{ display: 'grid', gap: '6px', background: 'white', border: '1px solid #b2dfdb', borderTop: 'none', borderBottomLeftRadius: '10px', borderBottomRightRadius: '10px', padding: '10px' }}>
                    <div id="execution-map" style={{
                      height: '220px',
                      borderRadius: '6px',
                      border: '1px solid #cfdcde',
                      overflow: 'hidden',
                      background: '#eceff1',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                    }}>
                      {!leafletLoaded && (
                        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#78909c', fontSize: '12px' }}>
                          جاري تحميل الخريطة التفاعلية...
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: '10.5px', color: '#64748b' }}>
                      💡 اسحب الدبوس لتحديد مكانك بدقة داخل المبنى وسيعيد النظام احتساب المسافة فوراً.
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>



      {/* Dynamic Approved Checklist Section */}
      <section className={styles.checklistSection} id="approved-checklist-section">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span className={styles.checklistHeading}>استمارة المرور ونموذج التقييم الفني المعتمد</span>
              <p className={styles.checklistSubheading}>يرجى تقييم بنود الاستمارة وتوثيق الملاحظات والمخالفات الميدانية بدقة</p>
            </div>
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#047857',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🛡️ نماذج معتمدة رسمياً</span>
            </div>
          </div>

          {/* Available Approved Templates Switcher Tabs */}
          {availableTemplates.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {availableTemplates.map((tpl) => {
                const isSelected = selectedTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    style={{
                      background: isSelected ? 'linear-gradient(135deg, #006d77 0%, #004d54 100%)' : '#f1f5f9',
                      color: isSelected ? '#ffffff' : '#334155',
                      border: isSelected ? '1px solid #006d77' : '1px solid #cbd5e1',
                      borderRadius: '20px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: isSelected ? 'bold' : 'normal',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>{tpl.type === 'infection_control' ? '🧪' : tpl.type === 'adolescent_health' ? '🩺' : '📋'}</span>
                    <span>{tpl.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Technical Support Notification Notice */}
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '11.5px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>ℹ️</span>
            <span>لطلب إضافة أو تعديل نماذج واستمارات المرور المعتمدة، يُرجى التواصل مع الدعم الفني الخاص بالمشروع.</span>
          </div>
        </div>

        {checklistSections.length === 0 && (
          <div style={{
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '24px 16px',
            textAlign: 'center',
            color: '#64748b',
            display: 'grid',
            gap: '8px',
            justifyItems: 'center',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '24px' }}>📋</span>
            <strong style={{ fontSize: '14px', color: '#1e293b' }}>جاري تحميل استمارة المرور المعتمدة...</strong>
            <p style={{ margin: 0, fontSize: '12px', maxWidth: '400px', lineHeight: '1.5' }}>
              لطلب إضافة أو تعديل نماذج واستمارات المرور المعتمدة، يُرجى التواصل مع الدعم الفني الخاص بالمشروع.
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

          // Filter sections based on selected stage (for 37-section standard checklist) and search query
          const filteredSections = checklistSections.filter((section: any, sIdx: number) => {
            const secNum = sIdx + 1;
            
            if (searchQuery.trim()) {
              const q = searchQuery.trim().toLowerCase();
              const nameMatch = section.name.toLowerCase().includes(q);
              const itemMatch = (section.items || []).some((it: any) => (it.text || '').toLowerCase().includes(q));
              return nameMatch || itemMatch;
            }

            if (checklistSections.length >= 25 && selectedStage > 0) {
              const currentStage = CHECKLIST_STAGES[selectedStage];
              return currentStage ? secNum >= currentStage.start && secNum <= currentStage.end : true;
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

              {/* Stage Stepper Tabs - Only for standard comprehensive checklist (37 sections) */}
              {checklistSections.length >= 25 && (
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
              )}

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
                                id={`criterion-card-${item.id}`}
                                style={{
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px',
                                  padding: '12px',
                                  background: currentAnswer ? '#f8fbfb' : '#ffffff',
                                  border: currentAnswer ? '1.5px solid #b2dfdb' : '1.5px solid #cfdcde',
                                  borderRadius: '10px',
                                  boxSizing: 'border-box',
                                  width: '100%',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <p style={{ margin: 0, fontSize: '13.5px', color: '#37474f', lineHeight: '1.6', fontWeight: 'bold', textAlign: 'right' }}>
                                      {item.text}
                                    </p>
                                    {(item.requires_photo || item.requires_note) && (
                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '2px' }}>
                                        {item.requires_photo && (
                                          <span
                                            style={{
                                              fontSize: '10.5px',
                                              fontWeight: 'bold',
                                              color: '#047857',
                                              background: '#ecfdf5',
                                              border: '1px solid #a7f3d0',
                                              padding: '2px 7px',
                                              borderRadius: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px'
                                            }}
                                          >
                                            📷 صورة إلزامية
                                          </span>
                                        )}
                                        {item.requires_note && (
                                          <span
                                            style={{
                                              fontSize: '10.5px',
                                              fontWeight: 'bold',
                                              color: '#b45309',
                                              background: '#fffbeb',
                                              border: '1px solid #fde68a',
                                              padding: '2px 7px',
                                              borderRadius: '4px',
                                              display: 'inline-flex',
                                              alignItems: 'center',
                                              gap: '3px'
                                            }}
                                          >
                                            📝 ملاحظة إلزامية
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                    <span
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 'bold',
                                        color: '#1565c0',
                                        background: '#e3f2fd',
                                        padding: '2px 8px',
                                        borderRadius: '4px'
                                      }}
                                    >
                                      الوزن: {item.score_max_value}%
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '10px',
                                        fontWeight: 'bold',
                                        color: item.violation_priority === 'critical' ? '#d32f2f' : item.violation_priority === 'high' ? '#e65100' : '#f57c00',
                                        background: item.violation_priority === 'critical' ? '#ffebee' : '#fff3e0',
                                        padding: '2px 6px',
                                        borderRadius: '4px'
                                      }}
                                    >
                                      {item.violation_priority === 'critical' ? 'حرجة' : item.violation_priority === 'high' ? 'عالية' : item.violation_priority === 'medium' ? 'متوسطة' : 'بسيطة'}
                                    </span>
                                  </div>
                                </div>

                                {/* Answers Touch Grid */}
                                <div style={{ marginTop: '4px', width: '100%' }}>
                                  {/* 1. Rating 5 Stars */}
                                  {answerType === 'rating_5' && (
                                    <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cfdcde', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                          {[1, 2, 3, 4, 5].map((star) => {
                                            const starVal = Number(currentAnswer) || 0
                                            const isFilled = starVal >= star
                                            return (
                                              <button
                                                key={star}
                                                type="button"
                                                onClick={() => handleAnswerChangeCustom(item.id, star, star >= 3, item.violation_priority, item.correction_dept, item.text)}
                                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                                              >
                                                <Star size={30} fill={isFilled ? '#f59e0b' : 'transparent'} color={isFilled ? '#f59e0b' : '#cbd5e1'} />
                                              </button>
                                            )
                                          })}
                                        </div>
                                        <button
                                          type="button"
                                          className={`${styles.answerBtn} ${currentAnswer === 'na' ? styles.naActive : ''}`}
                                          style={{ minWidth: '70px', padding: '4px 10px', fontSize: '11px' }}
                                          onClick={() => handleAnswerChange(item.id, 'na', item.violation_priority, item.correction_dept, item.text)}
                                        >
                                          لا ينطبق
                                        </button>
                                      </div>
                                      <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                                        {currentAnswer && typeof currentAnswer === 'number'
                                          ? `التقييم المسجل: ${currentAnswer} من 5 نجوم (الدرجة المكتسبة: ${((currentAnswer / 5) * (item.score_max_value || 2)).toFixed(1)}%)`
                                          : 'اضغط على النجوم لتسجيل التقييم'}
                                      </span>
                                    </div>
                                  )}

                                  {/* 2. Percentage Range Slider */}
                                  {answerType === 'percentage' && (
                                    <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cfdcde', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>
                                          نسبة التحقق المقدرة: <strong style={{ color: 'var(--brand)', fontSize: '14px' }}>{typeof currentAnswer === 'number' ? `${currentAnswer}%` : 'لم تحدد'}</strong>
                                        </span>
                                        <button
                                          type="button"
                                          className={`${styles.answerBtn} ${currentAnswer === 'na' ? styles.naActive : ''}`}
                                          style={{ minWidth: '70px', padding: '4px 10px', fontSize: '11px' }}
                                          onClick={() => handleAnswerChange(item.id, 'na', item.violation_priority, item.correction_dept, item.text)}
                                        >
                                          لا ينطبق
                                        </button>
                                      </div>
                                      <input
                                        type="range"
                                        min={0}
                                        max={100}
                                        step={5}
                                        value={typeof currentAnswer === 'number' ? currentAnswer : 50}
                                        onChange={(e) => {
                                          const v = Number(e.target.value)
                                          handleAnswerChangeCustom(item.id, v, v >= 50, item.violation_priority, item.correction_dept, item.text)
                                        }}
                                        style={{ width: '100%', cursor: 'pointer' }}
                                      />
                                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {[0, 25, 50, 75, 100].map((pct) => (
                                          <button
                                            key={pct}
                                            type="button"
                                            onClick={() => handleAnswerChangeCustom(item.id, pct, pct >= 50, item.violation_priority, item.correction_dept, item.text)}
                                            style={{
                                              flex: 1,
                                              padding: '4px 6px',
                                              borderRadius: '6px',
                                              fontSize: '11px',
                                              fontWeight: 'bold',
                                              border: currentAnswer === pct ? '2px solid var(--brand)' : '1px solid #e2e8f0',
                                              background: currentAnswer === pct ? '#e0f2fe' : '#f8fafc',
                                              color: currentAnswer === pct ? 'var(--brand)' : '#475569',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {pct}%
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* 3. Availability Check (3 Realistic States) */}
                                  {answerType === 'availability' && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'متوفر ومطابق' || currentAnswer === 'available' || currentAnswer === 'yes') ? styles.yesActive : ''}`}
                                        onClick={() => handleAnswerChangeCustom(item.id, 'متوفر ومطابق', true, item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        ✓ متوفر ومطابق
                                      </button>
                                      <button
                                        type="button"
                                        style={{
                                          padding: '8px 10px',
                                          borderRadius: '8px',
                                          border: currentAnswer === 'متوفر وغير مطابق' ? '2px solid #f57c00' : '1px solid #fed7aa',
                                          background: currentAnswer === 'متوفر وغير مطابق' ? '#fff7ed' : '#ffffff',
                                          color: '#c2410c',
                                          fontWeight: 'bold',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s'
                                        }}
                                        onClick={() => handleAnswerChangeCustom(item.id, 'متوفر وغير مطابق', false, item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        ⚠️ متوفر وغير مطابق
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'غير متوفر' || currentAnswer === 'not_available' || currentAnswer === 'no') ? styles.noActive : ''}`}
                                        onClick={() => handleAnswerChangeCustom(item.id, 'غير متوفر', false, item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        ✕ غير متوفر
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'na' || currentAnswer === 'لا ينطبق') ? styles.naActive : ''}`}
                                        onClick={() => handleAnswerChange(item.id, 'na', item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        لا ينطبق
                                      </button>
                                    </div>
                                  )}

                                  {/* 4. Binary Yes/No */}
                                  {answerType === 'yes_no' && optionsList.length <= 3 && (
                                    <div className={styles.radioGroup}>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'yes' || currentAnswer === 'نعم' || currentAnswer === 'مطابق' || currentAnswer === 'ملتزم') ? styles.yesActive : ''}`}
                                        onClick={() => handleAnswerChange(item.id, 'yes', item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        ✓ نعم / مطابق
                                      </button>
                                      <button
                                        type="button"
                                        className={`${styles.answerBtn} ${(currentAnswer === 'no' || currentAnswer === 'لا' || currentAnswer === 'غير مطابق' || currentAnswer === 'غير ملتزم') ? styles.noActive : ''}`}
                                        onClick={() => handleAnswerChange(item.id, 'no', item.violation_priority, item.correction_dept, item.text)}
                                      >
                                        ✕ لا / غير مطابق
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

                                {/* Per-Question Note & Photo Action Toolbar */}
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                  gap: '8px',
                                  marginTop: '8px',
                                  paddingTop: '8px',
                                  borderTop: '1px dashed #cfdcde'
                                }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {/* Note Button */}
                                    <button
                                      type="button"
                                      onClick={() => setExpandedItemNotes((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '5px 11px',
                                        borderRadius: '6px',
                                        fontSize: '11.5px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        background: answers[item.id]?.notes ? '#fef3c7' : '#ffffff',
                                        border: answers[item.id]?.notes ? '1.5px solid #f59e0b' : '1px solid #cfdcde',
                                        color: answers[item.id]?.notes ? '#b45309' : '#455a64'
                                      }}
                                    >
                                      <span>📝</span>
                                      <span>{answers[item.id]?.notes ? 'الملاحظة (مدونة) ✓' : 'كتابة ملاحظة'}</span>
                                      {item.requires_note && (
                                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold' }}>*إلزامي</span>
                                      )}
                                    </button>

                                    {/* Photo Button */}
                                    <label
                                      htmlFor={`file-input-${item.id}`}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        padding: '5px 11px',
                                        borderRadius: '6px',
                                        fontSize: '11.5px',
                                        fontWeight: 'bold',
                                        cursor: uploadingItemPhoto[item.id] ? 'wait' : 'pointer',
                                        transition: 'all 0.15s ease',
                                        background: answers[item.id]?.photo_url ? '#ecfdf5' : '#ffffff',
                                        border: answers[item.id]?.photo_url ? '1.5px solid #10b981' : '1px solid #cfdcde',
                                        color: answers[item.id]?.photo_url ? '#047857' : '#455a64'
                                      }}
                                    >
                                      <Camera size={13} color={answers[item.id]?.photo_url ? '#059669' : '#546e7a'} />
                                      <span>
                                        {uploadingItemPhoto[item.id]
                                          ? 'جاري الرفع...'
                                          : answers[item.id]?.photo_url
                                          ? 'تم إرفاق صورة ✓'
                                          : 'إرفاق صورة توثيقية'}
                                      </span>
                                      {item.requires_photo && (
                                        <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 'bold' }}>*إلزامي</span>
                                      )}
                                      <input
                                        type="file"
                                        id={`file-input-${item.id}`}
                                        accept="image/*"
                                        capture="environment"
                                        style={{ display: 'none' }}
                                        disabled={uploadingItemPhoto[item.id]}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0]
                                          if (file) {
                                            handleUploadItemPhoto(item.id, file)
                                            e.target.value = ''
                                          }
                                        }}
                                      />
                                    </label>
                                  </div>

                                  {/* Status tags */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {item.requires_photo && !answers[item.id]?.photo_url && (
                                      <span style={{ fontSize: '10.5px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold' }}>
                                        📷 صورة مطلوبة
                                      </span>
                                    )}
                                    {item.requires_note && (!answers[item.id]?.notes || !answers[item.id]?.notes?.trim()) && (
                                      <span style={{ fontSize: '10.5px', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', padding: '2px 7px', borderRadius: '4px', fontWeight: 'bold' }}>
                                        📝 ملاحظة مطلوبة
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Expandable Note Textarea */}
                                {(expandedItemNotes[item.id] || (item.requires_note && !answers[item.id]?.notes) || Boolean(answers[item.id]?.notes)) && (
                                  <div style={{ marginTop: '6px' }}>
                                    <textarea
                                      rows={2}
                                      value={answers[item.id]?.notes || ''}
                                      onChange={(e) => handleItemNoteChange(item.id, e.target.value)}
                                      placeholder="اكتب ملاحظة أو توثيقاً خاصاً بهذا السؤال تحديداً..."
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        border: item.requires_note && !answers[item.id]?.notes?.trim() ? '1.5px solid #f59e0b' : '1px solid #b0bec5',
                                        borderRadius: '6px',
                                        padding: '7px 10px',
                                        fontSize: '12px',
                                        fontFamily: 'inherit',
                                        resize: 'vertical',
                                        background: '#ffffff',
                                        outline: 'none'
                                      }}
                                    />
                                  </div>
                                )}

                                {/* Photo Preview Thumbnail & Delete */}
                                {answers[item.id]?.photo_url && (
                                  <div style={{
                                    marginTop: '6px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    background: '#f0fdf4',
                                    border: '1px solid #bbf7d0',
                                    borderRadius: '8px',
                                    padding: '6px 10px'
                                  }}>
                                    <a
                                      href={answers[item.id]?.photo_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                                    >
                                      <img
                                        src={answers[item.id]?.photo_url}
                                        alt="توثيق السؤال"
                                        style={{ width: '42px', height: '42px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #86efac' }}
                                      />
                                      <span style={{ fontSize: '11.5px', color: '#047857', fontWeight: 'bold' }}>
                                        📷 عرض الصورة بالحجم الكامل ↗
                                      </span>
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveItemPhoto(item.id)}
                                      style={{
                                        marginRight: 'auto',
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#dc2626',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        fontSize: '11px',
                                        fontWeight: 'bold'
                                      }}
                                      title="حذف الصورة"
                                    >
                                      <Trash2 size={13} />
                                      <span>حذف</span>
                                    </button>
                                  </div>
                                )}
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
              options={correctionUnitOptions}
              value={correctionUnit}
              onChange={(val) => setCorrectionUnit(val)}
              placeholder="اختر أو ابحث عن الإدارة للتصحيح..."
              onAdd={handleAddCorrectionUnit}
            />
          </label>
        </div>
      </section>

      {/* 2-Column Side-by-Side Bottom Section: Execution Notes & Mission Recommendations */}
      <section style={{
        background: '#ffffff',
        border: '1px solid #cfdcde',
        borderRadius: '12px',
        padding: '18px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '16px',
          alignItems: 'start'
        }}>
          {/* Column 1: Execution Notes */}
          <div style={{ display: 'grid', gap: '8px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontSize: '14px', fontWeight: 'bold' }}>
              <span>📝 ملاحظات التنفيذ الميداني</span>
            </label>
            <textarea
              value={executionNotes}
              onChange={(event) => setExecutionNotes(event.target.value)}
              rows={5}
              placeholder="اكتب أي ملاحظات عامة حول تنفيذ المأمورية وسير العمل..."
              style={{
                width: '100%',
                background: '#f8fbfb',
                border: '1px solid #cfdcde',
                borderRadius: '8px',
                color: '#102027',
                font: 'inherit',
                padding: '10px 12px',
                resize: 'vertical',
                minHeight: '110px'
              }}
            />
          </div>

          {/* Column 2: Mission Recommendations with @ Mention */}
          <div style={{ position: 'relative', display: 'grid', gap: '8px' }}>
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#1e293b', fontSize: '14px', fontWeight: 'bold' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>📋 توصيات وقرارات المأمورية الميدانية</span>
                <span style={{ color: '#e53935', fontSize: '12px', fontWeight: 'bold' }}>* (إلزامي)</span>
              </span>
              <span style={{ fontSize: '11.5px', color: '#006d77', background: '#e0f2f1', padding: '2px 8px', borderRadius: '12px', fontWeight: 'normal' }}>
                💡 اكتب @ للإشارة لمسؤول
              </span>
            </label>
            
            <div style={{ position: 'relative' }}>
              <textarea
                id="recommendations-textarea"
                value={recommendations}
                onChange={handleRecommendationsChange}
                onKeyDown={handleRecommendationsKeyDown}
                required
                rows={5}
                placeholder="اكتب توصيات وقرارات المأمورية (إلزامي) - مثال: يرجى التنبيه على @د. أحمد بمتابعة إجراءات التصحيح..."
                style={{
                  width: '100%',
                  background: '#f8fbfb',
                  border: '1.5px solid #cfdcde',
                  borderRadius: '8px',
                  color: '#102027',
                  font: 'inherit',
                  padding: '10px 12px',
                  resize: 'vertical',
                  minHeight: '110px'
                }}
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
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          padding: '8px 12px',
                          background: isActive ? '#e0f2f1' : 'transparent',
                          border: 0,
                          borderBottom: '1px solid #f0f4f4',
                          cursor: 'pointer',
                          textAlign: 'right',
                          width: '100%',
                          transition: 'background 0.1s'
                        }}
                      >
                        <strong style={{ fontSize: '13px', color: '#102027' }}>{u.full_name}</strong>
                        <span style={{ fontSize: '11px', color: '#546e7a' }}>
                          {u.role_title || u.role} {u.department ? `(${u.department})` : ''} {u.governorate_name ? `• ${u.governorate_name}` : ''}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Floating Live Evaluation HUD */}
      <div 
        className={styles.floatingHUD} 
        onClick={() => setShowLiveScoreModal(true)}
        title="انقر لعرض تفاصيل التقييم ورادار الأقسام اللحظي"
      >
        <div 
          className={styles.hudCircle}
          style={{
            borderColor: liveScoreStats.overallPct >= 90 ? '#2a9d8f' : liveScoreStats.overallPct >= 75 ? '#e76f51' : '#c2413f',
            color: liveScoreStats.overallPct >= 90 ? '#2a9d8f' : liveScoreStats.overallPct >= 75 ? '#e76f51' : '#c2413f'
          }}
        >
          {liveScoreStats.overallPct}%
        </div>
        <div className={styles.hudInfo}>
          <strong>التقييم اللحظي 📊</strong>
          <span>{liveScoreStats.totalScore} من {liveScoreStats.maxScore || 676} درجة | {liveScoreStats.answeredCount}/{liveScoreStats.totalCount} بند</span>
        </div>
      </div>

      {/* Live Scorecard Modal */}
      {showLiveScoreModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLiveScoreModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: '16px', borderBottom: '1px solid #dce7e8', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fbfb' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#102027', fontWeight: 900 }}>
                  📊 رادار ونتائج التقييم اللحظي للمأمورية
                </h3>
                <span style={{ fontSize: '12px', color: '#546e7a' }}>
                  {mission.serial_number} — المنشأة: {selectedFacility?.name || 'المنشأة المستهدفة'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowLiveScoreModal(false)}
                style={{ background: '#e2ecec', border: 0, borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', color: '#37474f' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', overflowY: 'auto', display: 'grid', gap: '16px', maxHeight: 'calc(85vh - 130px)' }}>
              {/* Top Score summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                <div style={{ background: '#f0f7f7', border: '1px solid #c2dede', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#546e7a', display: 'block' }}>نسبة الامتثال</span>
                  <strong style={{ fontSize: '22px', color: '#006d77', fontWeight: 900 }}>{liveScoreStats.overallPct}%</strong>
                </div>
                <div style={{ background: '#f8fbfb', border: '1px solid #dce7e8', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#546e7a', display: 'block' }}>الدرجات المحققة</span>
                  <strong style={{ fontSize: '18px', color: '#2c6fbb', fontWeight: 900 }}>{liveScoreStats.totalScore} / {liveScoreStats.maxScore}</strong>
                </div>
                <div style={{ background: liveScoreStats.violationsCount > 0 ? '#fff2f1' : '#f0f7f7', border: `1px solid ${liveScoreStats.violationsCount > 0 ? '#f5c6cb' : '#c2dede'}`, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#546e7a', display: 'block' }}>المخالفات المرصودة</span>
                  <strong style={{ fontSize: '20px', color: liveScoreStats.violationsCount > 0 ? '#c2413f' : '#2a9d8f', fontWeight: 900 }}>{liveScoreStats.violationsCount}</strong>
                </div>
              </div>

              {/* Provisional Facility Rating */}
              <div style={{ background: '#ffffff', border: '1px solid #dce7e8', borderRadius: '10px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', color: '#37474f', fontWeight: 'bold' }}>التصنيف التقديري للمنشأة:</span>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '20px',
                  fontSize: '12px',
                  fontWeight: 900,
                  background: liveScoreStats.overallPct >= 90 ? '#eaf8f3' : liveScoreStats.overallPct >= 75 ? '#fff3e0' : '#ffebee',
                  color: liveScoreStats.overallPct >= 90 ? '#16725a' : liveScoreStats.overallPct >= 75 ? '#e65100' : '#c62828'
                }}>
                  {liveScoreStats.overallPct >= 90 ? '🌟 منشأة متميزة ومعتمدة' : liveScoreStats.overallPct >= 75 ? '⚠️ مقبولة مع وجود ملاحظات' : '🚨 غير مطابقة وذات خطورة'}
                </span>
              </div>

              {/* Sections Breakdown List */}
              <div style={{ display: 'grid', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#102027', fontWeight: 'bold' }}>
                  📋 تفصيل درجات الأقسام التي تم فحصها ({liveScoreStats.sectionScores.filter(s => s.answered > 0).length} قسم):
                </h4>
                {liveScoreStats.sectionScores.map((sec, idx) => {
                  if (sec.answered === 0) return null;
                  const isTop = sec.pct >= 90;
                  const isCrit = sec.pct < 75;
                  const barColor = isTop ? '#2a9d8f' : isCrit ? '#c2413f' : '#e76f51';

                  return (
                    <div key={sec.id} style={{ background: '#f8fbfb', border: '1px solid #e2ecec', borderRadius: '8px', padding: '10px 12px', display: 'grid', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#102027' }}>
                          {idx + 1}. {sec.name}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 900, color: barColor }}>
                          {sec.pct}% ({sec.earned}/{sec.max} درجة)
                        </span>
                      </div>
                      <div style={{ height: '5px', background: '#e2ecec', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{ width: `${sec.pct}%`, height: '100%', background: barColor, borderRadius: '999px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ padding: '12px 16px', borderTop: '1px solid #dce7e8', background: '#f8fbfb', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setShowLiveScoreModal(false)}
                style={{ background: '#006d77', color: 'white', border: 0, borderRadius: '8px', padding: '8px 20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                متابعة التفتيش
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Sticky Action Bar with Immediate Alerts */}
      <div className={styles.mobileStickyBar}>
        {/* Floating Quick Alert Banner if error exists */}
        {error && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '12px',
            right: '12px',
            marginBottom: '8px',
            background: '#fef2f2',
            border: '1px solid #f87171',
            borderRadius: '8px',
            padding: '8px 12px',
            color: '#b91c1c',
            fontSize: '12.5px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <span>⚠️ {error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              style={{ background: 'transparent', border: 0, color: '#b91c1c', cursor: 'pointer', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>
        )}

        <div 
          style={{ display: 'flex', flexDirection: 'column', gap: '2px', cursor: 'pointer' }}
          onClick={() => setShowLiveScoreModal(true)}
        >
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#102027' }}>
            الامتثال: <strong style={{ color: liveScoreStats.overallPct >= 80 ? '#2a9d8f' : '#e76f51', fontSize: '15px' }}>{liveScoreStats.overallPct}%</strong>
            <span style={{ fontSize: '11px', color: '#78909c', marginRight: '6px' }}>({liveScoreStats.answeredCount} بند مُقيّم 📊)</span>
          </span>
          <span style={{ fontSize: '11px', color: liveScoreStats.violationsCount > 0 ? '#c62828' : '#2a9d8f', fontWeight: 'bold' }}>
            {liveScoreStats.violationsCount > 0 ? `⚠️ ${liveScoreStats.violationsCount} مخالفة مرصودة` : '🟢 لا توجد مخالفات مسجلة'}
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
            onClick={handleInitiateComplete}
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

      {/* Confirmation Before Final Completion Modal */}
      {showConfirmSubmitModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '520px',
            width: '100%',
            padding: '28px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
            textAlign: 'center',
            display: 'grid',
            gap: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#e0f2fe',
              border: '2px solid #7dd3fc',
              color: '#0284c7',
              fontSize: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              📋
            </div>

            <div>
              <h2 style={{ fontSize: '19px', fontWeight: 'bold', color: '#0f172a', margin: '0 0 6px' }}>
                تأكيد اعتماد التقرير وإغلاق المأمورية
              </h2>
              <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: '1.6' }}>
                هل أنت متأكد من رغبتك في اعتماد وإغلاق تقرير المأمورية نهائياً؟
                <br />
                <span style={{ color: '#006d77', fontWeight: 'bold' }}>
                  أم ترغب في مراجعة بنود أخرى أو تقييم استمارات إضافية لنفس المنشأة؟
                </span>
              </p>
            </div>

            {/* Quick Status Pill */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '10px'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>المنشأة المزارة</span>
                <strong style={{ fontSize: '12px', color: '#1e293b' }}>
                  {selectedFacility?.name || 'المنشأة المعتمدة'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>البنود المقيّمة</span>
                <strong style={{ fontSize: '13px', color: liveScoreStats.answeredCount === liveScoreStats.totalCount ? '#059669' : '#006d77' }}>
                  {liveScoreStats.answeredCount} من {liveScoreStats.totalCount} بند {liveScoreStats.answeredCount === liveScoreStats.totalCount ? '✅' : '📊'}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>المخالفات المرصودة</span>
                <strong style={{ fontSize: '13px', color: liveScoreStats.violationsCount > 0 ? '#dc2626' : '#059669' }}>
                  {liveScoreStats.violationsCount > 0 ? `${liveScoreStats.violationsCount} مخالفة` : 'لا توجد'}
                </strong>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setShowConfirmSubmitModal(false)
                  save('completed')
                }}
                style={{
                  background: '#006d77',
                  color: 'white',
                  border: 0,
                  borderRadius: '10px',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 109, 119, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {loading ? 'جاري الاعتماد...' : '✅ نعم، اعتماد وإغلاق المأمورية نهائياً'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowConfirmSubmitModal(false)
                  const el = document.getElementById('approved-checklist-section')
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                }}
                style={{
                  background: '#fffbeb',
                  color: '#b45309',
                  border: '1.5px solid #fde68a',
                  borderRadius: '10px',
                  padding: '11px 18px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                📝 اختيار استمارة / أقسام أخرى للمراجعة والتقييم
              </button>

              <button
                type="button"
                onClick={() => setShowConfirmSubmitModal(false)}
                style={{
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  padding: '8px 12px',
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                إلغاء والعودة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Success Modal */}
      {showSuccessModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '480px',
            width: '100%',
            padding: '28px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            textAlign: 'center',
            display: 'grid',
            gap: '16px',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{
              width: '72px',
              height: '72px',
              borderRadius: '50%',
              background: '#ecfdf5',
              border: '2px solid #a7f3d0',
              color: '#059669',
              fontSize: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto'
            }}>
              ✅
            </div>

            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#064e3b', margin: '0 0 6px' }}>
                تم اعتماد وإرسال تقرير المأمورية بنجاح!
              </h2>
              <p style={{ fontSize: '13px', color: '#4b5563', margin: 0 }}>
                تم توثيق الحضور الجغرافي وحفظ كافة بنود التقييم والملاحظات والتوصيات بنجاح.
              </p>
            </div>

            {/* Quick Stats Summary */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '8px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px'
            }}>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>نسبة الامتثال</span>
                <strong style={{ fontSize: '16px', color: liveScoreStats.overallPct >= 80 ? '#059669' : '#d97706' }}>
                  {liveScoreStats.overallPct}%
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>البنود المقيّمة</span>
                <strong style={{ fontSize: '16px', color: '#006d77' }}>
                  {liveScoreStats.answeredCount}
                </strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>المخالفات</span>
                <strong style={{ fontSize: '16px', color: liveScoreStats.violationsCount > 0 ? '#dc2626' : '#059669' }}>
                  {liveScoreStats.violationsCount}
                </strong>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div style={{ display: 'grid', gap: '8px', marginTop: '6px' }}>
              <button
                type="button"
                onClick={() => router.push(`/dashboard/missions/${mission.id}/print`)}
                style={{
                  background: '#006d77',
                  color: 'white',
                  border: 0,
                  borderRadius: '10px',
                  padding: '12px 18px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0, 109, 119, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                🖨️ عرض وطباعة التقرير الفني المعتمد
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/missions')}
                style={{
                  background: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: '10px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                📋 العودة إلى جدول المأموريات
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
