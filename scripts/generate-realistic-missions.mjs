import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(l => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
  if (m) env[m[1]] = m[2].trim()
})

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const PHC_SECTOR_ID = '00000000-0000-0000-0000-000000000010'
const CURATIVE_SECTOR_ID = '00000000-0000-0000-0000-000000000011'
const CAIRO_ORG_ID = 'd7af97fb-b3db-4450-b59d-c6a2222d0e02'
const ABNOUB_ORG_ID = '6e4ae168-adac-4166-a4bd-7f1d8fc3fafc'

const USERS = {
  admin: 'bf8cda02-ecf6-42e4-809a-a657e7fc8023', // مشرف عام المنظومة (Level 1)
  curativeHead: '36be794c-a006-415e-b489-08ae3cd0eff9', // د. بيتر وجيه (Level 2)
  phcHead: '45d06c34-faae-4fb4-a74d-cacd4f09764a', // د. سمير الدميري (Level 2)
  phcInspector: '0b1353e3-6a8e-4f3a-9d7a-4162cd22f1e7', // د. طارق نبيل (Level 2 Inspector)
  cairoDirector: '0c394908-3a5f-4989-b481-d28bf4af536c', // د. حمودة الجزار (Level 5)
  cairoInspector: '40c21c8e-d20b-410f-af2d-7fef073f73a2', // د. مصطفى محمود (Level 5 Inspector)
  abnoubDirector: 'e4a5aad4-115e-4fda-acc7-6a83b7ced23f', // د. ممدوح وشاحي (Level 6)
  abnoubInspector: 'b2bf6e99-3897-4bea-83a4-7a186a2489b1', // د. عبدالحميد (Level 6 Inspector)
  abnoubInspector2: '4442c828-f5a0-403a-8001-f7452461e2ab'
}

function generateDate(monthOffset, dayOffset = 10) {
  const base = new Date()
  base.setMonth(base.getMonth() - monthOffset)
  base.setDate(Math.min(28, Math.max(1, dayOffset)))
  return base.toISOString().split('T')[0]
}

async function run() {
  console.log('🚀 Starting clean generation of realistic missions...')

  // Clean old test missions
  const { error: delErr } = await supabase.from('missions').delete().like('serial_number', 'MIS-2026-%')
  if (delErr) console.warn('Warning during cleanup:', delErr.message)
  else console.log('✓ Cleaned previous batch of test missions')

  // Fetch facilities
  const { data: allFacilities, error: facErr } = await supabase
    .from('facilities')
    .select('id, name, facility_type, governorate, health_admin, sector_id, organization_id')
    .limit(400)

  if (facErr || !allFacilities || allFacilities.length === 0) {
    console.error('Failed to fetch facilities:', facErr)
    return
  }

  const hospitals = allFacilities.filter(f => f.facility_type?.includes('مستشفى') || f.name.includes('مستشفى'))
  const familyCenters = allFacilities.filter(f => f.facility_type?.includes('أسرة') || f.facility_type?.includes('وحدة') || f.name.includes('مركز') || f.name.includes('وحدة'))
  
  const facPool = {
    hospitals: hospitals.length > 0 ? hospitals : allFacilities,
    familyCenters: familyCenters.length > 0 ? familyCenters : allFacilities,
    all: allFacilities
  }

  console.log(`Found ${allFacilities.length} facilities (Hospitals: ${hospitals.length}, Family Centers: ${familyCenters.length})`)

  const missionsToInsert = []
  let serialCounter = 1000

  const statuses = ['completed', 'completed', 'completed', 'completed', 'in_progress', 'approved', 'pending_approval', 'completed']
  const priorities = ['urgent', 'high', 'normal', 'high', 'normal']

  // 1. Curative Sector (25 Missions)
  console.log('Generating Level 2 (Curative Sector) missions...')
  for (let i = 0; i < 25; i++) {
    serialCounter++
    const serial = `MIS-2026-${serialCounter}`
    const fac = facPool.hospitals[i % facPool.hospitals.length]
    const status = statuses[i % statuses.length]
    const priority = priorities[i % priorities.length]
    const monthOffset = i % 5
    const day = (i * 3 + 2) % 27 + 1
    const schedDate = generateDate(monthOffset, day)
    
    const isCompleted = status === 'completed'
    const isInProgress = status === 'in_progress'
    
    const totalItems = 30 + (i % 10)
    const violationCount = isCompleted ? ((i % 3) + 1) : 0
    const compliantItems = isCompleted ? (totalItems - violationCount) : 0

    const missionId = crypto.randomUUID()
    const checkinTime = isCompleted || isInProgress ? `${schedDate}T09:15:00+02:00` : null
    const checkoutTime = isCompleted ? `${schedDate}T13:45:00+02:00` : null

    missionsToInsert.push({
      id: missionId,
      serial_number: serial,
      facility_id: fac.id,
      target_facility_id: fac.id,
      assigned_user_id: USERS.curativeHead,
      primary_inspector_id: USERS.curativeHead,
      inspector_org_id: CURATIVE_SECTOR_ID,
      org_unit_id: CURATIVE_SECTOR_ID,
      inspector_level: 2,
      created_by: USERS.admin,
      approved_by: USERS.admin,
      status: status,
      priority: priority,
      scheduled_date: schedDate,
      checkin_time: checkinTime,
      checkout_time: checkoutTime,
      completed_at: checkoutTime,
      checkin_lat: 30.0444 + (Math.random() * 0.05),
      checkin_lng: 31.2357 + (Math.random() * 0.05),
      checkout_lat: 30.0444 + (Math.random() * 0.05),
      checkout_lng: 31.2357 + (Math.random() * 0.05),
      gps_verified: isCompleted || isInProgress,
      duration_minutes: isCompleted ? (180 + (i * 15) % 120) : null,
      total_criteria: totalItems,
      violations_count: violationCount,
      violation_count: violationCount,
      visit_purpose: 'مرور وتقييم حوكمة أقسام الطوارئ والرعايات المركزة',
      notes: `مرور وحوكمة فنية من ديوان قطاع الطب العلاجي للتفتيش على أقسام الاستقبال والرعايات المركزة وبنوك الدم بمستشفى (${fac.name}).`,
      destination_type: 'facility',
      sector_id: CURATIVE_SECTOR_ID,
      created_at: `${schedDate}T08:00:00+02:00`,
      updated_at: checkoutTime || `${schedDate}T08:30:00+02:00`
    })
  }

  // 2. PHC Sector (25 Missions)
  console.log('Generating Level 2 (PHC Sector) missions...')
  for (let i = 0; i < 25; i++) {
    serialCounter++
    const serial = `MIS-2026-${serialCounter}`
    const fac = facPool.familyCenters[i % facPool.familyCenters.length]
    const status = statuses[(i + 2) % statuses.length]
    const priority = ['high', 'normal', 'normal', 'urgent', 'normal'][i % 5]
    const monthOffset = (i + 1) % 5
    const day = (i * 4 + 5) % 27 + 1
    const schedDate = generateDate(monthOffset, day)
    
    const isCompleted = status === 'completed'
    const isInProgress = status === 'in_progress'
    
    const totalItems = 25 + (i % 8)
    const violationCount = isCompleted ? ((i % 3) + 1) : 0

    const missionId = crypto.randomUUID()
    const checkinTime = isCompleted || isInProgress ? `${schedDate}T08:45:00+02:00` : null
    const checkoutTime = isCompleted ? `${schedDate}T12:30:00+02:00` : null

    missionsToInsert.push({
      id: missionId,
      serial_number: serial,
      facility_id: fac.id,
      target_facility_id: fac.id,
      assigned_user_id: (i % 2 === 0) ? USERS.phcInspector : USERS.phcHead,
      primary_inspector_id: (i % 2 === 0) ? USERS.phcInspector : USERS.phcHead,
      inspector_org_id: PHC_SECTOR_ID,
      org_unit_id: PHC_SECTOR_ID,
      inspector_level: 2,
      created_by: USERS.phcHead,
      approved_by: USERS.phcHead,
      status: status,
      priority: priority,
      scheduled_date: schedDate,
      checkin_time: checkinTime,
      checkout_time: checkoutTime,
      completed_at: checkoutTime,
      checkin_lat: 27.1809 + (Math.random() * 0.04),
      checkin_lng: 31.1837 + (Math.random() * 0.04),
      checkout_lat: 27.1809 + (Math.random() * 0.04),
      checkout_lng: 31.1837 + (Math.random() * 0.04),
      gps_verified: isCompleted || isInProgress,
      duration_minutes: isCompleted ? (120 + (i * 20) % 90) : null,
      total_criteria: totalItems,
      violations_count: violationCount,
      violation_count: violationCount,
      visit_purpose: 'تفتيش خدمات طب الأسرة وسلاسل تبريد الطعوم وصحة الأم والطفل',
      notes: `متابعة حوكمة طب الأسرة وتنمية الأسرة، والتأكد من سلاسل التبريد وصرف الألبان الشبيهة بالمنشأة (${fac.name}).`,
      destination_type: 'facility',
      sector_id: PHC_SECTOR_ID,
      created_at: `${schedDate}T07:30:00+02:00`,
      updated_at: checkoutTime || `${schedDate}T08:00:00+02:00`
    })
  }

  // 3. Health Directorates (30 Missions)
  console.log('Generating Level 5 (Health Directorates) missions...')
  for (let i = 0; i < 30; i++) {
    serialCounter++
    const serial = `MIS-2026-${serialCounter}`
    const fac = facPool.all[(i * 3) % facPool.all.length]
    const status = statuses[(i + 1) % statuses.length]
    const priority = ['normal', 'high', 'normal', 'urgent'][i % 4]
    const monthOffset = (i * 2) % 6
    const day = (i * 5 + 1) % 27 + 1
    const schedDate = generateDate(monthOffset, day)
    
    const isCompleted = status === 'completed'
    const isInProgress = status === 'in_progress'
    
    const totalItems = 28 + (i % 6)
    const violationCount = isCompleted ? (i % 3) : 0

    const missionId = crypto.randomUUID()
    const checkinTime = isCompleted || isInProgress ? `${schedDate}T09:30:00+02:00` : null
    const checkoutTime = isCompleted ? `${schedDate}T14:15:00+02:00` : null

    missionsToInsert.push({
      id: missionId,
      serial_number: serial,
      facility_id: fac.id,
      target_facility_id: fac.id,
      assigned_user_id: USERS.cairoInspector,
      primary_inspector_id: USERS.cairoInspector,
      inspector_org_id: CAIRO_ORG_ID,
      org_unit_id: CAIRO_ORG_ID,
      inspector_level: 5,
      created_by: USERS.cairoDirector,
      approved_by: USERS.cairoDirector,
      status: status,
      priority: priority,
      scheduled_date: schedDate,
      checkin_time: checkinTime,
      checkout_time: checkoutTime,
      completed_at: checkoutTime,
      checkin_lat: 30.0626 + (Math.random() * 0.03),
      checkin_lng: 31.2497 + (Math.random() * 0.03),
      checkout_lat: 30.0626 + (Math.random() * 0.03),
      checkout_lng: 31.2497 + (Math.random() * 0.03),
      gps_verified: isCompleted || isInProgress,
      duration_minutes: isCompleted ? (150 + (i * 10) % 100) : null,
      total_criteria: totalItems,
      violations_count: violationCount,
      violation_count: violationCount,
      visit_purpose: 'مرور رقابي وتفتيش جودة من مديرية الشئون الصحية',
      notes: `تفتيش دوري ورقابي من مديرية الشئون الصحية على جودة الخدمة الطبية وتوافر الكوادر والأدوية بـ (${fac.name}).`,
      destination_type: 'facility',
      sector_id: PHC_SECTOR_ID,
      created_at: `${schedDate}T08:15:00+02:00`,
      updated_at: checkoutTime || `${schedDate}T08:45:00+02:00`
    })
  }

  // 4. Health Administrations (30 Missions)
  console.log('Generating Level 6 (Health Administrations) missions...')
  for (let i = 0; i < 30; i++) {
    serialCounter++
    const serial = `MIS-2026-${serialCounter}`
    const fac = facPool.familyCenters[(i * 2 + 1) % facPool.familyCenters.length]
    const status = statuses[(i + 3) % statuses.length]
    const priority = ['normal', 'normal', 'urgent', 'high', 'normal'][i % 5]
    const monthOffset = (i * 3) % 6
    const day = (i * 6 + 3) % 27 + 1
    const schedDate = generateDate(monthOffset, day)
    
    const isCompleted = status === 'completed'
    const isInProgress = status === 'in_progress'
    
    const totalItems = 20 + (i % 5)
    const violationCount = isCompleted ? (i % 2) : 0

    const missionId = crypto.randomUUID()
    const checkinTime = isCompleted || isInProgress ? `${schedDate}T08:30:00+02:00` : null
    const checkoutTime = isCompleted ? `${schedDate}T11:45:00+02:00` : null

    missionsToInsert.push({
      id: missionId,
      serial_number: serial,
      facility_id: fac.id,
      target_facility_id: fac.id,
      assigned_user_id: (i % 2 === 0) ? USERS.abnoubInspector : USERS.abnoubInspector2,
      primary_inspector_id: (i % 2 === 0) ? USERS.abnoubInspector : USERS.abnoubInspector2,
      inspector_org_id: ABNOUB_ORG_ID,
      org_unit_id: ABNOUB_ORG_ID,
      inspector_level: 6,
      created_by: USERS.abnoubDirector,
      approved_by: USERS.abnoubDirector,
      status: status,
      priority: priority,
      scheduled_date: schedDate,
      checkin_time: checkinTime,
      checkout_time: checkoutTime,
      completed_at: checkoutTime,
      checkin_lat: 27.2667 + (Math.random() * 0.02),
      checkin_lng: 31.1500 + (Math.random() * 0.02),
      checkout_lat: 27.2667 + (Math.random() * 0.02),
      checkout_lng: 31.1500 + (Math.random() * 0.02),
      gps_verified: isCompleted || isInProgress,
      duration_minutes: isCompleted ? (90 + (i * 15) % 60) : null,
      total_criteria: totalItems,
      violations_count: violationCount,
      violation_count: violationCount,
      visit_purpose: 'متابعة انتظام العمل الميداني وسجلات المواليد والوفيات والتطعيم',
      notes: `مرور ميداني ومتابعة الحضور والانصراف وسجلات المواليد والوفيات والتطعيمات الروتينية بوحدة (${fac.name}).`,
      destination_type: 'facility',
      sector_id: PHC_SECTOR_ID,
      created_at: `${schedDate}T07:45:00+02:00`,
      updated_at: checkoutTime || `${schedDate}T08:15:00+02:00`
    })
  }

  console.log(`\nInserting ${missionsToInsert.length} total missions across all levels...`)

  // Batch insert missions (in chunks of 25)
  for (let i = 0; i < missionsToInsert.length; i += 25) {
    const chunk = missionsToInsert.slice(i, i + 25)
    const { error: mErr } = await supabase.from('missions').upsert(chunk, { onConflict: 'id' })
    if (mErr) {
      console.error(`Error inserting missions chunk ${i}:`, mErr)
    } else {
      console.log(`✓ Inserted missions ${i + 1} - ${Math.min(i + 25, missionsToInsert.length)}`)
    }
  }

  // Count total missions in DB
  const { count } = await supabase.from('missions').select('*', { count: 'exact', head: true })
  console.log(`\n🎉 DONE! Total missions in database now: ${count}`)
}

run()
