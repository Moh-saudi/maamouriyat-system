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
  organization_type_code: string
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
  /** توافق قديم فقط؛ لا يُستخدم لتفويض V2. */
  hasNationalScope: boolean
  /** مؤشر سياق جغرافي قديم. */
  hasGovernorateScope: boolean
  /** مؤشر سياق إدارة صحية قديم. */
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
    .select('id,name,level,level_label,organization_type_code,parent_id,sector_id,governorate,health_admin,code,is_active')
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

/** جلب القطاعات المركزية حسب نوع الجهة الحقيقي. */
export async function getSectors(): Promise<Organization[]> {
  const all = await fetchAll()
  return all.filter((o) => o.organization_type_code === 'sector')
}

/** جلب مديريات الشؤون الصحية حسب نوع الجهة الحقيقي. */
export async function getDirectorates(): Promise<Organization[]> {
  const all = await fetchAll()
  return all.filter(
    (o) => o.organization_type_code === 'health_directorate'
  )
}

/** جلب الإدارات الصحية الجغرافية، وليس كل جهة تقع في نفس العمق. */
export async function getHealthAdmins(params: {
  governorate?: string
}): Promise<Organization[]> {
  const all = await fetchAll()
  return all.filter(
    (o) =>
      o.organization_type_code === 'health_administration' &&
      (params.governorate ? o.governorate === params.governorate : true)
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

  // Legacy helper only. V2 creation is authorized server-side by dynamic RBAC.
  if (creatorOrgLevel === 1) return all

  if (!creatorSectorId) return []

  const sector = all.find(
    (organization) =>
      organization.id === creatorSectorId &&
      organization.organization_type_code === 'sector'
  )

  if (!sector) return []

  return all.filter(
    (organization) =>
      organization.id === sector.id ||
      organization.sector_id === sector.id
  )
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

/**
 * توافق قديم فقط. لا تستخدم هذه الدالة كأساس لصلاحيات V2.
 * الصلاحيات الفعلية تُحسب من RBAC والنطاقات على الخادم.
 */
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
    hasNationalScope: user.org_level === 1,
    hasGovernorateScope: Boolean(user.governorate && !user.health_admin),
    hasHealthAdminScope: Boolean(user.health_admin),
  }
}

/** إبطال الكاش (مفيد بعد إضافة جهة جديدة) */
export function invalidateOrgCache(): void {
  _cache = null
  _cacheTime = 0
}
