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

const unitsToSeed = [
  // ── قطاع الرعاية الصحية الأولية وتنمية الأسرة ──
  // المستوى 3: الإدارات المركزية
  {
    id: '00000000-0000-0000-0001-000000000001',
    name: 'الإدارة المركزية لتنمية الأسرة',
    level: 3,
    level_label: 'central_entity',
    parent_id: PHC_SECTOR_ID,
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-FAM-DEV',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0001-000000000002',
    name: 'الإدارة المركزية للرعاية المتكاملة',
    level: 3,
    level_label: 'central_entity',
    parent_id: PHC_SECTOR_ID,
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-INT-CARE',
    is_active: true
  },

  // المستوى 4: الإدارات العامة لتنمية الأسرة
  {
    id: '00000000-0000-0000-0002-000000000001',
    name: 'الإدارة العامة لتنظيم الأسرة والصحة الإنجابية',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000001',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-FP',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000002',
    name: 'الإدارة العامة للإعلام والتربية السكانية',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000001',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-AWR',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000003',
    name: 'الإدارة العامة لصحة وتنمية المرأة ونوادي الأسرة',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000001',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-WMN',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000004',
    name: 'الإدارة العامة للبحوث والإحصاء السكاني',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000001',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-RES',
    is_active: true
  },

  // المستوى 4: الإدارات العامة للرعاية المتكاملة
  {
    id: '00000000-0000-0000-0002-000000000010',
    name: 'الإدارة العامة لطب الأسرة والمراكز الصحية',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000002',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-FM',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000011',
    name: 'الإدارة العامة لصحة الأم والطفل ورعاية المبتسرين',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000002',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-MCH',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000012',
    name: 'الإدارة العامة للتطعيمات والخدمات الوقائية الأساسية',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000002',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-VAC',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000013',
    name: 'الإدارة العامة للرعاية الصحية لكبار السن والمسنين',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000002',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-ELD',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000014',
    name: 'الإدارة العامة للمبادرات الرئاسية للرعاية الأولية',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000002',
    sector_id: PHC_SECTOR_ID,
    code: 'PHC-GEN-PRES',
    is_active: true
  },

  // ── قطاع الطب العلاجي ──
  // المستوى 3: الإدارات المركزية
  {
    id: '00000000-0000-0000-0001-000000000020',
    name: 'الإدارة المركزية للشئون العلاجية',
    level: 3,
    level_label: 'central_entity',
    parent_id: CURATIVE_SECTOR_ID,
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-CENTRAL-TH',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0001-000000000021',
    name: 'الإدارة المركزية لعمليات الدم وتجميع البلازما',
    level: 3,
    level_label: 'central_entity',
    parent_id: CURATIVE_SECTOR_ID,
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-CENTRAL-PL',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0001-000000000022',
    name: 'الإدارة المركزية للطوارئ والرعاية الحرجة',
    level: 3,
    level_label: 'central_entity',
    parent_id: CURATIVE_SECTOR_ID,
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-CENTRAL-EM',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0001-000000000023',
    name: 'الإدارة المركزية لأمانة المراكز الطبية المتخصصة',
    level: 3,
    level_label: 'central_entity',
    parent_id: CURATIVE_SECTOR_ID,
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-CENTRAL-SP',
    is_active: true
  },

  // المستوى 4: الإدارات العامة للطب العلاجي
  {
    id: '00000000-0000-0000-0002-000000000030',
    name: 'الإدارة العامة للمستشفيات',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000020',
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-GEN-HOSP',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000031',
    name: 'الإدارة العامة لشئون طب الأسنان',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000020',
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-GEN-DENT',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000032',
    name: 'الإدارة العامة للأشعة',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000020',
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-GEN-RAD',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000033',
    name: 'الإدارة العامة للشئون الصيدلية',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000020',
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-GEN-PHARM',
    is_active: true
  },
  {
    id: '00000000-0000-0000-0002-000000000034',
    name: 'الإدارة العامة للعلاج الطبيعي',
    level: 4,
    level_label: 'general_dept',
    parent_id: '00000000-0000-0000-0001-000000000020',
    sector_id: CURATIVE_SECTOR_ID,
    code: 'CUR-GEN-PT',
    is_active: true
  }
]

async function seed() {
  console.log(`Seeding ${unitsToSeed.length} central & general administrative units into organizations table...`)

  for (const unit of unitsToSeed) {
    const { error } = await supabase
      .from('organizations')
      .upsert(unit, { onConflict: 'id' })

    if (error) {
      console.error(`Error inserting ${unit.name}:`, error.message)
    } else {
      console.log(`✓ Inserted/Updated: ${unit.name} (Level ${unit.level})`)
    }
  }

  console.log('Seeding complete!')
}

seed()
