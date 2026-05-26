'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  Building2,
  Server,
  Plus,
  Trash2,
  MapPin,
  Search,
  Filter,
  CheckCircle2,
  Database,
  Building,
  Loader2,
  Navigation,
  Warehouse,
  Activity,
  Edit2,
  X,
  Compass,
  Check
} from 'lucide-react'
import { type FacilityAffiliationOption, type FacilityAffiliationType } from '@/lib/facility-affiliations'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { realEgyptianMinistryUnits } from '@/lib/real-facilities'

export type FacilityItem = {
  id: string
  name: string
  facility_type: string
  address: string
  is_active: boolean | null
  latitude?: number
  longitude?: number
  governorate_id?: string | null
  governorates?: { name: string } | null
}

const FACILITY_CATEGORIES = [
  'مستشفى عام',
  'مستشفى تخصصي (أمانة المراكز الطبية)',
  'مستشفى (الهيئة العامة للرعاية الصحية)',
  'مستشفى تعليمي',
  'مستشفى تأمين صحي',
  'مركز رعاية صحية أولية وطب أسرة',
  'مخزن تموين طبي وإمداد دوائي رئيسي'
]

const EGYPTIAN_GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'البحيرة', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'الغربية', 'المنوفية', 'الدقهلية', 'الشرقية',
  'كفر الشيخ', 'دمياط', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'الوادي الجديد',
  'مطروح', 'شمال سيناء', 'جنوب سيناء'
]

const affiliationTypes: { value: FacilityAffiliationType; label: string }[] = [
  { value: 'directorate', label: 'مديرية شئون صحية' },
  { value: 'central_entity', label: 'أمانة / إدارة مركزية' },
  { value: 'authority', label: 'هيئة خدمية' },
  { value: 'other', label: 'أخرى / جهة خارجية' }
]

function typeLabel(type: string) {
  switch (type) {
    case 'directorate':
      return 'مديرية شئون صحية'
    case 'central_entity':
      return 'أمانة / إدارة مركزية'
    case 'authority':
      return 'هيئة خدمية'
    default:
      return 'أخرى'
  }
}

function resolveType(aff: FacilityAffiliationOption) {
  return aff.affiliation_type ?? aff.type ?? 'other'
}

const ministryUnits = realEgyptianMinistryUnits

function renderUnitIcon(iconName: string, size = 18, color = 'currentColor') {
  switch (iconName) {
    case 'Compass':
      return <Compass size={size} style={{ color }} />
    case 'Building2':
      return <Building2 size={size} style={{ color }} />
    case 'Activity':
      return <Activity size={size} style={{ color }} />
    case 'Building':
      return <Building size={size} style={{ color }} />
    case 'Server':
      return <Server size={size} style={{ color }} />
    case 'CheckCircle2':
      return <CheckCircle2 size={size} style={{ color }} />
    case 'Warehouse':
      return <Warehouse size={size} style={{ color }} />
    case 'Database':
      return <Database size={size} style={{ color }} />
    default:
      return <Building2 size={size} style={{ color }} />
  }
}
export function FacilitiesPortal({
  initialFacilities,
  initialAffiliations,
  facilityStoreReady,
  role = 'superadmin'
}: {
  initialFacilities: FacilityItem[]
  initialAffiliations: FacilityAffiliationOption[]
  facilityStoreReady: boolean
  role?: string | null
}) {
  const supabase = createBrowserSupabaseClient()
  const isWritable = role === 'superadmin' || role === 'techadmin'
  const [activeTab, setActiveTab] = useState<'directory' | 'affiliations' | 'ministry_structure'>('directory')
  const [selectedUnitId, setSelectedUnitId] = useState<string>('therapeutic-sector')
  const [unitSearchQuery, setUnitSearchQuery] = useState('')

  // Facilities state
  const [facilities, setFacilities] = useState<FacilityItem[]>(initialFacilities)

  // Search & Filter state for physical facilities
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedGov, setSelectedGov] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Selected card state for highlights
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)

  // Map state
  const [leafletLoaded, setLeafletLoaded] = useState(false)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const tempMarkerRef = useRef<any>(null)

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create')
  const [editingFacility, setEditingFacility] = useState<FacilityItem | null>(null)

  // Form states
  const [facName, setFacName] = useState('')
  const [facType, setFacType] = useState('مستشفى عام')
  const [facGov, setFacGov] = useState('القاهرة')
  const [facAddress, setFacAddress] = useState('')
  const [facLat, setFacLat] = useState('30.0444')
  const [facLon, setFacLon] = useState('31.2357')
  const [facActive, setFacActive] = useState(true)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Affiliations management state
  const [affiliations, setAffiliations] = useState<FacilityAffiliationOption[]>(initialAffiliations)
  const [affName, setAffName] = useState('')
  const [affType, setAffType] = useState<FacilityAffiliationType>('directorate')
  const [affError, setAffError] = useState('')
  const [affSuccess, setAffSuccess] = useState('')
  const [affLoading, setAffLoading] = useState(false)

  // --- Dynamic Client-Side Leaflet Ingestion ---
  useEffect(() => {
    if (typeof window === 'undefined') return

    const win = window as any
    if (win.L) {
      setLeafletLoaded(true)
      return
    }

    // Load Leaflet CSS dynamically in document head if not present
    const existingLink = document.querySelector('link[href*="leaflet.css"]')
    if (!existingLink) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    // Load Leaflet JS dynamically
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
      // Poll for completion if script injected but L not yet exposed
      const interval = setInterval(() => {
        if (win.L) {
          setLeafletLoaded(true)
          clearInterval(interval)
        }
      }, 100)
      return () => clearInterval(interval)
    }
  }, [])

  // Facility metadata calculations
  const totalGovs = useMemo(() => {
    const set = new Set(facilities.map((f) => f.governorates?.name).filter(Boolean))
    return set.size
  }, [facilities])

  const facilityTypes = useMemo(() => {
    const set = new Set(facilities.map((f) => f.facility_type).filter(Boolean))
    return Array.from(set).sort()
  }, [facilities])

  const governoratesList = useMemo(() => {
    const set = new Set(facilities.map((f) => f.governorates?.name).filter(Boolean))
    return Array.from(set).sort()
  }, [facilities])

  // Filter physical facilities list
  const filteredFacilities = useMemo(() => {
    return facilities.filter((facility) => {
      // 0. Hierarchy: hide higher level facilities from lower level roles
      const type = facility.facility_type || '';
      
      if (role === 'generalmanager') {
        // General Manager cannot see Warehouses (restricted to techadmin/superadmin/central)
        if (type.includes('مخزن')) return false;
      } else if (role === 'creator' || role === 'financial') {
        // Specialists/Financial cannot see specialized tertiary hospitals or warehouses
        if (type.includes('تخصصي') || type.includes('الرعاية الصحية') || type.includes('مخزن') || type.includes('تعليمي')) return false;
      } else if (role === 'inspector') {
        // Inspectors can only see general hospitals and PHCs
        if (type.includes('تخصصي') || type.includes('الرعاية الصحية') || type.includes('مخزن') || type.includes('تعليمي') || type.includes('تأمين')) return false;
      }

      const matchesSearch =
        facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        facility.address.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesType = selectedType === 'all' || facility.facility_type === selectedType
      
      const matchesGov =
        selectedGov === 'all' || facility.governorates?.name === selectedGov
      
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && facility.is_active !== false) ||
        (statusFilter === 'inactive' && facility.is_active === false)

      return matchesSearch && matchesType && matchesGov && matchesStatus
    })
  }, [facilities, searchQuery, selectedType, selectedGov, statusFilter, role])

  // Sorted affiliations for presentation
  const sortedAffiliations = useMemo(() => {
    return [...affiliations].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
  }, [affiliations])

  // Ref to hold drawer callback to solve Leaflet closure stale state issue
  const mapClickCallbackRef = useRef<any>(null)
  mapClickCallbackRef.current = (lat: number, lng: number) => {
    if (drawerOpen) {
      setFacLat(lat.toFixed(6))
      setFacLon(lng.toFixed(6))
      
      // Update guide pin position
      const win = window as any
      const L = win.L
      if (L && mapRef.current) {
        if (tempMarkerRef.current) {
          tempMarkerRef.current.setLatLng([lat, lng])
        } else {
          // Dynamic pulsing guide pin
          const tempIcon = L.divIcon({
            className: 'temp-div-icon',
            html: `<div style="background-color: #f1c40f; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 8px #f1c40f; display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; border-radius: 50%; background: #e67e22;"></div></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
          tempMarkerRef.current = L.marker([lat, lng], { icon: tempIcon }).addTo(mapRef.current)
        }
      }
    }
  }

  // --- Map Initialization & PIN Drawing ---
  useEffect(() => {
    if (!leafletLoaded || !mapContainerRef.current) return

    const win = window as any
    const L = win.L
    if (!L) return

    // 1. Initialize Map if not present
    if (!mapRef.current) {
      // Centered on central Egypt (Cairo coords) with default zoom 7
      mapRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true
      }).setView([30.0444, 31.2357], 7)

      // Add high-quality Basemap (CartoDB Voyager) for clean modern RTL UI
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapRef.current)

      // Add custom positioned zoom control at bottom-right for clean RTL look
      L.control.zoom({
        position: 'bottomright'
      }).addTo(mapRef.current)

      // Bind Map Click Listener for geographic coordinate capture
      mapRef.current.on('click', (e: any) => {
        if (mapClickCallbackRef.current) {
          mapClickCallbackRef.current(e.latlng.lat, e.latlng.lng)
        }
      })
    }

    const map = mapRef.current

    // 2. Clear old markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // 3. Draw new pins for the currently filtered facilities
    filteredFacilities.forEach((facility) => {
      const lat = facility.latitude ?? 30.0444
      const lon = facility.longitude ?? 31.2357

      // Colors based on category for advanced visualization wow
      const iconColor = facility.facility_type.includes('مخزن') ? '#e74c3c' // Red (Warehouse!)
                       : facility.facility_type.includes('مركز طبي') || facility.facility_type.includes('طب أسرة') || facility.facility_type.includes('رعاية صحية أولية') ? '#1abc9c' // Teal/Turquoise (PHC!)
                       : facility.facility_type.includes('تخصصي') ? '#9b59b6' // Purple
                       : facility.facility_type.includes('تعليمي') ? '#e67e22' // Orange
                       : facility.facility_type.includes('تأمين') ? '#2980b9'  // Blue
                       : '#2ecc71' // Green (General/Other Hospitals)

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${iconColor}; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4); transition: transform 0.2s;" class="map-pin-div"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      })

      const marker = L.marker([lat, lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="direction: rtl; text-align: right; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; min-width: 180px; padding: 2px;">
            <strong style="font-size: 13.5px; color: #102027; display: block; margin-bottom: 3px; font-weight: 700;">${facility.name}</strong>
            <span style="font-size: 10px; color: ${iconColor}; background: ${iconColor}1A; padding: 2px 8px; border-radius: 12px; display: inline-block; font-weight: bold; margin-bottom: 8px; border: 1px solid ${iconColor}4D;">${facility.facility_type}</span>
            <div style="font-size: 11.5px; color: #546e7a; line-height: 1.4; margin-bottom: 4px;">${facility.address}</div>
            <div style="font-size: 10.5px; color: #90a4ae; border-top: 1px solid #eceff1; padding-top: 5px; margin-top: 5px; display: flex; justify-content: space-between;">
              <span>المحافظة: ${facility.governorates?.name || 'غير محددة'}</span>
              <a href="https://maps.google.com/?q=${lat},${lon}" target="_blank" rel="noopener noreferrer" style="color: var(--brand); font-weight: bold; text-decoration: none;">خرائط Google ↗</a>
            </div>
          </div>
        `)

      marker.on('click', () => {
        setSelectedFacilityId(facility.id)
        const cardElement = document.getElementById(`facility-card-${facility.id}`)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      })

      markersRef.current.push(marker)
    })

    // 4. Adjust map bounds to show all markers beautifully if they exist
    if (filteredFacilities.length > 0) {
      const bounds = L.latLngBounds(filteredFacilities.map((f) => [f.latitude ?? 30.0444, f.longitude ?? 31.2357]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [leafletLoaded, filteredFacilities])

  // Center and focus map on selected facility card click
  const handleFocusFacility = (facility: FacilityItem) => {
    setSelectedFacilityId(facility.id)
    if (!leafletLoaded || !mapRef.current) return

    const lat = facility.latitude ?? 30.0444
    const lon = facility.longitude ?? 31.2357

    mapRef.current.setView([lat, lon], 14, {
      animate: true,
      duration: 1.2
    })

    // Trigger Popup automatically
    markersRef.current.forEach((marker) => {
      const pos = marker.getLatLng()
      if (Math.abs(pos.lat - lat) < 0.0001 && Math.abs(pos.lng - lon) < 0.0001) {
        marker.openPopup()
      }
    })
  }

  // --- OPEN ADD / EDIT DRAWERS ---
  const handleOpenCreateDrawer = () => {
    setDrawerMode('create')
    setEditingFacility(null)
    setFacName('')
    setFacType('مستشفى عام')
    setFacGov('القاهرة')
    setFacAddress('')
    setFacLat('30.0444')
    setFacLon('31.2357')
    setFacActive(true)
    setFormError('')
    setFormSuccess('')
    setDrawerOpen(true)
  }

  const handleOpenEditDrawer = (facility: FacilityItem, e: React.MouseEvent) => {
    e.stopPropagation() // Avoid card focusing trigger
    setDrawerMode('edit')
    setEditingFacility(facility)
    setFacName(facility.name)
    setFacType(facility.facility_type)
    setFacGov(facility.governorates?.name || 'القاهرة')
    setFacAddress(facility.address)
    setFacLat((facility.latitude ?? 30.0444).toString())
    setFacLon((facility.longitude ?? 31.2357).toString())
    setFacActive(facility.is_active !== false)
    setFormError('')
    setFormSuccess('')
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    setEditingFacility(null)
    // Remove dynamic pulsing guide pin
    if (tempMarkerRef.current) {
      tempMarkerRef.current.remove()
      tempMarkerRef.current = null
    }
  }

  // --- SAVE / EDIT ACTIONS ---
  async function handleSaveFacility(event: React.FormEvent) {
    event.preventDefault()
    setFormError('')
    setFormSuccess('')

    const nameVal = facName.trim()
    const addressVal = facAddress.trim()
    const latVal = parseFloat(facLat)
    const lonVal = parseFloat(facLon)

    if (!nameVal || !addressVal || isNaN(latVal) || isNaN(lonVal)) {
      setFormError('الرجاء إدخال قيم صحيحة لكافة الحقول وتحديد الموقع.')
      return
    }

    setFormLoading(true)

    // A. EDIT MODE
    if (drawerMode === 'edit' && editingFacility) {
      if (facilityStoreReady && supabase && editingFacility.id) {
        try {
          // 1. Resolve Governorate ID if DB connected
          const { data: govData } = await supabase
            .from('governorates')
            .select('id')
            .eq('name', facGov)
            .single()

          const { error: updateError } = await supabase
            .from('facilities')
            .update({
              name: nameVal,
              facility_type: facType,
              address: addressVal,
              latitude: latVal,
              longitude: lonVal,
              is_active: facActive,
              governorate_id: govData?.id || null
            })
            .eq('id', editingFacility.id)

          if (updateError) {
            setFormError(updateError.message)
            setFormLoading(false)
            return
          }
        } catch (err: any) {
          setFormError(err.message || 'فشل الاتصال بقاعدة البيانات لتحديث البيانات.')
          setFormLoading(false)
          return
        }
      }

      // Update state locally
      setFacilities((current) =>
        current.map((item) =>
          item.id === editingFacility.id
            ? {
                ...item,
                name: nameVal,
                facility_type: facType,
                address: addressVal,
                latitude: latVal,
                longitude: lonVal,
                is_active: facActive,
                governorates: { name: facGov }
              }
            : item
        )
      )

      setFormSuccess('تم تحديث بيانات المنشأة وموضعها الجغرافي بنجاح.')
      
      // Auto focus map
      setTimeout(() => {
        handleFocusFacility({
          id: editingFacility.id,
          name: nameVal,
          facility_type: facType,
          address: addressVal,
          latitude: latVal,
          longitude: lonVal,
          is_active: facActive,
          governorates: { name: facGov }
        })
      }, 500)

    } else {
      // B. CREATE MODE
      const newId = `fac-new-${Date.now()}`
      let dbId = newId

      if (facilityStoreReady && supabase) {
        try {
          // 1. Resolve Governorate ID
          const { data: govData } = await supabase
            .from('governorates')
            .select('id')
            .eq('name', facGov)
            .single()

          const { data, error: insertError } = await supabase
            .from('facilities')
            .insert({
              name: nameVal,
              facility_type: facType,
              address: addressVal,
              latitude: latVal,
              longitude: lonVal,
              is_active: facActive,
              governorate_id: govData?.id || null
            })
            .select('id')
            .single()

          if (insertError) {
            setFormError(insertError.message)
            setFormLoading(false)
            return
          }
          if (data) dbId = data.id
        } catch (err: any) {
          setFormError(err.message || 'فشل تسكين المنشأة الجديدة بقاعدة البيانات.')
          setFormLoading(false)
          return
        }
      }

      const newFacility: FacilityItem = {
        id: dbId,
        name: nameVal,
        facility_type: facType,
        address: addressVal,
        latitude: latVal,
        longitude: lonVal,
        is_active: facActive,
        governorates: { name: facGov }
      }

      // Append state
      setFacilities((current) => [newFacility, ...current])
      setFormSuccess('تم تسجيل وإدراج المنشأة الطبية الجديدة بالخريطة بنجاح.')

      // Auto focus map
      setTimeout(() => {
        handleFocusFacility(newFacility)
      }, 500)
    }

    setFormLoading(false)
    setTimeout(() => {
      handleCloseDrawer()
    }, 1500)
  }

  async function handleDeleteFacility(facilityId: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (confirm('هل أنت متأكد من رغبتك في حذف هذه المنشأة الطبية نهائياً من قاعدة البيانات والمنظومة؟')) {
      if (facilityStoreReady && supabase) {
        try {
          const { error: deleteError } = await supabase
            .from('facilities')
            .delete()
            .eq('id', facilityId)

          if (deleteError) {
            alert('فشل في حذف المنشأة: ' + deleteError.message)
            return
          }
        } catch (err: any) {
          alert('فشل الاتصال بقاعدة البيانات لحذف المنشأة.')
          return
        }
      }

      setFacilities((current) => current.filter((item) => item.id !== facilityId))
      setSelectedFacilityId(null)
    }
  }

  // --- ACTIONS FOR ORGANIZATIONAL AFFILIATIONS ---
  async function handleAddAffiliation(event: React.FormEvent) {
    event.preventDefault()
    const nextName = affName.trim()
    setAffError('')
    setAffSuccess('')

    if (!nextName) return
    if (affiliations.some((item) => item.name === nextName)) {
      setAffError('هذه الجهة موجودة بالفعل.')
      return
    }

    setAffLoading(true)

    if (facilityStoreReady && supabase) {
      try {
        const { data, error: insertError } = await supabase
          .from('facility_affiliations')
          .insert({
            affiliation_type: affType,
            code: `MANUAL-${Date.now()}`,
            name: nextName,
            sort_order: affiliations.length * 10 + 10,
          })
          .select('id, name, affiliation_type')
          .single()

        if (insertError) {
          setAffError(insertError.message)
          setAffLoading(false)
          return
        }

        setAffiliations((current) => [...current, data as FacilityAffiliationOption])
      } catch (err: any) {
        setAffError(err.message || 'فشل الاتصال بجدول التبعية.')
        setAffLoading(false)
        return
      }
    } else {
      // Demo Mode / Session fallback
      setAffiliations((current) => [...current, { name: nextName, affiliation_type: affType }])
    }

    setAffName('')
    setAffLoading(false)
    setAffSuccess(facilityStoreReady ? 'تم تسجيل جهة التبعية وحفظها بقاعدة البيانات بنجاح.' : 'تمت الإضافة مؤقتاً للتجربة في الجلسة النشطة.')
    setTimeout(() => setAffSuccess(''), 5000)
  }

  async function handleRemoveAffiliation(affiliation: FacilityAffiliationOption) {
    setAffError('')
    setAffSuccess('')

    if (facilityStoreReady && supabase && affiliation.id) {
      setAffLoading(true)
      const { error: updateError } = await supabase
        .from('facility_affiliations')
        .update({ is_active: false })
        .eq('id', affiliation.id)
      setAffLoading(false)

      if (updateError) {
        setAffError(updateError.message)
        return
      }
    }

    setAffiliations((current) => current.filter((item) => item.name !== affiliation.name))
    setAffSuccess('تم إلغاء تنشيط جهة التبعية وتحديث القوائم.')
    setTimeout(() => setAffSuccess(''), 4000)
  }

  return (
    <div style={{ display: 'grid', gap: '20px', direction: 'rtl', position: 'relative' }}>
      
      {/* SaaS Sub-header Section */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '4px 0 10px 0',
        borderBottom: '1px solid var(--line)',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#102027' }}>
              إدارة المنشآت الصحية
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#004d40',
              background: '#e0f2f1',
              padding: '2px 8px',
              borderRadius: '20px',
              border: '1px solid #b2dfdb',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ecc71' }} />
              قاعدة البيانات نشطة
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#546e7a' }}>
            تصفح دليل المستشفيات والمراكز والمخازن الطبية، وقم بتهيئة جهات التبعية الإدارية والرقابية للوزارة.
          </p>
        </div>
      </section>

      {/* Tabs & Cloud State Header */}
      <section style={{
        background: 'white',
        border: '1px solid var(--line)',
        padding: '12px',
        borderRadius: '16px',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Navigation pills */}
        <div style={{ display: 'flex', gap: '8px', background: '#f0f4f5', padding: '4px', borderRadius: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('directory')}
            style={{
              background: activeTab === 'directory' ? 'white' : 'transparent',
              color: activeTab === 'directory' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'directory' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <Building2 size={15} />
            دليل المنشآت الطبية ({filteredFacilities.length})
          </button>
          
          <button
            onClick={() => setActiveTab('affiliations')}
            style={{
              background: activeTab === 'affiliations' ? 'white' : 'transparent',
              color: activeTab === 'affiliations' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'affiliations' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <Server size={15} />
            جهات التبعية التنظيمية ({affiliations.length})
          </button>

          <button
            onClick={() => setActiveTab('ministry_structure')}
            style={{
              background: activeTab === 'ministry_structure' ? 'white' : 'transparent',
              color: activeTab === 'ministry_structure' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'ministry_structure' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <Compass size={15} />
            إدارات ديوان عام الوزارة (قطاع الطب العلاجي)
          </button>
        </div>

        {/* Database state label */}
        <span style={{
          fontSize: '11.5px',
          fontWeight: 'bold',
          color: facilityStoreReady ? '#16725a' : '#b7791f',
          background: facilityStoreReady ? '#eaf8f3' : '#fdf4e3',
          border: `1px solid ${facilityStoreReady ? '#c7ebd8' : '#fbe3b5'}`,
          padding: '6px 12px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Database size={14} />
          {facilityStoreReady ? 'خادم البيانات السحابي متصل' : 'وضع جلسة العمل المؤقتة'}
        </span>
      </section>

      {/* --- TAB CONTENT PANELS --- */}
      <section style={{ minHeight: '300px' }}>
        
        {/* TAB 1: HEALTH FACILITIES DIRECTORY */}
        {activeTab === 'directory' && (
          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
            
            {/* Quick stats mini-bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px'
            }}>
              <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building size={20} style={{ color: 'var(--brand)' }} />
                <div>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>إجمالي المنشآت والوحدات</span>
                  <strong style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>{facilities.length} منشأة</strong>
                </div>
              </div>

              <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={20} style={{ color: '#1abc9c' }} />
                <div>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>مراكز الرعاية الأولية</span>
                  <strong style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>
                    {facilities.filter((f) => f.facility_type.includes('مركز طبي') || f.facility_type.includes('طب أسرة')).length} مركزاً
                  </strong>
                </div>
              </div>

              <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Warehouse size={20} style={{ color: '#e74c3c' }} />
                <div>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>مخازن الإمداد والتموين</span>
                  <strong style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>
                    {facilities.filter((f) => f.facility_type.includes('مخزن')).length} مخازن
                  </strong>
                </div>
              </div>

              <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <MapPin size={20} style={{ color: '#f39c12' }} />
                <div>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>التغطية بالجمهورية</span>
                  <strong style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>{totalGovs} محافظة</strong>
                </div>
              </div>
            </div>

            {/* Split-pane Map Dashboard */}
            <div style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '16px',
              flexWrap: 'wrap'
            }}>
              
              {/* Left Column: Filter + Scrollable high density list */}
              <div style={{
                flex: '1 1 350px',
                display: 'grid',
                gap: '14px',
                minWidth: '320px'
              }}>
                {/* Filter & Add Box */}
                <div style={{
                  background: 'white',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '14px',
                  boxShadow: 'var(--shadow)',
                  display: 'grid',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '12.5px', fontWeight: 'bold', color: '#37474f' }}>
                      <Filter size={15} style={{ color: 'var(--brand)' }} />
                      <span>تصفية الدليل والبحث الجغرافي</span>
                    </div>

                    {/* Prominent Add Button */}
                    {isWritable && (
                      <button
                        onClick={handleOpenCreateDrawer}
                        style={{
                          background: 'var(--brand)',
                          color: 'white',
                          border: 0,
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          boxShadow: '0 2px 4px rgba(22,160,133,0.15)',
                          transition: 'transform 0.1s'
                        }}
                        type="button"
                      >
                        <Plus size={12} />
                        إضافة منشأة
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gap: '8px' }}>
                    {/* Text search */}
                    <div style={{ position: 'relative' }}>
                      <input
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث باسم المستشفى أو العنوان..."
                        style={{
                          width: '100%',
                          minHeight: '36px',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          padding: '0 28px 0 10px',
                          fontSize: '12px',
                          background: '#f8fbfb',
                          outline: 'none'
                        }}
                        type="text"
                        value={searchQuery}
                      />
                      <Search size={14} style={{ position: 'absolute', right: '8px', top: '11px', color: '#90a4ae' }} />
                    </div>

                    {/* Type Filter */}
                    <select
                      onChange={(e) => setSelectedType(e.target.value)}
                      style={{
                        minHeight: '36px',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        padding: '0 8px',
                        fontSize: '12px',
                        background: '#f8fbfb',
                        outline: 'none'
                      }}
                      value={selectedType}
                    >
                      <option value="all">كل الفئات والأنواع ({facilityTypes.length})</option>
                      {facilityTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>

                    {/* Governorate Filter */}
                    <select
                      onChange={(e) => setSelectedGov(e.target.value)}
                      style={{
                        minHeight: '36px',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        padding: '0 8px',
                        fontSize: '12px',
                        background: '#f8fbfb',
                        outline: 'none'
                      }}
                      value={selectedGov}
                    >
                      <option value="all">كل المحافظات ({governoratesList.length})</option>
                      {governoratesList.map((gov) => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </select>

                    {/* Status Filter */}
                    <select
                      onChange={(e) => setStatusFilter(e.target.value)}
                      style={{
                        minHeight: '36px',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        padding: '0 8px',
                        fontSize: '12px',
                        background: '#f8fbfb',
                        outline: 'none'
                      }}
                      value={statusFilter}
                    >
                      <option value="all">الحالة (الكل)</option>
                      <option value="active">نشطة فقط</option>
                      <option value="inactive">غير نشطة فقط</option>
                    </select>
                  </div>
                </div>

                {/* List Container with fixed scrollable height */}
                <div style={{
                  maxHeight: '480px',
                  overflowY: 'auto',
                  display: 'grid',
                  gap: '10px',
                  paddingRight: '2px'
                }}>
                  {filteredFacilities.map((facility) => {
                    const isSelected = selectedFacilityId === facility.id
                    
                    // Standard color map
                    const typeColor = facility.facility_type.includes('مخزن') ? '#e74c3c' // Red (Warehouse!)
                                     : facility.facility_type.includes('مركز طبي') || facility.facility_type.includes('طب أسرة') || facility.facility_type.includes('رعاية صحية أولية') ? '#1abc9c' // Teal/Turquoise (PHC!)
                                     : facility.facility_type.includes('تخصصي') ? '#9b59b6' // Purple
                                     : facility.facility_type.includes('تعليمي') ? '#e67e22' // Orange
                                     : facility.facility_type.includes('تأمين') ? '#2980b9'  // Blue
                                     : '#2ecc71'; // Green

                    return (
                      <div
                        id={`facility-card-${facility.id}`}
                        key={facility.id}
                        onClick={() => handleFocusFacility(facility)}
                        style={{
                          background: isSelected ? '#f0fcf9' : 'white',
                          border: isSelected ? '1px solid var(--brand)' : '1px solid var(--line)',
                          borderRadius: '12px',
                          padding: '12px',
                          boxShadow: isSelected ? '0 4px 12px rgba(22,160,133,0.1)' : 'var(--shadow)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <strong style={{ fontSize: '13px', color: isSelected ? 'var(--brand)' : '#102027', fontWeight: 'bold', paddingLeft: '24px' }}>{facility.name}</strong>
                          <span style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            color: facility.is_active !== false ? '#27ae60' : '#c0392b',
                            background: facility.is_active !== false ? '#eafaf1' : '#fdedec',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            whiteSpace: 'nowrap'
                          }}>
                            {facility.is_active !== false ? 'نشطة' : 'غير نشطة'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{
                            fontSize: '10px',
                            color: typeColor,
                            background: `${typeColor}15`,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            fontWeight: 'bold'
                          }}>
                            {facility.facility_type}
                          </span>
                          
                          <span style={{
                            fontSize: '10px',
                            color: '#546e7a',
                            background: '#f1f5f7',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            📍 {facility.governorates?.name || 'غير محددة'}
                          </span>
                        </div>

                        <div style={{
                          borderTop: '1px dashed #eceff1',
                          paddingTop: '6px',
                          fontSize: '11px',
                          color: '#78909c',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          paddingLeft: isWritable ? '76px' : '44px'
                        }}>
                          {facility.address}
                        </div>

                        {/* Hover Edit & Delete action buttons */}
                        {isWritable && (
                          <div
                            style={{
                              position: 'absolute',
                              left: '12px',
                              bottom: '10px',
                              display: 'flex',
                              gap: '6px'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleOpenEditDrawer(facility, e)}
                              style={{
                                background: '#f1f5f7',
                                color: '#546e7a',
                                border: '1px solid #cfdcde',
                                borderRadius: '6px',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.1s'
                              }}
                              title="تعديل المنشأة"
                              type="button"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteFacility(facility.id, e)}
                              style={{
                                background: '#fcedec',
                                color: '#e74c3c',
                                border: '1px solid #fadbd8',
                                borderRadius: '6px',
                                width: '26px',
                                height: '26px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'all 0.1s'
                              }}
                              title="حذف المنشأة"
                              type="button"
                              onMouseEnter={(e) => e.currentTarget.style.background = '#fcdbd9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#fcedec'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {filteredFacilities.length === 0 && (
                    <div style={{
                      background: 'white',
                      border: '1px solid var(--line)',
                      borderRadius: '12px',
                      padding: '30px 14px',
                      textAlign: 'center',
                      color: '#90a4ae',
                      fontSize: '12px'
                    }}>
                      لا توجد منشآت مطابقة للبحث
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Premium Leaflet Map Pane */}
              <div style={{
                flex: '2 1 450px',
                minWidth: '320px',
                position: 'relative',
                borderRadius: '16px',
                border: '1px solid var(--line)',
                boxShadow: 'var(--shadow)',
                background: '#eceff1',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}>
                
                {/* Map Guide Overlay Banner when drawer is open */}
                {drawerOpen ? (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    zIndex: 400,
                    background: '#f39c12',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                    animation: 'fadeIn 0.2s ease-out'
                  }}>
                    <Compass size={14} className="animate-spin" />
                    <span>انقر على الخريطة مباشرة لتسجيل موقع الصرح الطبي تلقائياً!</span>
                  </div>
                ) : (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    right: '12px',
                    zIndex: 400,
                    background: 'rgba(255,255,255,0.92)',
                    backdropFilter: 'blur(4px)',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    border: '1px solid #cfdcde',
                    fontSize: '11.5px',
                    fontWeight: 'bold',
                    color: '#37474f',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                  }}>
                    <Navigation size={13} style={{ color: 'var(--brand)' }} />
                    <span>توزيع المستشفيات والوحدات على خريطة جمهورية مصر العربية</span>
                  </div>
                )}

                {/* Map Container Element */}
                <div
                  ref={mapContainerRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '620px',
                    borderRadius: '16px'
                  }}
                />

                {/* Loading skeleton screen overlay */}
                {!leafletLoaded && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: '#f8fbfb',
                    zIndex: 500,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px'
                  }}>
                    <Loader2 size={36} className="animate-spin" style={{ color: 'var(--brand)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#546e7a' }}>جاري تحميل الخريطة التفاعلية الحية...</span>
                  </div>
                )}
              </div>

            </div>

            {/* --- PREMIUM SIDE-DRAWER FORM (ADD & EDIT FACILITY) --- */}
            {drawerOpen && (
              <div style={{
                position: 'fixed',
                top: 0,
                right: 0,
                bottom: 0,
                width: '380px',
                maxWidth: '100%',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(16px)',
                boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                borderLeft: '1px solid var(--line)',
                direction: 'rtl'
              }}>
                {/* Header */}
                <div style={{
                  padding: '18px 20px',
                  borderBottom: '1px solid var(--line)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#f8fbfb'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building2 size={18} style={{ color: 'var(--brand)' }} />
                    <strong style={{ fontSize: '14px', color: '#102027', fontWeight: '700' }}>
                      {drawerMode === 'edit' ? 'تعديل بيانات المنشأة الطبية' : 'إضافة منشأة طبية جديدة'}
                    </strong>
                  </div>
                  
                  <button
                    onClick={handleCloseDrawer}
                    style={{
                      background: 'transparent',
                      color: '#90a4ae',
                      border: 0,
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '50%',
                      transition: 'background 0.2s'
                    }}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSaveFacility} style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  flex: 1,
                  overflowY: 'auto'
                }}>
                  {formError && (
                    <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '10px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 'bold' }}>
                      {formError}
                    </div>
                  )}

                  {formSuccess && (
                    <div style={{ background: '#eaf8f3', color: '#16725a', padding: '10px 12px', borderRadius: '8px', fontSize: '11.5px', fontWeight: 'bold' }}>
                      {formSuccess}
                    </div>
                  )}

                  {/* Name */}
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                    اسم الصرح الطبي / المنشأة *
                    <input
                      onChange={(e) => setFacName(e.target.value)}
                      placeholder="مثال: مستشفى المنصورة الدولي"
                      required
                      style={{
                        minHeight: '38px',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        padding: '0 10px',
                        fontSize: '12.5px',
                        outline: 'none'
                      }}
                      type="text"
                      value={facName}
                    />
                  </label>

                  {/* Type */}
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                    نوع وتصنيف المنشأة *
                    <select
                      onChange={(e) => setFacType(e.target.value)}
                      style={{
                        minHeight: '38px',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        padding: '0 6px',
                        fontSize: '12.5px',
                        outline: 'none',
                        background: 'white'
                      }}
                      value={facType}
                    >
                      {FACILITY_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </label>

                  {/* Governorate */}
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                    المحافظة الجغرافية *
                    <select
                      onChange={(e) => setFacGov(e.target.value)}
                      style={{
                        minHeight: '38px',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        padding: '0 6px',
                        fontSize: '12.5px',
                        outline: 'none',
                        background: 'white'
                      }}
                      value={facGov}
                    >
                      {EGYPTIAN_GOVERNORATES.map((gov) => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </select>
                  </label>

                  {/* Address */}
                  <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                    العنوان التفصيلي (الشارع والحي) *
                    <input
                      onChange={(e) => setFacAddress(e.target.value)}
                      placeholder="مثال: شارع عبد السلام عارف، المنصورة"
                      required
                      style={{
                        minHeight: '38px',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        padding: '0 10px',
                        fontSize: '12.5px',
                        outline: 'none'
                      }}
                      type="text"
                      value={facAddress}
                    />
                  </label>

                  {/* Coordinates Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      خط العرض (Latitude) *
                      <input
                        onChange={(e) => setFacLat(e.target.value)}
                        placeholder="30.0444"
                        required
                        style={{
                          minHeight: '38px',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          outline: 'none'
                        }}
                        type="text"
                        value={facLat}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      خط الطول (Longitude) *
                      <input
                        onChange={(e) => setFacLon(e.target.value)}
                        placeholder="31.2357"
                        required
                        style={{
                          minHeight: '38px',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          outline: 'none'
                        }}
                        type="text"
                        value={facLon}
                      />
                    </label>
                  </div>

                  <span style={{ fontSize: '11px', color: '#f39c12', display: 'block', background: '#fdf6e2', padding: '8px 10px', borderRadius: '6px', border: '1px solid #fbeab8', lineHeight: '1.4' }}>
                    💡 <strong>تلميح جيو-تفاعلي</strong>: يمكنك النقر مباشرة على أي موضع على الخريطة لتسجيل خط الطول والعرض الجغرافي للمبنى تلقائياً.
                  </span>

                  {/* Active Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid var(--line)', marginTop: '4px' }}>
                    <span style={{ fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>حالة المنشأة الجغرافية</span>
                    <button
                      onClick={() => setFacActive(!facActive)}
                      style={{
                        background: facActive ? 'var(--brand)' : '#b0bec5',
                        color: 'white',
                        border: 0,
                        borderRadius: '20px',
                        padding: '4px 14px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'background 0.2s'
                      }}
                      type="button"
                    >
                      {facActive ? <Check size={12} /> : null}
                      {facActive ? 'نشطة للزيارات' : 'غير نشطة حالياً'}
                    </button>
                  </div>

                  {/* Footer Actions */}
                  <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--line)' }}>
                    <button
                      disabled={formLoading}
                      style={{
                        flex: 1,
                        background: 'var(--brand)',
                        color: 'white',
                        border: 0,
                        borderRadius: '8px',
                        minHeight: '40px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(22,160,133,0.2)'
                      }}
                      type="submit"
                    >
                      {formLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      {drawerMode === 'edit' ? 'حفظ التعديلات' : 'تسجيل وإدراج المنشأة'}
                    </button>
                    
                    <button
                      onClick={handleCloseDrawer}
                      style={{
                        background: '#f1f5f7',
                        color: '#37474f',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        minHeight: '40px',
                        padding: '0 16px',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      type="button"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: ORGANIZATIONAL AFFILIATIONS */}
        {activeTab === 'affiliations' && (
          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)', display: 'grid', gap: '16px' }}>
              <div>
                <strong style={{ fontSize: '14.5px', color: '#102027', display: 'block', marginBottom: '4px' }}>إدارة خطوط التبعية الإدارية والتنظيمية</strong>
                <p style={{ margin: 0, fontSize: '12px', color: '#546e7a', lineHeight: '1.5' }}>
                  تسمح بفصل الكيان الجغرافي للمنشأة (مثل محافظة المنشأة) عن خط السلطة والتبعية الخاص بها (مثل مديرية الشؤون الصحية أو أمانة المراكز المتخصصة أو الهيئة المعنية).
                </p>
              </div>

              {affError && <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{affError}</div>}
              {affSuccess && <div style={{ background: '#eaf8f3', color: '#16725a', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{affSuccess}</div>}

              <form onSubmit={handleAddAffiliation} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', background: '#f8fbfb', padding: '16px', borderRadius: '12px', border: '1px solid #cfdcde' }}>
                <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px', color: '#37474f', fontWeight: 'bold' }}>
                  اسم الجهة التابعة *
                  <input
                    onChange={(e) => setAffName(e.target.value)}
                    placeholder="مثال: أمانة المراكز الطبية المتخصصة"
                    required
                    style={{
                      minHeight: '38px',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '0 10px',
                      fontSize: '13px',
                      background: 'white',
                      outline: 'none'
                    }}
                    type="text"
                    value={affName}
                  />
                </label>

                <label style={{ display: 'grid', gap: '4px', fontSize: '12.5px', color: '#37474f', fontWeight: 'bold' }}>
                  نوع التصنيف الهيكلي
                  <select
                    onChange={(e) => setAffType(e.target.value as FacilityAffiliationType)}
                    style={{
                      minHeight: '38px',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '0 6px',
                      fontSize: '13px',
                      background: 'white',
                      outline: 'none'
                    }}
                    value={affType}
                  >
                    {affiliationTypes.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <button
                    disabled={affLoading || !affName.trim()}
                    style={{
                      background: 'var(--brand)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      minHeight: '38px',
                      padding: '0 18px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%',
                      justifyContent: 'center'
                    }}
                    type="submit"
                  >
                    <Plus size={16} />
                    إضافة جهة التبعية
                  </button>
                </div>
              </form>

              {/* Grid layout for affiliations */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#546e7a', display: 'block', marginBottom: '12px' }}>جهات التبعية النشطة بالنظام ({affiliations.length} جهة هيكلية):</span>
                
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '10px'
                }}>
                  {sortedAffiliations.map((aff) => (
                    <div
                      key={aff.id ?? aff.name}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cfdcde',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.015)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ fontSize: '13px', color: '#263238' }}>{aff.name}</strong>
                        <span style={{ fontSize: '11px', color: 'var(--brand)', background: '#eef6f6', padding: '1px 6px', borderRadius: '4px', alignSelf: 'flex-start', fontWeight: 'bold' }}>
                          {typeLabel(resolveType(aff))}
                        </span>
                      </div>
                      
                      <button
                        onClick={() => handleRemoveAffiliation(aff)}
                        style={{
                          background: '#fff1f1',
                          color: '#e74c3c',
                          border: '1px solid #f9d5d5',
                          borderRadius: '6px',
                          width: '30px',
                          height: '30px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#fcd9d9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = '#fff1f1'}
                        title="إلغاء تنشيط"
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: MINISTRY STRUCTURE (قطاع الطب العلاجي) */}
        {activeTab === 'ministry_structure' && (() => {
          const activeUnit = ministryUnits.find(u => u.id === selectedUnitId) || ministryUnits[0]
          
          const filteredUnits = ministryUnits.filter(u => 
            u.name.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
            u.level.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
            u.description.toLowerCase().includes(unitSearchQuery.toLowerCase())
          )

          return (
            <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
              {/* Header stats & search panel */}
              <div style={{
                background: 'white',
                border: '1px solid var(--line)',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
              }}>
                <div>
                  <strong style={{ fontSize: '15px', color: '#102027', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Compass size={18} style={{ color: 'var(--brand)' }} />
                    الهيكل التنظيمي المعتمد لقطاع الطب العلاجي (ديوان عام وزارة الصحة)
                  </strong>
                  <small style={{ color: '#546e7a', display: 'block', marginTop: '4px' }}>
                    تصفح المستويات الوظيفية والإدارية لديوان عام الوزارة، وشكل فرق التكليفات الميدانية للرقابة.
                  </small>
                </div>

                {/* Search Bar */}
                <div style={{ position: 'relative', width: 'min(100%, 320px)' }}>
                  <input
                    type="text"
                    placeholder="🔍 ابحث عن إدارة أو مستوى تنظيمي..."
                    value={unitSearchQuery}
                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                    style={{
                      width: '100%',
                      minHeight: '38px',
                      borderRadius: '8px',
                      border: '1px solid #cfdcde',
                      padding: '0 36px 0 12px',
                      fontSize: '12.5px',
                      outline: 'none',
                      background: '#f8fbfb'
                    }}
                  />
                  <Search size={15} style={{ position: 'absolute', right: '12px', top: '12px', color: '#78909c' }} />
                </div>
              </div>

              {/* Two-Pane Explorer Layout */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '20px',
                alignItems: 'start'
              }}>
                
                {/* 1. RIGHT COLUMN: Hierarchical Tree List */}
                <div style={{
                  background: 'white',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: 'var(--shadow)',
                  display: 'grid',
                  gap: '12px',
                  maxHeight: '680px',
                  overflowY: 'auto'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#37474f', display: 'block', borderBottom: '1px solid #eef2f3', paddingBottom: '8px' }}>
                    شجرة الهيكل الإداري والرقابي للقطاع:
                  </span>

                  <div style={{ display: 'grid', gap: '8px', position: 'relative', paddingRight: '8px' }}>
                    {/* Vertical Connector Line for nesting aesthetic */}
                    <div style={{
                      position: 'absolute',
                      right: '18px',
                      top: '20px',
                      bottom: '20px',
                      width: '1px',
                      borderRight: '1px dashed #cfd8dc',
                      zIndex: 1
                    }} />

                    {filteredUnits.map((unit) => {
                      const isSelected = selectedUnitId === unit.id
                      const indent = unit.levelIndex * 16

                      return (
                        <div
                          key={unit.id}
                          onClick={() => setSelectedUnitId(unit.id)}
                          style={{
                            marginRight: `${indent}px`,
                            position: 'relative',
                            zIndex: 2,
                            background: isSelected ? '#f0fcf9' : '#ffffff',
                            border: `1px solid ${isSelected ? '#b2dfdb' : '#cfdcde'}`,
                            borderRadius: '10px',
                            padding: '10px 14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px',
                            boxShadow: isSelected ? '0 3px 8px rgba(0,109,119,0.06)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '30px',
                              height: '30px',
                              borderRadius: '8px',
                              background: isSelected ? 'var(--brand)' : '#eef4f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }}>
                              {renderUnitIcon(unit.icon, 14, isSelected ? 'white' : '#546e7a')}
                            </div>
                            <div>
                              <strong style={{
                                fontSize: unit.levelIndex === 0 ? '13px' : '12.5px',
                                fontWeight: 'bold',
                                color: isSelected ? '#004d40' : '#102027',
                                display: 'block'
                              }}>
                                {unit.name}
                              </strong>
                              <span style={{ fontSize: '10px', color: '#78909c' }}>
                                {unit.level.split('(')[0].trim()}
                              </span>
                            </div>
                          </div>

                          <span style={{
                            fontSize: '9px',
                            fontWeight: 'bold',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: unit.levelIndex === 0 ? '#fff8e1' : unit.levelIndex === 1 ? '#e0f2f1' : unit.levelIndex === 2 ? '#e8eaf6' : '#e0f7fa',
                            color: unit.levelIndex === 0 ? '#b7791f' : unit.levelIndex === 1 ? '#00796b' : unit.levelIndex === 2 ? '#3f51b5' : '#006064',
                            border: `1px solid ${unit.levelIndex === 0 ? '#ffe082' : unit.levelIndex === 1 ? '#b2dfdb' : unit.levelIndex === 2 ? '#c5cae9' : '#b2ebf2'}`
                          }}>
                            {unit.levelIndex === 0 ? 'ممتاز' : unit.levelIndex === 1 ? 'عالي' : unit.levelIndex === 2 ? 'مدير عام' : 'إشرافي'}
                          </span>
                        </div>
                      )
                    })}

                    {filteredUnits.length === 0 && (
                      <div style={{ padding: '24px', textAlign: 'center', color: '#78909c', fontSize: '13px' }}>
                        لا توجد إدارات مطابقة لبحثك في الهيكل الحالي.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. LEFT COLUMN: Glassmorphic Executive Detail Card */}
                <div style={{
                  background: 'white',
                  border: '1px solid var(--line)',
                  borderRadius: '16px',
                  padding: '24px',
                  boxShadow: 'var(--shadow)',
                  display: 'grid',
                  gap: '20px',
                  position: 'sticky',
                  top: '20px'
                }}>
                  {/* Executive colorful gradient header */}
                  <div style={{
                    background: activeUnit.color,
                    color: 'white',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.06)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        background: 'rgba(255, 255, 255, 0.2)',
                        color: 'white',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        backdropFilter: 'blur(4px)'
                      }}>
                        {activeUnit.type}
                      </span>

                      {activeUnit.levelIndex === 0 && (
                        <span style={{ fontSize: '20px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}>👑</span>
                      )}
                    </div>

                    <div>
                      <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{activeUnit.name}</h2>
                      <p style={{ margin: '4px 0 0 0', fontSize: '12px', opacity: 0.9 }}>{activeUnit.level}</p>
                    </div>
                  </div>

                  {/* Core details & stats */}
                  <div style={{ display: 'grid', gap: '14px' }}>
                    {/* Description */}
                    <div>
                      <span style={{ fontSize: '11px', color: '#78909c', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>الغرض والمسئوليات العامة للوظيفة:</span>
                      <p style={{ margin: 0, fontSize: '13px', color: '#263238', lineHeight: '1.6', textAlign: 'justify' }}>{activeUnit.description}</p>
                    </div>

                    {/* Core Tasks */}
                    {activeUnit.coreTasks && activeUnit.coreTasks.length > 0 && (
                      <div>
                        <span style={{ fontSize: '11px', color: '#78909c', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>الاختصاصات الرقابية والفنية الرئيسية:</span>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {activeUnit.coreTasks.map((task, index) => (
                            <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'start', fontSize: '12.5px', color: '#37474f' }}>
                              <CheckCircle2 size={14} style={{ color: activeUnit.badgeColor, marginTop: '2px', flexShrink: 0 }} />
                              <span>{task}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Personnel listing card */}
                    <div style={{
                      background: '#f8fbfb',
                      border: '1px solid #cfdcde',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>المشرف / المدير المسؤول حالياً:</span>
                        <strong style={{ fontSize: '13px', color: '#102027', display: 'block', marginTop: '2px' }}>{activeUnit.director}</strong>
                      </div>

                      <div style={{ textAlign: 'left' }}>
                        <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>القوى البشرية بالديوان:</span>
                        <strong style={{ fontSize: '14px', color: '#006d77', fontWeight: 'bold' }}>{activeUnit.staffCount} موظف ومفتش</strong>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action assignments */}
                  <div style={{
                    borderTop: '1px solid var(--line)',
                    paddingTop: '16px',
                    display: 'flex',
                    gap: '10px'
                  }}>
                    <a
                      href={`/dashboard/missions/new?orgUnit=${encodeURIComponent(activeUnit.name)}`}
                      style={{
                        flex: 1,
                        background: '#006d77',
                        color: 'white',
                        border: 0,
                        borderRadius: '8px',
                        minHeight: '40px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        textDecoration: 'none',
                        textAlign: 'center',
                        boxShadow: '0 2px 6px rgba(0,109,119,0.15)'
                      }}
                    >
                      <Plus size={16} />
                      تكليف مأمورية تفتيشية للإدارة
                    </a>
                  </div>
                </div>

              </div>
            </div>
          )
        })()}
      </section>

    </div>
  )
}
