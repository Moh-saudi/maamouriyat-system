'use client'

import { useMemo, useState } from 'react'
import {
  Building2,
  ClipboardList,
  Clock3,
  ShieldCheck,
  Siren,
  Stethoscope,
  UserRound,
  Users,
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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type Tone = 'green' | 'blue' | 'amber' | 'red' | 'teal' | 'violet'
type ReportFocus = 'all' | 'violations' | 'governorates' | 'performance'

export type DashboardProfile = {
  fullName: string
  jobTitle: string
  level: number
  department: string
  isDemo?: boolean
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
  label: string
  value: number
  detail: string
}

const toneColors: Record<Tone, string> = {
  green: '#2a9d8f',
  blue: '#2c6fbb',
  amber: '#b7791f',
  red: '#c2413f',
  teal: '#006d77',
  violet: '#6d5bd0',
}

const roleCopy: Record<string, { title: string; focus: string }> = {
  executive: {
    title: 'مركز قيادة المنظومة',
    focus: 'مؤشرات تنفيذية لحركة المرور، المخالفات، المنشآت، المحافظات، وكفاءة فرق التفتيش.',
  },
  manager: {
    title: 'لوحة متابعة الإدارة',
    focus: 'رؤية مركزة لتوزيع التكليفات، المخالفات المفتوحة، وأداء فرق المرور الميداني.',
  },
  supervisor: {
    title: 'لوحة المشرف الميداني',
    focus: 'متابعة يومية للمأموريات المتأخرة، المفتشين الأكثر مرورًا، والمنشآت عالية المخاطر.',
  },
  lateral: {
    title: 'لوحة التصحيح والمتابعة',
    focus: 'تركيز على المخالفات حسب الخطورة وحالة التصحيح داخل المنشآت والمحافظات.',
  },
  inspector: {
    title: 'لوحة المفتش',
    focus: 'ملخص عملي للمأموريات المسندة، أيام المرور، والمخالفات التي تحتاج استكمالًا.',
  },
}

const chartMargin = { bottom: 0, left: -12, right: 8, top: 12 }
const reportFilters: Array<{ label: string; value: ReportFocus }> = [
  { label: 'الكل', value: 'all' },
  { label: 'المخالفات', value: 'violations' },
  { label: 'المحافظات', value: 'governorates' },
  { label: 'الأداء', value: 'performance' },
]

export function AnalyticsDashboard({ metrics, profile }: { metrics: DashboardMetrics; profile: DashboardProfile }) {
  const [reportFocus, setReportFocus] = useState<ReportFocus>('all')
  const role = getRole(profile)
  const completionRate = percent(metrics.missionsCompleted, metrics.missionsTotal)
  const correctionRate = percent(metrics.violationsCorrected, metrics.violationsTotal)
  const activeFacilityRate = percent(metrics.activeFacilities, metrics.facilitiesTotal)
  const violatingFacilityRate = percent(metrics.violatingFacilities, metrics.facilitiesTotal)
  const healthScore = Math.round((completionRate + correctionRate + activeFacilityRate + (100 - violatingFacilityRate)) / 4)
  const visibleReports = useMemo(() => getVisibleReports(reportFocus), [reportFocus])

  return (
    <div className="analytics-dashboard">
      <section className="command-hero">
        <div>
          <p className="eyebrow">{profile.isDemo ? 'بيانات تجريبية' : profile.department || 'منظومة المأموريات'}</p>
          <h2>{roleCopy[role].title}</h2>
          <p>{roleCopy[role].focus}</p>
        </div>
        <div
          aria-label={`${profile.fullName} - ${profile.jobTitle || `المستوى ${profile.level}`}`}
          className="profile-chip"
          title={`${profile.fullName} - ${profile.jobTitle || `المستوى ${profile.level}`}`}
        >
          <UserRound size={20} />
          <span>{profile.fullName}</span>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard delta={`${completionRate}% إنجاز`} icon={ClipboardList} label="إجمالي المأموريات" tone="blue" value={metrics.missionsTotal} />
        <MetricCard delta={`${metrics.violatingFacilities} منشأة`} icon={Building2} label="المنشآت المخالفة" tone="red" value={metrics.violatingFacilities} />
        <MetricCard delta={`${metrics.highPriorityViolations} حرجة`} icon={Siren} label="مخالفات عالية الخطورة" tone="amber" value={metrics.highPriorityViolations} />
        <MetricCard delta={`${healthScore}%`} icon={ShieldCheck} label="مؤشر صحة المنظومة" tone={healthScore >= 75 ? 'green' : 'amber'} value={healthScore} />
        <MetricCard delta={`${metrics.inspectorsTotal} مفتش`} icon={Users} label="القائمون بالمرور" tone="teal" value={metrics.inspectorsTotal} />
        <MetricCard delta={`${metrics.missionsLate} متأخرة`} icon={Clock3} label="مأموريات تحتاج تدخل" tone={metrics.missionsLate ? 'red' : 'green'} value={metrics.missionsInProgress + metrics.missionsPending} />
      </section>

      <section className="report-toolbar" aria-label="تصفية التقارير">
        <div>
          <strong>استعراض التقارير</strong>
          <span>رتب العرض حسب ما تحتاجه على شاشة الموبايل أو سطح المكتب.</span>
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

      <section className="report-grid">
        {visibleReports.includes('missions') && (
          <ReportPanel title="حركة المأموريات" subtitle="توزيع الحالات التشغيلية">
            {hasData(metrics.missionStatus) ? (
              <ChartScroller>
                <ResponsiveContainer height={280}>
                  <PieChart>
                    <Pie data={toChartData(metrics.missionStatus)} dataKey="value" innerRadius={66} outerRadius={96} paddingAngle={3} nameKey="label">
                      {metrics.missionStatus.map((item) => (
                        <Cell fill={toneColors[item.tone]} key={item.label} />
                      ))}
                    </Pie>
                    <Tooltip formatter={arabicNumber} />
                    <Legend verticalAlign="bottom" />
                  </PieChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد مأموريات بعد" />
            )}
          </ReportPanel>
        )}

        {visibleReports.includes('violations') && (
          <ReportPanel title="المخالفات حسب الشدة" subtitle="حركة، متوسطة، بسيطة، ومصححة">
            {hasData(metrics.priorityBreakdown) ? (
              <ChartScroller>
                <ResponsiveContainer height={280}>
                  <BarChart data={toChartData(metrics.priorityBreakdown)} layout="vertical" margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis dataKey="label" type="category" width={96} tickLine={false} axisLine={false} />
                    <Tooltip formatter={arabicNumber} />
                    <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                      {metrics.priorityBreakdown.map((item) => (
                        <Cell fill={toneColors[item.tone]} key={item.label} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد مخالفات مسجلة" />
            )}
          </ReportPanel>
        )}

        {visibleReports.includes('governorates') && (
          <ReportPanel title="المرور حسب المحافظة" subtitle="عدد المأموريات المنفذة والمخططة">
            {hasData(metrics.governorateVisits) ? (
              <ChartScroller wide>
                <ResponsiveContainer height={310}>
                  <BarChart data={toChartData(metrics.governorateVisits)} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={arabicNumber} />
                    <Bar dataKey="value" fill={toneColors.teal} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد بيانات محافظات" />
            )}
          </ReportPanel>
        )}

        {visibleReports.includes('governorates') && (
          <ReportPanel title="أيام المرور بكل محافظة" subtitle="عدد أيام المرور الفعلية أو المجدولة">
            {hasData(metrics.visitDaysByGovernorate) ? (
              <ChartScroller wide>
                <ResponsiveContainer height={310}>
                  <BarChart data={toChartData(metrics.visitDaysByGovernorate)} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={72} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={arabicNumber} />
                    <Bar dataKey="value" fill={toneColors.blue} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد أيام مرور محسوبة" />
            )}
          </ReportPanel>
        )}

        {visibleReports.includes('performance') && (
          <ReportPanel title="أكثر القائمين بالمرور" subtitle="ترتيب المفتشين حسب عدد المأموريات">
            {metrics.topInspectors.length ? (
              <div className="ranking-list">
                {metrics.topInspectors.map((item, index) => (
                  <div className="ranking-row" key={item.label}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </div>
                    <b>{item.value.toLocaleString('en-US')}</b>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyReport title="لا توجد بيانات مرور للمفتشين" />
            )}
          </ReportPanel>
        )}

        {visibleReports.includes('performance') && (
          <ReportPanel title="الاتجاه الشهري" subtitle="نمو حركة المرور خلال آخر ستة أشهر">
            {hasData(metrics.monthlyTrend) ? (
              <ChartScroller>
                <ResponsiveContainer height={280}>
                  <LineChart data={toChartData(metrics.monthlyTrend)} margin={chartMargin}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} />
                    <YAxis tickLine={false} axisLine={false} />
                    <Tooltip formatter={arabicNumber} />
                    <Line type="monotone" dataKey="value" stroke={toneColors.violet} strokeWidth={3} dot={{ fill: toneColors.violet, r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد حركة شهرية بعد" />
            )}
          </ReportPanel>
        )}
      </section>

      <section className="pulse-grid">
        <PulseItem label="الإنجاز" tone="green" value={completionRate} />
        <PulseItem label="تصحيح المخالفات" tone="blue" value={correctionRate} />
        <PulseItem label="جاهزية المنشآت" tone="teal" value={activeFacilityRate} />
        <PulseItem label="المنشآت المخالفة" tone="red" value={violatingFacilityRate} />
      </section>

      <style jsx>{`
        .analytics-dashboard {
          display: grid;
          gap: 12px;
        }

        .command-hero,
        :global(.metric-card),
        .report-toolbar,
        .report-panel,
        .pulse-item {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: var(--shadow);
        }

        .command-hero {
          align-items: center;
          display: grid;
          gap: 12px;
          padding: 16px;
        }

        .command-hero h2 {
          font-size: 28px;
          line-height: 1.25;
        }

        .command-hero p {
          color: var(--muted);
          line-height: 1.8;
          margin-top: 8px;
          max-width: 54rem;
        }

        .profile-chip {
          align-items: center;
          background: #f4faf9;
          border: 1px solid #cfe5e6;
          border-radius: 8px;
          color: var(--brand);
          display: inline-flex;
          gap: 8px;
          justify-self: start;
          max-width: min(100%, 240px);
          min-height: 42px;
          padding: 8px 10px;
        }

        .profile-chip span {
          color: var(--brand);
          font-size: 13px;
          font-weight: 900;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .metric-grid,
        .report-grid,
        .pulse-grid {
          display: grid;
          gap: 12px;
        }

        .metric-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .report-toolbar {
          align-items: center;
          display: grid;
          gap: 10px;
          padding: 12px 14px;
        }

        .report-toolbar span {
          color: var(--muted);
          display: block;
          font-size: 13px;
          line-height: 1.6;
          margin-top: 2px;
        }

        .segmented-control {
          background: #edf3f4;
          border: 1px solid var(--line);
          border-radius: 8px;
          display: grid;
          gap: 4px;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          padding: 4px;
        }

        .segmented-control button {
          background: transparent;
          border: 0;
          border-radius: 6px;
          color: var(--muted);
          cursor: pointer;
          font: inherit;
          font-size: 13px;
          font-weight: 800;
          min-height: 36px;
          padding: 6px;
        }

        .segmented-control button.active {
          background: var(--surface);
          box-shadow: 0 6px 18px rgba(16, 32, 39, 0.08);
          color: var(--brand);
        }

        :global(.metric-card) {
          border-top: 3px solid var(--metric-tone);
          display: grid;
          gap: 10px;
          min-height: 130px;
          padding: 14px;
        }

        :global(.metric-head) {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        :global(.metric-icon) {
          align-items: center;
          background: var(--metric-soft);
          border-radius: 8px;
          display: inline-flex;
          height: 40px;
          justify-content: center;
          width: 40px;
        }

        :global(.metric-body) {
          align-self: end;
          display: grid;
          gap: 7px;
        }

        :global(.metric-card strong) {
          font-size: clamp(26px, 4vw, 34px);
          line-height: 1;
        }

        :global(.metric-card span),
        .report-panel p,
        .pulse-item span,
        .ranking-row small {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
        }

        :global(.metric-note) {
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.4;
          max-width: 120px;
          padding: 4px 8px;
          text-align: center;
          white-space: nowrap;
        }

        .report-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .report-panel {
          display: grid;
          gap: 12px;
          min-height: 360px;
          min-width: 0;
          overflow: hidden;
          padding: 16px;
        }

        .report-panel h3 {
          font-size: 18px;
          margin: 0;
        }

        .chart-scroll {
          margin: 0 -4px;
          max-width: 100%;
          min-width: 0;
          overflow-x: auto;
          padding: 0 4px 4px;
        }

        .chart-canvas {
          height: 100%;
          min-width: 420px;
          width: 100%;
        }

        .chart-canvas.wide {
          min-width: 560px;
        }

        .empty-report {
          align-content: center;
          border: 1px dashed var(--line);
          border-radius: 8px;
          color: var(--muted);
          display: grid;
          gap: 8px;
          justify-items: center;
          min-height: 230px;
          padding: 18px;
          text-align: center;
        }

        .empty-report strong {
          color: var(--ink);
        }

        .ranking-list {
          display: grid;
          gap: 10px;
        }

        .ranking-row {
          align-items: center;
          border: 1px solid var(--line);
          border-radius: 8px;
          display: grid;
          gap: 10px;
          grid-template-columns: 34px 1fr 44px;
          padding: 10px;
        }

        .ranking-row > span {
          align-items: center;
          background: #edf7f7;
          border-radius: 8px;
          color: var(--brand);
          display: inline-flex;
          font-weight: 900;
          height: 34px;
          justify-content: center;
          width: 34px;
        }

        .ranking-row b {
          color: var(--brand);
          font-size: 20px;
          text-align: end;
        }

        .pulse-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .pulse-item {
          display: grid;
          gap: 8px;
          padding: 14px;
        }

        .pulse-ring {
          align-items: center;
          border: 8px solid #edf3f4;
          border-radius: 999px;
          display: inline-flex;
          font-weight: 900;
          height: 78px;
          justify-content: center;
          width: 78px;
        }

        @media (min-width: 760px) {
          .command-hero {
            grid-template-columns: 1fr auto;
          }

          .metric-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .report-toolbar {
            grid-template-columns: 1fr auto;
          }

          .report-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pulse-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .chart-canvas,
          .chart-canvas.wide {
            min-width: 0;
          }
        }

        @media (max-width: 640px) {
          .command-hero {
            padding: 14px;
          }

          .command-hero h2 {
            font-size: 22px;
          }

          .profile-chip {
            justify-self: end;
            max-width: 48px;
            padding: 10px;
          }

          .profile-chip span {
            display: none;
          }

          .metric-grid,
          .pulse-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          :global(.metric-card) {
            min-height: 128px;
          }

          :global(.metric-card strong) {
            font-size: 32px;
          }

          .report-panel {
            min-height: 320px;
            padding: 12px;
          }

          .segmented-control {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
      `}</style>
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
          '--metric-soft': `${toneColors[tone]}14`,
          '--metric-tone': toneColors[tone],
        } as React.CSSProperties
      }
    >
      <div className="metric-head">
        <span className="metric-icon" style={{ color: toneColors[tone] }}>
          <Icon size={21} />
        </span>
        <span className="metric-note" style={{ backgroundColor: `${toneColors[tone]}18`, color: toneColors[tone] }}>
          {delta}
        </span>
      </div>
      <div className="metric-body">
        <strong>{value.toLocaleString('en-US')}</strong>
        <span>{label}</span>
      </div>
    </article>
  )
}

function ReportPanel({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <section className="report-panel">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function ChartScroller({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="chart-scroll">
      <div className={`chart-canvas ${wide ? 'wide' : ''}`}>{children}</div>
    </div>
  )
}

function EmptyReport({ title }: { title: string }) {
  return (
    <div className="empty-report">
      <Stethoscope size={24} />
      <strong>{title}</strong>
      <span>ستظهر البيانات هنا تلقائيًا بعد تسجيل المأموريات والمخالفات.</span>
    </div>
  )
}

function PulseItem({ label, tone, value }: { label: string; tone: Tone; value: number }) {
  return (
    <article className="pulse-item">
      <div className="pulse-ring" style={{ borderColor: `${toneColors[tone]}55`, color: toneColors[tone] }}>
        {value}%
      </div>
      <strong>{label}</strong>
      <span>مؤشر محسوب من البيانات التشغيلية الحالية.</span>
    </article>
  )
}

function getRole(profile: DashboardProfile) {
  if (profile.isDemo || profile.level <= 2) return 'executive'
  if (profile.department.includes('التصحيح')) return 'lateral'
  if (profile.level <= 4) return 'manager'
  if (profile.level <= 6) return 'supervisor'
  return 'inspector'
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function toChartData(items: ChartItem[]) {
  return items.map((item) => ({ ...item, fill: toneColors[item.tone] }))
}

function getVisibleReports(reportFocus: ReportFocus) {
  if (reportFocus === 'violations') return ['violations']
  if (reportFocus === 'governorates') return ['governorates']
  if (reportFocus === 'performance') return ['performance']
  return ['missions', 'violations', 'governorates', 'performance']
}

function hasData(items: ChartItem[]) {
  return items.some((item) => item.value > 0)
}

function arabicNumber(value?: number | string | readonly (number | string)[]) {
  if (Array.isArray(value)) {
    return value.join(' - ')
  }

  if (typeof value === 'number') {
    return value.toLocaleString('en-US')
  }

  return value ?? ''
}
