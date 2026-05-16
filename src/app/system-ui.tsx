'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Filter,
  Home,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react'

type View = 'login' | 'dashboard' | 'missions' | 'violations'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const canUseSupabase = Boolean(
  supabaseUrl && supabasePublishableKey && supabasePublishableKey !== 'your-anon-key-here',
)
const supabase = canUseSupabase ? createBrowserSupabaseClient() : null
const ministryLogo = '/mohp-logo.png'

const stats = [
  { label: 'المأموريات المنجزة', value: '124', tone: 'green', icon: CheckCircle2 },
  { label: 'قيد التنفيذ', value: '18', tone: 'blue', icon: ClipboardList },
  { label: 'مأموريات متأخرة', value: '5', tone: 'red', icon: AlertTriangle },
  { label: 'إجمالي المنشآت', value: '890', tone: 'amber', icon: Building2 },
]

const missions = [
  {
    id: 'MIS-2026-05-00001',
    facility: 'مستشفى النيل العام',
    inspector: 'أحمد محمود',
    date: '15 مايو',
    status: 'مكتملة',
    tone: 'green',
    violations: 2,
  },
  {
    id: 'MIS-2026-05-00002',
    facility: 'مستشفى الرحمة الخاصة',
    inspector: 'سارة خالد',
    date: '16 مايو',
    status: 'قيد التنفيذ',
    tone: 'blue',
    violations: 0,
  },
  {
    id: 'MIS-2026-05-00003',
    facility: 'معمل المختار للتحاليل',
    inspector: 'محمد علي',
    date: '17 مايو',
    status: 'بانتظار الاعتماد',
    tone: 'amber',
    violations: 1,
  },
  {
    id: 'MIS-2026-05-00004',
    facility: 'عيادة الأمل الخاصة',
    inspector: 'منى حسن',
    date: '18 مايو',
    status: 'تحت التصويب',
    tone: 'red',
    violations: 5,
  },
]

const violations = [
  { title: 'غياب سجل مكافحة العدوى', facility: 'عيادة الأمل الخاصة', severity: 'عالية', tone: 'red' },
  { title: 'تأخر تحديث تراخيص العاملين', facility: 'مستشفى الرحمة الخاصة', severity: 'متوسطة', tone: 'amber' },
  { title: 'نقص مستلزمات الطوارئ', facility: 'مستشفى النيل العام', severity: 'عالية', tone: 'red' },
]

export function SystemUI({ view }: { view: View }) {
  if (view === 'login') {
    return <LoginScreen />
  }

  return (
    <AppShell view={view}>
      {view === 'dashboard' && <DashboardScreen />}
      {view === 'missions' && <MissionsScreen />}
      {view === 'violations' && <ViolationsScreen />}
    </AppShell>
  )
}

export function DashboardShell({ children, view = 'dashboard' }: { children: React.ReactNode; view?: Exclude<View, 'login'> }) {
  return <AppShell view={view}>{children}</AppShell>
}

function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!supabase) {
      router.push('/dashboard')
      return
    }

    setLoading(true)
    const result = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (result.error) {
      setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      return
    }

    router.push('/dashboard')
  }

  return (
    <main className="login-screen">
      <Style />
      <section className="login-hero">
        <MinistryLogo size="hero" />
        <p className="eyebrow">وزارة الصحة والسكان</p>
        <h1>نظام إدارة المأموريات</h1>
        <p className="hero-copy">متابعة ميدانية أسرع، قرارات أوضح، وتجربة موبايل جاهزة لفترة الاختبار.</p>
      </section>

      <form className="login-panel" onSubmit={handleLogin}>
        <div className="panel-logo">
          <MinistryLogo size="panel" />
        </div>
        <div>
          <h2>تسجيل الدخول</h2>
          <p>ادخل بيانات الحساب للمتابعة إلى لوحة النظام.</p>
        </div>

        {error && <div className="alert">{error}</div>}

        <label>
          البريد الإلكتروني
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@mohp.gov.eg"
            required
            type="email"
            value={email}
          />
        </label>

        <label>
          كلمة المرور
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        <button className="primary-action" disabled={loading} type="submit">
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </main>
  )
}

function AppShell({ children, view }: { children: React.ReactNode; view: View }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <main className="app-shell">
      <Style />
      <header className="topbar">
        <button aria-label="فتح القائمة" className="icon-button" onClick={() => setMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <div className="topbar-title">
          <MinistryLogo size="header" />
          <div>
            <p className="eyebrow">وزارة الصحة والسكان</p>
            <h1>{pageTitle(view)}</h1>
          </div>
        </div>
        <button aria-label="التنبيهات" className="icon-button">
          <Bell size={20} />
          <span className="dot" />
        </button>
      </header>

      <aside className={`side-sheet ${menuOpen ? 'open' : ''}`}>
        <div className="sheet-head">
          <div className="brand-lockup">
            <MinistryLogo size="menu" />
            <strong>نظام المأموريات</strong>
          </div>
          <button aria-label="إغلاق القائمة" className="icon-button" onClick={() => setMenuOpen(false)}>
            <X size={20} />
          </button>
        </div>
        <Navigation onNavigate={() => setMenuOpen(false)} />
      </aside>

      {menuOpen && <button aria-label="إغلاق القائمة" className="scrim" onClick={() => setMenuOpen(false)} />}

      <section className="content">
        {children}
        <SecurityFooter />
      </section>

      <nav className="bottom-nav" aria-label="التنقل الرئيسي">
        <div className="bottom-logo">
          <MinistryLogo size="footer" />
        </div>
        <NavItem href="/dashboard" icon={Home} label="الرئيسية" />
        <NavItem href="/dashboard/missions" icon={ClipboardList} label="المأموريات" />
        <NavItem href="/dashboard/violations" icon={AlertTriangle} label="المخالفات" />
        <NavItem href="/login" icon={LogOut} label="خروج" />
      </nav>
    </main>
  )
}

function Navigation({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="sheet-nav">
      <NavItem href="/dashboard" icon={Home} label="لوحة القيادة" onClick={onNavigate} />
      <NavItem href="/dashboard/missions" icon={ClipboardList} label="المأموريات" onClick={onNavigate} />
      <NavItem href="/dashboard/violations" icon={AlertTriangle} label="المخالفات" onClick={onNavigate} />
      <NavItem href="/dashboard/facilities" icon={Building2} label="المنشآت" onClick={onNavigate} />
      <NavItem href="/dashboard/users" icon={Users} label="المستخدمين" onClick={onNavigate} />
      <NavItem href="/dashboard/settings" icon={Settings} label="الإعدادات" onClick={onNavigate} />
    </div>
  )
}

function MinistryLogo({ size }: { size: 'hero' | 'panel' | 'header' | 'menu' | 'footer' }) {
  return <img alt="شعار وزارة الصحة والسكان المصرية" className={`ministry-logo ${size}`} src={ministryLogo} />
}

function SecurityFooter() {
  return (
    <footer className="security-footer">
      <MinistryLogo size="footer" />
      <div>
        <strong>وزارة الصحة والسكان المصرية</strong>
        <p>نظام مؤمن ومشفر ومخصص للعمل وفق متطلبات الحماية والأمن السيبراني المعتمدة.</p>
      </div>
    </footer>
  )
}

function NavItem({
  href,
  icon: Icon,
  label,
  onClick,
}: {
  href: string
  icon: LucideIcon
  label: string
  onClick?: () => void
}) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link className={`nav-item ${active ? 'active' : ''}`} href={href} onClick={onClick}>
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  )
}

function DashboardScreen() {
  return (
    <div className="stack">
      <section className="welcome-band">
        <div>
          <p className="eyebrow">اليوم</p>
          <h2>متابعة المأموريات الميدانية</h2>
          <p>نظرة مختصرة مناسبة للموبايل على التنفيذ والمخالفات العاجلة.</p>
        </div>
        <div className="user-chip">
          <User size={18} />
          مدير النظام
        </div>
      </section>

      <section className="stats-grid">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <article className={`stat-card ${item.tone}`} key={item.label}>
              <Icon size={22} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          )
        })}
      </section>

      <SectionHeader actionHref="/dashboard/missions" actionText="عرض الكل" title="أحدث المأموريات" />
      <MissionList compact />
    </div>
  )
}

function MissionsScreen() {
  const [query, setQuery] = useState('')
  const visibleMissions = useMemo(
    () => missions.filter((mission) => `${mission.id} ${mission.facility} ${mission.inspector}`.includes(query.trim())),
    [query],
  )

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="search-field">
          <Search size={18} />
          <input onChange={(event) => setQuery(event.target.value)} placeholder="بحث عن مأمورية أو منشأة" value={query} />
        </label>
        <button className="icon-button strong" aria-label="تصفية">
          <Filter size={19} />
        </button>
        <Link className="icon-button accent" aria-label="إضافة مأمورية" href="/dashboard/missions/new">
          <Plus size={20} />
        </Link>
      </div>
      <MissionList missionsData={visibleMissions} />
    </div>
  )
}

function MissionList({ compact = false, missionsData = missions }: { compact?: boolean; missionsData?: typeof missions }) {
  return (
    <section className="cards-list">
      {missionsData.map((mission) => (
        <article className="mission-card" key={mission.id}>
          <div className="card-line">
            <strong>{mission.facility}</strong>
            <span className={`pill ${mission.tone}`}>{mission.status}</span>
          </div>
          <p>{mission.id}</p>
          {!compact && (
            <div className="meta-grid">
              <span>{mission.inspector}</span>
              <span>{mission.date}</span>
              <span>{mission.violations} مخالفات</span>
            </div>
          )}
        </article>
      ))}
    </section>
  )
}

function ViolationsScreen() {
  return (
    <div className="stack">
      <SectionHeader actionText="إضافة" title="المخالفات المفتوحة" />
      <section className="cards-list">
        {violations.map((item) => (
          <article className="mission-card" key={`${item.title}-${item.facility}`}>
            <div className="card-line">
              <strong>{item.title}</strong>
              <span className={`pill ${item.tone}`}>{item.severity}</span>
            </div>
            <p>{item.facility}</p>
          </article>
        ))}
      </section>
    </div>
  )
}

function SectionHeader({ actionHref, actionText, title }: { actionHref?: string; actionText: string; title: string }) {
  const action = <span className="text-action">{actionText}</span>

  return (
    <div className="section-head">
      <h2>{title}</h2>
      {actionHref ? <Link href={actionHref}>{action}</Link> : action}
    </div>
  )
}

function pageTitle(view: View) {
  if (view === 'missions') return 'المأموريات'
  if (view === 'violations') return 'المخالفات'
  return 'لوحة القيادة'
}

function Style() {
  return (
    <style jsx global>{`
      :root {
        --ink: #102027;
        --muted: #64747d;
        --line: #dce7e8;
        --surface: #ffffff;
        --canvas: #f3f7f7;
        --brand: #006d77;
        --brand-2: #2a9d8f;
        --amber: #b7791f;
        --red: #c2413f;
        --blue: #2c6fbb;
        --shadow: 0 12px 32px rgba(16, 32, 39, 0.1);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        min-height: 100%;
        margin: 0;
      }

      body {
        background: var(--canvas);
        color: var(--ink);
        direction: rtl;
        font-family: Tajawal, Cairo, Arial, sans-serif;
      }

      button,
      input {
        font: inherit;
      }

      a {
        color: inherit;
        text-decoration: none;
      }

      .login-screen {
        display: grid;
        gap: 18px;
        min-height: 100dvh;
        padding: 18px;
      }

      .login-hero,
      .login-panel,
      .welcome-band,
      .mission-card,
      .stat-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
      }

      .login-hero {
        align-content: end;
        background:
          linear-gradient(140deg, rgba(0, 109, 119, 0.92), rgba(42, 157, 143, 0.72)),
          url('https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=1400&q=80');
        background-position: center;
        background-size: cover;
        color: white;
        display: grid;
        min-height: 260px;
        padding: 24px;
      }

      .ministry-logo {
        display: block;
        flex: 0 0 auto;
        object-fit: contain;
      }

      .ministry-logo.hero {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(255, 255, 255, 0.75);
        border-radius: 8px;
        box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
        height: 92px;
        margin-bottom: 18px;
        padding: 8px;
        width: 92px;
      }

      .ministry-logo.panel {
        height: 86px;
        margin: 0 auto;
        width: 86px;
      }

      .ministry-logo.header,
      .ministry-logo.menu,
      .ministry-logo.footer {
        height: 42px;
        width: 42px;
      }

      .eyebrow {
        color: inherit;
        font-size: 12px;
        font-weight: 700;
        margin: 0 0 6px;
        opacity: 0.76;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      .login-hero h1 {
        font-size: 30px;
        line-height: 1.25;
      }

      .hero-copy {
        line-height: 1.8;
        margin-top: 10px;
        max-width: 32rem;
      }

      .login-panel {
        align-content: start;
        display: grid;
        gap: 16px;
        padding: 20px;
      }

      .panel-logo {
        display: grid;
        justify-items: center;
      }

      .login-panel h2 {
        font-size: 24px;
      }

      .login-panel p,
      .mission-card p,
      .welcome-band p {
        color: var(--muted);
        line-height: 1.7;
      }

      label {
        color: var(--ink);
        display: grid;
        gap: 8px;
        font-size: 14px;
        font-weight: 700;
      }

      input {
        background: #fbfdfd;
        border: 1px solid var(--line);
        border-radius: 8px;
        min-height: 48px;
        outline: none;
        padding: 0 14px;
        width: 100%;
      }

      input:focus {
        border-color: var(--brand);
        box-shadow: 0 0 0 3px rgba(0, 109, 119, 0.12);
      }

      .primary-action {
        background: var(--brand);
        border: 0;
        border-radius: 8px;
        color: white;
        cursor: pointer;
        font-weight: 800;
        min-height: 50px;
      }

      .alert {
        background: #fff2f1;
        border: 1px solid #ffc9c5;
        border-radius: 8px;
        color: var(--red);
        padding: 12px;
      }

      .app-shell {
        min-height: 100dvh;
        padding: 14px 14px 86px;
      }

      .topbar {
        align-items: center;
        display: grid;
        gap: 12px;
        grid-template-columns: 44px 1fr 44px;
        margin: 0 auto 16px;
        max-width: 960px;
      }

      .topbar h1 {
        font-size: 21px;
      }

      .topbar-title {
        align-items: center;
        display: flex;
        gap: 10px;
        min-width: 0;
      }

      .topbar-title h1 {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .icon-button {
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        color: var(--ink);
        cursor: pointer;
        display: inline-flex;
        height: 44px;
        justify-content: center;
        position: relative;
        width: 44px;
      }

      .icon-button.strong {
        background: #edf7f7;
      }

      .icon-button.accent {
        background: var(--brand);
        color: white;
      }

      .dot {
        background: var(--red);
        border: 2px solid white;
        border-radius: 99px;
        height: 10px;
        left: 9px;
        position: absolute;
        top: 9px;
        width: 10px;
      }

      .content,
      .stack {
        display: grid;
        gap: 14px;
      }

      .content {
        margin: 0 auto;
        max-width: 960px;
      }

      .security-footer {
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
        display: flex;
        gap: 12px;
        padding: 12px;
      }

      .security-footer strong {
        display: block;
        font-size: 14px;
        margin-bottom: 3px;
      }

      .security-footer p {
        color: var(--muted);
        font-size: 12px;
        line-height: 1.6;
        margin: 0;
      }

      .welcome-band {
        display: grid;
        gap: 16px;
        padding: 18px;
      }

      .welcome-band h2 {
        font-size: 22px;
      }

      .user-chip {
        align-items: center;
        background: #edf7f7;
        border-radius: 8px;
        color: var(--brand);
        display: inline-flex;
        font-weight: 800;
        gap: 8px;
        justify-self: start;
        padding: 8px 10px;
      }

      .stats-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .stat-card {
        display: grid;
        gap: 8px;
        min-height: 126px;
        padding: 14px;
      }

      .stat-card span {
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }

      .stat-card strong {
        font-size: 28px;
      }

      .green {
        color: var(--brand-2);
      }

      .blue {
        color: var(--blue);
      }

      .red {
        color: var(--red);
      }

      .amber {
        color: var(--amber);
      }

      .section-head,
      .card-line,
      .toolbar,
      .brand-lockup,
      .sheet-head {
        align-items: center;
        display: flex;
        gap: 10px;
      }

      .section-head,
      .card-line,
      .toolbar,
      .sheet-head {
        justify-content: space-between;
      }

      .section-head h2 {
        font-size: 18px;
      }

      .text-action {
        color: var(--brand);
        font-size: 14px;
        font-weight: 800;
      }

      .cards-list {
        display: grid;
        gap: 10px;
      }

      .mission-card {
        display: grid;
        gap: 9px;
        padding: 14px;
      }

      .mission-card strong {
        line-height: 1.45;
      }

      .pill {
        background: #eef6f6;
        border-radius: 999px;
        flex: 0 0 auto;
        font-size: 12px;
        font-weight: 800;
        padding: 5px 9px;
      }

      .meta-grid {
        color: var(--muted);
        display: grid;
        font-size: 13px;
        gap: 6px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .toolbar {
        position: sticky;
        top: 8px;
        z-index: 5;
      }

      .search-field {
        flex: 1;
        position: relative;
      }

      .search-field svg {
        color: var(--muted);
        position: absolute;
        right: 12px;
        top: 15px;
      }

      .search-field input {
        padding-right: 40px;
      }

      .bottom-nav {
        background: rgba(255, 255, 255, 0.96);
        border: 1px solid var(--line);
        border-radius: 8px 8px 0 0;
        bottom: 0;
        box-shadow: 0 -10px 24px rgba(16, 32, 39, 0.08);
        display: grid;
        gap: 4px;
        grid-template-columns: 48px repeat(4, minmax(0, 1fr));
        left: 0;
        padding: 8px;
        position: fixed;
        right: 0;
        z-index: 20;
      }

      .bottom-logo {
        align-items: center;
        display: flex;
        justify-content: center;
      }

      .nav-item {
        align-items: center;
        border-radius: 8px;
        color: var(--muted);
        display: grid;
        font-size: 12px;
        font-weight: 800;
        gap: 4px;
        justify-items: center;
        min-height: 52px;
        padding: 6px;
      }

      .nav-item.active {
        background: #edf7f7;
        color: var(--brand);
      }

      .side-sheet {
        background: var(--surface);
        border-left: 1px solid var(--line);
        bottom: 0;
        box-shadow: var(--shadow);
        max-width: 320px;
        padding: 16px;
        position: fixed;
        right: 0;
        top: 0;
        transform: translateX(105%);
        transition: transform 180ms ease;
        width: 86vw;
        z-index: 40;
      }

      .side-sheet.open {
        transform: translateX(0);
      }

      .sheet-nav {
        display: grid;
        gap: 8px;
        margin-top: 20px;
      }

      .sheet-nav .nav-item {
        grid-template-columns: 22px 1fr;
        justify-items: start;
        min-height: 46px;
        padding: 8px 10px;
      }

      .scrim {
        background: rgba(16, 32, 39, 0.28);
        border: 0;
        bottom: 0;
        left: 0;
        position: fixed;
        right: 0;
        top: 0;
        z-index: 30;
      }

      @media (min-width: 760px) {
        .login-screen {
          grid-template-columns: 1.2fr 0.8fr;
          padding: 28px;
        }

        .login-hero {
          min-height: calc(100dvh - 56px);
        }

        .login-panel {
          align-self: center;
          padding: 28px;
        }

        .app-shell {
          padding: 22px 22px 96px;
        }

        .stats-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .welcome-band {
          align-items: center;
          grid-template-columns: 1fr auto;
        }
      }
    `}</style>
  )
}
