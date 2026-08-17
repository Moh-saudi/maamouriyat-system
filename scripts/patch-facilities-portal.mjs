import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(__dirname, '../src/app/dashboard/facilities/facilities-portal.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Update imports
content = content.replace(
  `import { realEgyptianMinistryUnits } from '@/lib/real-facilities'`,
  `import {
  MinistryUnit,
  MinistrySector,
  realEgyptianSectors,
  realEgyptianMinistryUnits,
  realEgyptianAffiliations,
  getSectorById,
  getMinistryUnitsForSector
} from '@/lib/real-facilities'
import { AddMinistryUnitModal } from './add-ministry-unit-modal'`
)

// 2. Remove const ministryUnits = realEgyptianMinistryUnits
content = content.replace(
  `const ministryUnits = realEgyptianMinistryUnits`,
  `// Dynamic ministryUnits resolved via getMinistryUnitsForSector`
)

// 3. Update component signature and states
const targetFuncSignature = `export function FacilitiesPortal({
  initialFacilities,
  initialAffiliations = [],
  initialOrganizations = [],
  facilityStoreReady = false,
  role = 'superadmin',
  initialUsers = [],
  userOrgLevel = 7
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
}) {
  const supabase = createBrowserSupabaseClient()
  const isWritable = role === 'superadmin' || role === 'techadmin'
  const canCreateMissionAssignment = role !== 'inspector'
  const [activeTab, setActiveTab] = useState<'directory' | 'affiliations' | 'ministry_structure'>('directory')
  const [selectedUnitId, setSelectedUnitId] = useState<string>('therapeutic-sector')
  const [unitSearchQuery, setUnitSearchQuery] = useState('')`

const replacementFuncSignature = `export function FacilitiesPortal({
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
          code: \`GEN-\${Date.now().toString(36).toUpperCase()}\`,
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
  }`

content = content.replace(targetFuncSignature, replacementFuncSignature)

// 4. Update getUnitAndChildrenIds, activeUnit, resolvedDirector, resolvedStaffCount to use currentSectorUnits
content = content.replace(
  `const getUnitAndChildrenIds = (unitId: string): string[] => {
    const ids = [unitId]
    const children = ministryUnits.filter(u => u.parent === unitId)
    for (const child of children) {
      ids.push(...getUnitAndChildrenIds(child.id))
    }
    return ids
  }`,
  `const getUnitAndChildrenIds = (unitId: string): string[] => {
    const ids = [unitId]
    const children = currentSectorUnits.filter(u => u.parent === unitId)
    for (const child of children) {
      ids.push(...getUnitAndChildrenIds(child.id))
    }
    return ids
  }`
)

content = content.replace(
  `const activeUnit = useMemo(() => {
    return ministryUnits.find(u => u.id === selectedUnitId) || ministryUnits[0]
  }, [selectedUnitId])`,
  `const activeUnit = useMemo(() => {
    return currentSectorUnits.find(u => u.id === selectedUnitId) || currentSectorUnits[0] || realEgyptianMinistryUnits[0]
  }, [currentSectorUnits, selectedUnitId])`
)

content = content.replace(
  `const childUnits = ministryUnits.filter(u => childUnitIds.includes(u.id))`,
  `const childUnits = currentSectorUnits.filter(u => childUnitIds.includes(u.id))`
)

// 5. Update affiliations state initialization
content = content.replace(
  `const [affiliations, setAffiliations] = useState<FacilityAffiliationOption[]>(initialAffiliations)`,
  `const [affiliations, setAffiliations] = useState<FacilityAffiliationOption[]>(
    initialAffiliations && initialAffiliations.length > 0 ? initialAffiliations : realEgyptianAffiliations
  )`
)

// 6. Update Tab bar label
content = content.replace(
  `<Compass size={15} />
            إدارات ديوان عام الوزارة (قطاع الطب العلاجي)`,
  `<Compass size={15} />
            إدارات ديوان عام الوزارة ({activeSector.shortName || activeSector.name})`
)

// 7. Update Tab 3 rendering
const oldTab3Header = `<strong style={{ fontSize: '15px', color: '#102027', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Compass size={18} style={{ color: 'var(--brand)' }} />
                    الهيكل التنظيمي المعتمد لقطاع الطب العلاجي (ديوان عام وزارة الصحة)
                  </strong>`

const newTab3Header = `<div style={{ display: 'grid', gap: '8px' }}>
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
                        border: \`1px solid \${activeSector.badgeColor}40\`
                      }}>
                        ديوان عام وزارة الصحة والسكان
                      </span>
                    </div>

                    {/* Sector Switcher (Visible for Level 1/Admin or Writable roles) */}
                    {(userOrgLevel <= 2 || isWritable) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontSize: '11.5px', color: '#546e7a', fontWeight: 'bold' }}>تبديل القطاع:</span>
                        {realEgyptianSectors.map((sector) => {
                          const isCurrent = sector.id === selectedSectorId
                          return (
                            <button
                              key={sector.id}
                              type="button"
                              onClick={() => setSelectedSectorId(sector.id)}
                              style={{
                                border: isCurrent ? \`1.5px solid \${sector.badgeColor}\` : '1px solid #cfdcde',
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
                  </div>`

content = content.replace(oldTab3Header, newTab3Header)

// Add the "إضافة إدارة عامة جديدة" button next to Search bar in Tab 3 header
const oldTab3SearchBlock = `{/* Search Bar */}
                <div style={{ position: 'relative', width: 'min(100%, 320px)' }}>`

const newTab3SearchBlock = `<div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
                  <div style={{ position: 'relative', width: 'min(100%, 260px)' }}>`

content = content.replace(oldTab3SearchBlock, newTab3SearchBlock)

// Update Tab 3 filteredUnits
content = content.replace(
  `const activeUnit = ministryUnits.find(u => u.id === selectedUnitId) || ministryUnits[0]
          
          const filteredUnits = ministryUnits.filter(u => 
            u.name.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
            u.level.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
            u.description.toLowerCase().includes(unitSearchQuery.toLowerCase())
          )`,
  `const filteredUnits = currentSectorUnits.filter(u => 
            u.name.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
            u.level.toLowerCase().includes(unitSearchQuery.toLowerCase()) ||
            u.description.toLowerCase().includes(unitSearchQuery.toLowerCase())
          )`
)

// Add closing </div> for the search block wrapper
content = content.replace(
  `<Search size={15} style={{ position: 'absolute', right: '12px', top: '12px', color: '#78909c' }} />
                </div>
              </div>`,
  `<Search size={15} style={{ position: 'absolute', right: '12px', top: '12px', color: '#78909c' }} />
                </div>
              </div>
            </div>`
)

// Add AddMinistryUnitModal at the end of the return statement
content = content.replace(
  `{/* DRAWER: CREATE / EDIT FACILITY */}`,
  `{/* MODAL: ADD MINISTRY UNIT */}
      <AddMinistryUnitModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        activeSector={activeSector}
        centralUnits={centralUnits}
        onAddUnit={handleAddCustomUnit}
      />

      {/* DRAWER: CREATE / EDIT FACILITY */}`
)

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully patched facilities-portal.tsx!')
