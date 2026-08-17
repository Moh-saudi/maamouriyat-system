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
import {
  MinistryUnit,
  MinistrySector,
  realEgyptianSectors,
  realEgyptianMinistryUnits,
  realEgyptianAffiliations,
  getSectorById,
  getMinistryUnitsForSector
} from '@/lib/real-facilities'
import { AddMinistryUnitModal } from './add-ministry-unit-modal'
import {
  STANDARD_FACILITY_TYPES,
  formatFacilityType,
  getFacilityTypeColor,
} from '@/lib/facility-types'

export type FacilityItem = {
  id: string
  name: string
  facility_type: string
  address?: string          // قديم — اختياري
  is_active: boolean | null
  latitude?: number
  longitude?: number
  // حقول الهيكل الجديد
  governorate?: string | null
  health_admin?: string | null
  urban_rural?: string | null
  village_city?: string | null
  population?: number | null
  land_area?: number | null
  building_area?: number | null
  year_built?: number | null
  year_renovated?: number | null
  organization_id?: string | null
  sector_id?: string | null
  // حقول قديمة للتوافق
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

// Dynamic ministryUnits resolved via getMinistryUnitsForSector

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
export type UserRow = {
  id: string
  full_name: string
  job_title: string | null
  // حقول الهيكل الجديد
  org_level?: number
  organization_id?: string | null
  // حقول قديمة للتوافق
  level?: number
  department?: string | null
  is_active: boolean | null
  email?: string | null
  phone?: string | null
  facility_id?: string | null
  financial_code?: string | null
}

export function FacilitiesPortal({
  initialFacilities,
  initialAffiliations = [],
  initialOrganizations = [],
  facilityStoreReady = false,
  role = 'superadmin',
  initialUsers = [],
  userOrgLevel = 7,
  userSectorId = null,
  userEmail = ''
}: {
  initialFacilities: FacilityItem[]
  initialAffiliations?: FacilityAffiliationOption[]
  initialOrganizations?: Array<{
    id: string; name: string; level: number; level_label: string;
    governorate: string | null; health_admin: string | null;
    sector_id: string | null; code: string | null
  }>
  facilityStoreReady?: boolean
  role?: string | null
  initialUsers?: UserRow[]
  userOrgLevel?: number
  userSectorId?: string | null
  userEmail?: string | null
}) {
  const supabase = createBrowserSupabaseClient()
  const isWritable = role === 'superadmin' || role === 'techadmin'
  const canCreateMissionAssignment = role !== 'inspector'
  const [activeTab, setActiveTab] = useState<'directory' | 'affiliations' | 'ministry_structure'>('directory')

  // Sector and dynamic units state
  const defaultSectorId = userSectorId || (userEmail?.toLowerCase().includes('phc') ? '00000000-0000-0000-0000-000000000010' : '00000000-0000-0000-0000-000000000011')
  const [selectedSectorId, setSelectedSectorId] = useState<string>(defaultSectorId)
  const [customUnits, setCustomUnits] = useState<MinistryUnit[]>([])
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [unitSearchQuery, setUnitSearchQuery] = useState('')

  // Load custom units from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('maamouriyat_custom_ministry_units')
      if (saved) {
        setCustomUnits(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Error loading custom units:', e)
    }
  }, [])

  const activeSector = useMemo(() => getSectorById(selectedSectorId), [selectedSectorId])
  const currentSectorUnits = useMemo(() => getMinistryUnitsForSector(selectedSectorId, customUnits), [selectedSectorId, customUnits])
  const centralUnits = useMemo(() => currentSectorUnits.filter(u => u.levelIndex === 1), [currentSectorUnits])

  // Select top unit of the sector if current selected unit doesn't belong to sector
  useEffect(() => {
    const exists = currentSectorUnits.some(u => u.id === selectedUnitId)
    if (!exists && currentSectorUnits.length > 0) {
      setSelectedUnitId(currentSectorUnits[0].id)
    }
  }, [selectedSectorId, currentSectorUnits, selectedUnitId])

  const handleAddCustomUnit = async (newUnit: MinistryUnit) => {
    const updated = [...customUnits, newUnit]
    setCustomUnits(updated)
    try {
      localStorage.setItem('maamouriyat_custom_ministry_units', JSON.stringify(updated))
    } catch (e) {}

    try {
      if (supabase) {
        await supabase.from('organizational_units').insert({
          code: `GEN-${Date.now().toString(36).toUpperCase()}`,
          name: newUnit.name,
          unit_type: 'general_administration',
          parent_id: newUnit.parent && newUnit.parent.startsWith('00000000') ? newUnit.parent : null,
          level: 2,
          is_active: true
        })
      }
    } catch (err) {
      console.warn('Could not persist unit to database:', err)
    }

    setSelectedUnitId(newUnit.id)
  }

  // Helper to find child units recursively
  const getUnitAndChildrenIds = (unitId: string): string[] => {
    const ids = [unitId]
    const children = currentSectorUnits.filter(u => u.parent === unitId)
    for (const child of children) {
      ids.push(...getUnitAndChildrenIds(child.id))
    }
    return ids
  }

  // Robust check if user belongs to unit
  const isUserInUnit = (user: UserRow, unitName: string): boolean => {
    if (!user.department) return false
    const cleanDept = user.department.trim().toLowerCase()
    const cleanUnit = unitName.trim().toLowerCase()
    
    return (
      cleanDept === cleanUnit ||
      cleanDept.includes(cleanUnit) ||
      cleanUnit.includes(cleanDept) ||
      cleanDept.replace(/^ديوان عام وزارة الصحة - /, '').replace(/^ديوان عام الوزارة - /, '') === cleanUnit.replace(/^ديوان عام وزارة الصحة - /, '').replace(/^ديوان عام الوزارة - /, '')
    )
  }

  // Active Unit calculation
  const activeUnit = useMemo(() => {
    return currentSectorUnits.find(u => u.id === selectedUnitId) || currentSectorUnits[0] || realEgyptianMinistryUnits[0]
  }, [currentSectorUnits, selectedUnitId])

  // Resolve director dynamically for active unit
  const resolvedDirector = useMemo(() => {
    if (!initialUsers || initialUsers.length === 0) return 'لم يتم تعيين مدير حالياً'
    
    // Find users directly in this unit's department
    const deptUsers = initialUsers.filter(u => isUserInUnit(u, activeUnit.name))
    
    // Filter to only include actual leaders/managers (prevent regular inspectors/pharmacists from being directors)
    const leaders = deptUsers.filter(u => 
      (u.org_level ?? u.level ?? 7) <= 3 || 
      u.job_title?.includes('مدير') || 
      u.job_title?.includes('رئيس') || 
      u.job_title?.includes('مشرف') || 
      u.job_title?.includes('وكيل')
    )

    // Sort by level (highest rank first) and job_title relevance
    const sorted = [...leaders].sort((a, b) => {
      const aIsManager = a.job_title?.includes('مدير') || a.job_title?.includes('رئيس') ? 1 : 0
      const bIsManager = b.job_title?.includes('مدير') || b.job_title?.includes('رئيس') ? 1 : 0
      if (aIsManager !== bIsManager) return bIsManager - aIsManager
      return (a.org_level ?? a.level ?? 7) - (b.org_level ?? b.level ?? 7)
    })
    
    const manager = sorted[0]
    if (manager) {
      return `${manager.full_name} (${manager.job_title || 'مدير الإدارة'})`
    }
    
    // Sector-wide fallback for top-level sector head (must be a leader)
    if (activeUnit.id === 'therapeutic-sector') {
      const sectorHead = initialUsers.find(u => 
        ((u.org_level ?? u.level ?? 7) === 2 || u.job_title?.includes('رئيس قطاع')) && 
        ((u.org_level ?? u.level ?? 7) <= 3 || u.job_title?.includes('رئيس') || u.job_title?.includes('مدير'))
      )
      if (sectorHead) return `${sectorHead.full_name} (${sectorHead.job_title || 'رئيس القطاع'})`
    }
    
    return 'شاغر - قيد التعيين حالياً'
  }, [activeUnit, initialUsers])

  // Resolve staff/inspectors count recursively (department + sub-departments)
  const resolvedStaffCount = useMemo(() => {
    if (!initialUsers || initialUsers.length === 0) return 0
    
    const childUnitIds = getUnitAndChildrenIds(activeUnit.id)
    const childUnits = currentSectorUnits.filter(u => childUnitIds.includes(u.id))
    const unitNames = childUnits.map(u => u.name)
    
    return initialUsers.filter(u => 
      unitNames.some(name => isUserInUnit(u, name))
    ).length
  }, [activeUnit, initialUsers])

  // Facilities state
  const [facilities, setFacilities] = useState<FacilityItem[]>(initialFacilities)

  // Search & Filter state for physical facilities
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [selectedGov, setSelectedGov] = useState('all')
  const [selectedAdmin, setSelectedAdmin] = useState('all')
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
  const [facType, setFacType] = useState('family_medicine_center')
  const [facGov, setFacGov] = useState('أسيوط')
  const [facHealthAdmin, setFacHealthAdmin] = useState('')
  const [facUrbanRural, setFacUrbanRural] = useState<'ريف' | 'حضر'>('ريف')
  const [facVillageCity, setFacVillageCity] = useState('')
  const [facPopulation, setFacPopulation] = useState('')
  const [facLandArea, setFacLandArea] = useState('')
  const [facBuildingArea, setFacBuildingArea] = useState('')
  const [facYearBuilt, setFacYearBuilt] = useState('')
  const [facYearRenovated, setFacYearRenovated] = useState('')
  const [facAddress, setFacAddress] = useState('')
  const [facLat, setFacLat] = useState('27.1809')
  const [facLon, setFacLon] = useState('31.1837')
  const [facActive, setFacActive] = useState(true)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')
  const [formLoading, setFormLoading] = useState(false)

  // Derived health admins for selected governorate in drawer
  const availableHealthAdmins = useMemo(() => {
    const orgs = initialOrganizations.filter(
      (o) => o.level === 6 && o.governorate === facGov && o.health_admin
    )
    const set = new Set(orgs.map((o) => o.health_admin as string))
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [initialOrganizations, facGov])

  // Affiliations management state
  const [affiliations, setAffiliations] = useState<FacilityAffiliationOption[]>(
    initialAffiliations && initialAffiliations.length > 0 ? initialAffiliations : realEgyptianAffiliations
  )
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
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css'
      link.crossOrigin = ''
      document.head.appendChild(link)
    }

    // Load Leaflet JS dynamically
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
    const set = new Set(facilities.map((f) => f.governorate || f.governorates?.name).filter(Boolean))
    return set.size
  }, [facilities])

  const facilityTypes = useMemo(() => {
    const set = new Set(facilities.map((f) => f.facility_type).filter(Boolean))
    return Array.from(set).sort()
  }, [facilities])

  const governoratesList = useMemo(() => {
    const set = new Set(facilities.map((f) => f.governorate || f.governorates?.name).filter(Boolean))
    return Array.from(set).sort((a, b) => (a as string).localeCompare(b as string, 'ar'))
  }, [facilities])

  const healthAdminsForSelectedGov = useMemo(() => {
    if (selectedGov === 'all') return []
    const set = new Set<string>()
    facilities
      .filter((f) => (f.governorate || f.governorates?.name) === selectedGov)
      .forEach((f) => {
        if (f.health_admin) set.add(f.health_admin)
      })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [facilities, selectedGov])

  // Filter physical facilities list
  const filteredFacilities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const targetType = selectedType.trim().toLowerCase()
    const targetGov = selectedGov.trim().toLowerCase()
    const targetAdmin = selectedAdmin.trim().toLowerCase()

    return facilities.filter((facility) => {
      const facName = (facility.name || '').trim().toLowerCase()
      const facGov = (facility.governorate || facility.governorates?.name || '').trim().toLowerCase()
      const facAdmin = (facility.health_admin || '').trim().toLowerCase()
      const facVillage = (facility.village_city || '').trim().toLowerCase()
      const facType = (facility.facility_type || '').trim().toLowerCase()
      const facTypeLabel = formatFacilityType(facility.facility_type).trim().toLowerCase()

      // 1. Text Search matching
      const matchesSearch =
        !q ||
        facName.includes(q) ||
        facGov.includes(q) ||
        facAdmin.includes(q) ||
        facVillage.includes(q) ||
        facTypeLabel.includes(q) ||
        facType.includes(q) ||
        (facility.address ?? '').toLowerCase().includes(q)
      
      // 2. Type Filter matching (matches key or arabic label)
      const matchesType =
        targetType === 'all' ||
        facType === targetType ||
        facTypeLabel === targetType ||
        facType === formatFacilityType(selectedType).toLowerCase()
      
      // 3. Governorate matching
      const matchesGov =
        targetGov === 'all' ||
        facGov === targetGov

      // 4. Administration matching
      const matchesAdmin =
        targetAdmin === 'all' ||
        facAdmin === targetAdmin
      
      // 5. Status matching
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && facility.is_active !== false) ||
        (statusFilter === 'inactive' && facility.is_active === false)

      return matchesSearch && matchesType && matchesGov && matchesAdmin && matchesStatus
    })
  }, [facilities, searchQuery, selectedType, selectedGov, selectedAdmin, statusFilter])

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

      // Colors based on category from central facility-types config
      const iconColor = getFacilityTypeColor(facility.facility_type)

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${iconColor}; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.4); transition: transform 0.2s;" class="map-pin-div"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        popupAnchor: [0, -10]
      })

      const govDisplay = facility.governorate || facility.governorates?.name || 'غير محددة'
      const adminDisplay = facility.health_admin ? ` - إدارة ${facility.health_admin}` : ''
      const villageDisplay = facility.village_city ? ` (${facility.village_city})` : ''

      const marker = L.marker([lat, lon], { icon: customIcon })
        .addTo(map)
        .bindPopup(`
          <div style="direction: rtl; text-align: right; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; min-width: 200px; padding: 4px;">
            <strong style="font-size: 13.5px; color: #102027; display: block; margin-bottom: 4px; font-weight: 700;">${facility.name}</strong>
            <span style="font-size: 10px; color: ${iconColor}; background: ${iconColor}1A; padding: 2px 8px; border-radius: 12px; display: inline-block; font-weight: bold; margin-bottom: 8px; border: 1px solid ${iconColor}4D;">${formatFacilityType(facility.facility_type)}</span>
            <div style="font-size: 11.5px; color: #546e7a; line-height: 1.4; margin-bottom: 4px;">الموقع: ${govDisplay}${adminDisplay}${villageDisplay}</div>
            <div style="font-size: 10.5px; color: #90a4ae; border-top: 1px solid #eceff1; padding-top: 5px; margin-top: 5px; display: flex; justify-content: space-between;">
              <span>الإحداثيات: ${lat.toFixed(4)}, ${lon.toFixed(4)}</span>
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
    setFacType('family_medicine_center')
    const firstGov = governoratesList[0] || 'أسيوط'
    setFacGov(firstGov)
    setFacHealthAdmin('')
    setFacUrbanRural('ريف')
    setFacVillageCity('')
    setFacPopulation('')
    setFacLandArea('')
    setFacBuildingArea('')
    setFacYearBuilt('')
    setFacYearRenovated('')
    setFacAddress('')
    setFacLat('27.1809')
    setFacLon('31.1837')
    setFacActive(true)
    setFormError('')
    setFormSuccess('')
    setDrawerOpen(true)
  }

  const handleOpenEditDrawer = (facility: FacilityItem, e: React.MouseEvent) => {
    e.stopPropagation()
    setDrawerMode('edit')
    setEditingFacility(facility)
    setFacName(facility.name)
    setFacType(facility.facility_type)
    setFacGov(facility.governorate || facility.governorates?.name || 'أسيوط')
    setFacHealthAdmin(facility.health_admin || '')
    setFacUrbanRural((facility.urban_rural as any) || 'ريف')
    setFacVillageCity(facility.village_city || '')
    setFacPopulation(facility.population ? String(facility.population) : '')
    setFacLandArea(facility.land_area ? String(facility.land_area) : '')
    setFacBuildingArea(facility.building_area ? String(facility.building_area) : '')
    setFacYearBuilt(facility.year_built ? String(facility.year_built) : '')
    setFacYearRenovated(facility.year_renovated ? String(facility.year_renovated) : '')
    setFacAddress(facility.address ?? '')
    setFacLat((facility.latitude ?? 27.1809).toString())
    setFacLon((facility.longitude ?? 31.1837).toString())
    setFacActive(facility.is_active !== false)
    setFormError('')
    setFormSuccess('')
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    setDrawerOpen(false)
    setEditingFacility(null)
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
    const latVal = parseFloat(facLat)
    const lonVal = parseFloat(facLon)

    if (!nameVal || isNaN(latVal) || isNaN(lonVal)) {
      setFormError('الرجاء إدخال اسم المنشأة وتحديد إحداثيات الموقع بشكل صحيح.')
      return
    }

    setFormLoading(true)

    // Resolve target Organization (Health Admin Level 6)
    const matchedOrg = initialOrganizations.find(
      (o) => o.level === 6 && o.governorate === facGov && (facHealthAdmin ? o.health_admin === facHealthAdmin : true)
    ) || initialOrganizations.find(
      (o) => o.level === 5 && o.governorate === facGov
    )

    const orgId = matchedOrg?.id || '00000000-0000-0000-0000-000000000010'
    const phcSectorId = '00000000-0000-0000-0000-000000000010'

    const payload = {
      name: nameVal,
      facility_type: facType,
      governorate: facGov,
      health_admin: facHealthAdmin || facGov,
      urban_rural: facUrbanRural || null,
      village_city: facVillageCity || null,
      population: facPopulation ? parseInt(facPopulation) : null,
      land_area: facLandArea ? parseFloat(facLandArea) : null,
      building_area: facBuildingArea ? parseFloat(facBuildingArea) : null,
      year_built: facYearBuilt ? parseInt(facYearBuilt) : null,
      year_renovated: facYearRenovated ? parseInt(facYearRenovated) : null,
      latitude: latVal,
      longitude: lonVal,
      organization_id: orgId,
      sector_id: phcSectorId,
      is_active: facActive,
    }

    if (drawerMode === 'edit' && editingFacility) {
      if (supabase && editingFacility.id) {
        try {
          const { error: updateError } = await supabase
            .from('facilities')
            .update(payload)
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

      setFacilities((current) =>
        current.map((item) =>
          item.id === editingFacility.id
            ? { ...item, ...payload }
            : item
        )
      )

      setFormSuccess('تم تحديث بيانات المنشأة وموضعها الجغرافي بنجاح.')
      setTimeout(() => {
        handleFocusFacility({
          id: editingFacility.id,
          ...payload
        })
      }, 500)

    } else {
      let dbId = `fac-new-${Date.now()}`

      if (supabase) {
        try {
          const { data, error: insertError } = await supabase
            .from('facilities')
            .insert(payload)
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
        ...payload
      }

      setFacilities((current) => [newFacility, ...current])
      setFormSuccess('تمت إضافة وتسكين المنشأة الطبية الجديدة بالدليل بنجاح.')
      setTimeout(() => {
        handleFocusFacility(newFacility)
      }, 500)
    }

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
      // Session fallback when DB is unavailable
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
            تصفح دليل المستشفيات والمراكز والمخازن الطبية، وقم بتهيئة جهات التبعية الإدارية والحوكمة للوزارة.
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
            إدارات ديوان عام الوزارة ({activeSector.shortName || activeSector.name})
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
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>مراكز طب الأسرة</span>
                  <strong style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>
                    {facilities.filter((f) => f.facility_type === 'family_medicine_center' || f.name.includes('مركز')).length} مركزاً
                  </strong>
                </div>
              </div>

              <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Building2 size={20} style={{ color: '#3498db' }} />
                <div>
                  <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>الوحدات ومكاتب الصحة</span>
                  <strong style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>
                    {facilities.filter((f) => f.facility_type === 'health_unit' || f.facility_type === 'health_office' || f.facility_type === 'child_care' || f.name.includes('وحدة') || f.name.includes('مكتب')).length} وحدة
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
                        <option key={type} value={type}>{formatFacilityType(type)}</option>
                      ))}
                    </select>

                    {/* Governorate Filter */}
                    <select
                      onChange={(e) => {
                        setSelectedGov(e.target.value)
                        setSelectedAdmin('all')
                      }}
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

                    {/* Health Admin Filter (appears when Governorate is selected) */}
                    {selectedGov !== 'all' && healthAdminsForSelectedGov.length > 0 && (
                      <select
                        onChange={(e) => setSelectedAdmin(e.target.value)}
                        style={{
                          minHeight: '36px',
                          border: '1px solid #1abc9c',
                          borderRadius: '8px',
                          padding: '0 8px',
                          fontSize: '12px',
                          background: '#f0fcf9',
                          outline: 'none',
                          fontWeight: 'bold',
                          color: '#16725a'
                        }}
                        value={selectedAdmin}
                      >
                        <option value="all">كل إدارات {selectedGov} ({healthAdminsForSelectedGov.length})</option>
                        {healthAdminsForSelectedGov.map((adm) => (
                          <option key={adm} value={adm}>إدارة {adm}</option>
                        ))}
                      </select>
                    )}

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

                    {/* Active Filter summary & Reset */}
                    {(searchQuery || selectedType !== 'all' || selectedGov !== 'all' || selectedAdmin !== 'all' || statusFilter !== 'all') && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--brand)', fontWeight: 'bold' }}>
                          النتائج المطابقة: {filteredFacilities.length} منشأة
                        </span>
                        <button
                          onClick={() => {
                            setSearchQuery('')
                            setSelectedType('all')
                            setSelectedGov('all')
                            setSelectedAdmin('all')
                            setStatusFilter('all')
                          }}
                          style={{
                            background: 'transparent',
                            border: 0,
                            color: '#e74c3c',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            textDecoration: 'underline'
                          }}
                          type="button"
                        >
                          إعادة تعيين الفلاتر ↺
                        </button>
                      </div>
                    )}
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
                    const typeColor = getFacilityTypeColor(facility.facility_type)

                    return (
                      <div
                        id={`facility-card-${facility.id}`}
                        key={facility.id}
                        onClick={() => handleFocusFacility(facility)}
                        style={{
                          background: isSelected ? '#f0fcf9' : 'white',
                          border: isSelected ? '1.5px solid var(--brand)' : '1px solid var(--line)',
                          borderRadius: '12px',
                          padding: '12px',
                          boxShadow: isSelected ? '0 4px 14px rgba(22,160,133,0.15)' : 'var(--shadow)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                          position: 'relative'
                        }}
                      >
                        {/* Title & Status */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <strong style={{ fontSize: '13.5px', color: isSelected ? 'var(--brand)' : '#102027', fontWeight: 'bold' }}>
                            {facility.name}
                          </strong>
                          <span style={{
                            fontSize: '9.5px',
                            fontWeight: 'bold',
                            color: facility.is_active !== false ? '#27ae60' : '#c0392b',
                            background: facility.is_active !== false ? '#eafaf1' : '#fdedec',
                            padding: '2px 8px',
                            borderRadius: '8px',
                            whiteSpace: 'nowrap'
                          }}>
                            {facility.is_active !== false ? 'نشطة' : 'غير نشطة'}
                          </span>
                        </div>

                        {/* Badges: Type, Governorate, Admin, Village/City */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{
                            fontSize: '10.5px',
                            color: typeColor,
                            background: `${typeColor}15`,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            border: `1px solid ${typeColor}33`
                          }}>
                            {formatFacilityType(facility.facility_type)}
                          </span>
                          
                          <span style={{
                            fontSize: '10.5px',
                            color: '#37474f',
                            background: '#f1f5f7',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: '600'
                          }}>
                            📍 {facility.governorate || facility.governorates?.name || 'مصر'}
                            {facility.health_admin ? ` • إدارة ${facility.health_admin}` : ''}
                          </span>

                          {facility.village_city && (
                            <span style={{
                              fontSize: '10.5px',
                              color: '#546e7a',
                              background: '#eef2f5',
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}>
                              🏡 {facility.village_city} {facility.urban_rural ? `(${facility.urban_rural})` : ''}
                            </span>
                          )}
                        </div>

                        {/* Rich Subtitle Metadata Grid */}
                        {(facility.population || facility.land_area || facility.building_area || facility.year_built || facility.year_renovated) && (
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                            gap: '6px',
                            background: isSelected ? '#e6f7f3' : '#f8fbfb',
                            border: '1px solid #e2ecee',
                            borderRadius: '8px',
                            padding: '8px 10px',
                            fontSize: '11px',
                            color: '#546e7a',
                            lineHeight: '1.4'
                          }}>
                            {facility.population ? (
                              <div>
                                <span style={{ color: '#90a4ae', display: 'block', fontSize: '9.5px' }}>تعداد السكان المخدوم:</span>
                                <strong style={{ color: '#263238' }}>{facility.population.toLocaleString('ar-EG')} نسمة</strong>
                              </div>
                            ) : null}

                            {facility.land_area || facility.building_area ? (
                              <div>
                                <span style={{ color: '#90a4ae', display: 'block', fontSize: '9.5px' }}>المساحة (م²):</span>
                                <strong style={{ color: '#263238' }}>
                                  {facility.land_area ? `الأرض: ${facility.land_area}` : ''} 
                                  {facility.building_area ? ` • المباني: ${facility.building_area}` : ''}
                                </strong>
                              </div>
                            ) : null}

                            {facility.year_built || facility.year_renovated ? (
                              <div>
                                <span style={{ color: '#90a4ae', display: 'block', fontSize: '9.5px' }}>الإنشاء والتطوير:</span>
                                <strong style={{ color: '#263238' }}>
                                  {facility.year_built ? `إنشاء: ${facility.year_built}` : ''}
                                  {facility.year_renovated ? ` • تطوير: ${facility.year_renovated}` : ''}
                                </strong>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {/* Coordinates & Google Maps Link */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          fontSize: '10.5px',
                          color: '#78909c',
                          borderTop: '1px dashed #eceff1',
                          paddingTop: '6px',
                          marginTop: '2px'
                        }}>
                          <span>🌐 {facility.latitude ? `${facility.latitude.toFixed(4)}, ${facility.longitude?.toFixed(4)}` : 'الموقع مسجل'}</span>
                          {facility.latitude && facility.longitude && (
                            <a
                              href={`https://maps.google.com/?q=${facility.latitude},${facility.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--brand)', fontWeight: 'bold', textDecoration: 'none' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              خرائط Google ↗
                            </a>
                          )}
                        </div>

                        {/* Edit & Delete Actions */}
                        {isWritable && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              gap: '6px',
                              paddingTop: '4px'
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
                                padding: '4px 8px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.1s'
                              }}
                              title="تعديل المنشأة"
                              type="button"
                            >
                              <Edit2 size={11} />
                              تعديل
                            </button>
                            <button
                              onClick={(e) => handleDeleteFacility(facility.id, e)}
                              style={{
                                background: '#fcedec',
                                color: '#e74c3c',
                                border: '1px solid #fadbd8',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.1s'
                              }}
                              title="حذف المنشأة"
                              type="button"
                              onMouseEnter={(e) => e.currentTarget.style.background = '#fcdbd9'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#fcedec'}
                            >
                              <Trash2 size={11} />
                              حذف
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
                    اسم المنشأة الصحية *
                    <input
                      onChange={(e) => setFacName(e.target.value)}
                      placeholder="مثال: وحدة طب أسرة عرب العطيات"
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
                      {STANDARD_FACILITY_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label} {t.category ? `(${t.category})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Governorate & Health Admin Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      المحافظة *
                      <select
                        onChange={(e) => {
                          setFacGov(e.target.value)
                          setFacHealthAdmin('')
                        }}
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
                        {governoratesList.map((gov) => (
                          <option key={gov} value={gov}>{gov}</option>
                        ))}
                      </select>
                    </label>

                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      الإدارة الصحية
                      {availableHealthAdmins.length > 0 ? (
                        <select
                          onChange={(e) => setFacHealthAdmin(e.target.value)}
                          style={{
                            minHeight: '38px',
                            border: '1px solid #cfdcde',
                            borderRadius: '8px',
                            padding: '0 6px',
                            fontSize: '12.5px',
                            outline: 'none',
                            background: 'white'
                          }}
                          value={facHealthAdmin}
                        >
                          <option value="">اختر الإدارة...</option>
                          {availableHealthAdmins.map((adm) => (
                            <option key={adm} value={adm}>{adm}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          onChange={(e) => setFacHealthAdmin(e.target.value)}
                          placeholder="اسم الإدارة الصحية"
                          style={{
                            minHeight: '38px',
                            border: '1px solid #cfdcde',
                            borderRadius: '8px',
                            padding: '0 10px',
                            fontSize: '12.5px',
                            outline: 'none'
                          }}
                          type="text"
                          value={facHealthAdmin}
                        />
                      )}
                    </label>
                  </div>

                  {/* Urban/Rural & Village/City */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      النطاق
                      <select
                        onChange={(e) => setFacUrbanRural(e.target.value as any)}
                        style={{
                          minHeight: '38px',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          padding: '0 6px',
                          fontSize: '12.5px',
                          outline: 'none',
                          background: 'white'
                        }}
                        value={facUrbanRural}
                      >
                        <option value="ريف">ريف</option>
                        <option value="حضر">حضر</option>
                      </select>
                    </label>

                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      اسم القرية / المدينة
                      <input
                        onChange={(e) => setFacVillageCity(e.target.value)}
                        placeholder="مثال: قرية بنى ابراهيم"
                        style={{
                          minHeight: '38px',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          outline: 'none'
                        }}
                        type="text"
                        value={facVillageCity}
                      />
                    </label>
                  </div>

                  {/* Population & Areas */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      تعداد السكان
                      <input
                        onChange={(e) => setFacPopulation(e.target.value)}
                        placeholder="مثال: 12500"
                        style={{
                          minHeight: '38px',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          outline: 'none'
                        }}
                        type="number"
                        value={facPopulation}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      مساحة الأرض (م²)
                      <input
                        onChange={(e) => setFacLandArea(e.target.value)}
                        placeholder="مثال: 950"
                        style={{
                          minHeight: '38px',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          padding: '0 10px',
                          fontSize: '12.5px',
                          outline: 'none'
                        }}
                        type="number"
                        value={facLandArea}
                      />
                    </label>
                  </div>

                  {/* Coordinates Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                      خط العرض (Latitude) *
                      <input
                        onChange={(e) => setFacLat(e.target.value)}
                        placeholder="27.1809"
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
                        placeholder="31.1837"
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
          const filteredUnits = currentSectorUnits.filter(u => 
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
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '16px', color: '#102027', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Compass size={20} style={{ color: 'var(--brand)' }} />
                        الهيكل التنظيمي المعتمد لـ {activeSector.name}
                      </strong>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '3px 10px',
                        borderRadius: '20px',
                        background: activeSector.badgeColor + '20',
                        color: activeSector.badgeColor,
                        border: `1px solid ${activeSector.badgeColor}40`
                      }}>
                        ديوان عام وزارة الصحة والسكان
                      </span>
                    </div>

                    {/* Sector Switcher (Visible for Level 1/Admin or Writable roles) */}
                    {(userOrgLevel <= 2 || isWritable) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontSize: '11.5px', color: '#546e7a', fontWeight: 'bold' }}>عرض القطاع:</span>
                        <button
                          type="button"
                          onClick={() => setSelectedSectorId('all')}
                          style={{
                            border: selectedSectorId === 'all' ? '1.5px solid #102027' : '1px solid #cfdcde',
                            background: selectedSectorId === 'all' ? '#102027' : '#ffffff',
                            color: selectedSectorId === 'all' ? '#ffffff' : '#37474f',
                            padding: '4px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: selectedSectorId === 'all' ? 'bold' : 'normal',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: selectedSectorId === 'all' ? '0 2px 5px rgba(0,0,0,0.15)' : 'none'
                          }}
                        >
                          🌟 كافة القطاعات (عرض شامل)
                        </button>
                        {realEgyptianSectors.map((sector) => {
                          const isCurrent = sector.id === selectedSectorId
                          return (
                            <button
                              key={sector.id}
                              type="button"
                              onClick={() => setSelectedSectorId(sector.id)}
                              style={{
                                border: isCurrent ? `1.5px solid ${sector.badgeColor}` : '1px solid #cfdcde',
                                background: isCurrent ? sector.badgeColor : '#ffffff',
                                color: isCurrent ? '#ffffff' : '#37474f',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: isCurrent ? 'bold' : 'normal',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {sector.shortName}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  <small style={{ color: '#546e7a', display: 'block', marginTop: '4px' }}>
                    تصفح المستويات الوظيفية والإدارية لديوان عام الوزارة، وشكل فرق التكليفات الميدانية للحوكمة.
                  </small>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  {/* Add Unit Button */}
                  {(userOrgLevel <= 3 || isWritable) && (
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(true)}
                      style={{
                        background: 'var(--brand)',
                        color: 'white',
                        border: 0,
                        borderRadius: '8px',
                        padding: '8px 14px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                      }}
                    >
                      <Plus size={15} /> إضافة إدارة عامة ➕
                    </button>
                  )}

                  {/* Search Bar */}
                  <div style={{ position: 'relative', width: 'min(100%, 260px)' }}>
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
                    شجرة الهيكل الإداري والحوكمة للقطاع:
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
                        <span style={{ fontSize: '11px', color: '#78909c', display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>الاختصاصات الحوكمة والفنية الرئيسية:</span>
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
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>القوى البشرية بالديوان:</span>
                        <strong style={{ fontSize: '14px', color: '#006d77', fontWeight: 'bold' }}>{resolvedStaffCount} موظف ومفتش بالمنظومة</strong>
                      </div>
                    </div>
                  </div>

                  {/* Quick Action assignments */}
                  {canCreateMissionAssignment && (
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
                  )}
                </div>

              </div>
            </div>
          )
        })()}
      </section>

    </div>
  )
}
