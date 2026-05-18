'use client'

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  MapPinned,
  ShieldCheck,
  Siren,
  Stethoscope,
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

export function AnalyticsDashboard({ metrics, profile }: { metrics: DashboardMetrics; profile: DashboardProfile }) {
  const role = getRole(profile)
  const completionRate = percent(metrics.missionsCompleted, metrics.missionsTotal)
  const correctionRate = percent(metrics.violationsCorrected, metrics.violationsTotal)
  const activeFacilityRate = percent(metrics.activeFacilities, metrics.facilitiesTotal)
  const violatingFacilityRate = percent(metrics.violatingFacilities, metrics.facilitiesTotal)
  const healthScore = Math.round((completionRate + correctionRate + activeFacilityRate + (100 - violatingFacilityRate)) / 4)

  return (
    <div className="analytics-dashboard">
      <section className="command-hero">
        <div>
          <p className="eyebrow">{profile.isDemo ? 'بيانات تجريبية' : profile.department || 'منظومة المأموريات'}</p>
          <h2>{roleCopy[role].title}</h2>
          <p>{roleCopy[role].focus}</p>
        </div>
        <div className="profile-card">
          <ShieldCheck size={20} />
          <strong>{profile.fullName}</strong>
          <span>{profile.jobTitle || `المستوى ${profile.level}`}</span>
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

      <section className="report-grid">
        <ReportPanel title="حركة المأموريات" subtitle="توزيع الحالات التشغيلية">
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
        </ReportPanel>

        <ReportPanel title="المخالفات حسب الشدة" subtitle="حركة، متوسطة، بسيطة، ومصححة">
          <ResponsiveContainer height={280}>
            <BarChart data={toChartData(metrics.priorityBreakdown)} layout="vertical" margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis dataKey="label" type="category" width={90} tickLine={false} axisLine={false} />
              <Tooltip formatter={arabicNumber} />
              <Bar dataKey="value" radius={[8, 8, 8, 8]}>
                {metrics.priorityBreakdown.map((item) => (
                  <Cell fill={toneColors[item.tone]} key={item.label} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ReportPanel>

        <ReportPanel title="المرور حسب المحافظة" subtitle="عدد المأموريات المنفذة والمخططة">
          <ResponsiveContainer height={310}>
            <BarChart data={toChartData(metrics.governorateVisits)} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={64} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={arabicNumber} />
              <Bar dataKey="value" fill={toneColors.teal} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportPanel>

        <ReportPanel title="أيام المرور بكل محافظة" subtitle="عدد أيام المرور الفعلية أو المجدولة">
          <ResponsiveContainer height={310}>
            <BarChart data={toChartData(metrics.visitDaysByGovernorate)} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={64} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={arabicNumber} />
              <Bar dataKey="value" fill={toneColors.blue} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ReportPanel>

        <ReportPanel title="أكثر القائمين بالمرور" subtitle="ترتيب المفتشين حسب عدد المأموريات">
          <div className="ranking-list">
            {metrics.topInspectors.map((item, index) => (
              <div className="ranking-row" key={item.label}>
                <span>{index + 1}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                <b>{item.value.toLocaleString('ar-EG')}</b>
              </div>
            ))}
          </div>
        </ReportPanel>

        <ReportPanel title="الاتجاه الشهري" subtitle="نمو حركة المرور خلال آخر ستة أشهر">
          <ResponsiveContainer height={280}>
            <LineChart data={toChartData(metrics.monthlyTrend)} margin={chartMargin}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={arabicNumber} />
              <Line type="monotone" dataKey="value" stroke={toneColors.violet} strokeWidth={3} dot={{ fill: toneColors.violet, r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ReportPanel>
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
          gap: 16px;
        }

        .command-hero,
        .metric-card,
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
          gap: 18px;
          padding: 20px;
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

        .profile-card {
          align-items: center;
          background: #edf7f7;
          border: 1px solid #cfe5e6;
          border-radius: 8px;
          color: var(--brand);
          display: grid;
          gap: 4px 10px;
          grid-template-columns: 24px 1fr;
          justify-self: start;
          min-width: 240px;
          padding: 12px;
        }

        .profile-card span {
          color: var(--muted);
          grid-column: 2;
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

        .metric-card {
          display: grid;
          gap: 12px;
          min-height: 142px;
          padding: 14px;
        }

        .metric-card header {
          align-items: center;
          display: flex;
          gap: 10px;
          justify-content: space-between;
        }

        .metric-icon {
          align-items: center;
          background: #edf7f7;
          border-radius: 8px;
          display: inline-flex;
          height: 40px;
          justify-content: center;
          width: 40px;
        }

        .metric-card strong {
          font-size: 32px;
          line-height: 1;
        }

        .metric-card span,
        .report-panel p,
        .pulse-item span,
        .ranking-row small {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
        }

        .delta {
          border-radius: 999px;
          font-size: 12px;
          font-weight: 800;
          padding: 4px 8px;
        }

        .report-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .report-panel {
          display: grid;
          gap: 12px;
          min-height: 360px;
          padding: 16px;
        }

        .report-panel h3 {
          font-size: 18px;
          margin: 0;
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

          .report-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pulse-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
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
    <article className="metric-card">
      <header>
        <span className="metric-icon" style={{ color: toneColors[tone] }}>
          <Icon size={21} />
        </span>
        <span className="delta" style={{ backgroundColor: `${toneColors[tone]}18`, color: toneColors[tone] }}>
          {delta}
        </span>
      </header>
      <strong>{value.toLocaleString('ar-EG')}</strong>
      <span>{label}</span>
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

function arabicNumber(value?: number | string | readonly (number | string)[]) {
  if (Array.isArray(value)) {
    return value.join(' - ')
  }

  if (typeof value === 'number') {
    return value.toLocaleString('ar-EG')
  }

  return value ?? ''
}
