'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Search, 
  MapPin, 
  Calendar, 
  User, 
  Layers, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Printer,
  ChevronLeft,
  FileText,
  BadgeAlert,
  X,
  LayoutGrid,
  List
} from 'lucide-react'
import { realEgyptianMedicalFacilities } from '@/lib/real-facilities'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { departmentChecklists } from '@/lib/checklist-data'

export function getMissionEndDate(mission: any): string {
  const notes = mission.notes || '';
  const matches = notes.match(/تاريخ الانتهاء المتوقع:\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/g);
  if (matches && matches.length > 0) {
    const lastMatch = matches[matches.length - 1];
    return lastMatch.replace(/تاريخ الانتهاء المتوقع:\s*/, '').trim();
  }

  if (mission.endDate) return mission.endDate;
  if (mission.expected_end_date) return mission.expected_end_date;
  
  return mission.scheduledDate || mission.scheduled_date || '';
}

type MissionItem = {
  id: string
  serialNumber: string
  visitPurpose: string
  status: string
  priority: string
  scheduledDate: string
  endDate: string
  employeeNames: string
  orgUnitName: string
  destinationName: string
  destinationType: 'facility' | 'governorate'
  facilityType?: string | null
  notes?: string | null
  assignedUserId?: string
  gpsVerified?: boolean
  checkinLat?: number | null
  checkinLng?: number | null
}

export function MissionsPortal({
  initialMissions,
  roleName
}: {
  initialMissions: MissionItem[]
  roleName?: string | null
}) {
  const router = useRouter()
  const [missions, setMissions] = useState<MissionItem[]>(initialMissions)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const [auditMission, setAuditMission] = useState<MissionItem | null>(null)

  // --- Electronic Signature State ---
  const [signatureImage, setSignatureImage] = useState<string | null>(null)
  const [showSignaturePad, setShowSignaturePad] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [printTrigger, setPrintTrigger] = useState<string | null>(null)

  // --- Mission Extension States & Actions ---
  const [extendingMission, setExtendingMission] = useState<MissionItem | null>(null)
  const [newEndDate, setNewEndDate] = useState('')
  const [extensionReason, setExtensionReason] = useState('')
  const [extendingLoading, setExtendingLoading] = useState(false)

  // --- Dynamic Checklist & Audit Results State ---
  const [auditResults, setAuditResults] = useState<any[]>([])
  const [dbChecklists, setDbChecklists] = useState<any[]>([])
  const [loadingAuditResults, setLoadingAuditResults] = useState(false)

  // Load active checklists on mount to resolve UUIDs to question text dynamically
  useEffect(() => {
    const fetchChecklists = async () => {
      try {
        const res = await fetch('/api/admin/checklists')
        if (res.ok) {
          const data = await res.json()
          setDbChecklists(data || [])
        }
      } catch (e) {
        console.error('Error fetching checklists for audit mapping:', e)
      }
    }
    fetchChecklists()
  }, [])

  // Fetch real mission_results for auditMission
  useEffect(() => {
    if (!auditMission) {
      setAuditResults([])
      return
    }

    const fetchResults = async () => {
      setLoadingAuditResults(true)
      try {
        const res = await fetch(`/api/missions/results?mission_id=${encodeURIComponent(auditMission.id)}`)
        if (res.ok) {
          const data = await res.json()
          setAuditResults(data || [])
        }
      } catch (e) {
        console.error('Error fetching mission results for audit:', e)
      } finally {
        setLoadingAuditResults(false)
      }
    }
    fetchResults()
  }, [auditMission])

  const resolveItemDetails = (itemId: string) => {
    // 1. Search in static checklists
    for (const dept of Object.keys(departmentChecklists)) {
      for (const sec of departmentChecklists[dept]) {
        const match = sec.items.find((it) => it.id === itemId)
        if (match) {
          return {
            text: match.text,
            priority: match.violation_priority || 'medium'
          }
        }
      }
    }

    // 2. Search in db checklists
    for (const chk of dbChecklists) {
      for (const sec of chk.checklist_sections || []) {
        for (const item of sec.checklist_items || []) {
          if (item.id === itemId) {
            return {
              text: item.text,
              priority: item.violation_priority || 'medium'
            }
          }
        }
      }
    }

    return {
      text: 'بند فحص تخصصي غير محدد',
      priority: 'medium'
    }
  }

  const parsedAuditResults = useMemo(() => {
    return auditResults.map((res: any) => {
      let itemId = res.checklist_item_id
      let notes = res.notes || ''
      
      // Parse static signature from notes
      if (!itemId && notes.startsWith('__static_id__:')) {
        const delimiterIdx = notes.indexOf('||')
        if (delimiterIdx !== -1) {
          itemId = notes.substring('__static_id__:'.length, delimiterIdx)
          notes = notes.substring(delimiterIdx + 2)
        }
      }
      
      const details = itemId ? resolveItemDetails(itemId) : { text: 'بند فحص غير محدد', priority: 'medium' }
      
      return {
        id: itemId || `static-${Math.random()}`,
        text: details.text,
        priority: details.priority,
        answer: res.answer,
        notes: notes
      }
    })
  }, [auditResults, dbChecklists])

  const handleExtendSave = async () => {
    if (!extendingMission) return
    if (!newEndDate) {
      alert('يرجى اختيار تاريخ الانتهاء الجديد.')
      return
    }
    if (!extensionReason.trim()) {
      alert('يرجى كتابة سبب التمديد.')
      return
    }

    setExtendingLoading(true)

    const todayStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: '2-digit', day: '2-digit' })
    const newDateFormatted = newEndDate

    // Live Supabase Mode
    const supabase = createBrowserSupabaseClient()
    if (!supabase) {
      alert('فشل الاتصال بقاعدة البيانات.')
      setExtendingLoading(false)
      return
    }
    
    try {
      const originalNotes = extendingMission.notes || ''
      const updatedNotes = `${originalNotes}\n\n[تمديد إداري - ${todayStr}]: تم تمديد المأمورية إلى ${newDateFormatted} بناءً على تكليف: ${extensionReason}\nتاريخ الانتهاء المتوقع: ${newDateFormatted}`
      
      const { error: dbErr } = await supabase
        .from('missions')
        .update({
          notes: updatedNotes
        })
        .eq('id', extendingMission.id)
        
      if (dbErr) {
        alert(`فشل التحديث بقاعدة البيانات: ${dbErr.message}`)
        setExtendingLoading(false)
        return
      }
      
      // Send notification
      if (extendingMission.assignedUserId) {
        await supabase.from('notifications').insert({
          body: `تم تمديد فترة المأمورية رقم ${extendingMission.serialNumber} إلى ${newDateFormatted} بناءً على توجيهات إدارية.`,
          mission_id: extendingMission.id,
          title: 'تمديد فترة مأمورية',
          type: 'mission_extended',
          user_id: extendingMission.assignedUserId
        })
      }
      
      // Update state
      setMissions((current) =>
        current.map((m) =>
          m.id === extendingMission.id
            ? { ...m, notes: updatedNotes, endDate: newDateFormatted }
            : m
        )
      )
      
      setExtendingMission(null)
      setNewEndDate('')
      setExtensionReason('')
      setExtendingLoading(false)
      alert('تم تمديد فترة المأمورية بنجاح!')
    } catch (e: any) {
      alert(`حدث خطأ أثناء التمديد: ${e.message || e}`)
      setExtendingLoading(false)
    }
  }

  // Load signature from localStorage when selected mission changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!auditMission) {
      setSignatureImage(null)
      return
    }
    const storageKey = `maamouriyat_signature_${auditMission.id}`
    const match = localStorage.getItem(storageKey)

    if (match) {
      setSignatureImage(match)
    } else {
      setSignatureImage(null)
    }
  }, [auditMission])

  // Automated print handler when printTrigger is active and map has loaded inside the opened modal
  useEffect(() => {
    if (!printTrigger || !auditMission || auditMission.id !== printTrigger) return

    if (leafletLoaded) {
      const timer = setTimeout(() => {
        window.print()
        setPrintTrigger(null)
      }, 600)
      return () => clearTimeout(timer)
    }
  }, [printTrigger, auditMission, leafletLoaded])

  function saveSignatureLocal(missionId: string, dataUrl: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(`maamouriyat_signature_${missionId}`, dataUrl)
    }
  }

  // Drawing event handlers for touch/mouse
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#006d77'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const saveSignature = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const blank = document.createElement('canvas')
    blank.width = canvas.width
    blank.height = canvas.height
    if (canvas.toDataURL() === blank.toDataURL()) return // don't save empty signature

    const dataUrl = canvas.toDataURL()
    setSignatureImage(dataUrl)
    setShowSignaturePad(false)

    if (auditMission) {
      saveSignatureLocal(auditMission.id, dataUrl)
    }
  }

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    let clientX = 0
    let clientY = 0
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 }
      clientX = e.touches[0].clientX
      clientY = e.touches[0].clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    }
  }

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [destinationFilter, setDestinationFilter] = useState('all')

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

  const auditMapRef = useRef<any>(null)

  useEffect(() => {
    if (!leafletLoaded || !auditMission) return
    const win = window as any
    const L = win.L
    if (!L) return

    // Find official coords
    let targetLat = 30.0444
    let targetLng = 31.2357

    if (auditMission.destinationType === 'governorate') {
      const coords = getGovernorateCoords(auditMission.destinationName)
      targetLat = coords.latitude
      targetLng = coords.longitude
    } else {
      const matchedFac = realEgyptianMedicalFacilities.find(f => 
        auditMission.destinationName.includes(f.name) || f.name.includes(auditMission.destinationName)
      )
      if (matchedFac) {
        targetLat = matchedFac.latitude
        targetLng = matchedFac.longitude
      }
    }

    const checkinLat = auditMission.checkinLat ?? targetLat
    const checkinLng = auditMission.checkinLng ?? targetLng

    // Wait a brief tick for the modal DOM to paint
    const timer = setTimeout(() => {
      const container = document.getElementById('audit-map')
      if (!container) return

      // Clean up previous map if exists
      if (auditMapRef.current) {
        try {
          auditMapRef.current.remove()
        } catch (e) {}
        auditMapRef.current = null
      }

      // Initialize map centered between the two points
      const centerLat = (targetLat + checkinLat) / 2
      const centerLng = (targetLng + checkinLng) / 2
      const map = L.map('audit-map', {
        zoomControl: true,
        attributionControl: false
      }).setView([centerLat, centerLng], 14)

      auditMapRef.current = map

      // Add Basemap Tile Layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(map)

      // 1. Target Facility Marker (Teal color pin)
      const targetIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div style="background-color: #006d77; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4);" title="المقر الرسمي للمنشأة الصحية"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7]
      })
      L.marker([targetLat, targetLng], { icon: targetIcon })
        .addTo(map)
        .bindPopup(`<strong>المقر الرسمي للمصادقة:</strong><br/>${auditMission.destinationName}`)

      // 2. Inspector Check-in Marker (Gold/Blue pin based on compliance)
      const checkinColor = auditMission.gpsVerified ? '#2e7d32' : '#d84315'
      const checkinIcon = L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div style="background-color: ${checkinColor}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 5px rgba(0,0,0,0.4);" title="نقطة توثيق المفتش الجغرافية"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      })
      L.marker([checkinLat, checkinLng], { icon: checkinIcon })
        .addTo(map)
        .bindPopup(`<strong>نقطة توثيق المفتش:</strong><br/>خط العرض: ${checkinLat.toFixed(5)}<br/>خط الطول: ${checkinLng.toFixed(5)}`)
        .openPopup()

      // 3. Draw connection line
      const lineColor = auditMission.gpsVerified ? '#2e7d32' : '#d84315'
      const lineWeight = 3
      const dashArray = auditMission.gpsVerified ? '' : '5, 5'
      L.polyline([[targetLat, targetLng], [checkinLat, checkinLng]], {
        color: lineColor,
        weight: lineWeight,
        dashArray: dashArray
      }).addTo(map)

      // Fit map bounds to show both pins
      const bounds = L.latLngBounds([[targetLat, targetLng], [checkinLat, checkinLng]])
      map.fitBounds(bounds, { padding: [40, 40] })

    }, 200)

    return () => {
      clearTimeout(timer)
      if (auditMapRef.current) {
        try {
          auditMapRef.current.remove()
        } catch (e) {}
        auditMapRef.current = null
      }
    }
  }, [leafletLoaded, auditMission])

  function getGovernorateCoords(name: string) {
    const gov = name.trim()
    if (gov.includes('القاهرة')) return { latitude: 30.0444, longitude: 31.2357 }
    if (gov.includes('الجيزة')) return { latitude: 30.0135, longitude: 31.2144 }
    if (gov.includes('الإسكندرية')) return { latitude: 31.2001, longitude: 29.9187 }
    if (gov.includes('بورسعيد')) return { latitude: 31.2653, longitude: 32.3019 }
    if (gov.includes('الإسماعيلية')) return { latitude: 30.6043, longitude: 32.2723 }
    if (gov.includes('السويس')) return { latitude: 29.9668, longitude: 32.5498 }
    if (gov.includes('الغربية') || gov.includes('طنطا')) return { latitude: 30.7865, longitude: 31.0004 }
    if (gov.includes('الدقهلية') || gov.includes('المنصورة')) return { latitude: 31.0409, longitude: 31.3785 }
    if (gov.includes('جنوب سيناء') || gov.includes('شرم الشيخ')) return { latitude: 27.9158, longitude: 34.3299 }
    if (gov.includes('الوادي الجديد') || gov.includes('الخارجة')) return { latitude: 25.4390, longitude: 30.5598 }
    if (gov.includes('الأقصر')) return { latitude: 25.6872, longitude: 32.6396 }
    if (gov.includes('أسوان')) return { latitude: 24.0889, longitude: 32.8998 }
    return { latitude: 30.0444, longitude: 31.2357 }
  }

  // Calculate statistics
  const stats = useMemo(() => {
    const total = missions.length
    const completed = missions.filter(m => m.status === 'completed').length
    const inProgress = missions.filter(m => m.status === 'in_progress').length
    const assigned = missions.filter(m => m.status === 'assigned' || m.status === 'draft').length
    const coverageRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return { total, completed, inProgress, assigned, coverageRate }
  }, [missions])

  // Extract unique governorates/destination names for filter dropdown
  const uniqueDestinations = useMemo(() => {
    const set = new Set(missions.map(m => {
      // If it's a facility, extract the governorate name from address or just use name
      return m.destinationName.split(' - ')[0].split('، ')[0]
    }).filter(Boolean))
    return Array.from(set).sort()
  }, [missions])

  // Dynamic filter application
  const filteredMissions = useMemo(() => {
    return missions.filter(m => {
      const matchesSearch = 
        m.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.visitPurpose.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.employeeNames.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.destinationName.toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus = statusFilter === 'all' || m.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || m.priority === priorityFilter
      const matchesGov = destinationFilter === 'all' || m.destinationName.includes(destinationFilter)

      return matchesSearch && matchesStatus && matchesPriority && matchesGov
    })
  }, [missions, searchQuery, statusFilter, priorityFilter, destinationFilter])


  // --- Pagination State (Default 30 rows per page) ---
  const [pageSize, setPageSize] = useState<number>(30)
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, priorityFilter, destinationFilter, pageSize])

  const totalItems = filteredMissions.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, totalItems)

  const paginatedMissions = useMemo(() => {
    return filteredMissions.slice(startIndex, endIndex)
  }, [filteredMissions, startIndex, endIndex])

  function getPriorityBadgeClass(priority: string) {
    if (priority === 'urgent' || priority === 'critical') return 'priority-urgent'
    if (priority === 'high') return 'priority-high'
    return 'priority-normal'
  }

  function getPriorityLabel(priority: string) {
    if (priority === 'urgent' || priority === 'critical') return 'عاجلة جداً'
    if (priority === 'high') return 'مرتفعة'
    return 'عادية'
  }

  function getStatusLabel(status: string) {
    if (status === 'completed') return 'مكتملة'
    if (status === 'in_progress') return 'قيد التنفيذ'
    if (status === 'assigned') return 'مكلفة'
    if (status === 'draft') return 'مسودة'
    return status
  }

  function getStatusClass(status: string) {
    if (status === 'completed') return 'status-green'
    if (status === 'in_progress') return 'status-blue'
    if (status === 'assigned') return 'status-amber'
    return 'status-default'
  }

  function getDestinationTypeBadge(mission: any) {
    const name = mission.destinationName || '';
    const isGov = mission.destinationType === 'governorate';
    
    if (isGov) {
      return {
        label: '🗺️ زيارة إقليمية للمحافظة',
        bg: '#fff8e1',
        color: '#b78103',
        border: '#ffe082'
      };
    }
    
    if (name.includes('مخزن') || name.includes('مستودع') || name.includes('تموين')) {
      return {
        label: '📦 مخزن تموين وإمداد طبي',
        bg: '#ffebee',
        color: '#c62828',
        border: '#ffcdd2'
      };
    }
    if (name.includes('مركز') || name.includes('وحدة صحية') || name.includes('رعاية أولية') || name.includes('صحة الأسرة')) {
      return {
        label: '🩺 مركز رعاية أولية وطب أسرة',
        bg: '#e8f5e9',
        color: '#2e7d32',
        border: '#c8e6c9'
      };
    }
    if (name.includes('تأمين صحي') || name.includes('صيدناوي')) {
      return {
        label: '🏥 مستشفى تأمين صحي',
        bg: '#e1f5fe',
        color: '#0288d1',
        border: '#b3e5fc'
      };
    }
    if (name.includes('مجمع') || name.includes('الكرنك') || name.includes('الرعاية الصحية')) {
      return {
        label: '💎 هيئة الرعاية الصحية (تأمين شامل)',
        bg: '#e0f7fa',
        color: '#006d77',
        border: '#b2ebf2'
      };
    }
    if (name.includes('تخصصي') || name.includes('معهد ناصر') || name.includes('شرم الشيخ') || name.includes('المنصورة') || name.includes('الشيخ زايد')) {
      return {
        label: '⭐ مستشفى تخصصي (أمانة المراكز)',
        bg: '#f3e5f5',
        color: '#8e24aa',
        border: '#e1bee7'
      };
    }
    
    return {
      label: '🏥 مستشفى عام / تعليمي',
      bg: '#e8eaf6',
      color: '#3f51b5',
      border: '#c5cae9'
    };
  }

  return (
    <div className="missions-portal-container" style={{ display: 'grid', gap: '20px', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. HIGH-DENSITY EXECUTIVE STATISTICS */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px'
      }}>
        {/* Card 1: Total */}
        <div style={{
          background: 'linear-gradient(135deg, #006d77 0%, #004d55 100%)',
          borderRadius: '16px',
          padding: '16px',
          color: 'white',
          boxShadow: '0 4px 15px rgba(0, 109, 119, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', opacity: 0.85, display: 'block', marginBottom: '4px' }}>إجمالي المأموريات</span>
            <strong style={{ fontSize: '26px', fontWeight: '800' }}>{stats.total}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '10px', display: 'flex' }}>
            <FileText size={22} />
          </div>
        </div>

        {/* Card 2: Completed */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #dce7e8',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#546e7a', display: 'block', marginBottom: '4px' }}>مأموريات مكتملة</span>
            <strong style={{ fontSize: '26px', color: '#16725a', fontWeight: '800' }}>{stats.completed}</strong>
          </div>
          <div style={{ background: '#eaf8f3', borderRadius: '12px', padding: '10px', display: 'flex', color: '#16725a' }}>
            <CheckCircle size={22} />
          </div>
        </div>

        {/* Card 3: In Progress */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #dce7e8',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#546e7a', display: 'block', marginBottom: '4px' }}>قيد التنفيذ الميداني</span>
            <strong style={{ fontSize: '26px', color: '#2c6fbb', fontWeight: '800' }}>{stats.inProgress}</strong>
          </div>
          <div style={{ background: '#e8f1fb', borderRadius: '12px', padding: '10px', display: 'flex', color: '#2c6fbb' }}>
            <Clock size={22} />
          </div>
        </div>

        {/* Card 4: Assigned */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #dce7e8',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#546e7a', display: 'block', marginBottom: '4px' }}>مأموريات معلقة / مكلفة</span>
            <strong style={{ fontSize: '26px', color: '#b7791f', fontWeight: '800' }}>{stats.assigned}</strong>
          </div>
          <div style={{ background: '#fdf4e3', borderRadius: '12px', padding: '10px', display: 'flex', color: '#b7791f' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* Card 5: Coverage */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #dce7e8',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#546e7a', display: 'block', marginBottom: '4px' }}>نسبة إنجاز المأموريات</span>
            <strong style={{ fontSize: '26px', color: '#006d77', fontWeight: '800' }}>{stats.coverageRate}%</strong>
          </div>
          <div style={{ background: '#eef6f6', borderRadius: '12px', padding: '10px', display: 'flex', color: '#006d77' }}>
            <TrendingUp size={22} />
          </div>
        </div>
      </section>

      {/* 2. ADVANCED INTERACTIVE FILTERS PANEL */}
      <section style={{
        background: '#ffffff',
        border: '1px solid #cfdcde',
        borderRadius: '14px',
        padding: '16px',
        display: 'grid',
        gap: '12px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.01)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          {/* A. Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="ابحث برقم المأمورية، الموظف، الغرض، أو الوجهة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                minHeight: '40px',
                padding: '0 32px 0 12px',
                border: '1px solid #cfdcde',
                borderRadius: '8px',
                fontSize: '12.5px',
                background: '#f8fbfb',
                outline: 'none'
              }}
            />
            <Search size={14} style={{ position: 'absolute', right: '10px', top: '13px', color: '#90a4ae' }} />
          </div>

          {/* B. Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              minHeight: '40px',
              border: '1px solid #cfdcde',
              borderRadius: '8px',
              fontSize: '12.5px',
              background: '#f8fbfb',
              padding: '0 8px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">كل حالات التنفيذ</option>
            <option value="completed">مكتملة</option>
            <option value="in_progress">قيد التنفيذ</option>
            <option value="assigned">مكلفة</option>
          </select>

          {/* C. Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              minHeight: '40px',
              border: '1px solid #cfdcde',
              borderRadius: '8px',
              fontSize: '12.5px',
              background: '#f8fbfb',
              padding: '0 8px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">كل درجات الأولوية</option>
            <option value="urgent">عاجلة جداً</option>
            <option value="high">مرتفعة</option>
            <option value="normal">عادية</option>
          </select>

          {/* D. Destination Filter */}
          <select
            value={destinationFilter}
            onChange={(e) => setDestinationFilter(e.target.value)}
            style={{
              minHeight: '40px',
              border: '1px solid #cfdcde',
              borderRadius: '8px',
              fontSize: '12.5px',
              background: '#f8fbfb',
              padding: '0 8px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">كل المحافظات الجغرافية ({uniqueDestinations.length})</option>
            {uniqueDestinations.map(gov => (
              <option key={gov} value={gov}>{gov}</option>
            ))}
          </select>
        </div>
      </section>

      {/* 2.5 RESULTS COUNT & VIEW MODE TOGGLER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8fbfb',
        border: '1px solid #cfdcde',
        borderRadius: '12px',
        padding: '10px 16px',
        marginTop: '-10px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ fontSize: '13px', color: '#37474f', fontWeight: 'bold' }}>
          📋 تم العثور على <span style={{ color: 'var(--brand)' }}>{filteredMissions.length}</span> مأمورية
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Layout View Toggler */}
          <div style={{ display: 'flex', gap: '4px', background: '#e0ecef', padding: '4px', borderRadius: '10px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'white' : 'transparent',
                color: viewMode === 'grid' ? 'var(--brand)' : '#546e7a',
                border: 0,
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: viewMode === 'grid' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s'
              }}
              title="عرض كشبكة كروت"
              type="button"
            >
              <LayoutGrid size={16} />
            </button>
            
            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'white' : 'transparent',
                color: viewMode === 'table' ? 'var(--brand)' : '#546e7a',
                border: 0,
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: viewMode === 'table' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s'
              }}
              title="عرض كجدول بيانات"
              type="button"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* 3. PREMIUM CONTENT VIEW (GRID OR TABLE) */}
      {viewMode === 'grid' ? (
        <section style={{ display: 'grid', gap: '14px' }}>
        {paginatedMissions.map((mission) => {
          const isUrgent = mission.priority === 'urgent' || mission.priority === 'critical'
          
          return (
            <article 
              key={mission.id}
              className="mission-glass-card"
              onClick={() => {
                if (mission.status === 'completed') {
                  setAuditMission(mission)
                } else {
                  router.push(`/dashboard/missions/${mission.id}/execute`)
                }
              }}
              style={{
                background: 'white',
                border: isUrgent ? '1px solid #ffcdd2' : '1px solid #dce7e8',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: isUrgent ? '0 4px 15px rgba(211, 47, 47, 0.05)' : '0 4px 10px rgba(0,0,0,0.01)',
                display: 'grid',
                gap: '16px',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.25s ease'
              }}
            >
              {/* Pulsing indicator for urgent missions */}
              {isUrgent && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '4px',
                  height: '100%',
                  background: '#d32f2f'
                }} />
              )}

              {/* A. Card Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '16px', color: '#102027', fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                      {mission.serialNumber}
                    </strong>
                    
                    {/* Priority badge */}
                    <span 
                      style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        borderRadius: '6px',
                        padding: '2px 8px',
                      }}
                      className={getPriorityBadgeClass(mission.priority)}
                    >
                      {getPriorityLabel(mission.priority)}
                    </span>
                  </div>
                  <h3 style={{ margin: 0, fontSize: '14.5px', color: '#37474f', fontWeight: 'bold', lineHeight: '1.4' }}>
                    {mission.visitPurpose}
                  </h3>
                </div>

                {/* Status indicator */}
                <span 
                  style={{
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    padding: '6px 14px',
                  }}
                  className={getStatusClass(mission.status)}
                >
                  {getStatusLabel(mission.status)}
                </span>
              </div>

              {/* B. High Density Metadata Info Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
                background: '#f8fbfb',
                border: '1px solid #e0f0f0',
                borderRadius: '12px',
                padding: '16px'
              }}>
                {/* Met 1: Inspector */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ background: 'white', borderRadius: '8px', padding: '6px', display: 'flex', color: '#006d77', border: '1px solid #e0f0f0' }}>
                    <User size={16} />
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>المفتش / فريق العمل</span>
                    <strong style={{ fontSize: '13px', color: '#263238' }}>{mission.employeeNames}</strong>
                  </div>
                </div>

                {/* Met 2: Department */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ background: 'white', borderRadius: '8px', padding: '6px', display: 'flex', color: '#006d77', border: '1px solid #e0f0f0' }}>
                    <Layers size={16} />
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>الإدارة التابعة للمأمورية</span>
                    <strong style={{ fontSize: '13px', color: '#263238' }}>{mission.orgUnitName}</strong>
                  </div>
                </div>

                {/* Met 3: Destination */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ background: 'white', borderRadius: '8px', padding: '6px', display: 'flex', color: '#006d77', border: '1px solid #e0f0f0' }}>
                    <MapPin size={16} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>الوجهة الطبية المحددة</span>
                    <strong style={{ fontSize: '13px', color: '#263238', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={mission.destinationName}>
                      {mission.destinationName}
                    </strong>
                  </div>
                </div>

                {/* Met 4: Timeline */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ background: 'white', borderRadius: '8px', padding: '6px', display: 'flex', color: '#006d77', border: '1px solid #e0f0f0' }}>
                    <Calendar size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>فترة المأمورية المحددة</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '12.5px', color: '#263238', direction: 'ltr', display: 'inline-block' }}>
                        {mission.scheduledDate} {mission.endDate !== mission.scheduledDate && `~ ${mission.endDate}`}
                      </strong>
                      {(() => {
                        const targetEndDate = getMissionEndDate(mission);
                        const targetStartDate = mission.scheduledDate || '';
                        
                        const parseLocalDate = (dateStr: string) => {
                          if (!dateStr) return null;
                          const [year, month, day] = dateStr.split('-').map(Number);
                          return new Date(year, month - 1, day);
                        };

                        const sDate = parseLocalDate(targetStartDate);
                        const eDate = parseLocalDate(targetEndDate);
                        const todayDate = new Date();
                        todayDate.setHours(0, 0, 0, 0);

                        const isBefore = sDate ? todayDate < sDate : false;
                        const isAfter = eDate ? todayDate > eDate : false;

                        if (mission.status === 'completed') {
                          return null;
                        }

                        if (isBefore) {
                          return (
                            <span style={{
                              fontSize: '10px',
                              background: '#fff8e1',
                              color: '#b78103',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              border: '1px solid #ffe082'
                            }}>
                              ⌛ تبدأ قريباً ({mission.scheduledDate})
                            </span>
                          );
                        }

                        if (isAfter) {
                          return (
                            <span style={{
                              fontSize: '10px',
                              background: '#ffebee',
                              color: '#c62828',
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              border: '1px solid #ffcdd2'
                            }}>
                              🔒 منتهية الصلاحية
                            </span>
                          );
                        }

                        return (
                          <span style={{
                            fontSize: '10px',
                            background: '#e8f5e9',
                            color: '#2e7d32',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 'bold',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            border: '1px solid #c8e6c9'
                          }}>
                            🟢 نشطة وصالحة للتنفيذ
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* C. Action Bar */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                borderTop: '1px solid #f1f7f7',
                paddingTop: '14px'
              }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {mission.notes?.includes('[تحديث التنفيذ]') && (
                    <span style={{ fontSize: '11px', background: '#fff3e0', color: '#e65100', padding: '3px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                      <BadgeAlert size={12} /> تم تغيير الوجهة / تحديثها ميدانياً
                    </span>
                  )}
                  {mission.status === 'completed' ? (
                    mission.gpsVerified ? (
                      <span style={{ 
                        fontSize: '11.5px', 
                        background: '#e8f5e9', 
                        color: '#2e7d32', 
                        border: '1px solid #c8e6c9', 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontWeight: 'bold' 
                      }}>
                        🟢 حضور جغرافي موثق بالـ GPS (مطابق للنطاق المعتمد)
                        {mission.checkinLat && mission.checkinLng && (
                          <a 
                            href={`https://maps.google.com/?q=${mission.checkinLat},${mission.checkinLng}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              color: '#006d77', 
                              textDecoration: 'underline', 
                              fontSize: '11px', 
                              marginRight: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            🗺️ عرض على الخريطة ↗
                          </a>
                        )}
                      </span>
                    ) : (
                      <span style={{ 
                        fontSize: '11.5px', 
                        background: '#fff3e0', 
                        color: '#d84315', 
                        border: '1px solid #ffe0b2', 
                        padding: '4px 10px', 
                        borderRadius: '6px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '6px', 
                        fontWeight: 'bold' 
                      }}>
                        ⚠️ حضور موثق بالـ GPS (خارج نطاق المنشأة الفني)
                        {mission.checkinLat && mission.checkinLng && (
                          <a 
                            href={`https://maps.google.com/?q=${mission.checkinLat},${mission.checkinLng}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            onClick={(e) => e.stopPropagation()}
                            style={{ 
                              color: '#c62828', 
                              textDecoration: 'underline', 
                              fontSize: '11px', 
                              marginRight: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}
                          >
                            🗺️ عرض الموقع الفعلي على الخريطة ↗
                          </a>
                        )}
                      </span>
                    )
                  ) : (
                    <span style={{ 
                      fontSize: '11.5px', 
                      background: '#eceff1', 
                      color: '#455a64', 
                      border: '1px solid #cfd8dc', 
                      padding: '4px 10px', 
                      borderRadius: '6px', 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '6px' 
                    }}>
                      ⚪ في انتظار التحقق الجغرافي التلقائي بالخلفية عند التنفيذ
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Actions 1: Print */}
                  {mission.status === 'completed' ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setAuditMission(mission)
                        setPrintTrigger(mission.id)
                      }}
                      style={{
                        minHeight: '36px',
                        borderRadius: '8px',
                        border: '1px solid #cfdcde',
                        background: 'white',
                        color: '#37474f',
                        fontSize: '12.5px',
                        fontWeight: 'bold',
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      className="action-btn-hover"
                    >
                      <Printer size={14} />
                      طباعة وثيقة المطابقة
                    </button>
                  ) : (
                    <Link 
                      href={`/dashboard/missions/${mission.id}/print`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        minHeight: '36px',
                        borderRadius: '8px',
                        border: '1px solid #cfdcde',
                        background: 'white',
                        color: '#37474f',
                        fontSize: '12.5px',
                        fontWeight: 'bold',
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        transition: 'all 0.2s'
                      }}
                      className="action-btn-hover"
                    >
                      <Printer size={14} />
                      طباعة التكليف
                    </Link>
                  )}

                  {/* Actions 2: Execute or Audit */}
                  {mission.status === 'completed' ? (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation()
                        setAuditMission(mission)
                      }}
                      style={{
                        minHeight: '36px',
                        borderRadius: '8px',
                        background: '#f0fcf9',
                        border: '1px solid #ccebe6',
                        color: '#16725a',
                        fontSize: '12.5px',
                        fontWeight: 'bold',
                        padding: '0 14px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      className="action-btn-hover"
                    >
                      🔎 مراجعة التوثيق والنتائج
                      <ChevronLeft size={14} />
                    </button>
                  ) : (() => {
                    const targetEndDate = getMissionEndDate(mission);
                    const targetStartDate = mission.scheduledDate || '';
                    
                    const parseLocalDate = (dateStr: string) => {
                      if (!dateStr) return null;
                      const [year, month, day] = dateStr.split('-').map(Number);
                      return new Date(year, month - 1, day);
                    };

                    const sDate = parseLocalDate(targetStartDate);
                    const eDate = parseLocalDate(targetEndDate);
                    const todayDate = new Date();
                    todayDate.setHours(0, 0, 0, 0);

                    const isBefore = sDate ? todayDate < sDate : false;
                    const isAfter = eDate ? todayDate > eDate : false;
                    const isLocked = isBefore || isAfter;

                    const isInspector = roleName === 'inspector' || roleName === 'corrections';
                    const canExtend = roleName !== 'inspector' && roleName !== 'corrections';

                    return (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {canExtend && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExtendingMission(mission)
                              setNewEndDate(targetEndDate)
                              setExtensionReason('')
                            }}
                            style={{
                              minHeight: '36px',
                              borderRadius: '8px',
                              background: '#fff8e1',
                              border: '1px solid #ffe082',
                              color: '#b78103',
                              fontSize: '12.5px',
                              fontWeight: 'bold',
                              padding: '0 12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            className="action-btn-hover"
                          >
                            ⌛ تمديد المأمورية
                          </button>
                        )}

                        {isLocked && isInspector ? (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation()
                              alert(`⚠️ عذراً، لا يمكن تنفيذ المأمورية خارج تاريخ التحرك والانتهاء المحدد لها (من ${targetStartDate} إلى ${targetEndDate}).\n\nيرجى التواصل مع إدارة التفتيش والمتابعة لطلب تمديد فترة المأمورية.`)
                            }}
                            style={{
                              minHeight: '36px',
                              borderRadius: '8px',
                              background: '#eceff1',
                              border: '1px solid #cfd8dc',
                              color: '#78909c',
                              fontSize: '12.5px',
                              fontWeight: 'bold',
                              padding: '0 14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              cursor: 'not-allowed',
                            }}
                          >
                            🔒 تنفيذ الزيارة (مغلق)
                          </button>
                        ) : (
                          <Link 
                            href={`/dashboard/missions/${mission.id}/execute`}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              minHeight: '36px',
                              borderRadius: '8px',
                              background: mission.status === 'in_progress' ? '#ffe0b2' : 'var(--brand)',
                              border: mission.status === 'in_progress' ? '1px solid #ffcc80' : '0',
                              color: mission.status === 'in_progress' ? '#e65100' : 'white',
                              fontSize: '12.5px',
                              fontWeight: 'bold',
                              padding: '0 14px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              textDecoration: 'none',
                              boxShadow: '0 2px 6px rgba(0,109,119,0.15)',
                              transition: 'all 0.2s'
                            }}
                            className="action-btn-hover"
                          >
                            {mission.status === 'in_progress' ? '📝 استكمال وتعديل استمارة الزيارة' : '⚡ تنفيذ الزيارة وإثبات الحضور'}
                            <ChevronLeft size={14} />
                          </Link>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </article>
          )
        })}

        {filteredMissions.length === 0 && (
          <div style={{
            background: 'white',
            border: '1px solid #dce7e8',
            borderRadius: '16px',
            padding: '40px 20px',
            textAlign: 'center',
            display: 'grid',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <strong style={{ fontSize: '15px', color: '#102027' }}>لا توجد مأموريات تطابق الفلاتر المحددة</strong>
            <p style={{ margin: 0, fontSize: '13px', color: '#78909c' }}>يرجى تعديل خيارات البحث أو الفرز للحصول على نتائج، أو إنشاء مأمورية جديدة.</p>
          </div>
        )}
      </section>
      ) : (
        /* 3. PREMIUM RESPONSIVE RTL TABLE VIEW */
        <section style={{
          background: 'white',
          border: '1px solid #cfdcde',
          borderRadius: '16px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.01)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'right',
              fontSize: '13px',
              minWidth: '1000px'
            }}>
              <thead>
                <tr style={{
                  background: '#f8fbfb',
                  borderBottom: '1px solid #cfdcde',
                  color: '#37474f'
                }}>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>رقم وتفاصيل المأمورية</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>الوجهة الطبية</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>المفتش / فريق العمل</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>نطاق الفترة الزمنية</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>الأولوية والحالة</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>التوثيق الجغرافي</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold', textAlign: 'center' }}>العمليات</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMissions.map((mission) => {
                  const isUrgent = mission.priority === 'urgent' || mission.priority === 'critical'
                  const targetEndDate = getMissionEndDate(mission);
                  const targetStartDate = mission.scheduledDate || '';
                  
                  const parseLocalDate = (dateStr: string) => {
                    if (!dateStr) return null;
                    const [year, month, day] = dateStr.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  };

                  const sDate = parseLocalDate(targetStartDate);
                  const eDate = parseLocalDate(targetEndDate);
                  const todayDate = new Date();
                  todayDate.setHours(0, 0, 0, 0);

                  const isBefore = sDate ? todayDate < sDate : false;
                  const isAfter = eDate ? todayDate > eDate : false;
                  const isLocked = isBefore || isAfter;

                  const isInspector = roleName === 'inspector' || roleName === 'corrections';
                  const canExtend = roleName !== 'inspector' && roleName !== 'corrections';

                  return (
                    <tr
                      key={mission.id}
                      onClick={() => {
                        if (mission.status === 'completed') {
                          setAuditMission(mission)
                        } else {
                          router.push(`/dashboard/missions/${mission.id}/execute`)
                        }
                      }}
                      style={{
                        borderBottom: '1px solid #eef2f3',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f4f8f8'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Serial & Purpose */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ 
                            fontWeight: '800', 
                            color: '#006d77', 
                            background: '#eef6f6', 
                            padding: '2px 8px', 
                            borderRadius: '6px',
                            alignSelf: 'flex-start',
                            fontSize: '11.5px'
                          }}>
                            {mission.serialNumber}
                          </span>
                          <span style={{ fontWeight: 'bold', color: '#102027', fontSize: '13px' }}>
                            {mission.visitPurpose}
                          </span>
                        </div>
                      </td>

                      {/* Destination */}
                      {(() => {
                        const badge = getDestinationTypeBadge(mission);
                        return (
                          <td style={{ padding: '14px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ 
                                background: badge.bg, 
                                color: badge.color, 
                                borderRadius: '8px', 
                                padding: '6px', 
                                display: 'flex',
                                border: `1px solid ${badge.border}`
                              }}>
                                <MapPin size={16} />
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <strong style={{ color: '#263238' }}>{mission.destinationName}</strong>
                                <span style={{ 
                                  fontSize: '10px', 
                                  color: badge.color, 
                                  background: badge.bg,
                                  border: `1px solid ${badge.border}`,
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  alignSelf: 'flex-start',
                                  marginTop: '2px'
                                }}>
                                  {badge.label}
                                </span>
                              </div>
                            </div>
                          </td>
                        );
                      })()}

                      {/* Inspector / Dept */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <strong style={{ color: '#263238' }}>{mission.employeeNames}</strong>
                          <span style={{ fontSize: '11px', color: '#78909c' }}>{mission.orgUnitName}</span>
                        </div>
                      </td>

                      {/* Dates */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                          <span style={{ color: '#37474f' }}>
                            📅 البدء: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{targetStartDate}</strong>
                          </span>
                          <span style={{ color: isLocked && isInspector ? '#d32f2f' : '#2e7d32' }}>
                            ⌛ الانتهاء: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{targetEndDate}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Priority & Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                          <span 
                            style={{
                              fontSize: '10.5px',
                              fontWeight: 'bold',
                              borderRadius: '6px',
                              padding: '2px 8px',
                            }}
                            className={getPriorityBadgeClass(mission.priority)}
                          >
                            {getPriorityLabel(mission.priority)}
                          </span>
                          <span 
                            style={{
                              borderRadius: '20px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              padding: '4px 10px',
                            }}
                            className={getStatusClass(mission.status)}
                          >
                            {getStatusLabel(mission.status)}
                          </span>
                        </div>
                      </td>

                      {/* Geolocation Verification */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          {mission.status === 'completed' ? (
                            mission.gpsVerified ? (
                              <span style={{ 
                                fontSize: '11px', 
                                background: '#e8f5e9', 
                                color: '#2e7d32', 
                                border: '1px solid #c8e6c9', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontWeight: 'bold' 
                              }}>
                                🟢 موثق ومطابق
                              </span>
                            ) : (
                              <span style={{ 
                                fontSize: '11px', 
                                background: '#fff3e0', 
                                color: '#d84315', 
                                border: '1px solid #ffe0b2', 
                                padding: '3px 8px', 
                                borderRadius: '6px', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px', 
                                fontWeight: 'bold' 
                              }}>
                                ⚠️ خارج النطاق
                              </span>
                            )
                          ) : (
                            <span style={{ 
                              fontSize: '11px', 
                              background: '#eceff1', 
                              color: '#455a64', 
                              border: '1px solid #cfd8dc', 
                              padding: '3px 8px', 
                              borderRadius: '6px', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              fontWeight: 'bold' 
                            }}>
                              ⚪ بالانتظار
                            </span>
                          )}
                          
                          {mission.status === 'completed' && mission.checkinLat && mission.checkinLng && (
                            <a 
                              href={`https://maps.google.com/?q=${mission.checkinLat},${mission.checkinLng}`} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              onClick={(e) => e.stopPropagation()}
                              style={{ 
                                color: '#006d77', 
                                textDecoration: 'underline', 
                                fontSize: '11px',
                                fontWeight: 'bold'
                              }}
                            >
                              🗺️ الخريطة ↗
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 20px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                          {/* Print Action */}
                          {mission.status === 'completed' ? (
                            <button
                              onClick={() => {
                                setAuditMission(mission)
                                setPrintTrigger(Date.now().toString())
                              }}
                              style={{
                                minHeight: '30px',
                                borderRadius: '6px',
                                background: '#f0fcf9',
                                border: '1px solid #ccebe6',
                                color: '#16725a',
                                fontSize: '11.5px',
                                fontWeight: 'bold',
                                padding: '0 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              className="action-btn-hover"
                            >
                              🖨️ طباعة
                            </button>
                          ) : (
                            <Link
                              href={`/dashboard/missions/${mission.id}/print`}
                              style={{
                                minHeight: '30px',
                                borderRadius: '6px',
                                background: '#eceff1',
                                border: '1px solid #cfd8dc',
                                color: '#455a64',
                                fontSize: '11.5px',
                                fontWeight: 'bold',
                                padding: '0 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                textDecoration: 'none',
                                transition: 'all 0.2s'
                              }}
                              className="action-btn-hover"
                            >
                              🖨️ التكليف
                            </Link>
                          )}

                          {/* Extend Action */}
                          {canExtend && mission.status !== 'completed' && (
                            <button
                              onClick={() => {
                                setExtendingMission(mission)
                                setNewEndDate(targetEndDate)
                                setExtensionReason('')
                              }}
                              style={{
                                minHeight: '30px',
                                borderRadius: '6px',
                                background: '#fff8e1',
                                border: '1px solid #ffe082',
                                color: '#b78103',
                                fontSize: '11.5px',
                                fontWeight: 'bold',
                                padding: '0 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              className="action-btn-hover"
                            >
                              ⌛ تمديد
                            </button>
                          )}

                          {/* Execute or Audit Action */}
                          {mission.status === 'completed' ? (
                            <button
                              onClick={() => setAuditMission(mission)}
                              style={{
                                minHeight: '30px',
                                borderRadius: '6px',
                                background: '#f0fcf9',
                                border: '1px solid #ccebe6',
                                color: '#16725a',
                                fontSize: '11.5px',
                                fontWeight: 'bold',
                                padding: '0 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              className="action-btn-hover"
                            >
                              🔎 مراجعة
                            </button>
                          ) : isLocked && isInspector ? (
                            <button
                              onClick={() => {
                                alert(`⚠️ عذراً، لا يمكن تنفيذ المأمورية خارج تاريخ التحرك والانتهاء المحدد لها (من ${targetStartDate} إلى ${targetEndDate}).\n\nيرجى التواصل مع إدارة التفتيش والمتابعة لطلب تمديد فترة المأمورية.`)
                              }}
                              style={{
                                minHeight: '30px',
                                borderRadius: '6px',
                                background: '#eceff1',
                                border: '1px solid #cfd8dc',
                                color: '#78909c',
                                fontSize: '11.5px',
                                fontWeight: 'bold',
                                padding: '0 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'not-allowed',
                              }}
                            >
                              🔒 مغلق
                            </button>
                          ) : (
                            <Link
                              href={`/dashboard/missions/${mission.id}/execute`}
                              style={{
                                minHeight: '30px',
                                borderRadius: '6px',
                                background: mission.status === 'in_progress' ? '#ffe0b2' : 'var(--brand)',
                                border: mission.status === 'in_progress' ? '1px solid #ffcc80' : '0',
                                color: mission.status === 'in_progress' ? '#e65100' : 'white',
                                fontSize: '11.5px',
                                fontWeight: 'bold',
                                padding: '0 10px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                textDecoration: 'none',
                                boxShadow: '0 2px 4px rgba(0,109,119,0.1)',
                                transition: 'all 0.2s'
                              }}
                              className="action-btn-hover"
                            >
                              {mission.status === 'in_progress' ? '📝 استكمال' : 'تنفيذ'}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}

                {filteredMissions.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#78909c' }}>
                      <strong style={{ fontSize: '14px', color: '#102027', display: 'block', marginBottom: '4px' }}>
                        لا توجد مأموريات تطابق الفلاتر المحددة
                      </strong>
                      يرجى تعديل خيارات البحث أو الفرز للحصول على نتائج، أو إنشاء مأمورية جديدة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 4. SUPERVISOR GPS & TECHNICAL AUDIT MODAL */}
      {auditMission && (
        <div 
          className="modal-responsive-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(16, 32, 39, 0.5)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
            direction: 'rtl'
          }} onClick={() => setAuditMission(null)}>
          <div 
            className="modal-responsive-container"
            style={{
              background: 'white',
              borderRadius: '20px',
              width: '950px',
              maxWidth: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(16, 32, 39, 0.25)',
              border: '1px solid #cfdcde',
              animation: 'fadeInUp 0.3s ease-out'
            }} 
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <header 
              className="modal-responsive-header"
              style={{
                background: '#102027',
                color: 'white',
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '4px solid var(--brand)'
              }}
            >
              <div>
                <span style={{ fontSize: '11px', color: '#80cbc4', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  وثيقة إثبات المطابقة ومراجعة نتائج الزيارة الرسمية
                </span>
                <h2 style={{ margin: '4px 0 0', fontSize: '20px', color: 'white', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  📋 تكليف رقم: {auditMission.serialNumber}
                </h2>
              </div>
              <button 
                onClick={() => setAuditMission(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 0,
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="action-btn-hover"
              >
                <X size={18} />
              </button>
            </header>

            {/* Print-Only Official Header */}
            <div className="print-only-header" style={{ display: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #102027', paddingBottom: '16px', marginBottom: '20px', direction: 'rtl' }}>
                <div style={{ textAlign: 'right', fontSize: '13px', lineHeight: '1.6' }}>
                  <strong>جمهورية مصر العربية</strong><br />
                  <span>وزارة الصحة والسكان</span><br />
                  <span>{auditMission.orgUnitName || 'ديوان عام الوزارة'}</span>
                </div>
                <img 
                  alt="شعار وزارة الصحة والسكان المصرية" 
                  src="/mohp-logo.png" 
                  style={{ width: '80px', height: '80px', objectFit: 'contain' }} 
                />
                <div style={{ textAlign: 'left', fontSize: '13px', lineHeight: '1.6' }}>
                  <strong>نظام حوكمة المأمورية الميدانية</strong><br />
                  <span>وثيقة إثبات المطابقة والتوثيق الجغرافي</span><br />
                  <span>حالة التوثيق: {auditMission.gpsVerified ? '🟢 مطابق وموثق جغرافياً' : '⚠️ تباين جيو-مكاني (خارج النطاق)'}</span><br />
                  <strong>رقم التكليف: {auditMission.serialNumber}</strong>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px', color: '#102027' }}>وثيقة المطابقة والتوثيق الميداني المعتمدة</h1>
                <span style={{ fontSize: '12px', color: '#546e7a' }}>صادر تلقائياً من المنظومة الإلكترونية لحوكمة المأموريات الميدانية بوزارة الصحة والسكان المصرية</span>
              </div>
            </div>

            {/* Modal Scrollable Body */}
            <div 
              className="modal-responsive-grid"
              style={{
                padding: '24px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '24px',
                background: '#fcfdfd'
              }}
            >
              
              {/* Right Column: Technical & Execution Findings */}
              <div style={{ display: 'grid', gap: '20px', alignContent: 'start' }}>
                
                {/* 1. General Info & Inspector Details */}
                <div style={{ background: 'white', border: '1px solid #e0f0f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '14.5px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #f0f7f7', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <User size={16} /> المفتش وتوقيت المرور
                  </h3>
                  <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                    <div className="detail-row">
                      <span className="detail-label">المفتش المسؤول:</span>
                      <strong className="detail-value">{auditMission.employeeNames}</strong>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">الإدارة التابعة:</span>
                      <strong className="detail-value">{auditMission.orgUnitName}</strong>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">الوجهة المعتمدة:</span>
                      <strong className="detail-value">{auditMission.destinationName}</strong>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">تاريخ وجدول المرور:</span>
                      <strong className="detail-value">{auditMission.scheduledDate}</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Technical Findings Checklists */}
                <div style={{ background: 'white', border: '1px solid #e0f0f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '14.5px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #f0f7f7', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={16} /> تقييم بنود التفتيش المحوكم والنتائج الفعلية
                  </h3>
                  
                  {loadingAuditResults ? (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', color: '#78909c', fontSize: '12.5px', justifyContent: 'center', padding: '20px 0' }}>
                      <div className="spinner" style={{ border: '2px solid #e0f0f0', borderTopColor: '#006d77', width: '20px', height: '20px', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                      <span>جاري جلب إجابات الاستمارة الفعلية من السيرفر...</span>
                    </div>
                  ) : parsedAuditResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px 10px', color: '#78909c', fontSize: '12.5px', background: '#fafafa', borderRadius: '8px' }}>
                      ℹ️ لم يتم حفظ أي إجابات تقييمية لهذه المأمورية بعد.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: '12px', fontSize: '12.5px' }}>
                      {parsedAuditResults.map((res: any, idx: number) => {
                        let answerColor = '#2e7d32' // green
                        let answerText = 'ملتزم ✓'
                        
                        if (res.answer === 'no') {
                          answerColor = '#d32f2f' // red
                          answerText = 'غير ملتزم ❌'
                        } else if (res.answer === 'na') {
                          answerColor = '#78909c' // grey
                          answerText = 'لا ينطبق'
                        } else {
                          // Could be checkbox array, rating, or custom dropdown
                          answerText = Array.isArray(res.answer) ? res.answer.join(', ') : String(res.answer)
                          if (answerText.includes('غير') || answerText.includes('لا') || answerText.includes('مخالف')) {
                            answerColor = '#d32f2f'
                          } else {
                            answerColor = '#006d77'
                          }
                        }

                        return (
                          <div key={res.id || idx} style={{ display: 'grid', gap: '4px', borderBottom: idx < parsedAuditResults.length - 1 ? '1px solid #f0f7f7' : 'none', paddingBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                              <span style={{ fontWeight: 'bold', color: '#37474f', textAlign: 'right', flex: 1, lineHeight: '1.4' }}>
                                📋 {res.text}
                              </span>
                              <strong style={{ color: answerColor, flexShrink: 0, fontSize: '12px', direction: 'rtl' }}>
                                {answerText}
                              </strong>
                            </div>
                            {res.notes && (
                              <div style={{ 
                                fontSize: '11px', 
                                color: '#546e7a', 
                                background: '#f8fafb', 
                                padding: '6px 10px', 
                                borderRadius: '6px', 
                                borderRight: '2px solid #006d77',
                                display: 'flex',
                                gap: '4px',
                                width: '100%',
                                boxSizing: 'border-box'
                              }}>
                                <strong>📝 ملاحظات البند:</strong>
                                <span>{res.notes}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Execution Report Notes */}
                <div style={{ background: 'white', border: '1px solid #e0f0f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '14.5px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #f0f7f7', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    ✏️ تقرير وتوجيهات المفتش الميداني
                  </h3>
                  <div style={{ fontSize: '13px', color: '#37474f', lineHeight: '1.6', background: '#fafafa', padding: '12px', borderRadius: '8px', borderRight: '3px solid #006d77' }}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {auditMission.notes || 'لم يسجل المفتش أي ملاحظات إدارية إضافية.'}
                    </p>
                  </div>
                </div>

                {/* 4. Digital Signatures & Approvals */}
                <div style={{ background: 'white', border: '1px solid #e0f0f0', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <h3 style={{ margin: '0 0 14px', fontSize: '14.5px', color: '#006d77', fontWeight: 'bold', borderBottom: '1px solid #f0f7f7', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🖊️ الاعتماد والتوقيع الإلكتروني الموثق للمأمورية
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', textAlign: 'center', fontSize: '12px' }}>
                    {/* Inspector Sign */}
                    <div style={{ background: '#f8fbfb', border: '1px solid #edf2f2', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#78909c', fontSize: '11px' }}>توقيع المفتش الميداني:</span>
                      <div style={{ 
                        border: '1px dashed #2e7d32', 
                        borderRadius: '6px', 
                        padding: '4px 8px', 
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        fontWeight: 'bold',
                        fontSize: '9px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}>
                        <span>🛡️ موقّع رقمياً</span>
                        <span>بالموقع الميداني</span>
                      </div>
                      <strong style={{ fontSize: '11.5px', color: '#263238' }}>{auditMission.employeeNames}</strong>
                    </div>

                    {/* Director Sign */}
                    <div style={{ background: '#f8fbfb', border: '1px solid #edf2f2', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#78909c', fontSize: '11px' }}>اعتماد مدير الإدارة المختصة:</span>
                      {signatureImage ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', width: '100%' }}>
                          <div style={{ background: 'white', border: '1px solid #edf2f2', borderRadius: '6px', padding: '4px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                            <img 
                              src={signatureImage} 
                              alt="توقيع المدير" 
                              style={{ height: '32px', maxWidth: '100%', objectFit: 'contain', background: 'transparent' }} 
                            />
                          </div>
                          <button 
                            onClick={() => setShowSignaturePad(true)}
                            style={{ fontSize: '9.5px', color: '#c62828', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
                          >
                            تعديل التوقيع 📝
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowSignaturePad(true)}
                          style={{
                            background: '#ffb300',
                            color: '#102027',
                            border: 0,
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            marginTop: '10px'
                          }}
                        >
                          🖊️ توقيع واعتماد الآن
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Left Column: GPS & Map Audit Verification */}
              <div style={{ display: 'grid', gap: '20px', alignContent: 'start' }}>
                
                {/* 1. Map container */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13.5px', fontWeight: 'bold', color: '#37474f', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={16} style={{ color: 'var(--brand)' }} /> خريطة تتبع ومطابقة الحضور الفعلي
                    </span>
                    <span style={{ fontSize: '11px', color: '#78909c' }}>تحديث تلقائي صامت</span>
                  </div>

                  <div id="audit-map" style={{
                    height: '280px',
                    borderRadius: '16px',
                    border: '1px solid #cfdcde',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                    background: '#eceff1'
                  }}>
                    {!leafletLoaded && (
                      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', color: '#78909c' }}>
                        <div style={{ border: '3px solid #b0bec5', borderTop: '3px solid #006d77', width: '24px', height: '24px', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <span style={{ fontSize: '12px' }}>جاري تحميل مكتبة الخرائط الجغرافية...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. GPS Verification Status Panel */}
                <div className="gps-status-panel" style={{
                  background: auditMission.gpsVerified ? '#e8f5e9' : '#fff3e0',
                  border: `1px solid ${auditMission.gpsVerified ? '#a5d6a7' : '#ffcc80'}`,
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'start'
                }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: auditMission.gpsVerified ? '#c8e6c9' : '#ffe0b2',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    fontWeight: 'bold',
                    color: auditMission.gpsVerified ? '#2e7d32' : '#e65100',
                    marginTop: '2px'
                  }}>
                    {auditMission.gpsVerified ? '✓' : '⚠️'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 4px', fontSize: '14px', color: auditMission.gpsVerified ? '#2e7d32' : '#d84315', fontWeight: 'bold' }}>
                      {auditMission.gpsVerified ? 'حضور جغرافي معتمد ومطابق' : 'مخالفة: تباين جيو-مكاني (خارج نطاق المنشأة)'}
                    </h4>
                    <p style={{ margin: 0, fontSize: '12px', color: '#37474f', lineHeight: '1.5' }}>
                      {auditMission.gpsVerified ? (
                        'النظام يؤكد تواجد المفتش فعلياً ضمن النطاق المعتمد للمنشأة الصحية (أقل من ٢٠٠ متر) لحظة بدء وإنهاء المأمورية. تم استلام وقبول التقرير.'
                      ) : (
                        'تنبيه: أرسل المفتش التقرير من موقع جغرافي يبعد مسافة تزيد عن ٢٠٠ متر من إحداثيات المستشفى المسجلة. يتم تسجيل هذا التباين وتوثيق إحداثياته للتحقق الإداري المحوكم.'
                      )}
                    </p>
                    
                    {/* Exact Coordinates */}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <span style={{ fontSize: '11px', background: 'white', border: '1px solid rgba(0,0,0,0.06)', color: '#455a64', padding: '2px 8px', borderRadius: '4px', direction: 'ltr' }}>
                        📍 Lat: {auditMission.checkinLat ? auditMission.checkinLat.toFixed(6) : '30.0783'}
                      </span>
                      <span style={{ fontSize: '11px', background: 'white', border: '1px solid rgba(0,0,0,0.06)', color: '#455a64', padding: '2px 8px', borderRadius: '4px', direction: 'ltr' }}>
                        📍 Lng: {auditMission.checkinLng ? auditMission.checkinLng.toFixed(6) : '31.2339'}
                      </span>
                      {auditMission.checkinLat && auditMission.checkinLng && (
                        <a 
                          href={`https://maps.google.com/?q=${auditMission.checkinLat},${auditMission.checkinLng}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={{
                            fontSize: '11px',
                            color: auditMission.gpsVerified ? '#006d77' : '#c62828',
                            fontWeight: 'bold',
                            textDecoration: 'underline',
                            marginLeft: 'auto'
                          }}
                        >
                          فتح خرائط Google لتدقيق المسار ↗
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Legenda & Verification standard */}
                <div style={{ background: '#f5f5f5', borderRadius: '12px', padding: '12px', fontSize: '11.5px', color: '#607d8b', display: 'grid', gap: '6px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>💡 دليل رموز الخريطة:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#006d77' }} />
                    <span>الموقع الجغرافي الرسمي المعتمد للمستشفى بمركز البيانات.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: auditMission.gpsVerified ? '#2e7d32' : '#d84315' }} />
                    <span>المكان الفعلي الحقيقي للمفتش لحظة بدء وإثبات الزيارة.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '12px', height: '1.5px', background: auditMission.gpsVerified ? '#2e7d32' : '#d84315', borderStyle: auditMission.gpsVerified ? 'solid' : 'dashed' }} />
                    <span>مسافة المطابقة الخطية بين موقع المنشأة ومكان المفتش الفعلي.</span>
                  </div>
                </div>

              </div>
              
            </div>

            {/* Print-Only Signatures & Stamp Section */}
            <div className="print-only-footer" style={{ display: 'none', padding: '24px 30px', borderTop: '2px dashed #cfdcde', background: 'white' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '30px', textAlign: 'center', fontSize: '13px', lineHeight: '1.8', direction: 'rtl' }}>
                <div>
                  <strong style={{ color: '#102027', display: 'block', marginBottom: '8px' }}>المفتش / فريق التفتيش</strong>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block', marginBottom: '14px' }}>التوقيع الإلكتروني وتأكيد الحضور الجغرافي</span>
                  
                  {/* Styled electronic signature stamp */}
                  <div style={{ 
                    border: '1px dashed #2e7d32', 
                    borderRadius: '8px', 
                    padding: '8px', 
                    background: '#f1f8e9', 
                    maxWidth: '180px', 
                    margin: '0 auto 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <span style={{ fontSize: '10px', color: '#2e7d32', fontWeight: 'bold' }}>🛡️ تم التوقيع رقمياً</span>
                    <strong style={{ fontSize: '11px', color: '#33691e' }}>{auditMission.employeeNames}</strong>
                    <span style={{ fontSize: '8px', color: '#558b2f' }}>(معرف: MOHP-INSPECT-{auditMission.id.slice(-5)})</span>
                  </div>
                </div>
                <div>
                  <strong style={{ color: '#102027', display: 'block', marginBottom: '8px' }}>مدير الإدارة المختصة</strong>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block', marginBottom: '14px' }}>المراجعة والتوجيه والاعتماد الإداري</span>
                  {signatureImage ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                      <img 
                        src={signatureImage} 
                        alt="توقيع المدير المعتمد" 
                        style={{ height: '42px', maxWidth: '130px', objectFit: 'contain' }} 
                      />
                      <span style={{ fontSize: '9px', color: '#ffb300', fontWeight: 'bold' }}>⭐ معتمد إلكترونياً</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ height: '40px', borderBottom: '1px dotted #b0bec5', margin: '0 auto 10px', width: '80%' }}></div>
                      <span style={{ color: '#78909c' }}>الاسم / التوقيع: .....................</span>
                    </>
                  )}
                </div>
                <div>
                  <strong style={{ color: '#102027', display: 'block', marginBottom: '8px' }}>ديوان عام الوزارة</strong>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block', marginBottom: '14px' }}>شعار واعتماد قطاع الطب العلاجي (ختم النسر)</span>
                  <div style={{ height: '40px', borderBottom: '1px dotted #b0bec5', margin: '0 auto 10px', width: '80%' }}></div>
                  <span style={{ color: '#78909c' }}>خاتم الجهة الرسمي</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', fontSize: '11.5px', color: '#90a4ae', marginTop: '24px', borderTop: '1px solid #edf2f2', paddingTop: '12px' }}>
                <span>تم استخراج وتوثيق وثيقة المطابقة ومعاينة التكليف رقم {auditMission.serialNumber} إلكترونياً من وزارة الصحة والسكان المصرية.</span>
              </div>
            </div>

            {/* Modal Footer */}
            <footer 
              className="modal-responsive-footer"
              style={{
                background: '#f8fbfb',
                borderTop: '1px solid #dce7e8',
                padding: '16px 24px',
                display: 'flex',
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              {/* Edit Form & Report Button */}
              <button 
                onClick={() => {
                  setAuditMission(null)
                  router.push(`/dashboard/missions/${auditMission.id}/execute`)
                }}
                style={{
                  minHeight: '38px',
                  borderRadius: '8px',
                  border: '1px solid #ffcc80',
                  background: '#ffe0b2',
                  color: '#e65100',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  padding: '0 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="action-btn-hover"
              >
                ✏️ تعديل الاستمارة والتقرير الميداني
              </button>

              <button 
                onClick={() => window.print()}
                style={{
                  minHeight: '38px',
                  borderRadius: '8px',
                  border: '0',
                  background: '#006d77',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  padding: '0 20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,109,119,0.15)',
                  transition: 'all 0.2s'
                }}
                className="action-btn-hover"
              >
                <Printer size={14} /> طباعة وثيقة المطابقة والتوثيق المعتمدة
              </button>
            </footer>

          </div>
        </div>
      )}

      {/* Signature Canvas Pad Overlay */}
      {showSignaturePad && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(16, 32, 39, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
          direction: 'rtl'
        }} onClick={() => setShowSignaturePad(false)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '450px',
              maxWidth: '100%',
              boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
              border: '1px solid #cfdcde',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header style={{
              background: '#006d77',
              color: 'white',
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid var(--brand)'
            }}>
              <strong style={{ fontSize: '15px' }}>🖊️ توقيع واعتماد التكليف إلكترونياً</strong>
              <button 
                onClick={() => setShowSignaturePad(false)}
                style={{ background: 'transparent', border: 0, color: 'white', cursor: 'pointer', fontSize: '16px' }}
              >✕</button>
            </header>
            
            <div style={{ padding: '18px', display: 'grid', gap: '14px', background: '#fcfdfd' }}>
              <span style={{ fontSize: '12px', color: '#546e7a', lineHeight: '1.5' }}>
                يرجى رسم توقيعكم بالماوس أو الإصبع (للشاشات اللمسية) داخل المربع أدناه للربط والتوقيع الإلكتروني على وثيقة المطابقة:
              </span>
              
              <div style={{
                background: 'white',
                border: '2px dashed #b0bec5',
                borderRadius: '8px',
                overflow: 'hidden',
                height: '180px',
                position: 'relative'
              }}>
                <canvas
                  ref={canvasRef}
                  width={410}
                  height={176}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  style={{
                    display: 'block',
                    cursor: 'crosshair',
                    background: 'white',
                    width: '100%',
                    height: '100%'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={clearCanvas}
                  style={{
                    background: 'white',
                    border: '1px solid #cfdcde',
                    color: '#c62828',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  🧹 مسح اللوحة
                </button>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setShowSignaturePad(false)}
                    style={{
                      background: 'white',
                      border: '1px solid #cfdcde',
                      color: '#546e7a',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    إلغاء
                  </button>
                  <button 
                    onClick={saveSignature}
                    style={{
                      background: '#006d77',
                      border: 0,
                      color: 'white',
                      borderRadius: '6px',
                      padding: '6px 16px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,109,119,0.15)'
                    }}
                  >
                    💾 حفظ واعتماد التوقيع
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Administrative Mission Extension Modal */}
      {extendingMission && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(16, 32, 39, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '20px',
          direction: 'rtl'
        }} onClick={() => setExtendingMission(null)}>
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              width: '500px',
              maxWidth: '100%',
              boxShadow: '0 12px 36px rgba(0,0,0,0.15)',
              border: '1px solid #cfdcde',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <header style={{
              background: '#006d77',
              color: 'white',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '3px solid var(--brand)'
            }}>
              <strong style={{ fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⌛ تمديد فترة المأمورية إدارياً
              </strong>
              <button 
                onClick={() => setExtendingMission(null)}
                style={{ background: 'transparent', border: 0, color: 'white', cursor: 'pointer', fontSize: '18px' }}
              >✕</button>
            </header>
            
            <div style={{ padding: '20px', display: 'grid', gap: '16px', background: '#fcfdfd' }}>
              <div style={{
                background: '#e0f2f1',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #b2dfdb',
                fontSize: '13px',
                color: '#004d40',
                lineHeight: '1.4'
              }}>
                <strong>مأمورية رقم:</strong> {extendingMission.serialNumber}<br />
                <strong>الوجهة:</strong> {extendingMission.destinationName}<br />
                <strong>تاريخ التحرك الأصلي:</strong> {extendingMission.scheduledDate}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#37474f', fontWeight: 'bold', marginBottom: '6px' }}>
                  تاريخ الانتهاء الجديد المتوقع للمأمورية *
                </label>
                <input 
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                  min={extendingMission.scheduledDate || undefined}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cfdcde',
                    fontSize: '14px',
                    direction: 'ltr',
                    textAlign: 'right',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: '#37474f', fontWeight: 'bold', marginBottom: '6px' }}>
                  سند التكليف بالتمديد وسبب التمديد الإداري *
                </label>
                <textarea
                  value={extensionReason}
                  onChange={(e) => setExtensionReason(e.target.value)}
                  placeholder="مثال: بناءً على توجيهات السيد رئيس الإدارة المركزية نظراً لعدم استكمال أعمال الجرد بسبب تعطل النظام الإلكتروني..."
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: '1px solid #cfdcde',
                    fontSize: '13px',
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: '1.5',
                    transition: 'border-color 0.2s'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button 
                  onClick={() => setExtendingMission(null)}
                  style={{
                    background: 'white',
                    border: '1px solid #cfdcde',
                    color: '#546e7a',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleExtendSave}
                  disabled={extendingLoading}
                  style={{
                    background: '#006d77',
                    border: 0,
                    color: 'white',
                    borderRadius: '8px',
                    padding: '8px 20px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    cursor: extendingLoading ? 'not-allowed' : 'pointer',
                    opacity: extendingLoading ? 0.7 : 1,
                    boxShadow: '0 2px 4px rgba(0,109,119,0.15)'
                  }}
                >
                  {extendingLoading ? 'جاري الحفظ والتعميم...' : '💾 اعتماد وتمديد المأمورية'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Styled JSX to inject css hovers and animations cleanly */}
    <style jsx global>{`
      .priority-urgent {
        background: #ffebee;
        color: #c62828;
        border: 1px solid #ffcdd2;
      }
      .priority-high {
        background: #fff3e0;
        color: #e65100;
        border: 1px solid #ffe0b2;
      }
      .priority-normal {
        background: #f1f7f7;
        color: #455a64;
        border: 1px solid #cfdcde;
      }
      .status-green {
        background: #eaf8f3;
        color: #16725a;
        border: 1px solid #ccebe6;
      }
      .status-blue {
        background: #e8f1fb;
        color: #2c6fbb;
        border: 1px solid #cce0f5;
      }
      .status-amber {
        background: #fdf4e3;
        color: #b7791f;
        border: 1px solid #faeacc;
      }
      .status-default {
        background: #f0f4f8;
        color: #607d8b;
        border: 1px solid #cfd8dc;
      }
      .mission-glass-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(16,32,39,0.06) !important;
      }
      .action-btn-hover:hover {
        filter: brightness(0.96);
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        border-bottom: 1px dashed #f0f4f4;
        padding-bottom: 8px;
        padding-top: 4px;
      }
      .detail-row:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }
      .detail-label {
        color: #78909c;
        flex-shrink: 0;
        font-weight: normal;
      }
      .detail-value {
        color: #263238;
        font-weight: bold;
        text-align: left;
      }
      .checklist-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: #f8fbfb;
        border-radius: 8px;
        border: 1px solid #edf5f5;
        gap: 12px;
      }
      .checklist-label {
        color: #37474f;
        font-weight: 500;
      }
      .checklist-value {
        flex-shrink: 0;
        font-weight: bold;
      }
      @media (max-width: 768px) {
        .modal-responsive-backdrop {
          padding: 8px !important;
        }
        .modal-responsive-grid {
          grid-template-columns: 1fr !important;
          padding: 14px !important;
          gap: 16px !important;
        }
        .modal-responsive-header {
          padding: 12px 16px !important;
        }
        .modal-responsive-header h2 {
          font-size: 16px !important;
        }
        .modal-responsive-footer {
          padding: 12px 16px !important;
          flex-direction: column-reverse !important;
          align-items: stretch !important;
          gap: 8px !important;
        }
        .modal-responsive-footer a, .modal-responsive-footer button {
          width: 100% !important;
          justify-content: center !important;
          min-height: 40px !important;
        }
        .modal-responsive-container {
          max-height: 95vh !important;
          border-radius: 12px !important;
          margin: 10px !important;
        }
        .gps-status-panel {
          flex-direction: column !important;
          align-items: center !important;
          text-align: center !important;
          gap: 10px !important;
        }
        .gps-status-panel > div:first-child {
          margin-top: 0 !important;
        }
      }
      @media (max-width: 480px) {
        .detail-row {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 4px !important;
        }
        .detail-value {
          text-align: right !important;
          width: 100% !important;
        }
        .checklist-row {
          flex-direction: column !important;
          align-items: flex-start !important;
          gap: 6px !important;
        }
        .checklist-value {
          align-self: flex-end !important;
        }
      }
      .print-only-header, .print-only-footer {
        display: none !important;
      }
      @media print {
        /* Completely hide non-modal containers from print engine layout flow */
        .desktop-sidebar,
        .topbar,
        .bottom-nav,
        .scrim,
        .side-sheet,
        .security-footer,
        .missions-portal-container > section,
        .modal-responsive-header,
        .modal-responsive-footer,
        #audit-map .leaflet-control-container,
        .missions-page-header,
        .missions-page-error {
          display: none !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          overflow: hidden !important;
          visibility: hidden !important;
        }

        /* Reset and collapse core page shell wrappers to clean relative flow */
        html,
        body,
        .app-shell,
        .content-shell,
        .content,
        .missions-portal-container {
          display: block !important;
          background: white !important;
          color: black !important;
          width: 100% !important;
          height: auto !important;
          min-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
          overflow: visible !important;
        }

        /* Set modal backdrop as a standard relative block element */
        .modal-responsive-backdrop {
          position: relative !important;
          left: 0 !important;
          top: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: auto !important;
          background: white !important;
          display: block !important;
          z-index: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          overflow: visible !important;
        }

        /* Force modal container to occupy full width and flow naturally */
        .modal-responsive-container {
          position: relative !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
          height: auto !important;
          max-height: none !important;
          overflow: visible !important;
          display: block !important;
          box-shadow: none !important;
          border: none !important;
          background: white !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        /* Format grid columns for A4 paper printout */
        .modal-responsive-grid {
          overflow: visible !important;
          display: grid !important;
          grid-template-columns: 1fr 1fr !important;
          gap: 20px !important;
          padding: 10px 0 !important;
          background: white !important;
        }

        /* Render printable header and footer properly */
        .print-only-header {
          display: block !important;
          visibility: visible !important;
        }
        .print-only-footer {
          display: block !important;
          visibility: visible !important;
          page-break-inside: avoid !important;
        }

        /* Interactive map custom rendering */
        #audit-map {
          height: 220px !important;
          border: 1px solid #cfdcde !important;
        }

        /* Force high-quality color output */
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `}</style>
    </div>
  )
}
