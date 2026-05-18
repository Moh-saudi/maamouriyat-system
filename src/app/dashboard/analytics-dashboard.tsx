'use client'

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react'

type Tone = 'green' | 'blue' | 'amber' | 'red' | 'teal'

export type DashboardProfile = {
  fullName: string
  jobTitle: string
  level: number
  department: string
  isDemo?: boolean
}

export type DashboardMetrics = {
  missionsTotal: number
  missionsCompleted: number
  missionsInProgress: number
  missionsPending: number
  missionsLate: number
  violationsTotal: number
  violationsOpen: number
  violationsCorrected: number
  highPriorityViolations: number
  facilitiesTotal: number
  activeFacilities: number
  usersTotal: number
  inspectorsTotal: number
  missionStatus: ChartItem[]
  violationStatus: ChartItem[]
  facilityTypes: ChartItem[]
  monthlyTrend: ChartItem[]
}

export type ChartItem = {
  label: string
  value: number
  tone: Tone
}

const toneColors: Record<Tone, string> = {
  green: '#2a9d8f',
  blue: '#2c6fbb',
  amber: '#b7791f',
  red: '#c2413f',
  teal: '#006d77',
}

const roleCopy: Record<string, { title: string; focus: string }> = {
  executive: {
    title: 'لوحة القيادة التنفيذية',
    focus: 'رؤية شاملة لكل المأموريات والمخالفات والمنشآت ومؤشرات الأداء على مستوى المنظومة.',
  },
  manager: {
    title: 'لوحة متابعة الإدارة',
    focus: 'تركيز على توزيع المأموريات، نسب الإنجاز، المخالفات المفتوحة، ومتابعة فرق العمل.',
  },
  supervisor: {
    title: 'لوحة المشرف الميداني',
    focus: 'متابعة التكليفات الجارية، التأخير، جودة الإغلاق، والمخالفات التي تحتاج تصعيدًا.',
  },
  lateral: {
    title: 'لوحة التصحيح والمتابعة',
    focus: 'تركيز على المخالفات المفتوحة، إجراءات التصحيح، ونقاط التعثر داخل المنشآت.',
  },
  inspector: {
    title: 'لوحة المفتش',
    focus: 'عرض مأمورياتك، المهام المتأخرة، والمخالفات المسجلة خلال التنفيذ الميداني.',
  },
}

export function AnalyticsDashboard({ metrics, profile }: { metrics: DashboardMetrics; profile: DashboardProfile }) {
  const role = getRole(profile)
  const completionRate = percent(metrics.missionsCompleted, metrics.missionsTotal)
  const correctionRate = percent(metrics.violationsCorrected, metrics.violationsTotal)
  const activeFacilityRate = percent(metrics.activeFacilities, metrics.facilitiesTotal)
  const healthScore = Math.round((completionRate + correctionRate + activeFacilityRate) / 3)

  const cards = getCards(metrics, role, healthScore)

  return (
    <div className="analytics-dashboard">
      <section className="analytics-hero">
        <div>
          <p className="eyebrow">{profile.isDemo ? 'بيانات تجريبية' : profile.department || 'منظومة المأموريات'}</p>
          <h2>{roleCopy[role].title}</h2>
          <p>{roleCopy[role].focus}</p>
        </div>
        <div className="profile-badge">
          <ShieldCheck size={18} />
          <span>{profile.fullName}</span>
          <small>{profile.jobTitle || `المستوى ${profile.level}`}</small>
        </div>
      </section>

      <section className="insight-grid">
        {cards.map((card) => (
          <MetricCard key={card.label} {...card} />
        ))}
      </section>

      <section className="chart-grid">
        <ChartPanel title="حالة المأموريات" subtitle={`${metrics.missionsTotal} مأمورية داخل نطاق حسابك`}>
          <DonutChart items={metrics.missionStatus} />
        </ChartPanel>

        <ChartPanel title="المخالفات" subtitle={`${metrics.violationsOpen} مفتوحة وتحتاج متابعة`}>
          <BarChart items={metrics.violationStatus} />
        </ChartPanel>

        <ChartPanel title="المنشآت حسب النوع" subtitle={`${metrics.activeFacilities} منشأة نشطة`}>
          <BarChart items={metrics.facilityTypes} compact />
        </ChartPanel>

        <ChartPanel title="الاتجاه الشهري" subtitle="حجم المأموريات خلال آخر ستة أشهر">
          <LineChart items={metrics.monthlyTrend} />
        </ChartPanel>
      </section>

      <section className="system-pulse">
        <PulseItem label="معدل الإنجاز" value={completionRate} tone="green" />
        <PulseItem label="تصحيح المخالفات" value={correctionRate} tone="blue" />
        <PulseItem label="جاهزية المنشآت" value={activeFacilityRate} tone="teal" />
        <PulseItem label="مؤشر صحة المنظومة" value={healthScore} tone={healthScore >= 70 ? 'green' : 'amber'} />
      </section>

      <style jsx>{`
        .analytics-dashboard,
        .chart-grid,
        .insight-grid,
        .system-pulse {
          display: grid;
          gap: 14px;
        }

        .analytics-hero,
        .metric-card,
        .chart-panel,
        .pulse-item {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: var(--shadow);
        }

        .analytics-hero {
          align-items: center;
          display: grid;
          gap: 16px;
          padding: 18px;
        }

        .analytics-hero h2 {
          font-size: 24px;
          line-height: 1.35;
        }

        .analytics-hero p {
          color: var(--muted);
          line-height: 1.8;
          margin-top: 6px;
        }

        .profile-badge {
          align-items: center;
          background: #edf7f7;
          border: 1px solid #cfe5e6;
          border-radius: 8px;
          color: var(--brand);
          display: grid;
          gap: 4px 8px;
          grid-template-columns: 22px 1fr;
          justify-self: start;
          padding: 10px 12px;
        }

        .profile-badge small {
          color: var(--muted);
          grid-column: 2;
        }

        .insight-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .metric-card {
          display: grid;
          gap: 10px;
          min-height: 138px;
          padding: 14px;
        }

        .metric-card header {
          align-items: center;
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }

        .metric-icon {
          align-items: center;
          background: #edf7f7;
          border-radius: 8px;
          display: inline-flex;
          height: 38px;
          justify-content: center;
          width: 38px;
        }

        .metric-card span,
        .chart-panel p,
        .pulse-item span {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
        }

        .metric-card strong {
          font-size: 30px;
          line-height: 1;
        }

        .delta {
          border-radius: 999px;
          font-weight: 800;
          padding: 4px 8px;
        }

        .chart-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .chart-panel {
          display: grid;
          gap: 16px;
          min-height: 310px;
          padding: 16px;
        }

        .chart-panel h3 {
          font-size: 18px;
          margin: 0;
        }

        .donut-wrap {
          align-items: center;
          display: grid;
          gap: 16px;
          grid-template-columns: 150px 1fr;
        }

        .donut {
          height: 150px;
          transform: rotate(-90deg);
          width: 150px;
        }

        .donut text {
          direction: ltr;
          font-weight: 800;
          transform: rotate(90deg);
          transform-origin: center;
        }

        .legend,
        .bars {
          display: grid;
          gap: 10px;
        }

        .legend-row,
        .bar-row {
          align-items: center;
          display: grid;
          gap: 8px;
          grid-template-columns: 12px minmax(88px, 1fr) 42px;
        }

        .swatch {
          border-radius: 99px;
          height: 10px;
          width: 10px;
        }

        .bar-track {
          background: #edf3f4;
          border-radius: 999px;
          height: 11px;
          overflow: hidden;
        }

        .bar-fill {
          border-radius: inherit;
          height: 100%;
          min-width: 3px;
        }

        .line-chart {
          align-items: end;
          display: grid;
          gap: 8px;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          min-height: 190px;
        }

        .line-column {
          align-items: center;
          display: grid;
          gap: 8px;
          justify-items: center;
        }

        .line-bar {
          align-self: end;
          background: linear-gradient(180deg, var(--brand-2), var(--brand));
          border-radius: 8px 8px 3px 3px;
          min-height: 8px;
          width: 100%;
        }

        .line-column small {
          color: var(--muted);
          font-size: 11px;
        }

        .system-pulse {
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
          height: 74px;
          justify-content: center;
          width: 74px;
        }

        @media (min-width: 760px) {
          .analytics-hero {
            grid-template-columns: 1fr auto;
          }

          .insight-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }

          .chart-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .system-pulse {
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

function ChartPanel({ children, subtitle, title }: { children: React.ReactNode; subtitle: string; title: string }) {
  return (
    <section className="chart-panel">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      {children}
    </section>
  )
}

function DonutChart({ items }: { items: ChartItem[] }) {
  const total = Math.max(sum(items), 1)
  let offset = 0
  const radius = 54
  const circumference = 2 * Math.PI * radius

  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 140 140" role="img" aria-label="حالة المأموريات">
        <circle cx="70" cy="70" fill="none" r={radius} stroke="#edf3f4" strokeWidth="18" />
        {items.map((item) => {
          const length = (item.value / total) * circumference
          const segment = (
            <circle
              cx="70"
              cy="70"
              fill="none"
              key={item.label}
              r={radius}
              stroke={toneColors[item.tone]}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
              strokeWidth="18"
            />
          )
          offset += length
          return segment
        })}
        <text x="70" y="75" textAnchor="middle" fill="#102027" fontSize="20">
          {total}
        </text>
      </svg>
      <Legend items={items} />
    </div>
  )
}

function BarChart({ compact = false, items }: { compact?: boolean; items: ChartItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="bars">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span className="swatch" style={{ backgroundColor: toneColors[item.tone] }} />
          <div>
            <span>{item.label}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ backgroundColor: toneColors[item.tone], width: `${Math.max((item.value / max) * 100, compact ? 8 : 4)}%` }}
              />
            </div>
          </div>
          <strong>{item.value.toLocaleString('ar-EG')}</strong>
        </div>
      ))}
    </div>
  )
}

function LineChart({ items }: { items: ChartItem[] }) {
  const max = Math.max(...items.map((item) => item.value), 1)

  return (
    <div className="line-chart">
      {items.map((item) => (
        <div className="line-column" key={item.label}>
          <div className="line-bar" style={{ height: `${Math.max((item.value / max) * 160, 8)}px` }} />
          <strong>{item.value.toLocaleString('ar-EG')}</strong>
          <small>{item.label}</small>
        </div>
      ))}
    </div>
  )
}

function Legend({ items }: { items: ChartItem[] }) {
  return (
    <div className="legend">
      {items.map((item) => (
        <div className="legend-row" key={item.label}>
          <span className="swatch" style={{ backgroundColor: toneColors[item.tone] }} />
          <span>{item.label}</span>
          <strong>{item.value.toLocaleString('ar-EG')}</strong>
        </div>
      ))}
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
      <span>مؤشر لحظي محسوب من بيانات المنظومة المتاحة للحساب.</span>
    </article>
  )
}

function getRole(profile: DashboardProfile) {
  if (profile.isDemo || profile.level <= 2) return 'executive'
  if (profile.isDemo === false && profile.department.includes('التصحيح')) return 'lateral'
  if (profile.level <= 4) return 'manager'
  if (profile.level <= 6) return 'supervisor'
  return 'inspector'
}

function getCards(metrics: DashboardMetrics, role: string, healthScore: number) {
  const common = [
    {
      delta: `${percent(metrics.missionsCompleted, metrics.missionsTotal)}%`,
      icon: CheckCircle2,
      label: 'نسبة إنجاز المأموريات',
      tone: 'green' as Tone,
      value: metrics.missionsCompleted,
    },
    {
      delta: `${metrics.missionsLate} متأخرة`,
      icon: Clock3,
      label: 'مأموريات تحتاج تدخل',
      tone: metrics.missionsLate > 0 ? ('red' as Tone) : ('green' as Tone),
      value: metrics.missionsInProgress + metrics.missionsPending,
    },
    {
      delta: `${metrics.highPriorityViolations} عالية`,
      icon: AlertTriangle,
      label: 'مخالفات مفتوحة',
      tone: metrics.violationsOpen > 0 ? ('amber' as Tone) : ('green' as Tone),
      value: metrics.violationsOpen,
    },
    {
      delta: `${healthScore}%`,
      icon: ShieldCheck,
      label: 'مؤشر صحة المنظومة',
      tone: healthScore >= 70 ? ('teal' as Tone) : ('amber' as Tone),
      value: healthScore,
    },
  ]

  if (role === 'executive') {
    return [
      { delta: 'كل المنظومة', icon: ClipboardList, label: 'إجمالي المأموريات', tone: 'blue' as Tone, value: metrics.missionsTotal },
      { delta: `${metrics.inspectorsTotal} مفتش`, icon: Users, label: 'المستخدمون النشطون', tone: 'teal' as Tone, value: metrics.usersTotal },
      { delta: `${percent(metrics.activeFacilities, metrics.facilitiesTotal)}% نشطة`, icon: Building2, label: 'المنشآت المسجلة', tone: 'green' as Tone, value: metrics.facilitiesTotal },
      common[3],
    ]
  }

  if (role === 'lateral') {
    return [
      common[2],
      { delta: `${percent(metrics.violationsCorrected, metrics.violationsTotal)}%`, icon: CheckCircle2, label: 'مخالفات تم تصحيحها', tone: 'green' as Tone, value: metrics.violationsCorrected },
      { delta: 'أولوية متابعة', icon: AlertTriangle, label: 'مخالفات عالية الخطورة', tone: 'red' as Tone, value: metrics.highPriorityViolations },
      common[3],
    ]
  }

  return common
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function sum(items: ChartItem[]) {
  return items.reduce((total, item) => total + item.value, 0)
}
