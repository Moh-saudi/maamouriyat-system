'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  demoAccounts,
  demoPassword,
  getRoleDefinition,
  normalizeDemoRole,
  roleDefinitions,
  type DemoRole,
  type NavigationKey,
  getRoleNavigation,
  getUserNavigation,
} from '@/lib/roles'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  Filter,
  Eye,
  EyeOff,
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

type View = 'login' | 'dashboard' | 'missions' | 'violations' | 'facilities' | 'users' | 'settings' | 'checklists'

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

const notifications = [
  {
    href: '/dashboard/missions',
    meta: 'منذ 10 دقائق',
    text: 'توجد مأموريات قيد التنفيذ تحتاج متابعة اليوم.',
    title: 'متابعة المأموريات',
    tone: 'blue',
  },
  {
    href: '/dashboard/violations',
    meta: 'منذ 35 دقيقة',
    text: 'تم تسجيل مخالفة عالية الخطورة وتحتاج إجراء تصحيحي.',
    title: 'مخالفة عالية الخطورة',
    tone: 'red',
  },
  {
    href: '/dashboard/facilities',
    meta: 'اليوم',
    text: 'راجع بيانات المنشآت قبل اعتماد خطة المرور القادمة.',
    title: 'تحديث بيانات المنشآت',
    tone: 'amber',
  },
]

const navigationDefinitions: Record<NavigationKey, { href: string; icon: LucideIcon; label: string }> = {
  dashboard: { href: '/dashboard', icon: Home, label: 'لوحة القيادة' },
  facilities: { href: '/dashboard/facilities', icon: Building2, label: 'المنشآت' },
  missions: { href: '/dashboard/missions', icon: ClipboardList, label: 'المأموريات' },
  settings: { href: '/dashboard/settings', icon: Settings, label: 'الإعدادات' },
  users: { href: '/dashboard/users', icon: Users, label: 'المستخدمون' },
  violations: { href: '/dashboard/violations', icon: AlertTriangle, label: 'المخالفات' },
  checklists: { href: '/dashboard/checklists', icon: ClipboardList, label: 'استمارات المرور' },
}

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

export function DashboardShell({
  children,
  role = null,
  view = 'dashboard',
}: {
  children: React.ReactNode
  role?: DemoRole | null
  view?: Exclude<View, 'login'>
}) {
  return (
    <AppShell initialRole={role} view={view}>
      {children}
    </AppShell>
  )
}

function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    // Check for local demo login first to avoid making a failing Supabase API request
    if (isDemoLogin(email, password)) {
      const demoRole = email.trim().toLowerCase().split('@')[0]
      document.cookie = `maamouriyat_demo_session=${demoRole}; path=/; max-age=86400; SameSite=Lax`
      router.push('/dashboard')
      router.refresh()
      return
    }

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
          <p>استخدم أي حساب تجريبي بكلمة مرور موحدة: {demoPassword}</p>
        </div>

        {error && <div className="alert">{error}</div>}

        <label>
          البريد الإلكتروني
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@admin.com"
            required
            type="email"
            value={email}
          />
        </label>

        <label>
          كلمة المرور
          <span className="password-field">
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={demoPassword}
              required
              type={showPassword ? 'text' : 'password'}
              value={password}
            />
            <button
              aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              onClick={() => setShowPassword((isVisible) => !isVisible)}
              type="button"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>

        <div className="demo-accounts" aria-label="حسابات تجريبية">
          {demoAccounts.map((account) => (
            <button
              key={account}
              onClick={() => {
                setEmail(account)
                setPassword(demoPassword)
              }}
              type="button"
            >
              {account}
            </button>
          ))}
        </div>

        <button className="primary-action" disabled={loading} type="submit">
          {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
        </button>
      </form>
    </main>
  )
}

function AppShell({ children, initialRole, view }: { children: React.ReactNode; initialRole?: DemoRole | null; view: View }) {
  const router = useRouter()
  const [currentRole, setCurrentRole] = useState<DemoRole | null>(initialRole ?? null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const roleInfo = getRoleDefinition(currentRole)
  const [notificationsList, setNotificationsList] = useState<any[]>([])

  useEffect(() => {
    async function resolveUserEmail() {
      const demoRole = readDemoRoleFromCookie()
      if (demoRole) {
        setUserEmail(`${demoRole}@${demoRole}.com`)
        return
      }
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            setUserEmail(user.email ?? user.id)
            const { data: profileData } = await supabase
              .from('users')
              .select('level')
              .eq('auth_id', user.id)
              .maybeSingle()
            if (profileData) {
              const level = profileData.level ?? 7
              const role = level === 0 ? 'techadmin' : level === 1 ? 'superadmin' : level === 2 ? 'central' : level === 3 ? 'generalmanager' : level === 4 ? 'creator' : level === 5 ? 'financial' : 'inspector'
              document.cookie = `maamouriyat_user_role=${role}; path=/; max-age=86400; SameSite=Lax`
            }
          }
        } catch {}
      }
    }
    resolveUserEmail()
  }, [currentRole])

  useEffect(() => {
    setCurrentRole(readDemoRoleFromCookie() ?? initialRole ?? null)
  }, [initialRole])

  useEffect(() => {
    async function loadNotifications() {
      // 1. Demo Mode Cookie Feed
      const isDemo = readDemoRoleFromCookie()
      if (isDemo) {
        const cookieName = 'maamouriyat_demo_notifications'
        const existingCookie = document.cookie
          .split('; ')
          .find((item) => item.startsWith(`${cookieName}=`))
          ?.split('=')[1]
        let list = []
        if (existingCookie) {
          try {
            list = JSON.parse(decodeURIComponent(existingCookie))
          } catch {}
        } else {
          list = [
            {
              href: '/dashboard/missions',
              meta: 'منذ 10 دقائق',
              text: 'توجد مأموريات قيد التنفيذ تحتاج متابعة اليوم.',
              title: 'متابعة المأموريات',
              tone: 'blue',
              is_read: false
            },
            {
              href: '/dashboard/violations',
              meta: 'منذ 35 دقيقة',
              text: 'تم تسجيل مخالفة عالية الخطورة وتحتاج إجراء تصحيحي.',
              title: 'مخالفة عالية الخطورة',
              tone: 'red',
              is_read: false
            }
          ]
          document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(list))}; path=/; max-age=604800; SameSite=Lax`
        }
        setNotificationsList(list)
        return
      }

      // 2. Production Live Mode (Supabase)
      if (supabase) {
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data, error } = await supabase
              .from('notifications')
              .select('*')
              .eq('is_read', false)
              .order('sent_at', { ascending: false })
              .limit(10)
            
            if (!error && data) {
              setNotificationsList(data.map(n => ({
                href: n.mission_id ? `/dashboard/missions` : `/dashboard/violations`,
                meta: new Date(n.sent_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                text: n.body,
                title: n.title,
                tone: n.type === 'mission_assigned' ? 'blue' : 'red',
                is_read: n.is_read
              })))
            }
          }
        } catch (e) {
          console.error(e)
        }
      }
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 10000)
    return () => clearInterval(interval)
  }, [currentRole])

  async function handleClearNotifications() {
    const isDemo = readDemoRoleFromCookie()
    if (isDemo) {
      const cookieName = 'maamouriyat_demo_notifications'
      document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`
      setNotificationsList([])
      return
    }

    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase.from('users').select('id').eq('auth_id', user.id).single()
          if (profile) {
            await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id)
          }
          setNotificationsList([])
        }
      } catch (e) {
        console.error(e)
      }
    }
  }

  async function handleLogout() {
    setUserMenuOpen(false)
    setNotificationsOpen(false)
    setMenuOpen(false)

    if (supabase) {
      await supabase.auth.signOut()
    }

    document.cookie = 'maamouriyat_demo_session=; path=/; max-age=0; SameSite=Lax'

    router.replace('/login')
    router.refresh()
  }

  return (
    <main className="app-shell">
      <Style />
      <aside className="desktop-sidebar" aria-label="التنقل الرئيسي">
        <div className="desktop-brand">
          <MinistryLogo size="menu" />
          <div>
            <strong>نظام المأموريات</strong>
            <span>وزارة الصحة والسكان</span>
          </div>
        </div>
        <Navigation role={currentRole} userEmail={userEmail} />
      </aside>

      <header className="topbar">
        <button aria-label="فتح القائمة" className="icon-button" onClick={() => setMenuOpen(true)}>
          <Menu size={20} />
        </button>
        <div className="topbar-title">
          <MinistryLogo size="header" />
          <div>
            <p className="eyebrow">وزارة الصحة والسكان</p>
            <h1>{pageTitle(view)}</h1>
            <span className="topbar-role">{roleInfo.jobTitle}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <div className="user-menu-wrap">
          <button
            aria-expanded={userMenuOpen}
            className="user-menu-button"
            onClick={() => setUserMenuOpen((isOpen) => !isOpen)}
            type="button"
            title={roleInfo.name}
          >
            <User size={18} />
            <span>{roleInfo.name}</span>
          </button>
          {userMenuOpen && (
            <>
              <button
                aria-label="إغلاق بيانات المستخدم"
                className="user-menu-scrim"
                onClick={() => setUserMenuOpen(false)}
                type="button"
              />
              <div className="user-menu-panel">
                <strong>{roleInfo.name}</strong>
                <span>{roleInfo.jobTitle}</span>
                <button onClick={handleLogout} type="button">
                  <LogOut size={17} />
                  تسجيل الخروج
                </button>
              </div>
            </>
          )}
          </div>
          <button className="logout-button" onClick={handleLogout} title="تسجيل الخروج" type="button">
            <LogOut size={18} />
            <span>خروج</span>
          </button>
          <div className="notification-wrap">
            <button
              aria-expanded={notificationsOpen}
              aria-label="التنبيهات"
              className="icon-button"
              onClick={() => setNotificationsOpen((isOpen) => !isOpen)}
              type="button"
            >
              <Bell size={20} />
              {notificationsList.length > 0 && <span className="dot" />}
            </button>
            {notificationsOpen && (
              <>
                <button
                  aria-label="إغلاق التنبيهات"
                  className="notification-scrim"
                  onClick={() => setNotificationsOpen(false)}
                  type="button"
                />
                <NotificationsPanel
                  onNavigate={() => setNotificationsOpen(false)}
                  notificationsList={notificationsList}
                  onClear={handleClearNotifications}
                />
              </>
            )}
          </div>
        </div>
      </header>

      {menuOpen && (
        <aside className="side-sheet open">
          <div className="sheet-head">
            <div className="brand-lockup">
              <MinistryLogo size="menu" />
              <strong>نظام المأموريات</strong>
            </div>
            <button aria-label="إغلاق القائمة" className="icon-button" onClick={() => setMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <Navigation onNavigate={() => setMenuOpen(false)} role={currentRole} userEmail={userEmail} />
        </aside>
      )}

      {menuOpen && <button aria-label="إغلاق القائمة" className="scrim" onClick={() => setMenuOpen(false)} />}

      <section className="content-shell">
        <div className="content">
        {children}
        </div>
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

function isDemoLogin(email: string, password: string) {
  return (demoAccounts as readonly string[]).includes(email.trim().toLowerCase()) && password === demoPassword
}

function readDemoRoleFromCookie() {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('maamouriyat_demo_session='))
  return normalizeDemoRole(match?.split('=')[1])
}

function readDynamicPermissionsFromCookie() {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('maamouriyat_dynamic_permissions='))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

function readUserPermissionsFromCookie() {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('maamouriyat_user_permissions='))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

function Navigation({ onNavigate, role, userEmail }: { onNavigate?: () => void; role: DemoRole | null; userEmail?: string | null }) {
  const roleInfo = getRoleDefinition(role)
  const dynamicPermissionsRaw = readDynamicPermissionsFromCookie()
  const userPermissionsRaw = readUserPermissionsFromCookie()
  const allowedKeys = getUserNavigation(
    userEmail || (role ? `${role}@${role}.com` : null),
    role ?? 'superadmin',
    dynamicPermissionsRaw,
    userPermissionsRaw
  )
  const items = allowedKeys.map((key: NavigationKey) => ({
    key,
    ...navigationDefinitions[key],
  }))

  return (
    <div className="sheet-nav">
      <span className="role-nav-label">{roleInfo.homeLabel}</span>
      {items.map((item: any) => (
        <NavItem
          href={item.href}
          icon={item.icon}
          key={item.key}
          label={item.key === 'dashboard' ? roleInfo.homeLabel : item.label}
          onClick={onNavigate}
        />
      ))}
    </div>
  )
}

function NotificationsPanel({
  onNavigate,
  notificationsList,
  onClear,
}: {
  onNavigate: () => void
  notificationsList: any[]
  onClear: () => void
}) {
  return (
    <section aria-label="قائمة التنبيهات" className="notifications-panel">
      <div className="notifications-head">
        <strong>التنبيهات</strong>
        <span style={{ cursor: 'pointer', color: 'var(--red)', fontSize: '11px', fontWeight: 'bold' }} onClick={onClear}>
          مسح الكل
        </span>
      </div>
      <div className="notifications-list">
        {notificationsList.map((item) => (
          <Link className="notification-item" href={item.href} key={item.title} onClick={onNavigate}>
            <span className={`notification-mark ${item.tone}`} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
              <em>{item.meta}</em>
            </span>
          </Link>
        ))}
        {notificationsList.length === 0 && (
          <p style={{ padding: '16px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
            لا توجد تنبيهات جديدة
          </p>
        )}
      </div>
    </section>
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

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (href === '/login') {
      event.preventDefault()
      onClick?.()

      if (supabase) {
        await supabase.auth.signOut()
      }

      document.cookie = 'maamouriyat_demo_session=; path=/; max-age=0; SameSite=Lax'
      window.location.assign('/login')
      return
    }

    onClick?.()
  }

  return (
    <Link className={`nav-item ${active ? 'active' : ''}`} href={href} onClick={handleClick}>
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
  if (view === 'facilities') return 'المنشآت'
  if (view === 'users') return 'المستخدمون'
  if (view === 'settings') return 'الإعدادات'
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
        overflow-x: hidden;
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
        background: linear-gradient(140deg, #005f68 0%, #006d77 45%, #2a9d8f 100%);
        color: white;
        display: grid;
        min-height: 260px;
        padding: 24px;
      }

      .ministry-logo {
        display: block;
        flex: 0 0 auto;
        max-width: 100%;
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
        flex-basis: 42px;
        height: 42px;
        max-height: 42px;
        max-width: 42px;
        min-width: 42px;
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

      .demo-accounts {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .demo-accounts button {
        background: #edf7f7;
        border: 1px solid #cfe5e6;
        border-radius: 999px;
        color: var(--brand);
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
        padding: 7px 10px;
      }

      .password-field {
        display: block;
        position: relative;
      }

      .password-field input {
        padding-left: 46px;
        width: 100%;
      }

      .password-field button {
        align-items: center;
        background: transparent;
        border: 0;
        color: var(--muted);
        cursor: pointer;
        display: inline-flex;
        height: 42px;
        justify-content: center;
        left: 6px;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 42px;
      }

      .app-shell {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
        padding: 78px 14px calc(118px + env(safe-area-inset-bottom));
      }

      .desktop-sidebar {
        display: none;
      }

      .desktop-brand {
        align-items: center;
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 10px;
        padding-bottom: 14px;
      }

      .desktop-brand strong,
      .desktop-brand span {
        display: block;
      }

      .desktop-brand strong {
        font-size: 15px;
      }

      .desktop-brand span {
        color: var(--muted);
        font-size: 12px;
        margin-top: 3px;
      }

      .topbar {
        align-items: center;
        background: rgba(243, 247, 247, 0.94);
        backdrop-filter: blur(14px);
        display: grid;
        gap: 12px;
        grid-template-columns: 44px 1fr auto;
        margin: 0 auto 16px;
        max-width: 960px;
        padding-block: 2px;
        position: fixed;
        right: 14px;
        left: 14px;
        top: 12px;
        z-index: 25;
        width: auto;
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

      .topbar-role {
        color: var(--muted);
        display: block;
        font-size: 11px;
        font-weight: 800;
        line-height: 1.4;
        margin-top: 1px;
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

      .topbar-actions {
        align-items: center;
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      .user-menu-wrap {
        position: relative;
      }

      .user-menu-button {
        align-items: center;
        background: #edf7f7;
        border: 1px solid #cfe5e6;
        border-radius: 8px;
        color: var(--brand);
        cursor: pointer;
        display: inline-flex;
        font-weight: 900;
        gap: 8px;
        min-height: 44px;
        max-width: 170px;
        padding: 8px 10px;
      }

      .user-menu-button span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .logout-button {
        align-items: center;
        background: #fff2f1;
        border: 1px solid #ffc9c5;
        border-radius: 8px;
        color: var(--red);
        display: none;
        font-size: 13px;
        font-weight: 900;
        gap: 7px;
        min-height: 44px;
        padding: 8px 10px;
      }

      .user-menu-scrim {
        background: transparent;
        border: 0;
        bottom: 0;
        left: 0;
        position: fixed;
        right: 0;
        top: 0;
        z-index: 50;
      }

      .user-menu-panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
        display: grid;
        gap: 8px;
        left: 0;
        min-width: 210px;
        padding: 12px;
        position: absolute;
        top: 52px;
        z-index: 60;
      }

      .user-menu-panel strong,
      .user-menu-panel span {
        display: block;
      }

      .user-menu-panel span {
        color: var(--muted);
        font-size: 12px;
      }

      .user-menu-panel button {
        align-items: center;
        background: #fff2f1;
        border: 1px solid #ffc9c5;
        border-radius: 8px;
        color: var(--red);
        cursor: pointer;
        display: flex;
        font: inherit;
        font-weight: 900;
        gap: 8px;
        justify-content: center;
        margin-top: 4px;
        min-height: 40px;
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

      .notification-wrap {
        position: relative;
      }

      .notifications-panel {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
        display: grid;
        gap: 10px;
        left: 0;
        padding: 12px;
        position: absolute;
        top: 52px;
        width: min(86vw, 360px);
        z-index: 60;
      }

      .notification-scrim {
        background: transparent;
        border: 0;
        bottom: 0;
        left: 0;
        position: fixed;
        right: 0;
        top: 0;
        z-index: 50;
      }

      .notifications-head {
        align-items: center;
        display: flex;
        justify-content: space-between;
      }

      .notifications-head span {
        background: #edf7f7;
        border-radius: 999px;
        color: var(--brand);
        font-size: 12px;
        font-weight: 800;
        padding: 4px 8px;
      }

      .notifications-list {
        display: grid;
        gap: 8px;
      }

      .notification-item {
        border: 1px solid var(--line);
        border-radius: 8px;
        display: grid;
        gap: 10px;
        grid-template-columns: 10px 1fr;
        padding: 10px;
      }

      .notification-item:hover {
        background: #f6fbfb;
      }

      .notification-item strong,
      .notification-item small,
      .notification-item em {
        display: block;
      }

      .notification-item small {
        color: var(--muted);
        line-height: 1.6;
        margin-top: 3px;
      }

      .notification-item em {
        color: var(--brand);
        font-size: 12px;
        font-style: normal;
        font-weight: 800;
        margin-top: 6px;
      }

      .notification-mark {
        border-radius: 99px;
        height: 10px;
        margin-top: 7px;
        width: 10px;
      }

      .notification-mark.blue {
        background: var(--blue);
      }

      .notification-mark.red {
        background: var(--red);
      }

      .notification-mark.amber {
        background: var(--amber);
      }

      .content-shell,
      .content,
      .stack {
        display: grid;
        gap: 14px;
      }

      .content-shell {
        flex: 1;
        grid-template-rows: minmax(0, 1fr) auto;
        margin: 0 auto;
        max-width: 960px;
        min-height: 0;
        width: 100%;
      }

      .content {
        min-height: 0;
      }

      .security-footer {
        align-items: center;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
        display: flex;
        gap: 12px;
        margin-top: auto;
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

      .pill.green {
        background: #e8f7f4;
        color: var(--brand-2);
      }

      .pill.blue {
        background: #e8f1fb;
        color: var(--blue);
      }

      .pill.red {
        background: #fdeaea;
        color: var(--red);
      }

      .pill.amber {
        background: #fdf4e3;
        color: var(--amber);
      }

      .empty-state {
        background: var(--surface);
        border: 1px dashed var(--line);
        border-radius: 8px;
        color: var(--muted);
        display: grid;
        gap: 8px;
        padding: 32px 20px;
        text-align: center;
      }

      .empty-state h2 {
        color: var(--ink);
        font-size: 18px;
      }

      .meta-grid {
        color: var(--muted);
        display: grid;
        font-size: 13px;
        gap: 6px;
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
        padding: 8px 8px calc(8px + env(safe-area-inset-bottom));
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

      .role-nav-label {
        color: var(--brand);
        font-size: 12px;
        font-weight: 900;
        padding: 0 10px 4px;
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
          padding: 88px 22px calc(128px + env(safe-area-inset-bottom));
        }

        .stats-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .welcome-band {
          align-items: center;
          grid-template-columns: 1fr auto;
        }
      }

      @media (min-width: 1024px) {
        .app-shell {
          align-items: start;
          display: grid;
          gap: 18px;
          grid-template-areas:
            "sidebar topbar"
            "sidebar content";
          grid-template-columns: 232px minmax(0, 1fr);
          grid-template-rows: auto 1fr;
          padding: 24px;
        }

        .desktop-sidebar {
          align-self: start;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 8px;
          box-shadow: var(--shadow);
          display: grid;
          gap: 14px;
          grid-area: sidebar;
          max-height: calc(100dvh - 48px);
          min-height: calc(100dvh - 48px);
          overflow: auto;
          padding: 16px;
          position: sticky;
          top: 24px;
        }

        .topbar {
          grid-area: topbar;
          grid-template-columns: minmax(0, 1fr) auto;
          left: auto;
          margin: 0;
          max-width: none;
          position: sticky;
          right: auto;
          top: 24px;
          z-index: 25;
          width: 100%;
        }

        .topbar > .icon-button:first-child {
          display: none;
        }

        .topbar h1 {
          font-size: 24px;
        }

        .logout-button {
          display: inline-flex;
        }

        .content-shell {
          grid-area: content;
          margin: 0;
          max-width: 1440px;
          min-height: calc(100dvh - 107px);
        }

        .bottom-nav {
          display: none;
        }

        .side-sheet,
        .scrim {
          display: none;
        }

        .sheet-nav {
          gap: 6px;
          margin-top: 0;
        }

        .sheet-nav .nav-item {
          grid-template-columns: 22px 1fr;
          justify-items: start;
          min-height: 44px;
          padding: 8px 10px;
        }

        .sheet-nav .nav-item.active {
          box-shadow: inset -3px 0 0 var(--brand);
        }

        .notifications-panel {
          left: 0;
          right: auto;
        }
      }

      @media (max-width: 520px) {
        .user-menu-button {
          max-width: 44px;
          padding: 8px;
          width: 44px;
        }

        .user-menu-button span {
          display: none;
        }

        .user-menu-panel {
          left: 0;
          min-width: min(78vw, 240px);
        }
      }
    `}</style>
  )
}
