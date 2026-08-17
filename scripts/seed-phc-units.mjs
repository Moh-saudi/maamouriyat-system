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

async function seedPHCOrgUnits() {
  const phcSector = {
    id: '00000000-0000-0000-0000-000000000010',
    code: 'PHC-SECTOR',
    name: 'قطاع الرعاية الصحية الأولية وتنمية الأسرة',
    unit_type: 'sector',
    parent_id: null,
    level: 0,
    sort_order: 2,
    is_active: true
  }

  const caFamDev = {
    id: '00000000-0000-0000-0001-000000000001',
    code: 'PHC-CA-FAMILY-DEV',
    name: 'الإدارة المركزية لتنمية الأسرة',
    unit_type: 'central_administration',
    parent_id: phcSector.id,
    level: 1,
    sort_order: 1,
    is_active: true
  }

  const caIntCare = {
    id: '00000000-0000-0000-0001-000000000002',
    code: 'PHC-CA-INTEGRATED-CARE',
    name: 'الإدارة المركزية للرعاية المتكاملة',
    unit_type: 'central_administration',
    parent_id: phcSector.id,
    level: 1,
    sort_order: 2,
    is_active: true
  }

  const generalDepts = [
    // Family Dev
    {
      id: '00000000-0000-0000-0002-000000000001',
      code: 'PHC-GA-FAMILY-PLANNING',
      name: 'الإدارة العامة لتنظيم الأسرة والصحة الإنجابية',
      unit_type: 'general_administration',
      parent_id: caFamDev.id,
      level: 2,
      sort_order: 1,
      is_active: true
    },
    {
      id: '00000000-0000-0000-0002-000000000002',
      code: 'PHC-GA-POPULATION-AWARENESS',
      name: 'الإدارة العامة للإعلام والتربية السكانية',
      unit_type: 'general_administration',
      parent_id: caFamDev.id,
      level: 2,
      sort_order: 2,
      is_active: true
    },
    {
      id: '00000000-0000-0000-0002-000000000003',
      code: 'PHC-GA-WOMEN-DEV',
      name: 'الإدارة العامة لصحة وتنمية المرأة ونوادي الأسرة',
      unit_type: 'general_administration',
      parent_id: caFamDev.id,
      level: 2,
      sort_order: 3,
      is_active: true
    },
    {
      id: '00000000-0000-0000-0002-000000000004',
      code: 'PHC-GA-POPULATION-RESEARCH',
      name: 'الإدارة العامة للبحوث والإحصاء السكاني',
      unit_type: 'general_administration',
      parent_id: caFamDev.id,
      level: 2,
      sort_order: 4,
      is_active: true
    },
    // Integrated Care
    {
      id: '00000000-0000-0000-0002-000000000010',
      code: 'PHC-GA-FAMILY-MEDICINE',
      name: 'الإدارة العامة لطب الأسرة وتطوير المراكز الصحية',
      unit_type: 'general_administration',
      parent_id: caIntCare.id,
      level: 2,
      sort_order: 1,
      is_active: true
    },
    {
      id: '00000000-0000-0000-0002-000000000011',
      code: 'PHC-GA-MATERNAL-CHILD',
      name: 'الإدارة العامة لصحة الأم والطفل ورعاية المبتسرين',
      unit_type: 'general_administration',
      parent_id: caIntCare.id,
      level: 2,
      sort_order: 2,
      is_active: true
    },
    {
      id: '00000000-0000-0000-0002-000000000012',
      code: 'PHC-GA-VACCINES',
      name: 'الإدارة العامة للتطعيمات والخدمات الوقائية الأساسية',
      unit_type: 'general_administration',
      parent_id: caIntCare.id,
      level: 2,
      sort_order: 3,
      is_active: true
    },
    {
      id: '00000000-0000-0000-0002-000000000013',
      code: 'PHC-GA-ELDERLY-CARE',
      name: 'الإدارة العامة للرعاية الصحية لكبار السن والمسنين',
      unit_type: 'general_administration',
      parent_id: caIntCare.id,
      level: 2,
      sort_order: 4,
      is_active: true
    },
    {
      id: '00000000-0000-0000-0002-000000000014',
      code: 'PHC-GA-PRESIDENTIAL-INITIATIVES',
      name: 'الإدارة العامة للمبادرات الرئاسية للرعاية الأولية',
      unit_type: 'general_administration',
      parent_id: caIntCare.id,
      level: 2,
      sort_order: 5,
      is_active: true
    }
  ]

  const allUnits = [phcSector, caFamDev, caIntCare, ...generalDepts]
  console.log(`Seeding ${allUnits.length} PHC organizational units...`)

  for (const u of allUnits) {
    const { error } = await supabase.from('organizational_units').upsert(u, { onConflict: 'id' })
    console.log(`- ${u.name}: ${error ? error.message : 'OK'}`)
  }

  console.log('Finished seeding PHC organizational units!')
}

seedPHCOrgUnits()
