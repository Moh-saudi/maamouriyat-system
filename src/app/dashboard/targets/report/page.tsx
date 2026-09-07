'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { DashboardShell } from '@/app/system-ui'
import {
  BarChart3, Target, TrendingUp, CheckCircle2, AlertCircle,
  Printer, Download, Filter, Calendar, ChevronDown, Award,
  Building2, MapPin, Users, ArrowRight
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, LineChart, Line, Area, AreaChart
} from 'recharts'

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
  id: string; title: string; period_type: string; period_label: string
  start_date: string; end_date: string; target_missions: number
  scope_level: string; scope_name: string
  target_type?: string
  target_facilities?: TargetFacility[]
  assigned_user_name?: string; sector_name?: string; notes?: string
  status: string; created_by_name?: string; created_at: string
  executed_missions?: number; completion_rate?: number
}

type ReportRow = {
  name: string; target: number; executed: number; rate: number; count: number
}

const rateColor = (r: number) => r >= 85 ? '#16a34a' : r >= 60 ? '#d97706' : '#dc2626'
const rateBg    = (r: number) => r >= 85 ? '#f0fdf4' : r >= 60 ? '#fffbeb' : '#fef2f2'

function fmtDate(s: string) {
  if (!s) return '—'
  return new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(s))
}

const SCOPE_LABELS: Record<string, string> = {
  ministry: '🏛️ وزارة', sector: '🏢 قطاع', governorate: '📍 محافظة',
  health_admin: '🏥 إدارة صحية', user: '👤 مفتش فردي'
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', fontSize: '12px', direction: 'rtl', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1e293b' }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, display: 'flex', gap: '8px' }}>
          <span>{p.name}:</span><strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TargetsReportPage() {
  const [targets, setTargets]         = useState<MissionTarget[]>([])
  const [report, setReport]           = useState<{
    totalTarget: number
    totalExecuted: number
    overallRate: number
    byScope: ReportRow[]
    totalFacilitiesTargeted?: number
    totalFacilitiesVisited?: number
    facilityCoverageRate?: number
    specificTargetsCount?: number
    aggregateTargetsCount?: number
  } | null>(null)
  const [loading, setLoading]         = useState(true)
  const [activeTab, setActiveTab]     = useState<'overview' | 'by_scope' | 'by_inspector' | 'details' | 'print'>('overview')
  const [filterScope, setFilterScope] = useState<string>('all')
  const [filterType, setFilterType]   = useState<string>('all')
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/admin/mission-targets?report=true')
        if (res.ok) {
          const d = await res.json()
          setTargets(d.targets || [])
          setReport(d.report)
        }
      } finally { setLoading(false) }
    })()
  }, [])

  // Build detailed analytics
  const analytics = useMemo(() => {
    if (!targets.length) return null

    const byGov: Record<string, { target: number; executed: number }> = {}
    const byUser: Record<string, { name: string; target: number; executed: number }> = {}
    const byMonth: Record<string, { target: number; executed: number }> = {}

    for (const t of targets) {
      if (filterScope !== 'all' && t.scope_level !== filterScope) continue
      if (filterType !== 'all' && (t.target_type || 'aggregate') !== filterType) continue

      // By scope/governorate
      const gKey = t.scope_name || t.scope_level
      byGov[gKey] = byGov[gKey] || { target: 0, executed: 0 }
      byGov[gKey].target   += t.target_missions
      byGov[gKey].executed += t.executed_missions ?? 0

      // By user
      if (t.assigned_user_name) {
        byUser[t.assigned_user_name] = byUser[t.assigned_user_name] || { name: t.assigned_user_name, target: 0, executed: 0 }
        byUser[t.assigned_user_name].target   += t.target_missions
        byUser[t.assigned_user_name].executed += t.executed_missions ?? 0
      }

      // By month
      const month = t.start_date.slice(0, 7)
      byMonth[month] = byMonth[month] || { target: 0, executed: 0 }
      byMonth[month].target   += t.target_missions
      byMonth[month].executed += t.executed_missions ?? 0
    }

    const govChart = Object.entries(byGov)
      .map(([name, d]) => ({ name, target: d.target, executed: d.executed, rate: Math.min(100, Math.round((d.executed / Math.max(1, d.target)) * 100)) }))
      .sort((a, b) => b.executed - a.executed)
      .slice(0, 12)

    const userRanking = Object.values(byUser)
      .map(d => ({ ...d, rate: Math.min(100, Math.round((d.executed / Math.max(1, d.target)) * 100)) }))
      .sort((a, b) => b.rate - a.rate)

    const trendChart = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b))
      .map(([month, d]) => ({
        name: new Intl.DateTimeFormat('ar-EG', { month: 'short', year: '2-digit' }).format(new Date(month + '-01')),
        مستهدف: d.target, منفذ: d.executed
      }))

    return { govChart, userRanking, trendChart }
  }, [targets, filterScope, filterType])

  const filtered = useMemo(() => {
    return targets.filter(t => {
      const matchSco = filterScope === 'all' || t.scope_level === filterScope
      const matchTyp = filterType === 'all' || (t.target_type || 'aggregate') === filterType
      return matchSco && matchTyp
    })
  }, [targets, filterScope, filterType])

  const tabs = [
    { key: 'overview',     label: 'نظرة عامة',        icon: <BarChart3 size={14} /> },
    { key: 'by_scope',     label: 'تفصيل بالنطاق',    icon: <MapPin size={14} /> },
    { key: 'by_inspector', label: 'تفصيل بالمفتش',    icon: <Users size={14} /> },
    { key: 'details',      label: 'جدول تفصيلي',       icon: <Target size={14} /> },
  ] as const

  const printReport = () => window.print()

  if (loading) return (
    <DashboardShell view="targets-report">
      <div style={{ textAlign: 'center', padding: '80px', fontFamily: 'Tajawal, sans-serif' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
        جاري تحميل التقارير...
      </div>
    </DashboardShell>
  )

  return (
    <DashboardShell view="targets-report">
      {/* ── Print-Only Styles ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen { #__targets_print__ { display: none !important; } }
        @media print {
          body > * { display: none !important; }
          body * #__targets_print__,
          body > * > #__targets_print__ { display: block !important; }
          #__targets_print__ {
            display: block !important; position: static !important;
            width: 100% !important; height: auto !important;
            overflow: visible !important; background: white !important;
            direction: rtl !important; font-family: 'Tajawal', sans-serif !important;
          }
          #__targets_print__ * { visibility: visible !important; }
          .print-row { page-break-inside: avoid !important; }
        }
      `}} />

      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px 24px', direction: 'rtl', fontFamily: "'Tajawal', sans-serif" }}>

        {/* ── HEADER ── */}
        <div style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 50%, #7c3aed 100%)',
          borderRadius: '16px', padding: '22px 28px', color: 'white',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '16px', marginBottom: '20px',
          boxShadow: '0 8px 32px rgba(99,102,241,0.25)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ background: 'rgba(255,255,255,0.15)', padding: '8px', borderRadius: '10px' }}><BarChart3 size={22} /></div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900' }}>تقارير مستهدفات المرور الميداني</h1>
            </div>
            <p style={{ margin: 0, fontSize: '12.5px', opacity: 0.85 }}>تحليل شامل لأداء المرور الميداني مقارنةً بالمستهدفات المحددة على كافة المستويات</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <a href="/dashboard/targets" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', color: 'white', padding: '9px 16px', borderRadius: '8px', fontSize: '12.5px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight size={14} /> إدارة المستهدفات
            </a>
            <button onClick={printReport}
              style={{ background: 'white', color: '#4338ca', border: 0, padding: '9px 18px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit' }}>
              <Printer size={14} /> طباعة التقرير
            </button>
          </div>
        </div>

        {/* ── KPI STRIP ── */}
        {report && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'إجمالي المستهدف', value: report.totalTarget, unit: 'مرور', color: '#0284c7', soft: '#f0f9ff', icon: <Target size={18}/> },
              { label: 'المنفذ فعلياً',   value: report.totalExecuted, unit: 'مرور', color: '#16a34a', soft: '#f0fdf4', icon: <CheckCircle2 size={18}/> },
              { label: 'نسبة الإنجاز',   value: `${report.overallRate}%`, unit: '', color: rateColor(report.overallRate), soft: rateBg(report.overallRate), icon: <TrendingUp size={18}/> },
              { label: 'الباقي للإنجاز', value: Math.max(0, report.totalTarget - report.totalExecuted), unit: 'مرور', color: '#d97706', soft: '#fffbeb', icon: <AlertCircle size={18}/> },
              { label: 'عدد الخطط',       value: targets.length, unit: 'خطة', color: '#7c3aed', soft: '#f5f3ff', icon: <Calendar size={18}/> },
            ].map(({ label, value, unit, color, soft, icon }) => (
              <div key={label} style={{ background: soft, border: `1.5px solid ${color}30`, borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                <div style={{ color, marginBottom: '4px' }}>{icon}</div>
                <div style={{ fontSize: '26px', fontWeight: '900', color, lineHeight: '1' }}>{value}</div>
                {unit && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>{unit}</div>}
                <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', fontWeight: 'bold' }}>{label}</div>
              </div>
            ))}

            {Boolean(report.totalFacilitiesTargeted && report.totalFacilitiesTargeted > 0) && (
              <div style={{ background: '#f0fdfa', border: '1.5px solid #99f6e4', borderRadius: '12px', padding: '14px', textAlign: 'center' }}>
                <div style={{ color: '#0d9488', marginBottom: '4px' }}><Building2 size={18} /></div>
                <div style={{ fontSize: '26px', fontWeight: '900', color: '#0d9488', lineHeight: '1' }}>{report.facilityCoverageRate}%</div>
                <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{report.totalFacilitiesVisited} من {report.totalFacilitiesTargeted} منشأة</div>
                <div style={{ fontSize: '11px', color: '#0f766e', marginTop: '4px', fontWeight: 'bold' }}>تغطية المنشآت المستهدفة</div>
              </div>
            )}
          </div>
        )}

        {/* ── TABS + FILTER ── */}
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12.5px', fontWeight: activeTab === tab.key ? '900' : '500', fontFamily: 'inherit', background: activeTab === tab.key ? '#4338ca' : '#f8fafc', color: activeTab === tab.key ? 'white' : '#475569', transition: 'all 0.2s' }}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}>
              <option value="all">كل الأنواع</option>
              <option value="aggregate">📊 مستهدف عام</option>
              <option value="specific_facilities">🏥 محدد بالمنشآت</option>
            </select>

            <select value={filterScope} onChange={e => setFilterScope(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px', fontFamily: 'inherit', outline: 'none' }}>
              <option value="all">كل المستويات</option>
              {Object.entries(SCOPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        {/* ── TAB CONTENT ── */}

        {/* Overview Tab */}
        {activeTab === 'overview' && analytics && (
          <div style={{ display: 'grid', gap: '16px' }}>
            {/* Main Chart: Target vs Executed by scope */}
            <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '900', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BarChart3 size={16} /> مقارنة المستهدف والمنفذ بحسب النطاق والمحافظات
              </h3>
              <div style={{ height: '320px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.govChart} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar dataKey="target" name="المستهدف" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="executed" name="المنفذ فعلياً" fill="#0284c7" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Sub Charts: Users & Trend */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {/* Trend */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '13.5px', fontWeight: '900', color: '#1e293b' }}>
                  📈 تطور المستهدفات والمنفذ شهرياً
                </h3>
                <div style={{ height: '220px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.trendChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="مستهدف" stroke="#60a5fa" fill="#dbeafe" strokeWidth={2} />
                      <Area type="monotone" dataKey="منفذ" stroke="#059669" fill="#d1fae5" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Inspector Top Rates */}
              <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px', fontSize: '13.5px', fontWeight: '900', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Award size={16} color="#d97706" /> ترتيب إنجاز المفتشين والمستخدمين
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                  {analytics.userRanking.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '12px', padding: '30px' }}>لا توجد مستهدفات مخصصة لمفتشين</div>
                  ) : (
                    analytics.userRanking.map((u, i) => (
                      <div key={u.name} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 10px', background: '#f8fafc', borderRadius: '8px' }}>
                        <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: i < 3 ? '#fef3c7' : '#e2e8f0', color: i < 3 ? '#d97706' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold' }}>{i + 1}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>{u.name}</div>
                          <div style={{ fontSize: '10.5px', color: '#64748b' }}>{u.executed} من {u.target} مرور</div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: rateColor(u.rate) }}>{u.rate}%</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* By Scope Tab */}
        {activeTab === 'by_scope' && report && (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '900', color: '#1e293b' }}>المستهدفات حسب النطاق والجهات</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>الجهة / النطاق</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>عدد الخطط</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>المستهدف</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>المنفذ</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 'bold', color: '#475569', borderBottom: '2px solid #e2e8f0' }}>نسبة الإنجاز</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 'bold', color: '#475569', borderBottom: '2px solid #e2e8f0', minWidth: '120px' }}>شريط التقدم</th>
                  </tr>
                </thead>
                <tbody>
                  {report.byScope.map((row, i) => (
                    <tr key={row.name} style={{ background: i % 2 === 0 ? 'white' : '#fafcfc', borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 14px', fontWeight: 'bold', color: '#1e293b' }}>{row.name}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#64748b' }}>{row.count}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold', color: '#0284c7' }}>{row.target}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 'bold', color: rateColor(row.rate) }}>{row.executed}</td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', background: rateBg(row.rate), color: rateColor(row.rate), padding: '2px 8px', borderRadius: '6px', fontWeight: '900', fontSize: '11.5px' }}>
                          {row.rate}%
                        </span>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <div style={{ background: '#f1f5f9', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, row.rate)}%`, height: '100%', background: rateColor(row.rate), borderRadius: '100px' }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* By Inspector Tab */}
        {activeTab === 'by_inspector' && analytics && (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '14px', fontWeight: '900', color: '#1e293b' }}>متابعة مستهدفات المفتشين والقائمين بالمرور</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
              {analytics.userRanking.map((u, i) => (
                <div key={u.name} style={{ background: '#fafcfc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e293b' }}>👤 {u.name}</div>
                    <span style={{ background: rateBg(u.rate), color: rateColor(u.rate), padding: '2px 8px', borderRadius: '6px', fontWeight: '900', fontSize: '12px' }}>{u.rate}%</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center', marginBottom: '10px' }}>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>المستهدف</div>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: '#0284c7' }}>{u.target}</div>
                    </div>
                    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px' }}>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>المنفذ</div>
                      <div style={{ fontSize: '18px', fontWeight: '900', color: rateColor(u.rate) }}>{u.executed}</div>
                    </div>
                  </div>
                  <div style={{ background: '#f1f5f9', borderRadius: '100px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, u.rate)}%`, height: '100%', background: rateColor(u.rate), borderRadius: '100px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Details Tab */}
        {activeTab === 'details' && (
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ background: '#1e1b4b', color: 'white', padding: '12px 20px', fontSize: '13px', fontWeight: 'bold' }}>
              الجدول التفصيلي الكامل ({filtered.length} خطة)
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['#','العنوان','نوع المستهدف','النطاق','المكلف','الفترة','المستهدف','المنفذ','النسبة','الحالة'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold', color: '#475569', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t, i) => {
                    const rate = t.completion_rate ?? 0
                    const isSpecific = t.target_type === 'specific_facilities'
                    const facs = t.target_facilities || []
                    const visitedCount = facs.filter(f => f.is_visited).length

                    return (
                      <tr key={t.id} style={{ background: i % 2 === 0 ? 'white' : '#fafcfc', borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: 'bold' }}>{i + 1}</td>
                        <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1e293b', maxWidth: '200px' }}>{t.title}</td>
                        <td style={{ padding: '10px 12px' }}>
                          {isSpecific ? (
                            <span style={{ background: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
                              🏥 نوعي ({visitedCount}/{facs.length} منشأة)
                            </span>
                          ) : (
                            <span style={{ background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold' }}>
                              📊 عام
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{SCOPE_LABELS[t.scope_level] || t.scope_level}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{t.assigned_user_name || t.scope_name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{fmtDate(t.start_date)} — {fmtDate(t.end_date)}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', color: '#0284c7', fontSize: '15px' }}>{t.target_missions}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '900', color: rateColor(rate), fontSize: '15px' }}>{t.executed_missions ?? 0}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', background: rateBg(rate), color: rateColor(rate), padding: '3px 8px', borderRadius: '6px', fontWeight: '900', fontSize: '12px' }}>{rate}%</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ display: 'inline-block', background: t.status === 'active' ? '#f0fdf4' : '#f9fafb', color: t.status === 'active' ? '#16a34a' : '#64748b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                            {t.status === 'active' ? '🟢 نشط' : '⭕ منتهي'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ── PRINT REPORT ── */}
      <div id="__targets_print__" style={{ fontFamily: "'Tajawal', sans-serif", direction: 'rtl', color: '#1e293b', padding: 0 }}>
        {/* Gov Header */}
        <div style={{ background: 'linear-gradient(135deg, #0e4b5a, #006d77)', color: 'white', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', opacity: 0.8 }}>جمهورية مصر العربية — وزارة الصحة والسكان</div>
            <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '4px' }}>تقرير مستهدفات المرور والتفتيش الميداني</div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mohp-logo.png" alt="logo" style={{ height: '56px', opacity: 0.9, filter: 'brightness(0) invert(1)' }} />
          <div style={{ textAlign: 'left', fontSize: '10.5px', opacity: 0.85 }}>
            <div>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
            <div>عدد الخطط: {targets.length} خطة</div>
          </div>
        </div>

        {/* Summary */}
        {report && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px 24px', borderBottom: '2px solid #e2e8f0' }}>
            {[
              { label: 'إجمالي المستهدف', value: report.totalTarget, unit: 'مرور', color: '#0284c7' },
              { label: 'المنفذ فعلياً',   value: report.totalExecuted, unit: 'مرور', color: rateColor(report.overallRate) },
              { label: 'نسبة الإنجاز',   value: `${report.overallRate}%`, unit: '', color: rateColor(report.overallRate) },
              { label: 'الباقي',          value: Math.max(0, report.totalTarget - report.totalExecuted), unit: 'مرور', color: '#d97706' },
            ].map(({ label, value, unit, color }) => (
              <div key={label} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', color }}>{value} {unit}</div>
                <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Detail Table */}
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#0e4b5a', marginBottom: '10px', borderBottom: '2px solid #0e4b5a', paddingBottom: '6px' }}>
            تفاصيل الخطط ({targets.length} خطة)
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px' }}>
            <thead>
              <tr style={{ background: '#e8f0f1' }}>
                {['#','العنوان','نوع المستهدف','النطاق','المكلف','الفترة','المستهدف','المنفذ','النسبة'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold', color: '#1e3a40', borderBottom: '2px solid #c8d8da' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {targets.map((t, i) => {
                const rate = t.completion_rate ?? 0
                const isSpecific = t.target_type === 'specific_facilities'
                const facs = t.target_facilities || []
                const visitedCount = facs.filter(f => f.is_visited).length

                return (
                  <tr key={t.id} className="print-row" style={{ background: i % 2 === 0 ? 'white' : '#fafcfc', borderBottom: '1px solid #eef3f4' }}>
                    <td style={{ padding: '7px 10px', color: '#94a3b8' }}>{i+1}</td>
                    <td style={{ padding: '7px 10px', fontWeight: '600' }}>{t.title}</td>
                    <td style={{ padding: '7px 10px', fontSize: '9.5px', color: '#0f766e' }}>
                      {isSpecific ? `نوعي (${visitedCount}/${facs.length})` : 'عام'}
                    </td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{t.scope_level}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b' }}>{t.assigned_user_name || t.scope_name || '—'}</td>
                    <td style={{ padding: '7px 10px', color: '#64748b', whiteSpace: 'nowrap', fontSize: '10px' }}>{fmtDate(t.start_date)} — {fmtDate(t.end_date)}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '900', color: '#0284c7' }}>{t.target_missions}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '900', color: rateColor(rate) }}>{t.executed_missions ?? 0}</td>
                    <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: '900', color: rateColor(rate) }}>{rate}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="print-signatures" style={{ margin: '20px 24px 0', border: '2px solid #0e4b5a', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ background: '#0e4b5a', color: 'white', padding: '8px 16px', fontSize: '11px', fontWeight: 'bold', textAlign: 'center' }}>بيانات التوقيع والاعتماد</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            {['مدير الإدارة العامة للمأموريات','مدير القطاع المختص','مدير الإدارة العليا'].map(title => (
              <div key={title} style={{ padding: '16px', textAlign: 'center', borderLeft: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: '#0e4b5a', marginBottom: '8px' }}>{title}</div>
                <div style={{ borderBottom: '1px solid #334155', height: '36px', marginBottom: '6px' }}></div>
                <div style={{ fontSize: '9.5px', color: '#64748b' }}>الاسم / التوقيع / التاريخ</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ textAlign: 'center', fontSize: '9px', color: '#94a3b8', padding: '12px 24px' }}>
          تم إنشاء هذا التقرير بواسطة نظام حوكمة المأمورية الميدانية — {new Date().toLocaleString('ar-EG')}
        </div>
      </div>

    </DashboardShell>
  )
}
