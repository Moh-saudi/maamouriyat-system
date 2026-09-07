import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { PrintButton } from './print-button'
import { departmentChecklists } from '@/lib/checklist-data'
import { formatFacilityType } from '@/lib/facility-types'

// ─── Types ────────────────────────────────────────────────────────────────────

type PageProps = {
  params: Promise<{ id: string }>
}

type EvaluatedItem = {
  id: string
  text: string
  answer: string | null
  notes: string | null
  isViolation: boolean
  priority?: string | null
}

type EvaluatedSection = {
  id: string
  name: string
  items: EvaluatedItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(value: string | null) {
  if (!value) return 'غير محدد'
  try {
    return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value))
  } catch (_) {
    return value
  }
}

function priorityText(value: string | null) {
  if (value === 'urgent') return 'عاجلة'
  if (value === 'high') return 'مرتفعة'
  if (value === 'normal') return 'عادية'
  return value ?? 'عادية'
}

function statusText(value: string | null) {
  const s = (value || '').toLowerCase()
  if (s === 'assigned') return 'مكلفة'
  if (s === 'in_progress' || s === 'executing') return 'قيد التنفيذ'
  if (s === 'completed' || s === 'closed' || s === 'done') return 'مكتملة معتمدة ✅'
  if (s === 'draft') return 'مسودة'
  if (s === 'approved') return 'معتمدة للتنفيذ'
  return value ?? 'غير محددة'
}

function answerLabel(answer: string | null): { text: string; color: string; bg: string } {
  if (!answer) return { text: '—', color: '#6b7280', bg: '#f9fafb' }
  const ans = String(answer).trim().toLowerCase()
  if (ans === 'yes' || ans === 'مطابق' || ans === 'مطابق بالكامل' || ans === 'ملتزم' || ans === 'true') {
    return { text: 'مطابق بالكامل ✅', color: '#15803d', bg: '#f0fdf4' }
  }
  if (ans === 'مطابق جزئياً' || ans === 'partial' || ans === 'متوسط' || ans === 'مقبول') {
    return { text: 'مطابق جزئياً ⚠️', color: '#b45309', bg: '#fffbeb' }
  }
  if (ans === 'no' || ans === 'غير مطابق' || ans === 'غير مطابق بالكامل' || ans === 'غير ملتزم' || ans === 'false') {
    return { text: 'غير مطابق ❌', color: '#b91c1c', bg: '#fef2f2' }
  }
  if (ans === 'na' || ans === 'لا ينطبق' || ans === 'غير منطبق') {
    return { text: 'لا ينطبق', color: '#6b7280', bg: '#f3f4f6' }
  }
  return { text: String(answer), color: '#374151', bg: '#f9fafb' }
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// ─── Page Component ───────────────────────────────────────────────────────────

export default async function MissionPrintPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  if (!supabase) redirect('/login')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const signatureCookie = (await cookies()).get(`maamouriyat_signature_${id}`)?.value
  const signatureImage = signatureCookie ? decodeURIComponent(signatureCookie) : null

  let adminClient: any = null
  try {
    adminClient = getAdminClient()
  } catch (_) {}

  const clientToUse = adminClient || supabase

  // 1. Fetch mission data safely without brittle joins
  let missionData: any = null
  if (adminClient) {
    const { data: mData } = await adminClient.from('missions').select('*').eq('id', id).maybeSingle()
    missionData = mData
  }
  if (!missionData) {
    const { data: sbData } = await supabase.from('missions').select('*').eq('id', id).maybeSingle()
    missionData = sbData
  }

  if (!missionData) {
    return (
      <main style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Tajawal, sans-serif' }}>
        <div style={{ maxWidth: '600px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔒</div>
          <h2 style={{ color: '#c62828', fontSize: '18px' }}>المأمورية غير موجودة أو غير مصرح بالاطلاع عليها</h2>
          <Link href="/dashboard/missions" style={{ background: '#006d77', color: 'white', padding: '10px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block', marginTop: '16px' }}>
            ← العودة لقائمة المأموريات
          </Link>
        </div>
      </main>
    )
  }

  const mission = missionData
  const facId = mission.facility_id || mission.target_facility_id || mission.actual_facility_id
  const assignedUserId = mission.assigned_user_id || mission.primary_inspector_id
  const creatorId = mission.created_by

  // 2. Fetch related details in parallel
  const [userRes, creatorRes, orgRes, critRes, secRes, chkItemsRes, resultsRes] = await Promise.all([
    assignedUserId ? clientToUse.from('users').select('full_name, job_title, department').eq('id', assignedUserId).maybeSingle() : Promise.resolve({ data: null }),
    creatorId ? clientToUse.from('users').select('full_name, job_title, department').eq('id', creatorId).maybeSingle() : Promise.resolve({ data: null }),
    mission.sector_id ? clientToUse.from('organizations').select('name').eq('id', mission.sector_id).maybeSingle() : Promise.resolve({ data: null }),
    clientToUse.from('form_criteria').select('id, section_id, template_id, criterion_text, score_max_value, sort_order').eq('is_active', true),
    clientToUse.from('form_sections').select('id, template_id, name, section_number, sort_order').eq('is_active', true),
    clientToUse.from('checklist_items').select('id, text, score_max_value'),
    clientToUse.from('mission_results').select('checklist_item_id, answer, notes').eq('mission_id', id)
  ])

  // Resolve Facility with multi-column fallback and select(*)
  let facility: any = null
  const candidateFacIds = [
    mission.actual_facility_id,
    mission.facility_id,
    mission.target_facility_id
  ].filter(Boolean)

  for (const fid of candidateFacIds) {
    if (!facility && fid) {
      const { data: fData } = await clientToUse
        .from('facilities')
        .select('*')
        .eq('id', fid)
        .maybeSingle()
      if (fData) {
        facility = fData
        break
      }
    }
  }

  // Check violations if facility not directly on mission
  if (!facility) {
    const { data: vRow } = await clientToUse
      .from('violations')
      .select('facility_id')
      .eq('mission_id', id)
      .not('facility_id', 'is', null)
      .limit(1)
      .maybeSingle()
    if (vRow?.facility_id) {
      const { data: vfData } = await clientToUse.from('facilities').select('*').eq('id', vRow.facility_id).maybeSingle()
      if (vfData) facility = vfData
    }
  }

  // Resolve Organization if governorate/org-unit
  let targetOrg: any = null
  const orgCandidates = [
    mission.target_governorate_id,
    mission.actual_governorate_id,
    mission.inspector_org_id,
    mission.org_unit_id
  ].filter(Boolean)

  for (const oid of orgCandidates) {
    if (!targetOrg && oid) {
      const { data: oData } = await clientToUse.from('organizations').select('*').eq('id', oid).maybeSingle()
      if (oData) {
        targetOrg = oData
        break
      }
    }
  }

  const assignedUser = userRes.data
  const creator = creatorRes.data
  const sectorName = orgRes.data?.name || assignedUser?.department || 'قطاع الرعاية الصحية الأولية وتنمية الأسرة'
  const assignedDept = assignedUser?.department || sectorName || 'ديوان عام وزارة الصحة والسكان'
  const issuingOrg = creator?.department || sectorName || 'ديوان عام الوزارة'
  const isCompleted = ['completed', 'closed', 'done'].includes((mission.status || '').toLowerCase())

  const GOV_MAP: Record<string, string> = {
    cairo: 'القاهرة',
    giza: 'الجيزة',
    alexandria: 'الإسكندرية',
    asyut: 'أسيوط',
    dakahlia: 'الدقهلية',
    gharbia: 'الغربية',
    sharkia: 'الشرقية',
    beheira: 'البحيرة',
    damietta: 'دمياط',
    kafr_el_sheikh: 'كفر الشيخ',
    menoufia: 'المنوفية',
    qalyubia: 'القليوبية',
    fayoum: 'الفيوم',
    beni_suef: 'بني سويف',
    minya: 'المنيا',
    sohag: 'سوهاج',
    qena: 'قنا',
    luxor: 'الأقصر',
    aswan: 'أسوان',
    red_sea: 'البحر الأحمر',
    new_valley: 'الوادي الجديد',
    matrouh: 'مطروح',
    north_sinai: 'شمال سيناء',
    south_sinai: 'جنوب سيناء',
    ismailia: 'الإسماعيلية',
    suez: 'السويس',
    port_said: 'بورسعيد'
  }

  const isUuid = (val: string | null | undefined): boolean => {
    if (!val) return false
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val).trim())
  }

  const govKey = String(mission.target_governorate_id || '').toLowerCase()
  const arabicGov = GOV_MAP[govKey] || facility?.governorate || targetOrg?.governorate || ''

  function inferFacilityType(name: string | null | undefined, rawType: string | null | undefined): string {
    if (rawType && rawType !== 'other' && rawType !== 'منشأة صحية' && rawType !== 'مديرية صحية' && rawType !== 'governorate') {
      return formatFacilityType(rawType)
    }
    const n = (name || '').toLowerCase()
    if (n.includes('مركز طب أسرة') || n.includes('مركز طب اسرة')) return 'مركز طب أسرة'
    if (n.includes('وحدة طب أسرة') || n.includes('وحدة طب اسرة') || n.includes('وحدة صحية')) return 'وحدة صحية'
    if (n.includes('مركز صحي') || n.includes('مركز طبي')) return 'مركز طبي / رعاية أولية'
    if (n.includes('مستشفى تعليمي') || n.includes('مستشفي تعليمي')) return 'مستشفى تعليمي'
    if (n.includes('أمانة المراكز') || n.includes('مراكز تخصصية') || n.includes('مستشفى تخصصي')) return 'أمانة المراكز الطبية المتخصصة'
    if (n.includes('تأمين صحي') || n.includes('تأمين')) return 'مستشفى تأمين صحي'
    if (n.includes('صحة نفسية')) return 'مستشفى صحة نفسية'
    if (n.includes('مستشفى') || n.includes('مستشفي')) return 'مستشفى عام / مركزي'
    if (n.includes('مكتب صحة')) return 'مكتب صحة'
    if (n.includes('رعاية طفل') || n.includes('أمومة')) return 'رعاية طفل وأمومة'
    if (n.includes('مخزن') || n.includes('إمداد') || n.includes('تموين')) return 'مخزن تموين طبي وإمداد دوائي'
    
    return 'وحدة صحية / مركز طب أسرة'
  }

  // Exact registered facility name and health administration
  let destinationName = facility?.name || ''
  let healthAdmin = facility?.health_admin || targetOrg?.health_admin || (facility?.governorate ? `الإدارة الصحية بـ ${facility.governorate}` : 'الإدارة الصحية المختصة')
  let address = facility?.address || facility?.village_city || (facility?.governorate ? `محافظة ${facility.governorate}` : (arabicGov ? `محافظة ${arabicGov}` : 'جمهورية مصر العربية'))

  if (isUuid(address)) {
    address = arabicGov ? `محافظة ${arabicGov}` : targetOrg?.name || 'جمهورية مصر العربية'
  }

  if (!destinationName) {
    if (targetOrg?.name && !targetOrg.name.includes('مديرية')) {
      destinationName = targetOrg.name
    } else if (arabicGov) {
      destinationName = `وحدات ومراكز الرعاية الصحية (محافظة ${arabicGov})`
    } else {
      destinationName = 'وحدة صحية / مركز طب أسرة'
    }
  }

  if (isUuid(destinationName)) {
    destinationName = arabicGov ? `وحدات ومراكز الرعاية الصحية (محافظة ${arabicGov})` : 'الوحدة الصحية المستهدفة'
  }

  const facilityType = inferFacilityType(destinationName, facility?.facility_type)

  const displaySerialNumber = isUuid(mission.serial_number)
    ? `MOH-${mission.id.substring(0, 8).toUpperCase()}`
    : mission.serial_number || `MOH-${mission.id.substring(0, 8).toUpperCase()}`

  // 3. Build lookup maps for criteria and sections
  const sectionNameMap = new Map<string, string>()
  ;(secRes.data || []).forEach((sec: any) => {
    sectionNameMap.set(sec.id, sec.name)
  })

  const criteriaMap = new Map<string, { id: string; text: string; sectionId: string; sectionName: string; maxScore: number }>()

  ;(critRes.data || []).forEach((c: any) => {
    const sName = sectionNameMap.get(c.section_id) || 'القسم التقييمي'
    criteriaMap.set(c.id, {
      id: c.id,
      text: c.criterion_text,
      sectionId: c.section_id || 'default_sec',
      sectionName: sName,
      maxScore: c.score_max_value || 2
    })
  })

  ;(chkItemsRes.data || []).forEach((item: any) => {
    if (!criteriaMap.has(item.id)) {
      criteriaMap.set(item.id, {
        id: item.id,
        text: item.text,
        sectionId: 'chk_sec',
        sectionName: 'بنود التقييم الميداني المعتمدة',
        maxScore: item.score_max_value || 2
      })
    }
  })

  // Add static department checklists items
  Object.values(departmentChecklists).forEach((sections) => {
    sections.forEach((sec) => {
      sec.items.forEach((item) => {
        if (!criteriaMap.has(item.id)) {
          criteriaMap.set(item.id, {
            id: item.id,
            text: item.text,
            sectionId: sec.id,
            sectionName: sec.name,
            maxScore: 2
          })
        }
      })
    })
  })

  // 4. Parse results and map to structured sections
  const rawResults = resultsRes.data || []
  const groupedSectionsMap = new Map<string, EvaluatedSection>()

  let totalScore = 0
  let maxScore = 0
  let totalItems = 0
  let yesCount = 0
  let partialCount = 0
  let noCount = 0
  let naCount = 0

  rawResults.forEach((r: any, idx: number) => {
    let cleanId = r.checklist_item_id || ''
    let cleanNotes = r.notes || ''

    if (cleanNotes.startsWith('__item_id__:')) {
      const delim = cleanNotes.indexOf('||')
      if (delim !== -1) {
        cleanId = cleanNotes.substring('__item_id__:'.length, delim)
        cleanNotes = cleanNotes.substring(delim + 2)
      }
    } else if (cleanNotes.startsWith('__static_id__:')) {
      const delim = cleanNotes.indexOf('||')
      if (delim !== -1) {
        cleanId = cleanNotes.substring('__static_id__:'.length, delim)
        cleanNotes = cleanNotes.substring(delim + 2)
      }
    }

    const critInfo = criteriaMap.get(cleanId)
    const itemText = critInfo?.text || cleanNotes || `معيار رقابي #${idx + 1}`
    const secId = critInfo?.sectionId || 'general_sec'
    const secName = critInfo?.sectionName || 'بنود ومعايير التقييم الميداني'
    const itemMax = critInfo?.maxScore || 2
    const ans = r.answer

    if (ans !== undefined && ans !== null && ans !== '') {
      totalItems++
      const ansNorm = String(ans).trim().toLowerCase()
      if (ansNorm === 'yes' || ansNorm === 'مطابق' || ansNorm === 'مطابق بالكامل' || ansNorm === 'ملتزم' || ansNorm === 'true') {
        yesCount++
        totalScore += itemMax
        maxScore += itemMax
      } else if (ansNorm === 'مطابق جزئياً' || ansNorm === 'partial' || ansNorm === 'متوسط' || ansNorm === 'مقبول') {
        partialCount++
        totalScore += Math.round(itemMax / 2) || 1
        maxScore += itemMax
      } else if (ansNorm === 'no' || ansNorm === 'غير مطابق' || ansNorm === 'غير مطابق بالكامل' || ansNorm === 'غير ملتزم' || ansNorm === 'false') {
        noCount++
        maxScore += itemMax
      } else if (ansNorm === 'na' || ansNorm === 'لا ينطبق' || ansNorm === 'غير منطبق') {
        naCount++
      } else {
        yesCount++
        totalScore += itemMax
        maxScore += itemMax
      }
    }

    const isViolation = String(ans).toLowerCase() === 'no' || String(ans).includes('غير مطابق') || String(ans).includes('غير ملتزم')

    if (!groupedSectionsMap.has(secId)) {
      groupedSectionsMap.set(secId, {
        id: secId,
        name: secName,
        items: []
      })
    }

    groupedSectionsMap.get(secId)!.items.push({
      id: cleanId || `item_${idx}`,
      text: itemText,
      answer: ans,
      notes: cleanNotes === itemText ? null : cleanNotes || null,
      isViolation
    })
  })

  const evaluatedSections: EvaluatedSection[] = Array.from(groupedSectionsMap.values())
  const applicableItems = totalItems - naCount
  const complianceScore = maxScore > 0 
    ? Math.round((totalScore / maxScore) * 100) 
    : (applicableItems > 0 ? Math.round(((yesCount + (partialCount * 0.5)) / applicableItems) * 100) : 0)

  const scoreColor = complianceScore >= 85 ? '#15803d' : complianceScore >= 65 ? '#b45309' : '#b91c1c'
  const scoreBg    = complianceScore >= 85 ? '#f0fdf4' : complianceScore >= 65 ? '#fffbeb' : '#fef2f2'
  const scoreBorder= complianceScore >= 85 ? '#86efac' : complianceScore >= 65 ? '#fde047' : '#fca5a5'

  // Extract separate recommendations if present in execution_notes
  const rawExecutionNotes = mission.execution_notes || mission.notes || ''
  let executionNotesOnly = rawExecutionNotes
  let recommendationsOnly = ''
  const recDivider = '\n\n---\n\n📋 توصيات المأمورية المعتمدة:\n'
  if (rawExecutionNotes.includes(recDivider)) {
    const parts = rawExecutionNotes.split(recDivider)
    executionNotesOnly = parts[0].trim()
    recommendationsOnly = parts[1].trim()
  }

  // ─── Styles ──────────────────────────────────────────────────────────────────

  const S = {
    page: {
      fontFamily: "'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif",
      direction: 'rtl' as const,
      background: '#f0f4f5',
      minHeight: '100vh',
      padding: '24px 16px',
    },
    toolbar: {
      maxWidth: '860px',
      margin: '0 auto 16px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'white',
      border: '1px solid #dce8e9',
      borderRadius: '10px',
      padding: '12px 20px',
    },
    sheet: {
      maxWidth: '860px',
      margin: '0 auto',
      background: 'white',
      borderRadius: '12px',
      border: '1px solid #d0dfe0',
      boxShadow: '0 4px 24px rgba(0,109,119,0.08)',
      overflow: 'hidden',
    },
    govHeader: {
      background: 'linear-gradient(135deg, #0e4b5a 0%, #006d77 50%, #0d9488 100%)',
      color: 'white',
      padding: '20px 28px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
    },
    titleBlock: {
      background: '#f8fbfb',
      borderBottom: '2px solid #e2ecee',
      padding: '16px 28px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionHeader: {
      background: '#0e4b5a',
      color: 'white',
      padding: '10px 20px',
      fontSize: '13px',
      fontWeight: 'bold',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    th: {
      padding: '9px 12px',
      background: '#e8f0f1',
      color: '#1e3a40',
      fontWeight: 'bold',
      fontSize: '11.5px',
      textAlign: 'right' as const,
      borderBottom: '2px solid #c8d8da',
    },
    td: {
      padding: '9px 12px',
      fontSize: '11px',
      borderBottom: '1px solid #eef3f4',
      verticalAlign: 'top' as const,
    },
    sigBox: {
      flex: 1,
      padding: '20px 16px',
      textAlign: 'center' as const,
      borderLeft: '1px solid #e2e8f0',
    },
    sigLine: {
      borderBottom: '1.5px solid #334155',
      height: '44px',
      margin: '12px auto 10px',
    },
  }

  return (
    <main style={S.page} className="no-print-bg">

      {/* ── Toolbar (screen only) ── */}
      <div style={S.toolbar} className="no-print">
        <Link
          href="/dashboard/missions"
          style={{ color: '#006d77', fontWeight: 'bold', fontSize: '13.5px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          ← العودة للمأموريات
        </Link>
        <PrintButton />
      </div>

      {/* ── Print Sheet ── */}
      <article style={S.sheet}>

        {/* Ministry Header */}
        <header style={S.govHeader}>
          <div>
            <div style={{ fontSize: '10.5px', opacity: 0.85, letterSpacing: '0.5px' }}>جمهورية مصر العربية</div>
            <div style={{ fontSize: '11px', opacity: 0.95, fontWeight: 'bold' }}>وزارة الصحة والسكان</div>
            <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '4px' }}>{sectorName}</div>
            <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>{issuingOrg}</div>
          </div>
          <div style={{
            background: 'white',
            borderRadius: '50%',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
            border: '2px solid rgba(255,255,255,0.4)',
            width: '68px',
            height: '68px',
            flexShrink: 0
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="شعار وزارة الصحة والسكان"
              src="/mohp-logo.png"
              style={{ height: '56px', width: '56px', objectFit: 'contain' }}
            />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>نظام حوكمة المأمورية الميدانية</div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>{isCompleted ? 'تقرير تفتيش ميداني معتمد' : 'وثيقة تكليف ميداني'}</div>
            <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '4px' }}>{displaySerialNumber}</div>
          </div>
        </header>

        {/* Title Block */}
        <div style={S.titleBlock}>
          <div>
            <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '2px' }}>
              {isCompleted ? 'تقرير نتائج المرور والتفتيش الميداني' : 'تكليف مأمورية ميدانية'}
            </div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#0e4b5a' }}>{displaySerialNumber}</h1>
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 14px', textAlign: 'center', fontSize: '11px' }}>
              <div style={{ color: '#64748b' }}>تاريخ المأمورية</div>
              <div style={{ fontWeight: '900', color: '#0369a1', marginTop: '2px' }}>{formatDate(mission.scheduled_date)}</div>
            </div>
            <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '8px 14px', textAlign: 'center', fontSize: '11px' }}>
              <div style={{ color: '#64748b' }}>الأولوية</div>
              <div style={{ fontWeight: '900', color: '#b45309', marginTop: '2px' }}>{priorityText(mission.priority)}</div>
            </div>
            <div style={{ background: isCompleted ? '#f0fdf4' : '#f8fafc', border: `1px solid ${isCompleted ? '#86efac' : '#e2e8f0'}`, borderRadius: '8px', padding: '8px 14px', textAlign: 'center', fontSize: '11px' }}>
              <div style={{ color: '#64748b' }}>الحالة</div>
              <div style={{ fontWeight: '900', color: isCompleted ? '#15803d' : '#334155', marginTop: '2px' }}>{statusText(mission.status)}</div>
            </div>
          </div>
        </div>

        {/* Section: Mission Metadata */}
        <section style={{ padding: '16px 28px', borderBottom: '1px solid #e8eef0' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '900', color: '#0e4b5a', borderBottom: '2px solid #0e4b5a', paddingBottom: '6px', display: 'inline-block' }}>
            📋 بيانات التكليف والمنشأة المستهدفة
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px 24px' }}>
            {[
              ['الموظف المكلف', assignedUser?.full_name ?? 'غير محدد'],
              ['الوظيفة / الإدارة', assignedUser?.job_title ?? assignedUser?.department ?? 'غير محدد'],
              ['الإدارة المختصة', assignedDept],
              ['مصدر التكليف', issuingOrg],
              ['الوجهة المستهدفة', destinationName],
              ['نوع المنشأة', facilityType],
              ['الإدارة الصحية', healthAdmin],
              ['العنوان / الموقع', address],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                <span style={{ color: '#64748b', minWidth: '120px', flexShrink: 0 }}>{label}:</span>
                <strong style={{ color: '#1e293b' }}>{value}</strong>
              </div>
            ))}

            {/* GPS Verification Status Row */}
            <div style={{ display: 'flex', gap: '8px', fontSize: '12px', alignItems: 'center' }}>
              <span style={{ color: '#64748b', minWidth: '120px', flexShrink: 0 }}>التوثيق الميداني (GPS):</span>
              {mission.gps_verified || mission.checkin_lat ? (
                mission.gps_verified !== false ? (
                  <span style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '900', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    🟢 داخل نطاق المنشأة (موثق جغرافياً ✅)
                  </span>
                ) : (
                  <span style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: '900', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    ⚠️ خارج نطاق المنشأة المقررة
                  </span>
                )
              ) : (
                <span style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>
                  ⚪ لم يُسجل إحداثيات GPS
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Section: Purpose */}
        <section style={{ padding: '14px 28px', borderBottom: '1px solid #e8eef0', background: '#fcfdfd' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '12.5px', fontWeight: '900', color: '#0e4b5a' }}>🎯 الغرض من المأمورية</h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: '1.7' }}>
            {mission.visit_purpose || 'متابعة وتقييم مستوى جودة الخدمات الصحية المقدمة للمواطنين وتطبيق المعايير الرقابية.'}
          </p>
        </section>

        {/* ══ INSPECTION RESULTS (Completed or Evaluated missions) ══ */}
        {rawResults.length > 0 ? (
          <>
            {/* Score Summary */}
            <section style={{ padding: '16px 28px', borderBottom: '1px solid #e8eef0' }} className="print-no-break">
              <h2 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: '900', color: '#0e4b5a', borderBottom: '2px solid #0e4b5a', paddingBottom: '6px', display: 'inline-block' }}>
                📊 ملخص نتائج التفتيش الميداني
              </h2>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Big Score */}
                <div style={{ background: scoreBg, border: `3px solid ${scoreBorder}`, borderRadius: '12px', padding: '16px 24px', textAlign: 'center', minWidth: '120px' }}>
                  <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>نسبة الامتثال</div>
                  <div style={{ fontSize: '36px', fontWeight: '900', color: scoreColor, lineHeight: '1' }}>{complianceScore}%</div>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '4px', color: scoreColor }}>
                    {complianceScore >= 85 ? '🟢 مطابق' : complianceScore >= 65 ? '🟡 مقبول' : '🔴 غير مطابق'}
                  </div>
                </div>
                {/* Counts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', flex: 1 }}>
                  {[
                    { label: 'مطابق', value: yesCount, color: '#15803d', bg: '#f0fdf4' },
                    { label: 'مطابق جزئياً', value: partialCount, color: '#b45309', bg: '#fffbeb' },
                    { label: 'مخالفة', value: noCount, color: '#b91c1c', bg: '#fef2f2' },
                    { label: 'لا ينطبق', value: naCount, color: '#6b7280', bg: '#f9fafb' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} style={{ background: bg, borderRadius: '8px', padding: '10px', textAlign: 'center', fontSize: '11px' }}>
                      <div style={{ color: '#64748b', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontSize: '22px', fontWeight: '900', color }}>{value}</div>
                      <div style={{ color: '#94a3b8', fontSize: '10px' }}>بند</div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Detailed Checklist per section */}
            {evaluatedSections.map((section, sIdx) => (
              <section key={section.id} style={{ borderBottom: '1px solid #e8eef0' }} className={sIdx > 0 ? 'print-page-break' : ''}>
                <div style={S.sectionHeader}>
                  <span>{section.name}</span>
                  <span style={{ fontSize: '11px', opacity: 0.9 }}>({section.items.length} بنداً)</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, width: '32px', textAlign: 'center' }}>#</th>
                      <th style={S.th}>المعيار الرقابي</th>
                      <th style={{ ...S.th, width: '120px', textAlign: 'center' }}>نتيجة التفتيش</th>
                      <th style={{ ...S.th, width: '180px' }}>ملاحظات المفتش</th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.items.map((item, iIdx) => {
                      const disp = answerLabel(item.answer)
                      return (
                        <tr key={item.id} style={{ background: item.isViolation ? '#fff5f5' : iIdx % 2 === 0 ? '#fafcfc' : 'white' }}>
                          <td style={{ ...S.td, textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>{iIdx + 1}</td>
                          <td style={{ ...S.td, color: '#1e293b', lineHeight: '1.6' }}>
                            {item.text}
                          </td>
                          <td style={{ ...S.td, textAlign: 'center' }}>
                            <span style={{ display: 'inline-block', padding: '3px 8px', borderRadius: '5px', background: disp.bg, color: disp.color, fontWeight: 'bold', fontSize: '10.5px' }}>
                              {disp.text}
                            </span>
                          </td>
                          <td style={{ ...S.td, color: '#475569' }}>
                            {item.notes || <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </>
        ) : (
          <section style={{ padding: '20px 28px', borderBottom: '1px solid #e8eef0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
            ⚠️ لم يتم تسجيل نتائج تفتيش لهذه المأمورية بعد.
          </section>
        )}

        {/* Execution Notes & Recommendations */}
        {(recommendationsOnly || executionNotesOnly) && (
          <section style={{ padding: '16px 28px', borderBottom: '1px solid #e8eef0', background: '#fffef9' }}>
            {recommendationsOnly && (
              <div style={{ marginBottom: executionNotesOnly ? '12px' : 0 }}>
                <h2 style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '900', color: '#006d77' }}>
                  📋 توصيات وقرارات المأمورية المعتمدة
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#1e293b', lineHeight: '1.8', whiteSpace: 'pre-wrap', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: '8px' }}>
                  {recommendationsOnly}
                </p>
              </div>
            )}

            {executionNotesOnly && (
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: '12.5px', fontWeight: '900', color: '#b45309' }}>
                  📝 ملاحظات التنفيذ الميداني
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: '#334155', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
                  {executionNotesOnly}
                </p>
              </div>
            )}
          </section>
        )}

        {/* ══ SIGNATURE BLOCK ══ */}
        <section className="print-signatures print-no-break" style={{ padding: '20px 28px', borderBottom: '1px solid #e8eef0' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: '900', color: '#0e4b5a', textAlign: 'center' }}>
            ✍️ بيانات التوقيع والاعتماد
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', border: '2px solid #0e4b5a', borderRadius: '10px', overflow: 'hidden' }}>

            {/* Inspector */}
            <div style={S.sigBox}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0e4b5a' }}>المفتش المنفذ للمرور</div>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', marginTop: '4px' }}>{assignedUser?.full_name ?? 'غير محدد'}</div>
              <span style={{ display: 'inline-block', marginTop: '4px', fontSize: '9.5px', background: '#f1f8e9', color: '#2e7d32', border: '1px dashed #2e7d32', borderRadius: '4px', padding: '2px 6px' }}>
                🛡️ تم التوقيع رقمياً
              </span>
              <div style={S.sigLine}></div>
              <div style={{ fontSize: '9.5px', color: '#64748b' }}>الاسم / التوقيع</div>
              <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '4px' }}>التاريخ: {formatDate(mission.completed_at || mission.updated_at)}</div>
            </div>

            {/* Director */}
            <div style={{ ...S.sigBox }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0e4b5a' }}>مدير الإدارة المختصة</div>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', marginTop: '4px' }}>&nbsp;</div>
              {signatureImage ? (
                <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={signatureImage} alt="توقيع المدير" style={{ height: '36px', maxWidth: '120px', objectFit: 'contain' }} />
                  <span style={{ fontSize: '9px', color: '#b45309', fontWeight: 'bold' }}>⭐ معتمد إلكترونياً</span>
                </div>
              ) : (
                <div style={S.sigLine}></div>
              )}
              <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: signatureImage ? '4px' : '0' }}>الاسم / التوقيع</div>
              <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '4px' }}>التاريخ: .........................</div>
            </div>

            {/* Issuing Authority */}
            <div style={{ ...S.sigBox, borderLeft: 'none' }}>
              <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0e4b5a' }}>اعتماد جهة الإصدار</div>
              <div style={{ fontSize: '12px', fontWeight: '900', color: '#1e293b', marginTop: '4px' }}>{issuingOrg}</div>
              <div style={S.sigLine}></div>
              <div style={{ fontSize: '9.5px', color: '#64748b' }}>الاسم / التوقيع</div>
              <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '4px' }}>الختم الرسمي: ................</div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer style={{ background: '#f0f7f8', borderTop: '1px solid #dce8e9', padding: '12px 28px', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
          <span>تم إنشاء هذا التقرير من نظام حوكمة المأمورية الميدانية بتاريخ {formatDate(mission.created_at)}</span>
          <span>هذا المستند للاستخدام الرسمي داخل منظومة وزارة الصحة والسكان.</span>
        </footer>

      </article>

      {/* Screen-only bottom padding */}
      <div style={{ height: '40px' }} className="no-print"></div>

    </main>
  )
}
