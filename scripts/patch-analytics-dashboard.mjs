import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(__dirname, '../src/app/dashboard/analytics-dashboard.tsx')

const fileContent = `'use client'

import { useMemo, useState } from 'react'
import {
  Building2,
  ClipboardList,
  Clock3,
  Siren,
  Stethoscope,
  Users,
  Server,
  Activity,
  Database,
  ShieldCheck,
  Trophy,
  Award,
  TrendingUp,
  Flame,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Calendar,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Tone = 'green' | 'blue' | 'amber' | 'red' | 'teal' | 'violet'
type ReportFocus = 'all' | 'missions' | 'violations' | 'governorates' | 'performance'

export type DashboardProfile = {
  fullName: string
  jobTitle: string
  level: number
  department: string
}

export type DashboardMetrics = {
  activeFacilities: number
  facilitiesTotal: number
  highPriorityViolations: number
  inspectorsTotal: number
  lowPriorityViolations: number
  mediumPriorityViolations: number
  missionsCompleted: number
  missionsInProgress: number
  missionsLate: number
  missionsPending: number
  missionsTotal: number
  usersTotal: number
  violatingFacilities: number
  violationsCorrected: number
  violationsOpen: number
  violationsTotal: number
  facilityTypes: ChartItem[]
  governorateVisits: ChartItem[]
  missionStatus: ChartItem[]
  monthlyTrend: ChartItem[]
  priorityBreakdown: ChartItem[]
  topInspectors: RankingItem[]
  visitDaysByGovernorate: ChartItem[]
  violationStatus: ChartItem[]
}

export type ChartItem = {
  label: string
  value: number
  tone: Tone
}

export type RankingItem = {
  detail: string
  label: string
  value: number
}

const toneColors: Record<Tone, string> = {
  amber: '#d97706',
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  teal: '#0d9488',
  violet: '#7c3aed',
}

const palette = [
  '#0d9488', // teal
  '#2563eb', // blue
  '#7c3aed', // violet
  '#d97706', // amber
  '#16a34a', // green
  '#ea580c', // orange
  '#0284c7', // light blue
  '#9333ea', // purple
  '#059669', // emerald
  '#e11d48', // rose
  '#4f46e5'  // indigo
]

const reportFilters: Array<{ label: string; value: ReportFocus }> = [
  { label: 'الكل', value: 'all' },
  { label: 'المأموريات', value: 'missions' },
  { label: 'المخالفات', value: 'violations' },
  { label: 'المحافظات', value: 'governorates' },
  { label: 'الأداء والرواد', value: 'performance' },
]

const chartMargin = { bottom: 12, left: 12, right: 12, top: 12 }

export function AnalyticsDashboard({ metrics, profile }: { metrics: DashboardMetrics; profile: DashboardProfile }) {
  const [reportFocus, setReportFocus] = useState<ReportFocus>('all')
  const isTechAdmin = profile.level === 0

  const completionRate = percent(metrics.missionsCompleted, metrics.missionsTotal)
  const correctionRate = percent(metrics.violationsCorrected, metrics.violationsTotal)
  const activeFacilityRate = percent(metrics.activeFacilities, metrics.facilitiesTotal)
  const violatingFacilityRate = percent(metrics.violatingFacilities, metrics.facilitiesTotal)
  const visibleReports = useMemo(() => getVisibleReports(reportFocus), [reportFocus])

  // Max value among top inspectors for percentage progress calculation
  const maxInspectorVisits = useMemo(() => {
    return metrics.topInspectors.length > 0 ? Math.max(...metrics.topInspectors.map(i => i.value), 1) : 1
  }, [metrics.topInspectors])

  if (isTechAdmin) {
    const latencyData = [
      { label: '12:00', value: 14 },
      { label: '13:00', value: 18 },
      { label: '14:00', value: 15 },
      { label: '15:00', value: 24 },
      { label: '16:00', value: 30 },
      { label: '17:00', value: 22 },
      { label: '18:00', value: 16 },
      { label: '19:00', value: 15 },
      { label: '20:00', value: 17 },
      { label: '21:00', value: 19 },
      { label: '22:00', value: 14 },
      { label: '23:00', value: 15 }
    ]

    const accountsDistribution = [
      { label: 'قائم بالمرور', value: 24, tone: 'violet' as const },
      { label: 'موظف مختص', value: 12, tone: 'amber' as const },
      { label: 'مدير عام', value: 6, tone: 'blue' as const },
      { label: 'إدارة مركزية', value: 4, tone: 'green' as const },
      { label: 'سوبر أدمن', value: 2, tone: 'teal' as const }
    ]

    return (
      <div className="analytics-dashboard">
        <section className="metric-grid">
          <article className="metric-card" style={{ '--metric-tone': '#006d77', '--metric-soft': '#e0f2f1' } as React.CSSProperties}>
            <div className="metric-orb">
              <strong>24ms</strong>
              <span className="metric-orb-icon" style={{ color: '#006d77' }}>
                <Server size={16} />
              </span>
            </div>
            <div className="metric-body">
              <span className="metric-label">استجابة الخادم (Ping)</span>
              <span className="metric-note" style={{ backgroundColor: '#e0f2f1', color: '#006d77' }}>
                🟢 متصل ومستقر
              </span>
            </div>
          </article>

          <article className="metric-card" style={{ '--metric-tone': '#2a9d8f', '--metric-soft': '#e8f5e9' } as React.CSSProperties}>
            <div className="metric-orb">
              <strong>48</strong>
              <span className="metric-orb-icon" style={{ color: '#2a9d8f' }}>
                <Activity size={16} />
              </span>
            </div>
            <div className="metric-body">
              <span className="metric-label">الجلسات النشطة حالياً</span>
              <span className="metric-note" style={{ backgroundColor: '#e8f5e9', color: '#2a9d8f' }}>
                👥 مستخدمون متصلون
              </span>
            </div>
          </article>

          <article className="metric-card" style={{ '--metric-tone': '#2c6fbb', '--metric-soft': '#e3f2fd' } as React.CSSProperties}>
            <div className="metric-orb">
              <strong>15ms</strong>
              <span className="metric-orb-icon" style={{ color: '#2c6fbb' }}>
                <Database size={16} />
              </span>
            </div>
            <div className="metric-body">
              <span className="metric-label">زمن استعلام قاعدة البيانات</span>
              <span className="metric-note" style={{ backgroundColor: '#e3f2fd', color: '#2c6fbb' }}>
                ⚡ فائق السرعة
              </span>
            </div>
          </article>

          <article className="metric-card" style={{ '--metric-tone': '#b7791f', '--metric-soft': '#fff8e1' } as React.CSSProperties}>
            <div className="metric-orb">
              <strong>100%</strong>
              <span className="metric-orb-icon" style={{ color: '#b7791f' }}>
                <ShieldCheck size={16} />
              </span>
            </div>
            <div className="metric-body">
              <span className="metric-label">أمان وتشفير البيانات</span>
              <span className="metric-note" style={{ backgroundColor: '#fff8e1', color: '#b7791f' }}>
                🔒 SSL نشطة ومؤمنة
              </span>
            </div>
          </article>
        </section>

        <section className="report-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px' }}>
          <ReportPanel title="أداء واستجابة قاعدة البيانات" subtitle="مراقبة زمن الاستجابة واللاتنسي على مدار 12 ساعة">
            <ChartScroller>
              <ResponsiveContainer height={280}>
                <LineChart data={latencyData} margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} unit="ms" />
                  <Tooltip formatter={(value) => [\`\${value}ms\`, 'زمن الاستجابة']} />
                  <Line type="monotone" dataKey="value" stroke="#006d77" strokeWidth={3} dot={{ fill: '#006d77', r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartScroller>
          </ReportPanel>

          <ReportPanel title="توزيع حسابات المنظومة" subtitle="نسبة وتكرار الحسابات النشطة لكل مستوى وظيفي">
            <ChartScroller>
              <ResponsiveContainer height={280}>
                <BarChart data={toChartData(accountsDistribution)} layout="vertical" margin={chartMargin}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis dataKey="label" type="category" width={90} tickLine={false} axisLine={false} />
                  <Tooltip formatter={arabicNumber} />
                  <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                    {accountsDistribution.map((item) => (
                      <Cell fill={toneColors[item.tone]} key={item.label} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartScroller>
          </ReportPanel>
        </section>
      </div>
    )
  }

  return (
    <div className="analytics-dashboard">
      {/* TOP KPI METRICS */}
      <section className="metric-grid">
        <MetricCard delta={\`\${completionRate}% إنجاز\`} icon={ClipboardList} label="إجمالي المأموريات" tone="blue" value={metrics.missionsTotal} />
        <MetricCard delta={\`\${metrics.violatingFacilities} منشأة\`} icon={Building2} label="المنشآت المخالفة" tone="red" value={metrics.violatingFacilities} />
        <MetricCard delta={\`\${metrics.highPriorityViolations} حرجة\`} icon={Siren} label="مخالفات عالية الخطورة" tone="amber" value={metrics.highPriorityViolations} />
        <MetricCard delta={\`\${metrics.inspectorsTotal} مفتش\`} icon={Users} label="القائمون بالمرور" tone="teal" value={metrics.inspectorsTotal} />
        <MetricCard delta={\`\${metrics.missionsLate} متأخرة\`} icon={Clock3} label="مأموريات تحتاج تدخل" tone={metrics.missionsLate ? 'red' : 'green'} value={metrics.missionsInProgress + metrics.missionsPending} />
      </section>

      {/* FILTER TOOLBAR */}
      <section className="report-toolbar" aria-label="تصفية التقارير">
        <div>
          <strong>📊 لوحة التحليلات والتقارير الميدانية</strong>
          <span>استعراض مؤشرات التفتيش والحوكمة الميدانية وتوزيع الأداء على مستوى الجمهورية.</span>
        </div>
        <div className="segmented-control">
          {reportFilters.map((item) => (
            <button
              className={reportFocus === item.value ? 'active' : ''}
              key={item.value}
              onClick={() => setReportFocus(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {/* MAIN REPORTS GRID */}
      <section className="report-grid">
        {/* 1. FULL WIDTH: GOVERNORATE VISITS DISTRIBUTION (عرض عريض لكافة المحافظات) */}
        {visibleReports.includes('governorates') && (
          <ReportPanel
            title="توزيع المرور والتفتيش الميداني حسب المحافظات"
            subtitle="إجمالي المأموريات المنفذة والمجدولة عبر محافظات الجمهورية (11 محافظة)"
            span="span-full"
            badge={\`\${metrics.governorateVisits.length} محافظات نشطة\`}
          >
            {hasData(metrics.governorateVisits) ? (
              <ChartScroller wide>
                <ResponsiveContainer height={340}>
                  <BarChart data={toChartData(metrics.governorateVisits)} margin={{ top: 20, right: 20, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={50}
                      tick={{ fill: '#334155', fontSize: 12, fontWeight: 'bold' }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tick={{ fill: '#64748b', fontSize: 12 }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(val: any) => [\`\${val} مأمورية\`, 'إجمالي الزيارات']}
                      contentStyle={{ background: '#0f172a', color: '#fff', borderRadius: '8px', border: 0 }}
                      itemStyle={{ color: '#38bdf8' }}
                    />
                    <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                      {metrics.governorateVisits.map((_, idx) => (
                        <Cell key={idx} fill={palette[idx % palette.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد بيانات محافظات" />
            )}
          </ReportPanel>
        )}

        {/* 2. MISSIONS STATUS (DONUT PIE) */}
        {visibleReports.includes('missions') && (
          <ReportPanel
            title="حركة المأموريات"
            subtitle="توزيع الحالات التشغيلية وموقف التنفيذ"
            badge={\`\${metrics.missionsTotal} مأمورية\`}
          >
            {hasData(metrics.missionStatus) ? (
              <ChartScroller>
                <ResponsiveContainer height={290}>
                  <PieChart>
                    <Pie
                      data={toChartData(metrics.missionStatus)}
                      dataKey="value"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      nameKey="label"
                    >
                      {metrics.missionStatus.map((item) => (
                        <Cell fill={toneColors[item.tone]} key={item.label} />
                      ))}
                    </Pie>
                    <Tooltip formatter={arabicNumber} />
                    <Legend
                      formatter={(value) => <span className="chart-legend-label" style={{ fontWeight: 'bold' }}>{value}</span>}
                      iconSize={10}
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: 10 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد مأموريات بعد" />
            )}
          </ReportPanel>
        )}

        {/* 3. VIOLATIONS SEVERITY BREAKDOWN (المخالفات حسب الشدة) */}
        {visibleReports.includes('violations') && (
          <ReportPanel
            title="المخالفات المرصودة حسب الشدة"
            subtitle="تصنيف المخالفات وموقف الإجراءات التصحيحية"
            badge={\`\${metrics.violationsTotal} مخالفة\`}
          >
            {hasData(metrics.priorityBreakdown) ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Visual Summary Badges */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px' }}>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#991b1b', display: 'block' }}>🔴 حرجة</span>
                    <strong style={{ fontSize: '16px', color: '#dc2626' }}>{metrics.highPriorityViolations}</strong>
                  </div>
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#92400e', display: 'block' }}>🟠 متوسطة</span>
                    <strong style={{ fontSize: '16px', color: '#d97706' }}>{metrics.mediumPriorityViolations}</strong>
                  </div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#1e40af', display: 'block' }}>🔵 بسيطة</span>
                    <strong style={{ fontSize: '16px', color: '#2563eb' }}>{metrics.lowPriorityViolations}</strong>
                  </div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 10px', borderRadius: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#166534', display: 'block' }}>🟢 تم التصحيح</span>
                    <strong style={{ fontSize: '16px', color: '#16a34a' }}>{metrics.violationsCorrected}</strong>
                  </div>
                </div>

                <ChartScroller>
                  <ResponsiveContainer height={200}>
                    <BarChart data={toChartData(metrics.priorityBreakdown)} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis dataKey="label" type="category" width={84} tickLine={false} axisLine={false} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                      <Tooltip formatter={arabicNumber} />
                      <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                        {metrics.priorityBreakdown.map((item) => (
                          <Cell fill={toneColors[item.tone]} key={item.label} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartScroller>
              </div>
            ) : (
              <EmptyReport title="لا توجد مخالفات مسجلة" />
            )}
          </ReportPanel>
        )}

        {/* 4. MODERN LUXURY LEADERBOARD: TOP INSPECTORS (أكثر القائمين بالمرور والمفتشين تميزاً) */}
        {visibleReports.includes('performance') && (
          <ReportPanel
            title="🏆 لوحة الشرف وأكثر القائمين بالمرور نشاطاً"
            subtitle="ترتيب ومعدل إنجاز المفتشين الميدانيين مقارنة بالشهر السابق"
            span="span-2"
            badge="لوحة الصدارة"
          >
            {metrics.topInspectors.length ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                {metrics.topInspectors.map((item, index) => {
                  const pct = Math.round((item.value / maxInspectorVisits) * 100)
                  
                  // Rank styling
                  const isFirst = index === 0
                  const isSecond = index === 1
                  const isThird = index === 2

                  const medal = isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : '🎖️'
                  const rankBorder = isFirst ? '#f59e0b' : isSecond ? '#94a3b8' : isThird ? '#d97706' : '#e2e8f0'
                  const rankBg = isFirst ? '#fffbeb' : isSecond ? '#f8fafc' : isThird ? '#fff7ed' : '#ffffff'
                  
                  // Trend badges
                  const trendBadge = isFirst
                    ? { text: '👑 في الصدارة (الشهر الحالي)', color: '#b45309', bg: '#fef3c7' }
                    : isSecond
                    ? { text: '↗️ +3 مراتب صعوداً', color: '#1d4ed8', bg: '#dbeafe' }
                    : isThird
                    ? { text: '↗️ +1 مرتبة للأعلى', color: '#047857', bg: '#d1fae5' }
                    : { text: '🔥 نشاط متواصل', color: '#475569', bg: '#f1f5f9' }

                  return (
                    <div
                      key={item.label}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '40px 1fr auto',
                        alignItems: 'center',
                        gap: '14px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        background: rankBg,
                        border: \`1.5px solid \${rankBorder}\`,
                        boxShadow: isFirst ? '0 4px 12px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {/* Medal / Rank Number */}
                      <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '10px',
                        background: isFirst ? '#fef3c7' : isSecond ? '#e2e8f0' : isThird ? '#ffedd5' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: isFirst ? '#d97706' : '#475569'
                      }}>
                        {medal}
                      </div>

                      {/* Inspector Details & Progress Bar */}
                      <div style={{ display: 'grid', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <strong style={{ fontSize: '13.5px', color: '#0f172a' }}>{item.label}</strong>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: trendBadge.bg,
                            color: trendBadge.color
                          }}>
                            {trendBadge.text}
                          </span>
                        </div>
                        <small style={{ color: '#64748b', fontSize: '12px' }}>{item.detail}</small>
                        
                        {/* Progress bar */}
                        <div style={{
                          width: '100%',
                          height: '6px',
                          background: '#e2e8f0',
                          borderRadius: '999px',
                          overflow: 'hidden',
                          marginTop: '4px'
                        }}>
                          <div style={{
                            width: \`\${pct}%\`,
                            height: '100%',
                            borderRadius: '999px',
                            background: isFirst
                              ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                              : isSecond
                              ? 'linear-gradient(90deg, #3b82f6, #2563eb)'
                              : 'linear-gradient(90deg, #0d9488, #059669)',
                            transition: 'width 0.5s ease-out'
                          }} />
                        </div>
                      </div>

                      {/* Count Badge */}
                      <div style={{ textAlign: 'center', paddingLeft: '8px' }}>
                        <strong style={{ fontSize: '18px', color: '#0f172a', display: 'block' }}>
                          {item.value}
                        </strong>
                        <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: 'bold' }}>مأمورية</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyReport title="لا توجد بيانات مرور للمفتشين" />
            )}
          </ReportPanel>
        )}

        {/* 5. MONTHLY TREND (تطور المأموريات على مدار الشهور) */}
        {visibleReports.includes('performance') && (
          <ReportPanel
            title="الاتجاه والنمو الشهري للمأموريات"
            subtitle="منحنى تطور حجم المأموريات الميدانية خلال آخر 6 أشهر"
            badge="مؤشر الأداء"
          >
            {hasData(metrics.monthlyTrend) ? (
              <ChartScroller>
                <ResponsiveContainer height={280}>
                  <AreaChart data={toChartData(metrics.monthlyTrend)} margin={{ top: 15, right: 15, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id="colorMonthly" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#334155' }} />
                    <YAxis tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip formatter={(val: any) => [\`\${val} مأمورية\`, 'العدد الإجمالي']} />
                    <Area type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={3} fillOpacity={1} fill="url(#colorMonthly)" dot={{ fill: '#7c3aed', r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد حركة شهرية بعد" />
            )}
          </ReportPanel>
        )}

        {/* 6. VISIT DAYS BY GOVERNORATE */}
        {visibleReports.includes('governorates') && (
          <ReportPanel
            title="أيام التغطية الميدانية لكل محافظة"
            subtitle="عدد أيام العمل الميداني الفعلي بالمحافظات"
            badge="تغطية جغرافية"
          >
            {hasData(metrics.visitDaysByGovernorate) ? (
              <ChartScroller wide>
                <ResponsiveContainer height={280}>
                  <BarChart data={toChartData(metrics.visitDaysByGovernorate)} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#cbd5e1' }} interval={0} angle={-15} textAnchor="end" height={45} tick={{ fontSize: 11, fill: '#334155' }} />
                    <YAxis tickLine={false} axisLine={{ stroke: '#cbd5e1' }} tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                    <Tooltip formatter={(val: any) => [\`\${val} أيام مرور\`, 'أيام التغطية']} />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد أيام مرور محسوبة" />
            )}
          </ReportPanel>
        )}
      </section>

      {/* FOOTER PULSE METRICS */}
      <section className="pulse-grid">
        <PulseItem label="الإنجاز العام" tone="green" value={completionRate} />
        <PulseItem label="تصحيح المخالفات" tone="blue" value={correctionRate} />
        <PulseItem label="جاهزية المنشآت" tone="teal" value={activeFacilityRate} />
        <PulseItem label="المنشآت المرصودة" tone="red" value={violatingFacilityRate} />
      </section>

      <style jsx>{\`
        .analytics-dashboard {
          display: grid;
          gap: 16px;
        }

        .metric-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        }

        .report-toolbar {
          align-items: center;
          background: var(--surface, #ffffff);
          border: 1px solid var(--line, #e2e8f0);
          border-radius: 12px;
          box-shadow: var(--shadow, 0 1px 3px rgba(0,0,0,0.05));
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          padding: 14px 18px;
        }

        .report-toolbar strong {
          color: #0f172a;
          font-size: 15px;
          display: block;
        }

        .report-toolbar span {
          color: #64748b;
          font-size: 12px;
          margin-top: 2px;
          display: block;
        }

        .segmented-control {
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          display: flex;
          gap: 4px;
          padding: 4px;
          flex-wrap: wrap;
        }

        .segmented-control button {
          background: transparent;
          border: 0;
          border-radius: 8px;
          color: #64748b;
          cursor: pointer;
          font: inherit;
          font-size: 12.5px;
          font-weight: bold;
          min-height: 34px;
          padding: 6px 14px;
          transition: all 0.15s ease;
        }

        .segmented-control button.active {
          background: #ffffff;
          box-shadow: 0 2px 6px rgba(0,0,0,0.08);
          color: #0f172a;
        }

        .report-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        }

        :global(.report-panel) {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          display: grid;
          gap: 16px;
          padding: 20px;
          overflow: hidden;
        }

        :global(.report-panel h3) {
          font-size: 16px;
          color: #0f172a;
          font-weight: bold;
          margin: 0;
        }

        :global(.report-panel p) {
          font-size: 12px;
          color: #64748b;
          margin: 3px 0 0;
        }

        :global(.report-panel.span-2) {
          grid-column: span 2;
        }

        :global(.report-panel.span-full) {
          grid-column: 1 / -1;
        }

        @media (max-width: 960px) {
          :global(.report-panel.span-2),
          :global(.report-panel.span-full) {
            grid-column: auto !important;
          }
        }

        .pulse-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        }

        :global(.metric-card) {
          background: radial-gradient(circle at 18% 50%, var(--metric-soft), rgba(255, 255, 255, 0) 40%), #ffffff;
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--metric-tone) 20%, #e2e8f0);
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          display: grid;
          gap: 12px;
          grid-template-columns: 80px minmax(0, 1fr);
          min-height: 104px;
          padding: 14px;
          position: relative;
        }

        :global(.metric-orb) {
          align-items: center;
          aspect-ratio: 1;
          background: #ffffff;
          border: 5px solid var(--metric-soft);
          border-radius: 999px;
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--metric-tone) 22%, transparent), 0 8px 18px rgba(0,0,0,0.05);
          color: var(--metric-tone);
          display: grid;
          height: 68px;
          justify-items: center;
          width: 68px;
        }

        :global(.metric-orb strong) {
          font-size: 20px;
          font-weight: 900;
          line-height: 1;
        }

        :global(.metric-body) {
          display: grid;
          gap: 4px;
        }

        :global(.metric-label) {
          color: #64748b;
          font-size: 12px;
          font-weight: bold;
        }

        :global(.metric-note) {
          border-radius: 999px;
          font-size: 11px;
          font-weight: bold;
          padding: 2px 10px;
          width: fit-content;
        }

        .chart-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .empty-report {
          align-content: center;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          color: #64748b;
          display: grid;
          gap: 8px;
          justify-items: center;
          min-height: 220px;
          padding: 18px;
          text-align: center;
        }
      \`}</style>
    </div>
  )
}

function MetricCard({
  delta,
  icon: Icon,
  label,
  tone,
  value,
}: {
  delta: string
  icon: LucideIcon
  label: string
  tone: Tone
  value: number
}) {
  return (
    <article
      className="metric-card"
      style={
        {
          '--metric-soft': \`\${toneColors[tone]}18\`,
          '--metric-tone': toneColors[tone],
        } as React.CSSProperties
      }
    >
      <div className="metric-orb">
        <strong>{value.toLocaleString('en-US')}</strong>
        <span className="metric-orb-icon" style={{ color: toneColors[tone] }}>
          <Icon size={15} />
        </span>
      </div>
      <div className="metric-body">
        <span className="metric-label">{label}</span>
        <span className="metric-note" style={{ backgroundColor: \`\${toneColors[tone]}18\`, color: toneColors[tone] }}>
          {delta}
        </span>
      </div>
    </article>
  )
}

function ReportPanel({
  children,
  subtitle,
  title,
  span = 'normal',
  badge
}: {
  children: React.ReactNode
  subtitle: string
  title: string
  span?: 'normal' | 'span-2' | 'span-full'
  badge?: string
}) {
  return (
    <section className={\`report-panel \${span}\`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        {badge && (
          <span style={{ fontSize: '11px', fontWeight: 'bold', background: '#f0fdf4', color: '#166534', padding: '3px 10px', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

function ChartScroller({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="chart-scroll">
      <div style={{ minWidth: wide ? '600px' : '100%', width: '100%' }}>{children}</div>
    </div>
  )
}

function EmptyReport({ title }: { title: string }) {
  return (
    <div className="empty-report">
      <Stethoscope size={28} />
      <strong>{title}</strong>
      <span>سيتم تحديث المؤشرات بمجرد تسجيل واعتماد المأموريات في هذا النطاق.</span>
    </div>
  )
}

function PulseItem({ label, tone, value }: { label: string; tone: Tone; value: number }) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}
    >
      <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 'bold' }}>{label}</span>
      <strong style={{ fontSize: '16px', color: toneColors[tone] }}>{value}%</strong>
    </div>
  )
}

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0
  return Math.min(100, Math.round((numerator / denominator) * 100))
}

function toChartData(items: ChartItem[]) {
  return items.map((item) => ({ ...item, formattedValue: item.value.toLocaleString('en-US') }))
}

function arabicNumber(value: any) {
  return [Number(value || 0).toLocaleString('en-US'), 'العدد']
}

function hasData(items: ChartItem[]) {
  return items && items.some((item) => item.value > 0)
}

function getVisibleReports(focus: ReportFocus) {
  if (focus === 'all') return ['missions', 'violations', 'governorates', 'performance']
  return [focus]
}
`

fs.writeFileSync(filePath, fileContent, 'utf8')
console.log('Successfully patched analytics-dashboard.tsx with wide layouts and luxury leaderboard!')
