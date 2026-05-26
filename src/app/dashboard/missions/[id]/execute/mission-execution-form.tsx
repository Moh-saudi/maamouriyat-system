'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { type CorrectionUnitOption } from '@/lib/correction-units'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { Camera, Trash2 } from 'lucide-react'
import imageCompression from 'browser-image-compression'
import { getChecklistByDepartment } from '@/lib/checklist-data'
import styles from './execute.module.css'

type Facility = {
  id: string
  name: string
  address: string
  governorate_id: string | null
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
  correctionUnits,
  facilities,
  governorates,
  mission,
  demoMode = false,
}: {
  currentUserId: string
  currentUserDept?: string
  correctionUnits: CorrectionUnitOption[]
  facilities: Facility[]
  governorates: Governorate[]
  mission: Mission
  demoMode?: boolean
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
  const [correctionUnit, setCorrectionUnit] = useState('')
  const [changeReason, setChangeReason] = useState(mission.change_reason ?? '')
  const [executionNotes, setExecutionNotes] = useState(mission.execution_notes ?? '')
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
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector('script[src*="leaflet.js"]')
    if (!existingScript) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
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
  const [answers, setAnswers] = useState<Record<string, { answer: 'yes' | 'no' | 'na'; notes: string }>>({})

  const customChecklists = useMemo(() => {
    if (typeof window === 'undefined') return []
    const cookieName = 'maamouriyat_demo_checklists'
    const cookie = document.cookie
      .split('; ')
      .find((item) => item.startsWith(`${cookieName}=`))
      ?.split('=')[1]
    if (!cookie) return []
    try {
      const parsed = JSON.parse(decodeURIComponent(cookie))
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }, [])

  const checklistSections = useMemo(() => {
    const baseChecklist = getChecklistByDepartment(currentUserDept)
    return [...customChecklists, ...baseChecklist]
  }, [currentUserDept, customChecklists])

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

    if (demoMode) {
      let savedActualFacilityId = actualFacilityId
      let registeredNewFacilityName = ''
      
      if (destinationType === 'facility' && isUnregisteredFacility) {
        const newFacId = `demo-facility-new-${Date.now()}`
        registeredNewFacilityName = newFacilityName.trim()
        
        const newFacilityObj = {
          id: newFacId,
          name: newFacilityName.trim(),
          facility_type: newFacilityType,
          address: newFacilityAddress.trim() || 'تم تسجيلها أثناء المرور الميداني',
          governorate_id: newFacilityGovId,
          latitude: inspectorLat ?? 30.0444,
          longitude: inspectorLng ?? 31.2357,
          is_active: true
        }

        const facCookieName = 'maamouriyat_demo_facilities'
        const rawFacs = document.cookie
          .split('; ')
          .find((item) => item.startsWith(`${facCookieName}=`))
          ?.split('=')[1]
        let existingFacs: any[] = []
        try {
          existingFacs = rawFacs ? JSON.parse(decodeURIComponent(rawFacs)) : []
        } catch {}
        existingFacs = [newFacilityObj, ...existingFacs]
        document.cookie = `${facCookieName}=${encodeURIComponent(JSON.stringify(existingFacs))}; path=/; max-age=604800; SameSite=Lax`

        savedActualFacilityId = newFacId
      }

      const cookieName = 'maamouriyat_demo_missions'
      const existingCookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith(`${cookieName}=`))
        ?.split('=')[1]
      let existing: any[] = []
      try {
        existing = existingCookie ? JSON.parse(decodeURIComponent(existingCookie)) : []
      } catch {}

      const foundMissionIndex = existing.findIndex((m) => m.id === mission.id)
      if (foundMissionIndex !== -1) {
        const targetFacility = isUnregisteredFacility
          ? { name: registeredNewFacilityName }
          : facilities.find((f) => f.id === actualFacilityId)
        const targetGov = governorates.find((g) => g.id === (isUnregisteredFacility ? newFacilityGovId : actualGovernorateId))

        existing[foundMissionIndex] = {
          ...existing[foundMissionIndex],
          status,
          destinationName: destinationType === 'facility' 
            ? targetFacility?.name ?? 'منشأة فعلية' 
            : targetGov?.name ?? 'محافظة فعلية',
          destinationType,
          notes: `${existing[foundMissionIndex].notes || ''}\n[تحديث التنفيذ]: ${executionNotes}\nتغيير الوجهة: ${(changed || isUnregisteredFacility) ? 'نعم - ' + (changeReason || `تسجيل وزيارة منشأة جديدة: ${registeredNewFacilityName}`) : 'لا'}`,
          checkin_lat: inspectorLat,
          checkin_lng: inspectorLng,
          gps_verified: gpsVerified
        }

        document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(existing))}; path=/; max-age=604800; SameSite=Lax`
      }

      // If they also logged a mock violation
      const hasViolation = Boolean(violationDescription.trim())
      if (hasViolation) {
        const violationsCookieName = 'maamouriyat_demo_violations'
        const existingViolationsCookie = document.cookie
          .split('; ')
          .find((item) => item.startsWith(`${violationsCookieName}=`))
          ?.split('=')[1]
        let existingViolations: any[] = []
        try {
          existingViolations = existingViolationsCookie ? JSON.parse(decodeURIComponent(existingViolationsCookie)) : []
        } catch {}

        const newViolation = {
          id: `demo-violation-${Date.now()}`,
          description: violationDescription.trim(),
          priority: violationPriority,
          status: 'new',
          assigned_to_dept: correctionUnit.trim(),
          facility_name: destinationType === 'facility' 
            ? (isUnregisteredFacility ? registeredNewFacilityName : (facilities.find((f) => f.id === actualFacilityId)?.name ?? 'منشأة فعلية')) 
            : 'محافظة فعلية',
          mission_id: mission.id,
          created_at: new Date().toISOString()
        }

        existingViolations = [newViolation, ...existingViolations].slice(0, 50)
        document.cookie = `${violationsCookieName}=${encodeURIComponent(JSON.stringify(existingViolations))}; path=/; max-age=604800; SameSite=Lax`
      }

      // Save dynamic checklist results to local cookies for demo mode
      if (Object.keys(answers).length > 0) {
        const resultsCookieName = 'maamouriyat_demo_results'
        const existingResultsCookie = document.cookie
          .split('; ')
          .find((item) => item.startsWith(`${resultsCookieName}=`))
          ?.split('=')[1]
        let existingResults: any[] = []
        try {
          existingResults = existingResultsCookie ? JSON.parse(decodeURIComponent(existingResultsCookie)) : []
        } catch {}

        const newResults = Object.entries(answers).map(([itemId, val]) => ({
          mission_id: mission.id,
          item_id: itemId,
          answer: val.answer,
          notes: val.notes || ''
        }))

        existingResults = [...newResults, ...existingResults.filter((r) => r.mission_id !== mission.id)]
        document.cookie = `${resultsCookieName}=${encodeURIComponent(JSON.stringify(existingResults))}; path=/; max-age=604800; SameSite=Lax`
      }

      setLoading(false)
      setSuccess(status === 'completed' ? 'تم إنهاء المأمورية التجريبية وتوثيق الحضور بنجاح.' : 'تم بدء/تحديث المأمورية التجريبية.')
      router.push('/dashboard/missions')
      router.refresh()
      return
    }

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
        execution_notes: executionNotes.trim() || null,
        started_at: mission.status === 'assigned' || !mission.started_at ? now : undefined,
        completed_at: status === 'completed' ? now : null,
        status,
        checkin_lat: inspectorLat,
        checkin_lng: inspectorLng,
        checkin_time: mission.status === 'assigned' || !mission.started_at ? now : undefined,
        checkout_lat: status === 'completed' ? inspectorLat : undefined,
        checkout_lng: status === 'completed' ? inspectorLng : undefined,
        checkout_time: status === 'completed' ? now : undefined,
        gps_verified: gpsVerified
      })
      .eq('id', mission.id)

    if (updateError) {
      setLoading(false)
      setError(updateError.message)
      return
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

    // Save dynamic checklist results to Supabase table mission_results
    if (Object.keys(answers).length > 0) {
      const resultsPayload = Object.entries(answers).map(([itemId, val]) => ({
        mission_id: mission.id,
        checklist_item_id: itemId.startsWith('item-') ? null : itemId,
        answer: val.answer,
        notes: val.notes || null
      }))

      const { error: resultsError } = await supabase.from('mission_results').insert(resultsPayload)
      if (resultsError) {
        console.error('Error saving mission results to Supabase:', resultsError)
      }
    }

    setLoading(false)
    setSuccess(status === 'completed' ? 'تم إنهاء المأمورية وتوثيق الحضور جغرافياً.' : 'تم بدء/تحديث المأمورية.')
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
                  `يبعد موقعك الحالي مسافة ${gpsDistance} متر عن الإحداثيات الرسمية للمستشفى. سيتم حفظ هذا التباين للتوثيق والرقابة الإدارية.`
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
              <label>
                اختر المنشأة المسجلة *
                <select value={actualFacilityId} onChange={(event) => handleFacilityChange(event.target.value)}>
                  <option value="">اختر المنشأة</option>
                  {facilities.map((facility) => (
                    <option key={facility.id} value={facility.id}>
                      {facility.name} - {facility.address}
                    </option>
                  ))}
                </select>
              </label>
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
      </div>

      {/* Dynamic Specialization Checklist */}
      {checklistSections && checklistSections.length > 0 && (
        <section className={styles.checklistSection}>
          <div>
            <span className={styles.checklistHeading}>قائمة بنود التفتيش التخصصية والمخصصة ({currentUserDept || 'المرور العام'})</span>
            <p className={styles.checklistSubheading}>يرجى الإجابة وتوثيق بنود الالتزام وتوليد المخالفات تلقائياً عند عدم المطابقة</p>
          </div>
          
          <div className={styles.checklistGrid}>
            {checklistSections.map((section: any) => (
              <div key={section.id} className={styles.checklistSecCard} style={{ background: 'white', border: '1px solid #cfdcde', borderRadius: '12px', padding: '16px', display: 'grid', gap: '14px', marginBottom: '14px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', color: '#102027', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eef6f6', paddingBottom: '8px' }}>
                  <span>{section.name}</span>
                  {section.dept_name && (
                    <span style={{ fontSize: '11px', background: '#eef6f6', color: 'var(--brand)', padding: '2px 8px', borderRadius: '12px' }}>
                      {section.dept_name} | {section.checklist_type || 'دوري'}
                    </span>
                  )}
                </h4>
                
                <div className={styles.checklistItemsList} style={{ display: 'grid', gap: '12px' }}>
                  {section.items.map((item: any) => {
                    const currentAnswer = answers[item.id]?.answer || '';
                    const answerType = item.answer_type || 'yes_no';
                    const optionsList = item.options
                      ? item.options.split(',').map((opt: string) => opt.trim()).filter(Boolean)
                      : [];

                    return (
                      <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: '#f8fbfb', border: '1px solid #cfdcde', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <p style={{ margin: 0, fontSize: '13.5px', color: '#37474f', lineHeight: '1.5', fontWeight: 'bold', textAlign: 'right' }}>{item.text}</p>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', color: item.violation_priority === 'critical' ? '#d32f2f' : item.violation_priority === 'high' ? '#e65100' : '#f57c00', background: item.violation_priority === 'critical' ? '#ffebee' : '#fff3e0', padding: '2px 6px', borderRadius: '4px', flexShrink: 0 }}>
                            {item.violation_priority === 'critical' ? 'حرجة' : item.violation_priority === 'high' ? 'عالية' : item.violation_priority === 'medium' ? 'متوسطة' : 'بسيطة'}
                          </span>
                        </div>

                        {/* Rendering by Type */}
                        <div style={{ marginTop: '4px', width: '100%' }}>
                          
                          {answerType === 'yes_no' && (
                            <div className={styles.radioGroup}>
                              <button
                                type="button"
                                className={`${styles.answerBtn} ${currentAnswer === 'yes' ? styles.yesActive : ''}`}
                                onClick={() => handleAnswerChange(item.id, 'yes', item.violation_priority, item.correction_dept, item.text)}
                              >
                                ملتزم
                              </button>
                              <button
                                type="button"
                                className={`${styles.answerBtn} ${currentAnswer === 'no' ? styles.noActive : ''}`}
                                onClick={() => handleAnswerChange(item.id, 'no', item.violation_priority, item.correction_dept, item.text)}
                              >
                                غير ملتزم
                              </button>
                              <button
                                type="button"
                                className={`${styles.answerBtn} ${currentAnswer === 'na' ? styles.naActive : ''}`}
                                onClick={() => handleAnswerChange(item.id, 'na', item.violation_priority, item.correction_dept, item.text)}
                              >
                                لا ينطبق
                              </button>
                            </div>
                          )}

                          {answerType === 'dropdown' && (
                            <select
                              value={currentAnswer}
                              onChange={(e) => {
                                const val = e.target.value;
                                const isNonCompliant = val.includes('غير') || val.includes('لا') || val.includes('مخالف');
                                handleAnswerChangeCustom(item.id, val, !isNonCompliant, item.violation_priority, item.correction_dept, item.text);
                              }}
                              style={{ width: '100%', minHeight: '38px', borderRadius: '6px', border: '1px solid #cfdcde', padding: '0 8px', fontSize: '13px', background: 'white', outline: 'none' }}
                            >
                              <option value="">-- اختر الإجابة --</option>
                              {optionsList.map((opt: string) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
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

                          {answerType === 'text_short' && (
                            <input
                              type="text"
                              value={currentAnswer}
                              onChange={(e) => handleAnswerChangeCustom(item.id, e.target.value, true, item.violation_priority, item.correction_dept, item.text)}
                              placeholder="اكتب إجابة مختصرة هنا..."
                              style={{ width: '100%', minHeight: '38px', borderRadius: '6px', border: '1px solid #cfdcde', padding: '0 10px', fontSize: '13px', outline: 'none' }}
                            />
                          )}

                          {answerType === 'text_long' && (
                            <textarea
                              value={currentAnswer}
                              onChange={(e) => handleAnswerChangeCustom(item.id, e.target.value, true, item.violation_priority, item.correction_dept, item.text)}
                              placeholder="اكتب تقرير الفحص التفصيلي لهذا البند هنا..."
                              rows={3}
                              style={{ width: '100%', borderRadius: '6px', border: '1px solid #cfdcde', padding: '8px 10px', fontSize: '13px', outline: 'none' }}
                            />
                          )}

                          {answerType === 'rating_5' && (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              {[1, 2, 3, 4, 5].map((val) => {
                                const isActive = Number(currentAnswer) === val;
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => {
                                      const isLow = val < 3; // less than 3 is non-compliant
                                      handleAnswerChangeCustom(item.id, val.toString(), !isLow, item.violation_priority, item.correction_dept, item.text);
                                    }}
                                    style={{
                                      minWidth: '38px',
                                      minHeight: '38px',
                                      borderRadius: '6px',
                                      border: '1px solid #cfdcde',
                                      background: isActive ? 'var(--brand)' : 'white',
                                      color: isActive ? 'white' : '#37474f',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {answerType === 'rating_10' && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                                const isActive = Number(currentAnswer) === val;
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() => {
                                      const isLow = val < 6; // less than 6 is non-compliant
                                      handleAnswerChangeCustom(item.id, val.toString(), !isLow, item.violation_priority, item.correction_dept, item.text);
                                    }}
                                    style={{
                                      minWidth: '32px',
                                      minHeight: '32px',
                                      borderRadius: '6px',
                                      border: '1px solid #cfdcde',
                                      background: isActive ? 'var(--brand)' : 'white',
                                      color: isActive ? 'white' : '#37474f',
                                      fontWeight: 'bold',
                                      fontSize: '12px',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s'
                                    }}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {answerType === 'rating_stars' && (
                            <div style={{ display: 'flex', gap: '8px', direction: 'rtl', justifyContent: 'flex-start' }}>
                              {[1, 2, 3, 4, 5].map((val) => {
                                const isActive = Number(currentAnswer) >= val;
                                return (
                                  <span
                                    key={val}
                                    onClick={() => {
                                      const isLow = val < 3; // less than 3 is non-compliant
                                      handleAnswerChangeCustom(item.id, val.toString(), !isLow, item.violation_priority, item.correction_dept, item.text);
                                    }}
                                    style={{
                                      fontSize: '28px',
                                      color: isActive ? '#f1c40f' : '#bdc3c7',
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      transition: 'color 0.15s'
                                    }}
                                  >
                                    ★
                                  </span>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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

          <label>
            الإدارة المختصة بالتصحيح
            <input
              list="correction-units"
              onChange={(event) => setCorrectionUnit(event.target.value)}
              placeholder="مثال: إدارة الصيدلة والمستلزمات"
              value={correctionUnit}
            />
            <datalist id="correction-units">
              {correctionUnits.map((unit) => (
                <option key={unit.id ?? unit.name} value={unit.name} />
              ))}
            </datalist>
          </label>
        </div>
      </section>

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
