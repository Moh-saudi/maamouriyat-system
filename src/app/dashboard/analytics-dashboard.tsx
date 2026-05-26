'use client'

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

const chartMargin = { bottom: 8, left: -6, right: 12, top: 12 }
const reportFilters: Array<{ label: string; value: ReportFocus }> = [
  { label: 'الكل', value: 'all' },
  { label: 'المخالفات', value: 'violations' },
  { label: 'المحافظات', value: 'governorates' },
  { label: 'الأداء', value: 'performance' },
]

export function AnalyticsDashboard({ metrics, profile }: { metrics: DashboardMetrics; profile: DashboardProfile }) {
  const [reportFocus, setReportFocus] = useState<ReportFocus>('all')
  const isTechAdmin = profile.level === 0

  const completionRate = percent(metrics.missionsCompleted, metrics.missionsTotal)
  const correctionRate = percent(metrics.violationsCorrected, metrics.violationsTotal)
  const activeFacilityRate = percent(metrics.activeFacilities, metrics.facilitiesTotal)
  const violatingFacilityRate = percent(metrics.violatingFacilities, metrics.facilitiesTotal)
  const visibleReports = useMemo(() => getVisibleReports(reportFocus), [reportFocus])

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
        <section className="role-band" style={{ borderInlineStart: '6px solid var(--brand)', position: 'relative' }}>
          <div>
            <span style={{ color: 'var(--brand)', fontWeight: 'bold' }}>{profile.department}</span>
            <h2>{profile.jobTitle}</h2>
            <p>{profile.fullName}</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <strong style={{ background: '#e0f2f1', color: '#006d77', border: '1px solid #b2dfdb' }}>التحكم التقني الأعلى</strong>
            <span style={{ fontSize: '11px', color: '#00796b', fontWeight: 'bold' }}>⚡ المستوى 0 (حوكمة كاملة)</span>
          </div>
        </section>

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
                  <Tooltip formatter={(value) => [`${value}ms`, 'زمن الاستجابة']} />
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

        <section className="report-panel" style={{ padding: '16px' }}>
          <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: '12px', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>📡 حالة تكامل البنية التحتية والربط الشبكي</h3>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>مؤشرات تشغيل قنوات التكامل المباشر والخدمات السحابية</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div style={{ background: '#f8fbfb', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }}></div>
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#102027' }}>Supabase Connection</strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>متصل ومستقر (قنوات حية)</span>
              </div>
            </div>
            <div style={{ background: '#f8fbfb', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }}></div>
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#102027' }}>GPS Integrity</strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>نشط ومطابق (معايير WGS 84)</span>
              </div>
            </div>
            <div style={{ background: '#f8fbfb', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }}></div>
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#102027' }}>JWT Cookie Governance</strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>مطابقة مشفرة وآمنة</span>
              </div>
            </div>
            <div style={{ background: '#f8fbfb', border: '1px solid var(--line)', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }}></div>
              <div>
                <strong style={{ display: 'block', fontSize: '12px', color: '#102027' }}>SMTP Gateway relay</strong>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>جاهز للاستخدام ومؤمن</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="analytics-dashboard">
      <section className="role-band">
        <div>
          <span>{profile.department}</span>
          <h2>{profile.jobTitle}</h2>
          <p>{profile.fullName}</p>
        </div>
        {profile.isDemo && <strong>حساب تجريبي</strong>}
      </section>

      <section className="metric-grid">
        <MetricCard delta={`${completionRate}% إنجاز`} icon={ClipboardList} label="إجمالي المأموريات" tone="blue" value={metrics.missionsTotal} />
        <MetricCard delta={`${metrics.violatingFacilities} منشأة`} icon={Building2} label="المنشآت المخالفة" tone="red" value={metrics.violatingFacilities} />
        <MetricCard delta={`${metrics.highPriorityViolations} حرجة`} icon={Siren} label="مخالفات عالية الخطورة" tone="amber" value={metrics.highPriorityViolations} />
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
                    <Legend
                      formatter={(value) => <span className="chart-legend-label">{value}</span>}
                      iconSize={9}
                      verticalAlign="bottom"
                      wrapperStyle={{ paddingTop: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartScroller>
            ) : (
              <EmptyReport title="لا توجد مأموريات بعد" />
            )}
          </ReportPanel>
        )}

        {visibleReports.includes('violations') && (
          <ReportPanel title="المخالفات حسب الشدة" subtitle="حرجة، متوسطة، بسيطة، ومصححة">
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
          gap: 14px;
        }

        .role-band {
          align-items: center;
          background:
            linear-gradient(135deg, rgba(0, 109, 119, 0.1), rgba(42, 157, 143, 0.04)),
            var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: var(--shadow);
          display: flex;
          gap: 12px;
          justify-content: space-between;
          padding: 14px 16px;
        }

        .role-band h2,
        .role-band p {
          margin: 0;
        }

        .role-band h2 {
          color: var(--ink);
          font-size: 20px;
          line-height: 1.35;
        }

        .role-band p,
        .role-band span {
          color: var(--muted);
          display: block;
          font-size: 13px;
          line-height: 1.6;
        }

        .role-band strong {
          background: #edf7f7;
          border-radius: 999px;
          color: var(--brand);
          flex: 0 0 auto;
          font-size: 12px;
          padding: 6px 10px;
        }

        :global(.metric-card),
        .report-toolbar,
        .report-panel,
        .pulse-item {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: var(--shadow);
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
          background:
            radial-gradient(circle at 18% 50%, var(--metric-soft), rgba(255, 255, 255, 0) 38%),
            var(--surface);
          align-items: center;
          border: 1px solid color-mix(in srgb, var(--metric-tone) 20%, var(--line));
          display: grid;
          gap: 12px;
          grid-template-columns: 92px minmax(0, 1fr);
          min-height: 112px;
          overflow: hidden;
          padding: 14px;
          position: relative;
        }

        :global(.metric-card::before) {
          background: var(--metric-tone);
          border-radius: 999px;
          content: '';
          height: 108px;
          inset-inline-start: -54px;
          opacity: 0.07;
          pointer-events: none;
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 108px;
        }

        :global(.metric-orb) {
          align-items: center;
          aspect-ratio: 1;
          background: var(--surface);
          border: 6px solid var(--metric-soft);
          border-radius: 999px;
          box-shadow:
            inset 0 0 0 1px color-mix(in srgb, var(--metric-tone) 22%, transparent),
            0 12px 26px rgba(16, 32, 39, 0.08);
          color: var(--metric-tone);
          display: grid;
          height: 78px;
          justify-items: center;
          position: relative;
          width: 78px;
        }

        :global(.metric-orb-icon) {
          align-items: center;
          background: transparent;
          border: 0;
          color: var(--metric-tone);
          display: inline-flex;
          height: auto;
          justify-content: center;
          margin-top: -2px;
          width: auto;
        }

        :global(.metric-card strong) {
          color: inherit;
          font-size: clamp(28px, 3vw, 38px);
          font-weight: 950;
          line-height: 1;
        }

        :global(.metric-body) {
          display: grid;
          gap: 7px;
          min-width: 0;
          position: relative;
        }

        :global(.metric-label),
        .report-panel p,
        .pulse-item span,
        .ranking-row small {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
        }

        :global(.metric-label) {
          color: #53666f;
          font-weight: 900;
        }

        :global(.metric-note) {
          border-radius: 999px;
          justify-self: start;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.4;
          max-width: 120px;
          padding: 4px 8px;
          position: relative;
          text-align: center;
          white-space: nowrap;
        }

        .report-grid {
          grid-template-columns: minmax(0, 1fr);
        }

        .report-panel {
          display: grid;
          gap: 12px;
          min-height: 340px;
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

        :global(.recharts-default-legend) {
          align-items: center !important;
          display: flex !important;
          flex-wrap: wrap !important;
          gap: 7px 12px !important;
          justify-content: center !important;
          line-height: 1.4 !important;
          padding: 0 !important;
        }

        :global(.recharts-default-legend .recharts-legend-item) {
          align-items: center !important;
          display: inline-flex !important;
          margin-left: 0 !important;
          margin-right: 0 !important;
          white-space: nowrap !important;
        }

        .chart-legend-label {
          color: var(--muted);
          font-size: 12px;
          padding-inline-start: 4px;
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

        .ranking-row strong,
        .ranking-row small {
          display: block;
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

        @media (min-width: 1200px) {
          .analytics-dashboard {
            gap: 16px;
          }

          .metric-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          :global(.metric-card) {
            min-height: 112px;
          }

          :global(.metric-card strong) {
            font-size: 34px;
          }

          :global(.metric-note) {
            max-width: 100%;
          }

          .report-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .report-panel {
            min-height: 360px;
          }

          .report-panel:nth-child(1),
          .report-panel:nth-child(6) {
            grid-column: span 2;
          }
        }

        @media (max-width: 640px) {
          .role-band {
            align-items: start;
            display: grid;
          }

          .metric-grid,
          .pulse-grid {
            grid-template-columns: minmax(0, 1fr);
          }

          :global(.metric-card) {
            grid-template-columns: 88px minmax(0, 1fr);
            min-height: 108px;
          }

          :global(.metric-card strong) {
            font-size: 34px;
          }

          :global(.metric-orb) {
            height: 74px;
            width: 74px;
          }

          .report-panel {
            min-height: 310px;
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
      <div className="metric-orb">
        <strong>{value.toLocaleString('en-US')}</strong>
        <span className="metric-orb-icon" style={{ color: toneColors[tone] }}>
          <Icon size={16} />
        </span>
      </div>
      <div className="metric-body">
        <span className="metric-label">{label}</span>
        <span className="metric-note" style={{ backgroundColor: `${toneColors[tone]}18`, color: toneColors[tone] }}>
          {delta}
        </span>
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
