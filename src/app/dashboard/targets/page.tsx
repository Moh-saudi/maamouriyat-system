'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardShell } from '@/app/system-ui'
import {
  Target, Plus, Calendar, TrendingUp, CheckCircle2, Clock,
  AlertCircle, Trash2, Edit2, BarChart3, Users, Building2,
  MapPin, Search, Filter, X, ChevronDown, Award, Layers,
  Check, Hospital, ChevronUp
} from 'lucide-react'
import { formatFacilityType } from '@/lib/facility-types'

// ─── Types ────────────────────────────────────────────────────────────────────
type ScopeLevel = 'ministry' | 'sector' | 'governorate' | 'health_admin' | 'user'
type PeriodType  = 'monthly' | 'quarterly' | 'custom'

type TargetFacility = {
  id: string
  name: string
  governorate?: string
  facility_type?: string
  health_admin?: string
  is_visited?: boolean
  visited_at?: string
  mission_id?: string
}

type MissionTarget = {
  id: string
  title: string
  period_type: PeriodType
  period_label: string
  start_date: string
  end_date: string
  target_missions: number
  scope_level: ScopeLevel
  scope_name: string
  scope_id?: string
  target_type?: 'aggregate' | 'specific_facilities'
  target_facilities?: TargetFacility[]
  assigned_user_id?: string
  assigned_user_name?: string
  sector_id?: string
  sector_name?: string
  notes?: string
  status: 'active' | 'completed' | 'cancelled'
  created_by_name?: string
  created_at: string
  executed_missions?: number
  completion_rate?: number
}

type User = { id: string; full_name: string; job_title: string; level: number; org_level: number; sector_id?: string }
type Facility = { id: string; name: string; facility_type: string; governorate: string; health_admin?: string; sector_id?: string }

// ─── Constants ────────────────────────────────────────────────────────────────
const SCOPE_LABELS: Record<ScopeLevel, { label: string; icon: string; color: string; bg: string }> = {
  ministry:    { label: 'وزارة',         icon: '🏛️', color: '#7c3aed', bg: '#f5f3ff' },
  sector:      { label: 'قطاع',          icon: '🏢', color: '#0284c7', bg: '#f0f9ff' },
  governorate: { label: 'محافظة',        icon: '📍', color: '#0d9488', bg: '#f0fdfa' },
  health_admin:{ label: 'إدارة صحية',    icon: '🏥', color: '#16a34a', bg: '#f0fdf4' },
  user:        { label: 'مستهدف مستخدم', icon: '👤', color: '#d97706', bg: '#fffbeb' },
}

const EGYPT_GOVS = [
  'القاهرة','الجيزة','الإسكندرية','الدقهلية','البحيرة','الفيوم','الغربية','الإسماعيلية',
  'المنوفية','المنيا','القليوبية','الوادي الجديد','السويس','أسوان','أسيوط','بني سويف',
  'بورسعيد','دمياط','الشرقية','جنوب سيناء','كفر الشيخ','مطروح','الأقصر','قنا',
  'شمال سيناء','سوهاج','البحر الأحمر'
]

function fmtDate(s: string) {
  if (!s) return ''
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s))
}

function getStatus(target: MissionTarget): { label: string; color: string; bg: string } {
  const rate = target.completion_rate ?? 0
  const now = new Date()
  const end = new Date(target.end_date)
  if (end < now && rate < 100) return { label: 'منتهية المدة', color: '#b91c1c', bg: '#fef2f2' }
  if (rate >= 100) return { label: 'مكتمل ✅', color: '#15803d', bg: '#f0fdf4' }
  if (rate >= 70)  return { label: 'في المسار 🟢', color: '#15803d', bg: '#f0fdf4' }
  if (rate >= 40)  return { label: 'تحت المتابعة 🟡', color: '#b45309', bg: '#fffbeb' }
  return { label: 'يحتاج تدخل 🔴', color: '#b91c1c', bg: '#fef2f2' }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TargetsPage() {
  const [targets, setTargets]           = useState<MissionTarget[]>([])
  const [users, setUsers]               = useState<User[]>([])
  const [facilities, setFacilities]     = useState<Facility[]>([])
  const [callerLevel, setCallerLevel]   = useState(1)
  const [loading, setLoading]           = useState(true)
  const [showModal, setShowModal]       = useState(false)
  const [editTarget, setEditTarget]     = useState<MissionTarget | null>(null)
  const [saving, setSaving]             = useState(false)
  const [searchQ, setSearchQ]           = useState('')
  const [filterScope, setFilterScope]   = useState<ScopeLevel | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all')
  const [filterType, setFilterType]     = useState<'all' | 'aggregate' | 'specific_facilities'>('all')
  const [expandedTargetId, setExpandedTargetId] = useState<string | null>(null)

  // Modal filters & search state
  const [userSearch, setUserSearch]         = useState('')
  const [facSearch, setFacSearch]           = useState('')
  const [facGovFilter, setFacGovFilter]     = useState('all')
  const [facAdminFilter, setFacAdminFilter] = useState('all')

  // Form state
  const blank = {
    title: '',
    period_type: 'monthly' as PeriodType,
    period_label: '',
    start_date: new Date().toISOString().slice(0, 7) + '-01',
    end_date: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10),
    target_missions: 15,
    scope_level: 'user' as ScopeLevel,
    scope_name: '',
    target_type: 'aggregate' as 'aggregate' | 'specific_facilities',
    target_facilities: [] as TargetFacility[],
    assigned_user_id: '',
    assigned_user_name: '',
    sector_id: '',
    sector_name: '',
    notes: ''
  }
  const [form, setForm] = useState(blank)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/mission-targets')
      if (res.ok) {
        const d = await res.json()
        setTargets(d.targets || [])
        setUsers(d.users || [])
        setFacilities(d.facilities || [])
        setCallerLevel(d.callerLevel ?? 1)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const method = editTarget ? 'PATCH' : 'POST'
      const body = editTarget ? { id: editTarget.id, ...form } : form
      const res = await fetch('/api/admin/mission-targets', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        setShowModal(false)
        setEditTarget(null)
        setForm(blank)
        await load()
      } else {
        const err = await res.json()
        alert(err.error || 'حدث خطأ أثناء حفظ المستهدف')
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل تريد حذف هذا المستهدف؟')) return
    await fetch(`/api/admin/mission-targets?id=${id}`, { method: 'DELETE' })
    setTargets(prev => prev.filter(t => t.id !== id))
  }

  const openEdit = (t: MissionTarget) => {
    setEditTarget(t)
    setForm({
      title: t.title,
      period_type: t.period_type,
      period_label: t.period_label,
      start_date: t.start_date,
      end_date: t.end_date,
      target_missions: t.target_missions,
      scope_level: t.scope_level,
      scope_name: t.scope_name,
      target_type: t.target_type || 'aggregate',
      target_facilities: t.target_facilities || [],
      assigned_user_id: t.assigned_user_id || '',
      assigned_user_name: t.assigned_user_name || '',
      sector_id: t.sector_id || '',
      sector_name: t.sector_name || '',
      notes: t.notes || ''
    })
    setUserSearch('')
    setFacSearch('')
    setFacGovFilter('all')
    setFacAdminFilter('all')
    setShowModal(true)
  }

  // Summary metrics
  const summary = useMemo(() => {
    const totalTarget   = targets.reduce((s, t) => s + t.target_missions, 0)
    const totalExecuted = targets.reduce((s, t) => s + (t.executed_missions ?? 0), 0)
    const overallRate   = totalTarget > 0 ? Math.min(100, Math.round((totalExecuted / totalTarget) * 100)) : 0
    const activeCount   = targets.filter(t => t.status === 'active').length
    const specificCount = targets.filter(t => t.target_type === 'specific_facilities').length
    return { totalTarget, totalExecuted, overallRate, activeCount, specificCount, total: targets.length }
  }, [targets])

  // Filtered targets
  const filtered = useMemo(() => {
    return targets.filter(t => {
      const matchQ   = !searchQ || t.title.includes(searchQ) || (t.scope_name || '').includes(searchQ) || (t.assigned_user_name || '').includes(searchQ)
      const matchSco = filterScope === 'all' || t.scope_level === filterScope
      const matchSt  = filterStatus === 'all' || (filterStatus === 'active' ? t.status === 'active' : (t.completion_rate ?? 0) >= 100)
      const matchTyp = filterType === 'all' || (t.target_type || 'aggregate') === filterType
      return matchQ && matchSco && matchSt && matchTyp
    })
  }, [targets, searchQ, filterScope, filterStatus, filterType])

  // Filtered subordinates for modal employee search
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users
    const q = userSearch.trim().toLowerCase()
    return users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.job_title || '').toLowerCase().includes(q)
    )
  }, [users, userSearch])

  // Available health administrations for selected governorate
  const availableHealthAdmins = useMemo(() => {
    const set = new Set<string>()
    facilities.forEach(f => {
      if (f.health_admin && f.health_admin.trim()) {
        if (facGovFilter === 'all' || f.governorate === facGovFilter) {
          set.add(f.health_admin.trim())
        }
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'))
  }, [facilities, facGovFilter])

  // Filtered facilities for selector modal (Name + Governorate + Health Administration)
  const availableFacilities = useMemo(() => {
    return facilities.filter(f => {
      const q = facSearch.trim().toLowerCase()
      const matchName = !q ||
        (f.name || '').toLowerCase().includes(q) ||
        (f.governorate || '').toLowerCase().includes(q) ||
        (f.health_admin || '').toLowerCase().includes(q)
      const matchGov   = facGovFilter === 'all' || f.governorate === facGovFilter
      const matchAdmin = facAdminFilter === 'all' || (f.health_admin && f.health_admin.trim() === facAdminFilter)
      return matchName && matchGov && matchAdmin
    })
  }, [facilities, facSearch, facGovFilter, facAdminFilter])

  // Facilities already targeted for this user in overlapping periods
  const userPriorFacilitiesInPeriod = useMemo(() => {
    if (!form.assigned_user_id) return new Map<string, { targetTitle: string; period: string; isVisited?: boolean }>()
    const map = new Map<string, { targetTitle: string; period: string; isVisited?: boolean }>()

    for (const t of targets) {
      if (editTarget && t.id === editTarget.id) continue
      if (t.assigned_user_id === form.assigned_user_id) {
        const tStart = t.start_date
        const tEnd   = t.end_date
        const fStart = form.start_date
        const fEnd   = form.end_date

        const hasOverlap = (tStart && tEnd && fStart && fEnd)
          ? (tStart <= fEnd && tEnd >= fStart)
          : (t.period_label && form.period_label && t.period_label === form.period_label)

        if (hasOverlap && Array.isArray(t.target_facilities)) {
          for (const fac of t.target_facilities) {
            if (fac.id && !map.has(fac.id)) {
              map.set(fac.id, {
                targetTitle: t.title,
                period: t.period_label || `${tStart} إلى ${tEnd}`,
                isVisited: fac.is_visited
              })
            }
          }
        }
      }
    }
    return map
  }, [targets, form.assigned_user_id, form.start_date, form.end_date, form.period_label, editTarget])

  const canManage = callerLevel <= 6

  // Facility Selection helpers
  const toggleFacility = (fac: Facility) => {
    setForm(prev => {
      const exists = prev.target_facilities.some(f => f.id === fac.id)
      let updated: TargetFacility[]
      if (exists) {
        updated = prev.target_facilities.filter(f => f.id !== fac.id)
      } else {
        updated = [...prev.target_facilities, {
          id: fac.id,
          name: fac.name,
          governorate: fac.governorate,
          facility_type: fac.facility_type,
          health_admin: fac.health_admin,
          is_visited: false
        }]
      }
      return {
        ...prev,
        target_facilities: updated,
        target_missions: updated.length > 0 ? updated.length : prev.target_missions
      }
    })
  }

  const handlePeriodType = (pt: PeriodType) => {
    const now = new Date()
    let start = '', end = ''
    if (pt === 'monthly') {
      start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
      end   = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10)
    } else if (pt === 'quarterly') {
      const q = Math.floor(now.getMonth() / 3)
      start = new Date(now.getFullYear(), q*3, 1).toISOString().slice(0,10)
      end   = new Date(now.getFullYear(), q*3+3, 0).toISOString().slice(0,10)
    }
    setForm(p => ({ ...p, period_type: pt, start_date: start || p.start_date, end_date: end || p.end_date }))
  }

  const rateColor = (r: number) => r >= 85 ? '#15803d' : r >= 60 ? '#b45309' : '#b91c1c'
  const rateBg    = (r: number) => r >= 85 ? '#f0fdf4' : r >= 60 ? '#fffbeb' : '#fef2f2'

  return (
    <DashboardShell view="targets">
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 24px', direction: 'rtl', fontFamily: "'Tajawal', sans-serif" }}>

        {/* ── HEADER ── */}
        <div style={{
          background: 'linear-gradient(135deg, #0a2540 0%, #006d77 60%, #0d9488 100%)',
          borderRadius: '16px', padding: '24px 28px', color: 'white',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '16px', marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(0,109,119,0.25)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px', borderRadius: '10px' }}>
                <Target size={22} />
              </div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>مستهدفات المرور والتفتيش الميداني</h1>
            </div>
            <p style={{ margin: 0, fontSize: '13px', opacity: 0.85 }}>
              تحديد ومتابعة مستهدفات كل مستخدم (مستهدف عام مجمع أو تحديد منشآت صحية مستهدفة بالاسم)
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href="/dashboard/targets/report"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '10px 18px', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <BarChart3 size={16} /> التقارير التفصيلية
            </a>
            {canManage && (
              <button
                onClick={() => {
                  setEditTarget(null)
                  setForm(blank)
                  setUserSearch('')
                  setFacSearch('')
                  setFacGovFilter('all')
                  setFacAdminFilter('all')
                  setShowModal(true)
                }}
                style={{ background: 'white', color: '#006d77', border: 0, padding: '10px 20px', borderRadius: '10px', fontSize: '13px', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
              >
                <Plus size={16} /> إضافة مستهدف لمستخدم
              </button>
            )}
          </div>
        </div>

        {/* ── SUMMARY METRICS CARDS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'إجمالي المستهدف', value: summary.totalTarget, unit: 'مرور', icon: <Target size={20} />, color: '#0284c7', soft: '#f0f9ff' },
            { label: 'المنفذ فعلياً',   value: summary.totalExecuted, unit: 'مرور', icon: <CheckCircle2 size={20} />, color: '#16a34a', soft: '#f0fdf4' },
            { label: 'نسبة الإنجاز',   value: `${summary.overallRate}%`, unit: '', icon: <TrendingUp size={20} />, color: rateColor(summary.overallRate), soft: rateBg(summary.overallRate) },
            { label: 'مستهدفات نشطة',   value: summary.activeCount, unit: 'خطة', icon: <Clock size={20} />, color: '#7c3aed', soft: '#f5f3ff' },
            { label: 'محددة بالمنشآت', value: summary.specificCount, unit: 'خطة نوعية', icon: <Hospital size={20} />, color: '#0d9488', soft: '#f0fdfa' },
          ].map(({ label, value, unit, icon, color, soft }) => (
            <div key={label} style={{ background: soft, border: `1.5px solid ${color}30`, borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              <div style={{ color, marginBottom: '6px' }}>{icon}</div>
              <div style={{ fontSize: '28px', fontWeight: '900', color, lineHeight: '1' }}>{value}</div>
              {unit && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{unit}</div>}
              <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', fontWeight: 'bold' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── TOOLBAR & FILTERS ── */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
          {/* Search */}
          <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder="بحث بالخطة، المفتش، المحافظة أو الجهة..."
              style={{ width: '100%', padding: '9px 36px 9px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
            />
          </div>

          {/* Filter Type */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>النوع:</span>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
            >
              <option value="all">كل الأنواع</option>
              <option value="aggregate">📊 مستهدف عام (مجمع)</option>
              <option value="specific_facilities">🏥 محدد بالمنشآت</option>
            </select>
          </div>

          {/* Filter Scope */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>المستوى:</span>
            <select
              value={filterScope}
              onChange={e => setFilterScope(e.target.value as any)}
              style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
            >
              <option value="all">كل المستويات</option>
              {Object.entries(SCOPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>الحالة:</span>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as any)}
              style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشطة</option>
              <option value="completed">مكتملة (100%)</option>
            </select>
          </div>
        </div>

        {/* ── TARGETS LIST ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#64748b' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
            جاري تحميل المستهدفات وبيانات المرور...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <Target size={48} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', color: '#1e293b' }}>لا توجد مستهدفات مسجلة تطابق البحث</h3>
            <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px' }}>يمكنك إضافة مستهدف جديد لمستخدم أو منشآت عبر زر الإضافة</p>
            {canManage && (
              <button
                onClick={() => { setEditTarget(null); setForm(blank); setShowModal(true) }}
                style={{ background: '#006d77', color: 'white', border: 0, padding: '9px 20px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}
              >
                + إضافة مستهدف جديد
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '14px' }}>
            {filtered.map((t) => {
              const rate  = t.completion_rate ?? 0
              const sc    = SCOPE_LABELS[t.scope_level] || SCOPE_LABELS.user
              const st    = getStatus(t)
              const isSpecific = t.target_type === 'specific_facilities'
              const facs = t.target_facilities || []
              const visitedFacsCount = facs.filter(f => f.is_visited).length
              const isExpanded = expandedTargetId === t.id

              return (
                <div key={t.id} style={{
                  background: 'white',
                  border: `1.5px solid ${rate >= 85 ? '#86efac' : rate >= 60 ? '#fde68a' : '#fca5a5'}50`,
                  borderRadius: '16px', padding: '20px 24px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>

                    {/* Left: Info */}
                    <div style={{ flex: 1, minWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}30`, borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 'bold' }}>
                          {sc.icon} {sc.label}
                        </span>

                        {isSpecific ? (
                          <span style={{ background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Hospital size={13} /> مستهدف نوعي ({facs.length} منشآت)
                          </span>
                        ) : (
                          <span style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Layers size={13} /> مستهدف عام مجمع
                          </span>
                        )}

                        <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.color}30`, borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 'bold' }}>
                          {st.label}
                        </span>
                      </div>

                      <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: '900', color: '#0f172a' }}>{t.title}</h3>
                      <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>📍 {t.scope_name || t.scope_level}</span>
                        {t.assigned_user_name && <span style={{ fontWeight: 'bold', color: '#0284c7' }}>👤 المفتش المكلف: {t.assigned_user_name}</span>}
                        <span>📅 {fmtDate(t.start_date)} — {fmtDate(t.end_date)}</span>
                      </div>

                      {t.notes && (
                        <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#475569', background: '#f8fafc', padding: '6px 12px', borderRadius: '6px', borderRight: '3px solid #006d77' }}>
                          📝 {t.notes}
                        </div>
                      )}
                    </div>

                    {/* Center: Big Numbers */}
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '12px', padding: '10px 18px', minWidth: '95px' }}>
                        <div style={{ fontSize: '10px', color: '#0284c7', fontWeight: 'bold' }}>المستهدف</div>
                        <div style={{ fontSize: '26px', fontWeight: '900', color: '#0284c7', lineHeight: '1.1' }}>{t.target_missions}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>{isSpecific ? 'منشأة' : 'مأمورية'}</div>
                      </div>

                      <div style={{ textAlign: 'center', background: rate >= 85 ? '#f0fdf4' : '#fffbeb', border: `1px solid ${rate >= 85 ? '#86efac' : '#fde68a'}`, borderRadius: '12px', padding: '10px 18px', minWidth: '95px' }}>
                        <div style={{ fontSize: '10px', color: rateColor(rate), fontWeight: 'bold' }}>المنفذ</div>
                        <div style={{ fontSize: '26px', fontWeight: '900', color: rateColor(rate), lineHeight: '1.1' }}>{t.executed_missions ?? 0}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>منجز</div>
                      </div>

                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>نسبة الإنجاز</div>
                        <div style={{
                          width: '64px', height: '64px', borderRadius: '50%',
                          background: `conic-gradient(${rateColor(rate)} ${rate * 3.6}deg, #e2e8f0 0deg)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                          <div style={{ width: '48px', height: '48px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '900', fontSize: '13px', color: rateColor(rate) }}>
                            {rate}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    {canManage && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEdit(t)}
                          title="تعديل"
                          style={{ background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0284c7', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          title="حذف"
                          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ background: '#f1f5f9', borderRadius: '100px', height: '8px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(100, rate)}%`, height: '100%', background: `linear-gradient(90deg, ${rateColor(rate)}, ${rateColor(rate)}dd)`, borderRadius: '100px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>

                  {/* Specific Facilities Checklist Expandable Section */}
                  {isSpecific && facs.length > 0 && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px dashed #e2e8f0' }}>
                      <div
                        onClick={() => setExpandedTargetId(isExpanded ? null : t.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Hospital size={15} />
                          قائمة المنشآت المستهدفة لهذا الحساب: ({visitedFacsCount} من {facs.length} تم المرور عليها)
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isExpanded ? 'طي القائمة' : 'عرض المنشآت'}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', marginTop: '10px' }}>
                          {facs.map(f => (
                            <div key={f.id} style={{
                              background: f.is_visited ? '#f0fdf4' : '#f8fafc',
                              border: `1px solid ${f.is_visited ? '#86efac' : '#e2e8f0'}`,
                              borderRadius: '8px', padding: '8px 12px',
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ fontSize: '12.5px', fontWeight: 'bold', color: f.is_visited ? '#15803d' : '#334155' }}>
                                  {f.name}
                                </div>
                                <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                  {formatFacilityType(f.facility_type)} • {f.governorate || ''}
                                </div>
                              </div>
                              <div>
                                {f.is_visited ? (
                                  <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Check size={12} /> تم المرور
                                  </span>
                                ) : (
                                  <span style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '6px', padding: '2px 8px', fontSize: '10px', fontWeight: 'bold' }}>
                                    ⚪ قيد الانتظار
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )
            })}
          </div>
        )}

        {/* ── ADD/EDIT MODAL ── */}
        {showModal && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'white', borderRadius: '18px', width: '100%', maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ background: 'linear-gradient(135deg, #0a2540, #006d77)', color: 'white', padding: '18px 24px', borderRadius: '18px 18px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Target size={18} /> {editTarget ? 'تعديل مستهدف المستخدم' : 'إضافة مستهدف جديد لمستخدم'}
                </h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 0, color: 'white', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '16px' }}>✕</button>
              </div>

              <form onSubmit={handleSave} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* 1. Title */}
                <div>
                  <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>عنوان الخطة أو المستهدف *</label>
                  <input required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="مثال: مستهدف المرور الميداني لشهر سبتمبر 2026 — د. أحمد محمود"
                    style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }} />
                </div>

                {/* 2. Target Assignment: User / Hierarchy */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>المستوى الإداري *</label>
                    <select
                      value={form.scope_level}
                      onChange={e => {
                        const lvl = e.target.value as ScopeLevel
                        setForm(p => ({ ...p, scope_level: lvl }))
                      }}
                      style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}
                    >
                      <option value="user">👤 مستخدم / مفتش فردي (موصى به)</option>
                      <option value="health_admin">🏥 إدارة صحية</option>
                      <option value="governorate">📍 مديرية / محافظة</option>
                      {callerLevel <= 2 && <option value="sector">🏢 قطاع مركزي</option>}
                      {callerLevel === 1 && <option value="ministry">🏛️ ديوان الوزارة العام</option>}
                    </select>
                  </div>

                  {form.scope_level === 'user' ? (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151' }}>
                          اختر المستخدم المرؤوس *
                        </label>
                        {form.assigned_user_name && (
                          <span style={{ fontSize: '10.5px', color: '#0f766e', background: '#f0fdfa', padding: '1px 8px', borderRadius: '12px', border: '1px solid #99f6e4', fontWeight: '600' }}>
                            ✓ {form.assigned_user_name}
                          </span>
                        )}
                      </div>

                      {/* Search box for users */}
                      <div style={{ position: 'relative', marginBottom: '6px' }}>
                        <input
                          type="text"
                          value={userSearch}
                          onChange={e => setUserSearch(e.target.value)}
                          placeholder="🔍 ابحث عن الموظف بالاسم أو الوظيفة..."
                          style={{
                            width: '100%',
                            padding: '7px 28px 7px 10px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '7px',
                            fontSize: '12px',
                            fontFamily: 'inherit',
                            outline: 'none',
                            background: '#fafafa'
                          }}
                        />
                        {userSearch && (
                          <button
                            type="button"
                            onClick={() => setUserSearch('')}
                            style={{
                              position: 'absolute',
                              left: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              fontSize: '12px',
                              padding: '2px'
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <select
                        required
                        value={form.assigned_user_id}
                        onChange={e => {
                          const u = users.find(u => u.id === e.target.value)
                          setForm(p => ({
                            ...p,
                            assigned_user_id: e.target.value,
                            assigned_user_name: u?.full_name || '',
                            scope_name: u?.full_name || '',
                            title: p.title || `مستهدف مرور — ${u?.full_name || ''} (${p.period_label || 'سبتمبر 2026'})`
                          }))
                        }}
                        style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}
                      >
                        <option value="">
                          {filteredUsers.length === 0 ? '-- لا توجد نتائج مطابقة للبحث --' : `-- اختر مستخدماً من مرؤوسيك (${filteredUsers.length}) --`}
                        </option>
                        {/* Always retain selected user option if filtered out by search */}
                        {form.assigned_user_id && !filteredUsers.some(u => u.id === form.assigned_user_id) && (
                          <option value={form.assigned_user_id}>
                            {form.assigned_user_name} (المحدد حالياً)
                          </option>
                        )}
                        {filteredUsers.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.full_name} ({u.job_title || 'مفتش صحي'})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : form.scope_level === 'governorate' ? (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>المحافظة *</label>
                      <select
                        value={form.scope_name}
                        onChange={e => setForm(p => ({ ...p, scope_name: e.target.value }))}
                        style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}
                      >
                        {EGYPT_GOVS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>اسم الجهة المستهدفة *</label>
                      <input
                        value={form.scope_name}
                        onChange={e => setForm(p => ({ ...p, scope_name: e.target.value }))}
                        placeholder="مثال: الإدارة الصحية بأبنوب"
                        style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}
                      />
                    </div>
                  )}
                </div>

                {/* 3. Period */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>نوع الفترة *</label>
                    <select value={form.period_type} onChange={e => handlePeriodType(e.target.value as PeriodType)}
                      style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }}>
                      <option value="monthly">شهري</option>
                      <option value="quarterly">ربع سنوي</option>
                      <option value="custom">مخصص</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>تاريخ البدء *</label>
                    <input type="date" required value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                      style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>تاريخ الانتهاء *</label>
                    <input type="date" required value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                      style={{ width: '100%', padding: '9px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12.5px', fontFamily: 'inherit', outline: 'none' }} />
                  </div>
                </div>

                {/* 4. Target Mode Switch: Aggregate vs Specific Facilities */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <label style={{ fontSize: '13px', fontWeight: '900', color: '#0f172a', display: 'block', marginBottom: '10px' }}>
                    نوع وطريقة تحديد المستهدف *
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    <div
                      onClick={() => setForm(p => ({ ...p, target_type: 'aggregate' }))}
                      style={{
                        background: form.target_type === 'aggregate' ? '#f0f9ff' : 'white',
                        border: `2px solid ${form.target_type === 'aggregate' ? '#0284c7' : '#cbd5e1'}`,
                        borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: form.target_type === 'aggregate' ? '#0284c7' : '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📊 مستهدف عام (مجمع)
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        تحديد عدد مأموريات إجمالي مطلوب إنجازه (مثلاً: 15 مأمورية)
                      </div>
                    </div>

                    <div
                      onClick={() => setForm(p => ({ ...p, target_type: 'specific_facilities' }))}
                      style={{
                        background: form.target_type === 'specific_facilities' ? '#f0fdfa' : 'white',
                        border: `2px solid ${form.target_type === 'specific_facilities' ? '#0d9488' : '#cbd5e1'}`,
                        borderRadius: '10px', padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s'
                      }}
                    >
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: form.target_type === 'specific_facilities' ? '#0d9488' : '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        🏥 مستهدف محدد بالمنشآت
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                        اختيار منشآت صحية محددة بالاسم يستهدفها هذا الحساب
                      </div>
                    </div>
                  </div>

                  {/* Mode A: Aggregate Target Number Input */}
                  {form.target_type === 'aggregate' && (
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>
                        عدد المأموريات المستهدفة خلال الفترة *
                      </label>
                      <input
                        type="number" required min={1} max={9999}
                        value={form.target_missions}
                        onChange={e => setForm(p => ({ ...p, target_missions: Number(e.target.value) }))}
                        style={{ width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '20px', fontWeight: '900', textAlign: 'center', color: '#006d77', fontFamily: 'inherit', outline: 'none' }}
                      />
                    </div>
                  )}

                  {/* Mode B: Specific Facilities Selector */}
                  {form.target_type === 'specific_facilities' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#0f766e' }}>
                          المنشآت المختارة: ({form.target_facilities.length}) منشأة
                        </div>
                        {form.target_facilities.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setForm(p => ({ ...p, target_facilities: [], target_missions: 0 }))}
                            style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '11px', padding: '3px 8px', borderRadius: '6px', cursor: 'pointer' }}
                          >
                            إلغاء تحديد الكل
                          </button>
                        )}
                      </div>

                      {/* Reference Alert: If this user has facilities already targeted in overlapping period */}
                      {form.assigned_user_id && userPriorFacilitiesInPeriod.size > 0 && (
                        <div style={{
                          background: '#fffbeb',
                          border: '1px solid #fde68a',
                          borderRadius: '8px',
                          padding: '7px 12px',
                          fontSize: '11.5px',
                          color: '#92400e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <AlertCircle size={15} style={{ flexShrink: 0, color: '#d97706' }} />
                          <span>
                            تنبيه مرجعي: تم استهداف <strong>{userPriorFacilitiesInPeriod.size}</strong> منشأة مسبقاً لهذا الموظف خلال نفس الفترة (معلمة بعلامة تحذيرية ⚠️ لتفادي التكرار).
                          </span>
                        </div>
                      )}

                      {/* Filter facilities: Search + Governorate + Health Administration */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px, 1.8fr) minmax(110px, 1.1fr) minmax(110px, 1.1fr)', gap: '8px' }}>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={facSearch}
                            onChange={e => setFacSearch(e.target.value)}
                            placeholder="🔍 بحث بالاسم أو الإدارة..."
                            style={{ width: '100%', padding: '7px 24px 7px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
                          />
                          {facSearch && (
                            <button
                              type="button"
                              onClick={() => setFacSearch('')}
                              style={{ position: 'absolute', left: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '11px' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <select
                          value={facGovFilter}
                          onChange={e => {
                            setFacGovFilter(e.target.value)
                            setFacAdminFilter('all')
                          }}
                          style={{ padding: '7px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
                        >
                          <option value="all">📍 كل المحافظات</option>
                          {EGYPT_GOVS.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                        <select
                          value={facAdminFilter}
                          onChange={e => setFacAdminFilter(e.target.value)}
                          style={{ padding: '7px 8px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}
                        >
                          <option value="all">🏥 كل الإدارات ({availableHealthAdmins.length})</option>
                          {availableHealthAdmins.map(adm => (
                            <option key={adm} value={adm}>{adm}</option>
                          ))}
                        </select>
                      </div>

                      {/* Filter info indicator */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b', padding: '0 2px' }}>
                        <span>المنشآت المتاحة للفرز: <strong>{availableFacilities.length}</strong></span>
                        {facAdminFilter !== 'all' && (
                          <span style={{ color: '#0f766e', fontWeight: 'bold' }}>تصفية حسب: إدارة {facAdminFilter}</span>
                        )}
                      </div>

                      {/* Facilities list box */}
                      <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '6px', background: 'white', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {availableFacilities.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '12px' }}>
                            لا توجد منشآت مطابقة للبحث أو الفلتر المحدد
                          </div>
                        ) : (
                          availableFacilities.slice(0, 200).map(fac => {
                            const isChecked = form.target_facilities.some(f => f.id === fac.id)
                            const priorTarget = userPriorFacilitiesInPeriod.get(fac.id)
                            return (
                              <div
                                key={fac.id}
                                onClick={() => toggleFacility(fac)}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                                  background: isChecked ? '#f0fdfa' : priorTarget ? '#fffbeb' : 'transparent',
                                  border: isChecked ? '1px solid #99f6e4' : priorTarget ? '1px dashed #fcd34d' : '1px solid transparent',
                                  borderRadius: '6px', cursor: 'pointer', transition: 'all 0.1s'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}} // handled by parent onClick
                                  style={{ cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: isChecked ? 'bold' : 'normal', color: isChecked ? '#0f766e' : '#334155' }}>
                                    {fac.name}
                                  </span>
                                  <span style={{
                                    fontSize: '10px',
                                    padding: '1px 7px',
                                    borderRadius: '12px',
                                    background: isChecked ? '#ccfbf1' : '#f1f5f9',
                                    color: isChecked ? '#0f766e' : '#64748b',
                                    fontWeight: '600'
                                  }}>
                                    {formatFacilityType(fac.facility_type)}
                                  </span>
                                  {fac.health_admin && (
                                    <span style={{ color: '#0284c7', fontSize: '10.5px' }}>
                                      • إدارة {fac.health_admin}
                                    </span>
                                  )}
                                  {fac.governorate && (
                                    <span style={{ color: '#94a3b8', fontSize: '10.5px' }}>
                                      • {fac.governorate}
                                    </span>
                                  )}

                                  {/* Previously targeted marker for same user in this period */}
                                  {priorTarget && (
                                    <span
                                      title={`مستهدفة سابقاً لهذا الموظف في خطة: "${priorTarget.targetTitle}"`}
                                      style={{
                                        fontSize: '10px',
                                        padding: '1px 8px',
                                        borderRadius: '6px',
                                        background: priorTarget.isVisited ? '#ecfdf5' : '#fff7ed',
                                        color: priorTarget.isVisited ? '#065f46' : '#c2410c',
                                        border: `1px solid ${priorTarget.isVisited ? '#a7f3d0' : '#fed7aa'}`,
                                        fontWeight: 'bold',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px',
                                        marginRight: 'auto'
                                      }}
                                    >
                                      {priorTarget.isVisited ? '✅ تم المرور مسبقاً' : '⚠️ تم اختيارها مسبقاً للموظف'} ({priorTarget.period})
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })
                        )}
                        {availableFacilities.length > 200 && (
                          <div style={{ textAlign: 'center', padding: '6px', color: '#64748b', fontSize: '11px', background: '#f8fafc', borderRadius: '4px' }}>
                            يتم عرض أول 200 منشأة. استخدم خانة البحث أو فلتر الإدارة الصحية لتضييق النتائج.
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#64748b' }}>
                        <span>عدد مأموريات المستهدف آلياً: <strong>{form.target_facilities.length}</strong></span>
                        <span>(يتم احتساب إنجاز كل منشأة عند المرور الفعلي عليها)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Notes */}
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#374151', display: 'block', marginBottom: '6px' }}>ملاحظات وتوجيهات رقابية (اختياري)</label>
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={2} placeholder="توجيهات أو اشتراطات تفتيش خاصة..."
                    style={{ width: '100%', padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </div>

                {/* Submit */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                  <button type="button" onClick={() => setShowModal(false)}
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', padding: '9px 20px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    إلغاء
                  </button>
                  <button type="submit" disabled={saving || (form.target_type === 'specific_facilities' && form.target_facilities.length === 0)}
                    style={{
                      background: saving || (form.target_type === 'specific_facilities' && form.target_facilities.length === 0) ? '#94a3b8' : 'linear-gradient(135deg, #006d77, #0d9488)',
                      color: 'white', border: 0, padding: '9px 26px', borderRadius: '8px', fontSize: '13px', fontWeight: '900',
                      cursor: saving || (form.target_type === 'specific_facilities' && form.target_facilities.length === 0) ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(0,109,119,0.3)'
                    }}>
                    {saving ? '⏳ جاري الحفظ...' : (editTarget ? '💾 تحديث المستهدف' : '✅ حفظ المستهدف')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  )
}
