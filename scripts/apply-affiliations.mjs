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

const affiliations = [
  { code: 'DIR-CAI', name: 'مديرية الشؤون الصحية بالقاهرة', affiliation_type: 'directorate', governorate_code: 'CAI', sort_order: 10 },
  { code: 'DIR-GIZ', name: 'مديرية الشؤون الصحية بالجيزة', affiliation_type: 'directorate', governorate_code: 'GIZ', sort_order: 20 },
  { code: 'DIR-KAL', name: 'مديرية الشؤون الصحية بالقليوبية', affiliation_type: 'directorate', governorate_code: 'KAL', sort_order: 30 },
  { code: 'DIR-ALX', name: 'مديرية الشؤون الصحية بالإسكندرية', affiliation_type: 'directorate', governorate_code: 'ALX', sort_order: 40 },
  { code: 'DIR-BHR', name: 'مديرية الشؤون الصحية بالبحيرة', affiliation_type: 'directorate', governorate_code: 'BHR', sort_order: 50 },
  { code: 'DIR-MTR', name: 'مديرية الشؤون الصحية بمطروح', affiliation_type: 'directorate', governorate_code: 'MTR', sort_order: 60 },
  { code: 'DIR-DMT', name: 'مديرية الشؤون الصحية بدمياط', affiliation_type: 'directorate', governorate_code: 'DMT', sort_order: 70 },
  { code: 'DIR-DAK', name: 'مديرية الشؤون الصحية بالدقهلية', affiliation_type: 'directorate', governorate_code: 'DAK', sort_order: 80 },
  { code: 'DIR-KFS', name: 'مديرية الشؤون الصحية بكفر الشيخ', affiliation_type: 'directorate', governorate_code: 'KFS', sort_order: 90 },
  { code: 'DIR-GHB', name: 'مديرية الشؤون الصحية بالغربية', affiliation_type: 'directorate', governorate_code: 'GHB', sort_order: 100 },
  { code: 'DIR-MNF', name: 'مديرية الشؤون الصحية بالمنوفية', affiliation_type: 'directorate', governorate_code: 'MNF', sort_order: 110 },
  { code: 'DIR-SHR', name: 'مديرية الشؤون الصحية بالشرقية', affiliation_type: 'directorate', governorate_code: 'SHR', sort_order: 120 },
  { code: 'DIR-PTS', name: 'مديرية الشؤون الصحية ببورسعيد', affiliation_type: 'directorate', governorate_code: 'PTS', sort_order: 130 },
  { code: 'DIR-ISM', name: 'مديرية الشؤون الصحية بالإسماعيلية', affiliation_type: 'directorate', governorate_code: 'ISM', sort_order: 140 },
  { code: 'DIR-SUZ', name: 'مديرية الشؤون الصحية بالسويس', affiliation_type: 'directorate', governorate_code: 'SUZ', sort_order: 150 },
  { code: 'DIR-NSI', name: 'مديرية الشؤون الصحية بشمال سيناء', affiliation_type: 'directorate', governorate_code: 'NSI', sort_order: 160 },
  { code: 'DIR-SSI', name: 'مديرية الشؤون الصحية بجنوب سيناء', affiliation_type: 'directorate', governorate_code: 'SSI', sort_order: 170 },
  { code: 'DIR-BNS', name: 'مديرية الشؤون الصحية ببني سويف', affiliation_type: 'directorate', governorate_code: 'BNS', sort_order: 180 },
  { code: 'DIR-FYM', name: 'مديرية الشؤون الصحية بالفيوم', affiliation_type: 'directorate', governorate_code: 'FYM', sort_order: 190 },
  { code: 'DIR-MIN', name: 'مديرية الشؤون الصحية بالمنيا', affiliation_type: 'directorate', governorate_code: 'MIN', sort_order: 200 },
  { code: 'DIR-AST', name: 'مديرية الشؤون الصحية بأسيوط', affiliation_type: 'directorate', governorate_code: 'AST', sort_order: 210 },
  { code: 'DIR-SHG', name: 'مديرية الشؤون الصحية بسوهاج', affiliation_type: 'directorate', governorate_code: 'SHG', sort_order: 220 },
  { code: 'DIR-QNA', name: 'مديرية الشؤون الصحية بقنا', affiliation_type: 'directorate', governorate_code: 'QNA', sort_order: 230 },
  { code: 'DIR-LXR', name: 'مديرية الشؤون الصحية بالأقصر', affiliation_type: 'directorate', governorate_code: 'LXR', sort_order: 240 },
  { code: 'DIR-ASN', name: 'مديرية الشؤون الصحية بأسوان', affiliation_type: 'directorate', governorate_code: 'ASN', sort_order: 250 },
  { code: 'DIR-RS', name: 'مديرية الشؤون الصحية بالبحر الأحمر', affiliation_type: 'directorate', governorate_code: 'RS', sort_order: 260 },
  { code: 'DIR-WJD', name: 'مديرية الشؤون الصحية بالوادي الجديد', affiliation_type: 'directorate', governorate_code: 'WJD', sort_order: 270 },
  { code: 'MOHP-HQ', name: 'ديوان عام وزارة الصحة والسكان', affiliation_type: 'central_entity', governorate_code: null, sort_order: 300 },
  { code: 'MHS-SECRETARIAT', name: 'الأمانة العامة للصحة النفسية وعلاج الإدمان', affiliation_type: 'central_entity', governorate_code: null, sort_order: 310 },
  { code: 'SMC-SECRETARIAT', name: 'أمانة المراكز الطبية المتخصصة', affiliation_type: 'central_entity', governorate_code: null, sort_order: 320 },
  { code: 'HIO', name: 'الهيئة العامة للتأمين الصحي', affiliation_type: 'authority', governorate_code: null, sort_order: 330 },
  { code: 'UHIA', name: 'الهيئة العامة للرعاية الصحية', affiliation_type: 'authority', governorate_code: null, sort_order: 340 },
  { code: 'EAO', name: 'هيئة الإسعاف المصرية', affiliation_type: 'authority', governorate_code: null, sort_order: 350 },
  { code: 'CURATIVE-ORG', name: 'المؤسسة العلاجية', affiliation_type: 'central_entity', governorate_code: null, sort_order: 360 }
]

async function main() {
  console.log('Testing/inserting affiliations...')
  const { error } = await supabase.from('facility_affiliations').upsert(affiliations, { onConflict: 'code' })
  if (error) {
    console.log('Upsert direct error (expected if table not created yet):', error.message)
  } else {
    console.log('Successfully inserted affiliations into DB!')
  }
}

main()
