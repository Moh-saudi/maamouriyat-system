// ══════════════════════════════════════════════════════════════
// مكتبة الهيكل التنظيمي — organizations
// جلب وكاشينغ بيانات organizations من Supabase
// ══════════════════════════════════════════════════════════════

import { createBrowserSupabaseClient } from '@/lib/supabase/client'

export type Organization = {
  id: string
  name: string
  level: number
  level_label: string
  parent_id: string | null
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  code: string | null
  is_active: boolean
}

export type UserScope = {
  org_id: string
  org_level: number
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  can_inspect: boolean
  /** هل يرى كل المحافظات؟ (مستوى 1-4) */
  hasNationalScope: boolean
  /** هل يرى كل محافظة واحدة؟ (مستوى 5) */
  hasGovernorateScope: boolean
  /** هل يرى إدارة صحية واحدة فقط؟ (مستوى 6) */
  hasHealthAdminScope: boolean
}

// ── كاش بسيط في الذاكرة (يُعاد تحميله كل 5 دقائق)
let _cache: Organization[] | null = null
let _cacheTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000

async function fetchAll(): Promise<Organization[]> {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache

  const supabase = createBrowserSupabaseClient()
  if (!supabase) return []

  const { data, error } = await supabase
    .from('organizations')
    .select('id,name,level,level_label,parent_id,sector_id,governorate,health_admin,code,is_active')
    .eq('is_active', true)
    .order('level')
    .order('name')

  if (error || !data) return []
  _cache = data
  _cacheTime = now
  return data
}

/** جلب كل الجهات التنظيمية */
export async function getOrganizations(): Promise<Organization[]> {
  return fetchAll()
}

/** جلب جهات بمستوى معين */
export async function getOrganizationsByLevel(level: number): Promise<Organization[]> {
  const all = await fetchAll()
  return all.filter((o) => o.level === level)
}

/** جلب القطاعات المركزية (مستوى 2) */
export async function getSectors(): Promise<Organization[]> {
  return getOrganizationsByLevel(2)
}

/** جلب المديريات (مستوى 5) */
export async function getDirectorates(sectorId?: string): Promise<Organization[]> {
  const all = await fetchAll()
  return all.filter(
    (o) => o.level === 5 && (sectorId ? o.sector_id === sectorId : true)
  )
}

/** جلب الإدارات الصحية (مستوى 6) حسب المحافظة والقطاع */
export async function getHealthAdmins(params: {
  governorate?: string
  sectorId?: string
}): Promise<Organization[]> {
  const all = await fetchAll()
  return all.filter(
    (o) =>
      o.level === 6 &&
      (params.governorate ? o.governorate === params.governorate : true) &&
      (params.sectorId ? o.sector_id === params.sectorId : true)
  )
}

/** جلب الأبناء المباشرين لجهة معينة */
export async function getDirectChildren(parentId: string): Promise<Organization[]> {
  const all = await fetchAll()
  return all.filter((o) => o.parent_id === parentId)
}

/** جلب جهة بالـ ID */
export async function getOrganizationById(id: string): Promise<Organization | null> {
  const all = await fetchAll()
  return all.find((o) => o.id === id) ?? null
}

/** جلب جهات قابلة للاختيار عند إنشاء مستخدم جديد
 *  يُعيد الجهات المسموح للمُشغِّل بإنشاء مستخدمين فيها
 */
export async function getAllowedOrgsForUserCreation(
  creatorOrgLevel: number,
  creatorSectorId: string | null
): Promise<Organization[]> {
  const all = await fetchAll()
  if (creatorOrgLevel === 1) return all               // الوزارة: كل الجهات
  if (creatorOrgLevel === 2) {
    // القطاع: جهاته وما تحتها
    return all.filter((o) => o.sector_id === creatorSectorId || o.id === creatorSectorId)
  }
  // المستويات الأعلى: لا تنشئ مستخدمين عبر هذه الدالة
  return []
}

/**
 * بناء المسار الهرمي لجهة معينة (Breadcrumb)
 * مثال: وزارة → قطاع الرعاية الأساسية → مديرية أسيوط → إدارة ابنوب
 */
export async function getOrgBreadcrumb(orgId: string): Promise<Organization[]> {
  const all = await fetchAll()
  const map = new Map(all.map((o) => [o.id, o]))
  const path: Organization[] = []
  let current = map.get(orgId)
  while (current) {
    path.unshift(current)
    current = current.parent_id ? map.get(current.parent_id) : undefined
  }
  return path
}

/** تحديد نطاق المستخدم من org_level */
export function resolveUserScope(user: {
  org_id: string
  org_level: number
  sector_id: string | null
  governorate: string | null
  health_admin: string | null
  can_inspect: boolean
}): UserScope {
  return {
    ...user,
    hasNationalScope:     user.org_level <= 4,
    hasGovernorateScope:  user.org_level === 5,
    hasHealthAdminScope:  user.org_level === 6,
  }
}

/** إبطال الكاش (مفيد بعد إضافة جهة جديدة) */
export function invalidateOrgCache(): void {
  _cache = null
  _cacheTime = 0
}
