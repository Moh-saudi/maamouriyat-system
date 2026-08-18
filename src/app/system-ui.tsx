'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  getRoleDefinition,
  roleDefinitions,
  type UserRole,
  type NavigationKey,
  getRoleNavigation,
  normalizeNavigationKeys,
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
  role?: UserRole | null
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
  const [rememberMe, setRememberMe] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const rememberedEmail = window.localStorage.getItem('maamouriyat_remembered_email')
    if (rememberedEmail) {
      setEmail(rememberedEmail)
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (!supabase) {
      setError('قاعدة البيانات غير متوفرة حالياً')
      return
    }

    setLoading(true)
    try {
      const cleanEmail = email.trim().toLowerCase()
      const result = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
      setLoading(false)

      if (result.error) {
        console.error('Supabase auth login error:', result.error)
        const errMsg = result.error.message?.toLowerCase() || ''
        if (errMsg.includes('invalid login credentials') || errMsg.includes('invalid_grant')) {
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة، أو الحساب غير مسجل بالمنظومة.')
        } else if (errMsg.includes('email not confirmed')) {
          setError('حساب البريد الإلكتروني غير مؤكد. يرجى التواصل مع المسؤول لتأكيد الحساب.')
        } else {
          setError(`خطأ في تسجيل الدخول: ${result.error.message}`)
        }
        return
      }

      if (rememberMe) {
        window.localStorage.setItem('maamouriyat_remembered_email', cleanEmail)
      } else {
        window.localStorage.removeItem('maamouriyat_remembered_email')
      }

      if (result.data.session?.access_token) {
        sessionStorage.setItem('mohp_pending_token', result.data.session.access_token)
      }

      router.push('/dashboard')
    } catch (err: any) {
      setLoading(false)
      console.error('Supabase auth connection error:', err)
      setError('تعذر الاتصال بالمخزُن الرئيسي للمنظومة. يُرجى التحقق من اتصال الإنترنت.')
    }
  }

  return (
    <main className="login-screen-popup-wrapper">
      <Style />
      {/* Background Mesh Ambient Overlay */}
      <div className="login-bg-overlay" />

      {/* Floating Centered 2-Column Popup Modal Dialog Container */}
      <div className="login-modal-card-popup" role="dialog" aria-modal="true">
        {/* Right Column: Modern Governmental Presentation Panel (Clean & Borderless) */}
        <section className="login-hero-panel-right">
          <div className="hero-image-overlay" />
          <div className="hero-pattern-glow" />

          <div className="hero-content">
            {/* Top Official Header Badge */}
            <div className="hero-official-badge">
              <div className="official-logo-box">
                <MinistryLogo size="panel" />
              </div>
              <div className="official-text-group">
                <span className="republic-text">جمهورية مصر العربية</span>
                <h3 className="ministry-text">وزارة الصحة والسكان</h3>
              </div>
            </div>

            {/* Quranic Verse Box - Seamless Calligraphy */}
            <div className="quran-quote-box">
              <blockquote className="quran-quote">
                « وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ »
              </blockquote>
              <span className="quran-verse-ref">سورة التوبة — آية ١٠٥</span>
            </div>

            {/* Main System Title & Motivational Welcome Note */}
            <div className="hero-main-title">
              <div className="system-official-tag">
                <span className="pulse-indicator" />
                <span>المنظومة الوطنية الموحدة</span>
              </div>
              <h1>نظام حوكمة المأموريات الميدانية 🩺</h1>
              <p className="hero-subtext">
                أهلاً بك 👋 نتمنى لك يوماً موفقاً ومجهوداً كبيراً مقدراً في خدمة الوطن والرعاية الصحية 💙✨
              </p>
            </div>

            {/* Features / Operational Pillars */}
            <div className="hero-features-list">
              <div className="feature-pill">
                <span className="pill-icon">⚡</span>
                <span className="pill-title">متابعة وحوكمة دقيقة</span>
              </div>
              <div className="feature-pill">
                <span className="pill-icon">🏥</span>
                <span className="pill-title">ربط مباشر بالمنشآت</span>
              </div>
              <div className="feature-pill">
                <span className="pill-icon">🛡️</span>
                <span className="pill-title">أعلى معايير الجودة</span>
              </div>
            </div>

            {/* Security Assurance Tag */}
            <div className="hero-security-assurance">
              <span>🔒 بوابة رسمية آمنة • مخصصة للكوادر المصرح لها</span>
            </div>
          </div>
        </section>

        {/* Left Column: Official Login Form */}
        <form className="login-form-panel-left" onSubmit={handleLogin}>
          <div className="form-header">
            <div className="header-logo-row">
              <MinistryLogo size="panel" />
              <div>
                <h2>تسجيل الدخول للمنظومة 🔐</h2>
                <p className="subhead">البوابة الرقمية المركزية لرقمنة المرور علي المنشات الصحية</p>
              </div>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {/* Email Field */}
          <div className="input-group">
            <label htmlFor="login-email">البريد الإلكتروني المعتمد</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                id="login-email"
                autoComplete="email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="أدخل بريدك الإلكتروني المعتمد..."
                required
                type="email"
                value={email}
              />
            </div>
          </div>

          {/* Clean Password Field without Dots Artifacts */}
          <div className="input-group">
            <label htmlFor="login-password">كلمة المرور</label>
            <div className="input-wrapper clean-password-wrapper">
              <input
                id="login-password"
                className="clean-password-input"
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="toggle-password-btn"
                onClick={() => setShowPassword((isVisible) => !isVisible)}
                type="button"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="remember-row-container">
            <label className="remember-row">
              <input
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                type="checkbox"
              />
              <span>تذكر بياناتي في هذا الجهاز</span>
            </label>
          </div>

          <button className="primary-action-btn" disabled={loading} type="submit">
            {loading ? (
              <span className="btn-spinner-row">
                <span className="spinner" /> جاري التحقق والدخول...
              </span>
            ) : (
              'تسجيل الدخول إلى المنظومة 🚀'
            )}
          </button>

          <div className="form-security-footer">
            <span>🛡️ نظام حكومي مشفر ومحمي وفق أحدث بروتوكولات الأمان الرقمي</span>
          </div>
        </form>
      </div>
    </main>
  )
}

function AppShell({ children, initialRole, view }: { children: React.ReactNode; initialRole?: UserRole | null; view: View }) {
  const router = useRouter()
  const [currentRole, setCurrentRole] = useState<UserRole | null>(initialRole ?? null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  
  // Real database-backed user profile states
  const [profileName, setProfileName] = useState<string | null>(null)
  const [profileJobTitle, setProfileJobTitle] = useState<string | null>(null)
  const [profileDepartment, setProfileDepartment] = useState<string | null>(null)
  const [navigationOverride, setNavigationOverride] = useState<NavigationKey[] | null>(null)

  // Logout Confirmation & Farewell Toast States
  const [showLogoutConfirmModal, setShowLogoutConfirmModal] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [showLogoutFarewellToast, setShowLogoutFarewellToast] = useState(false)

  const roleInfo = getRoleDefinition(currentRole)
  const shellAllowedNavigation = navigationOverride ?? getRoleNavigation(currentRole ?? 'inspector')
  const bottomNavigationKeys = shellAllowedNavigation.filter((key) =>
    ['dashboard', 'missions', 'violations', 'checklists'].includes(key),
  )
  const [notificationsList, setNotificationsList] = useState<any[]>([])
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [passwordChangedSuccess, setPasswordChangedSuccess] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    async function resolveUserEmail() {
      if (supabase) {
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          if (sessionError || !session) return

          const user = session.user
          if (user) {
            setUserEmail(user.email ?? user.id)
            if (user.user_metadata?.must_change_password === true) {
              setMustChangePassword(true)
            }
            const { data: profileData } = await supabase
              .from('users')
              .select('id, org_level, level, full_name, job_title, organization_id, department, organizations:organization_id(name)')
              .eq('auth_id', user.id)
              .maybeSingle()
            if (profileData) {
              setProfileName(profileData.full_name)
              setProfileJobTitle(profileData.job_title)
              const orgName = (profileData.organizations as any)?.name || profileData.department || 'ديوان عام وزارة الصحة والسكان'
              setProfileDepartment(orgName)

              const { orgLevelToRole } = await import('@/lib/roles')
              const role = orgLevelToRole(profileData.level ?? profileData.org_level ?? 7, profileData.job_title)
              document.cookie = `maamouriyat_user_role=${role}; path=/; max-age=86400; SameSite=Lax`
              setCurrentRole(role)
            }
          }
        } catch {}
      }
    }
    resolveUserEmail()
  }, [currentRole])

  useEffect(() => {
    setCurrentRole(readUserRoleFromCookie() ?? initialRole ?? null)
  }, [initialRole])

  useEffect(() => {
    async function loadNotifications() {
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (!session?.user) return

          const user = session.user
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('is_read', false)
            .order('created_at', { ascending: false })
            .limit(10)
          
          if (!error && data) {
            setNotificationsList(data.map(n => ({
              href: n.mission_id ? `/dashboard/missions` : `/dashboard/violations`,
              meta: new Date(n.created_at || n.sent_at || Date.now()).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              text: n.body,
              title: n.title,
              tone: n.type === 'mission_assigned' ? 'blue' : 'red',
              is_read: n.is_read
            })))
          }
        } catch (e) {
          // silently handle network/auth blips
        }
      }
    }

    loadNotifications()
    const interval = setInterval(loadNotifications, 15000)
    return () => clearInterval(interval)
  }, [currentRole])

  async function handleClearNotifications() {
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

    useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  function handleInitiateLogout() {
    setUserMenuOpen(false)
    setNotificationsOpen(false)
    setMenuOpen(false)
    setShowLogoutConfirmModal(true)
  }

  async function handleConfirmLogout() {
    setIsLoggingOut(true)
    setShowLogoutFarewellToast(true)

    if (supabase) {
      await supabase.auth.signOut().catch(() => {})
    }

    // Purge all user session and permissions cookies upon logout
    document.cookie = 'maamouriyat_user_role=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'maamouriyat_dynamic_permissions=; path=/; max-age=0; SameSite=Lax'
    document.cookie = 'maamouriyat_user_permissions=; path=/; max-age=0; SameSite=Lax'

    // Clean pending token
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('mohp_pending_token')
    }

    setTimeout(() => {
      setShowLogoutConfirmModal(false)
      setIsLoggingOut(false)
      setShowLogoutFarewellToast(false)
      router.replace('/login')
      router.refresh()
    }, 1500)
  }

  return (
    <main className="app-shell">
      <Style />
      <aside className="desktop-sidebar" aria-label="التنقل الرئيسي">
        <div className="desktop-brand">
          <MinistryLogo size="menu" />
          <div>
            <strong style={{ fontSize: '13px', color: '#0f172a', fontWeight: 900, display: 'block', lineHeight: 1.3 }}>جمهورية مصر العربية</strong>
            <span style={{ fontSize: '11px', color: '#006d77', fontWeight: 'bold', display: 'block' }}>وزارة الصحة والسكان المصرية</span>
          </div>
        </div>
        <Navigation
          allowedKeysOverride={navigationOverride}
          role={currentRole}
          userProfile={{
            name: profileName,
            jobTitle: profileJobTitle,
            department: profileDepartment,
            email: userEmail
          }}
          onLogout={handleInitiateLogout}
        />
      </aside>

      <header className="topbar">
        {/* === Mobile hamburger — hidden on desktop === */}
        <button aria-label="فتح القائمة" className="icon-button topbar-menu-btn" onClick={() => setMenuOpen(true)}>
          <Menu size={20} />
        </button>

        {/* === Brand + page title === */}
        <div className="topbar-title">
          <MinistryLogo size="header" />
          <div className="topbar-text">
            <p className="topbar-org">وزارة الصحة والسكان</p>
            <h1 className="topbar-page">{pageTitle(view)}</h1>
          </div>
        </div>

        {/* === Right-side actions === */}
        <div className="topbar-actions">
          {/* Notifications */}
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

          {/* User chip */}
          <div className="user-menu-wrap">
            <button
              aria-expanded={userMenuOpen}
              className="user-chip-btn"
              onClick={() => setUserMenuOpen((isOpen) => !isOpen)}
              type="button"
              title={profileJobTitle || roleInfo.jobTitle}
              style={{
                background: '#edf7f7',
                border: '1px solid #cfe5e6',
                borderRadius: '50px',
                padding: '4px 10px 4px 6px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                minHeight: '40px',
                maxWidth: '240px',
                transition: 'all 0.2s ease'
              }}
            >
              <span className="user-chip-avatar" style={{
                background: 'linear-gradient(135deg, #0077b6 0%, #00b4d8 100%)',
                boxShadow: '0 2px 8px rgba(0, 180, 216, 0.3)',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 'bold',
                fontSize: '12px'
              }}>
                {(profileName || roleInfo.name || 'ص').charAt(0)}
              </span>
              <span className="user-chip-info" style={{ display: 'grid', textAlign: 'right' }}>
                <span className="user-chip-name" style={{ fontSize: '13px', fontWeight: '900', color: 'var(--ink)' }}>
                  {profileName || roleInfo.name}
                </span>
                <span className="user-chip-role" style={{ fontSize: '10px', fontWeight: '700', color: 'var(--brand)' }}>
                  {profileJobTitle || roleInfo.jobTitle}
                </span>
              </span>
            </button>
            {userMenuOpen && (
              <>
                <button
                  aria-label="إغلاق بيانات المستخدم"
                  className="user-menu-scrim"
                  onClick={() => setUserMenuOpen(false)}
                  type="button"
                />
                <div className="user-menu-panel" style={{
                  background: 'rgba(255, 255, 255, 0.98)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(0, 109, 119, 0.15)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(0, 109, 119, 0.12)',
                  minWidth: '280px',
                  padding: '20px',
                  position: 'absolute',
                  top: '56px',
                  left: '0',
                  zIndex: 60,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  alignItems: 'center',
                  textAlign: 'center'
                }}>
                  {/* Elegant Header Avatar */}
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #006d77 0%, #83c5be 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 15px rgba(0, 109, 119, 0.2)',
                    marginBottom: '4px'
                  }}>
                    {(profileName || roleInfo.name || 'ص').charAt(0)}
                  </div>

                  {/* Active User Details */}
                  <div style={{ display: 'grid', gap: '4px' }}>
                    <strong style={{ fontSize: '15px', color: '#102027', fontWeight: 'bold', display: 'block' }}>
                      {profileName || roleInfo.name}
                    </strong>
                    
                    {/* Job Title Tag */}
                    <span style={{
                      fontSize: '11px',
                      color: '#006d77',
                      background: '#eaf8f3',
                      border: '1px solid #ccebe6',
                      padding: '3px 10px',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      display: 'inline-block',
                      margin: '4px auto'
                    }}>
                      {profileJobTitle || roleInfo.jobTitle}
                    </span>
                  </div>

                  {/* Divider */}
                  <div style={{ width: '100%', height: '1px', background: '#e0f0f0', margin: '4px 0' }} />

                  {/* Department Block */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    width: '100%',
                    justifyContent: 'center'
                  }}>
                    <span style={{ fontSize: '13px' }}>🏢</span>
                    <span style={{ fontSize: '11.5px', color: '#42555d', fontWeight: 'bold' }}>
                      {profileDepartment || 'ديوان عام وزارة الصحة والسكان'}
                    </span>
                  </div>

                  {/* User email display */}
                  {userEmail && (
                    <span style={{ fontSize: '11px', color: '#78909c', wordBreak: 'break-all', display: 'block' }}>
                      {userEmail}
                    </span>
                  )}

                  {/* Divider */}
                  <div style={{ width: '100%', height: '1px', background: '#e0f0f0', margin: '4px 0' }} />

                  {/* Logout button */}
                  <button 
                    onClick={handleInitiateLogout} 
                    type="button"
                    style={{
                      width: '100%',
                      minHeight: '40px',
                      borderRadius: '10px',
                      background: '#fff2f1',
                      border: '1px solid #ffc9c5',
                      color: 'var(--red)',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      margin: '0',
                      fontFamily: 'inherit'
                    }}
                  >
                    <LogOut size={16} />
                    تسجيل الخروج
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Desktop logout */}
          <button className="logout-button" onClick={handleInitiateLogout} title="تسجيل الخروج" type="button">
            <LogOut size={18} />
            <span>خروج</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <aside className="side-sheet open">
          <div className="sheet-head">
            <div className="brand-lockup">
              <MinistryLogo size="menu" />
              <div>
                <strong style={{ fontSize: '13.5px', color: '#102027', display: 'block', lineHeight: 1.3, fontWeight: 900 }}>جمهورية مصر العربية</strong>
                <span style={{ fontSize: '11px', color: '#006d77', display: 'block', fontWeight: 'bold' }}>وزارة الصحة والسكان المصرية</span>
              </div>
            </div>
            <button aria-label="إغلاق القائمة" className="drawer-close-btn" onClick={() => setMenuOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <Navigation
            allowedKeysOverride={navigationOverride}
            onNavigate={() => setMenuOpen(false)}
            role={currentRole}
            userProfile={{
              name: profileName,
              jobTitle: profileJobTitle,
              department: profileDepartment,
              email: userEmail
            }}
            onLogout={handleInitiateLogout}
          />
        </aside>
      )}

      {menuOpen && <button aria-label="إغلاق القائمة" className="scrim" onClick={() => setMenuOpen(false)} />}

      <section className="content-shell">
        <div className="content">
          {children}
          <OfficialGovernmentFooter />
        </div>
      </section>

      <nav 
        className="bottom-nav" 
        aria-label="التنقل الرئيسي"
        style={{
          gridTemplateColumns: `48px repeat(${bottomNavigationKeys.length + 1}, minmax(0, 1fr))`
        }}
      >
        <div className="bottom-logo">
          <MinistryLogo size="footer" />
        </div>
        {bottomNavigationKeys.map((key) => {
          const item = navigationDefinitions[key]
          return (
            <NavItem
              href={item.href}
              icon={item.icon}
              key={key}
              label={key === 'dashboard' ? 'الرئيسية' : (key === 'checklists' ? 'الاستمارات' : item.label)}
            />
          )
        })}
        <NavItem href="/login" icon={LogOut} label="خروج" />
      </nav>

      {/* ===== FORCED PASSWORD CHANGE MODAL =====
          Direct child of <main>, outside any fixed/positioned stacking context,
          so z-index: 99999 applies in the root stacking context and covers the topbar ===== */}
      {mustChangePassword && (
        <div className="forced-password-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 24, 31, 0.74)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '24px 16px',
          direction: 'rtl'
        }}>
          <div className="forced-password-modal" style={{
            background: 'white',
            border: '1px solid #d8e5e7',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '520px',
            boxShadow: '0 22px 64px rgba(10,24,31,0.32)',
            overflow: 'auto',
            maxHeight: '92vh',
          }}>

            {passwordChangedSuccess ? (
              /* ===== SUCCESS SCREEN ===== */
              <div style={{ display: 'grid', gap: 0 }}>
                {/* Gradient hero */}
                <div style={{
                  background: 'linear-gradient(135deg, #006d77 0%, #2a9d8f 50%, #52b788 100%)',
                  padding: '48px 32px 40px',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Decorative circles */}
                  <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
                  <div style={{ position: 'absolute', bottom: -20, left: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
                  {/* Checkmark badge */}
                  <div style={{
                    width: 80, height: 80,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.18)',
                    border: '3px solid rgba(255,255,255,0.5)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '38px',
                    marginBottom: '16px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  }}>
                    ✅
                  </div>
                  <h2 style={{ color: 'white', fontSize: '22px', fontWeight: 900, margin: '0 0 8px', lineHeight: 1.3 }}>
                    تم التحديث بنجاح!
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px', margin: 0, lineHeight: 1.7 }}>
                    كلمة مرورك الجديدة محفوظة وآمنة
                  </p>
                </div>

                {/* Body */}
                <div style={{ padding: '28px 32px 32px', display: 'grid', gap: '20px' }}>
                  {/* Info row */}
                  <div style={{
                    background: '#f0faf8',
                    border: '1px solid #b2dfdb',
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'grid',
                    gap: '10px',
                  }}>
                    {[
                      { icon: '🛡️', text: 'حسابك محمي بكلمة مرور قوية وخاصة بك' },
                      { icon: '🔐', text: 'لن تحتاج لتغيير كلمة المرور مجدداً في كل دخول' },
                      { icon: '✨', text: 'يمكنك الآن استخدام جميع ميزات المنظومة بأمان' },
                    ].map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#37474f' }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>

                  {/* CTA button */}
                  <button
                    type="button"
                    onClick={() => setMustChangePassword(false)}
                    style={{
                      width: '100%',
                      minHeight: '48px',
                      background: 'linear-gradient(135deg, #006d77 0%, #2a9d8f 100%)',
                      color: 'white',
                      border: 0,
                      borderRadius: '12px',
                      fontWeight: 900,
                      cursor: 'pointer',
                      fontSize: '15px',
                      boxShadow: '0 6px 20px rgba(0, 109, 119, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>➡️</span>
                    الدخول إلى المنظومة
                  </button>
                </div>
              </div>

            ) : (
              /* ===== FORM SCREEN ===== */
              <div className="forced-password-content" style={{ display: 'grid', gap: '18px' }}>
                {/* Header */}
                <div className="forced-password-header" style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '22px 24px 18px', borderBottom: '1px solid #e7eff1', background: '#ffffff' }}>
                  <span style={{ width: '46px', height: '46px', borderRadius: '14px', background: '#e7f5f1', color: 'var(--brand)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', flexShrink: 0 }}>🔒</span>
                  <div style={{ display: 'grid', gap: '6px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#102027', margin: 0, lineHeight: 1.35 }}>تغيير كلمة المرور الإلزامي</h2>
                  <p style={{ fontSize: '13px', color: '#546e7a', margin: 0, lineHeight: '1.75' }}>
                    أنت تستخدم كلمة مرور مؤقتة أو افتراضية حالياً. لحماية حسابك وتوافقاً مع معايير الأمن السيبراني للمنظومة، يرجى تعيين كلمة مرور جديدة قوية وخاصة بك للمتابعة.
                  </p>
                  </div>
                </div>

            {/* Form */}
            <form onSubmit={async (e) => {
              e.preventDefault()
              const form = e.currentTarget
              const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement | null
              const newPass = (form.elements.namedItem('newPass') as HTMLInputElement).value
              const confirmPass = (form.elements.namedItem('confirmPass') as HTMLInputElement).value

              if (newPass.length < 6) {
                alert('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.')
                return
              }
              if (newPass === '123456') {
                alert('يجب اختيار كلمة مرور مختلفة عن الكلمة الافتراضية.')
                return
              }
              if (newPass !== confirmPass) {
                alert('كلمتا المرور غير متطابقتين.')
                return
              }

              if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جارٍ التحديث...' }

              try {
                if (supabase) {
                  // ===== REAL SUPABASE LOGIN =====
                  // 1. Try live session from the browser client
                  let accessToken: string | null = null
                  const { data: { session } } = await supabase.auth.getSession()
                  if (session?.access_token) {
                    accessToken = session.access_token
                  } else {
                    // 2. Fall back to the token stored right after signInWithPassword
                    accessToken = sessionStorage.getItem('mohp_pending_token')
                  }

                  if (!accessToken) {
                    alert('انتهت صلاحية جلسة الدخول. يرجى تسجيل الخروج ثم الدخول مرة أخرى.')
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'تحديث كلمة المرور والدخول' }
                    return
                  }

                  const res = await fetch('/api/user/change-password', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${accessToken}`,
                    },
                    body: JSON.stringify({ newPassword: newPass }),
                  })
                  const json = await res.json()
                  if (!res.ok) {
                    alert('فشل التحديث: ' + (json.error || 'خطأ غير معروف'))
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'تحديث كلمة المرور والدخول' }
                    return
                  }

                  // Clean up stored token after successful change
                  sessionStorage.removeItem('mohp_pending_token')
                } else {
                  alert('إعداد قاعدة البيانات Supabase غير مكتمل.')
                  if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'تحديث كلمة المرور والدخول' }
                  return
                }

                setPasswordChangedSuccess(true)
              } catch (err: any) {
                alert('حدث خطأ أثناء الاتصال بالخادم: ' + err.message)
                if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'تحديث كلمة المرور والدخول' }
              }
            }} style={{ display: 'grid', gap: '16px', padding: '4px 24px 0' }}>

              <label className="forced-password-field" style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: '#37474f', textAlign: 'right' }}>
                كلمة المرور الجديدة
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    name="newPass"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="أدخل كلمة مرور جديدة قوية"
                    required
                    style={{
                      width: '100%',
                      minHeight: '50px',
                      borderRadius: '12px',
                      border: '1px solid #cfdcde',
                      padding: '0 12px 0 46px',
                      fontSize: '14px',
                      outline: 'none',
                      background: '#fbfdfd',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    aria-label={showNewPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    style={{
                      position: 'absolute', top: '50%', left: '8px',
                      transform: 'translateY(-50%)', background: 'transparent',
                      border: 0, color: '#546e7a', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, width: '36px', height: '36px', borderRadius: '50%', outline: 'none'
                    }}
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              <label className="forced-password-field" style={{ display: 'grid', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: '#37474f', textAlign: 'right' }}>
                تأكيد كلمة المرور الجديدة
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    name="confirmPass"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="أعد كتابة كلمة المرور للتأكيد"
                    required
                    style={{
                      width: '100%',
                      minHeight: '50px',
                      borderRadius: '12px',
                      border: '1px solid #cfdcde',
                      padding: '0 12px 0 46px',
                      fontSize: '14px',
                      outline: 'none',
                      background: '#fbfdfd',
                      boxSizing: 'border-box'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    style={{
                      position: 'absolute', top: '50%', left: '8px',
                      transform: 'translateY(-50%)', background: 'transparent',
                      border: 0, color: '#546e7a', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, width: '36px', height: '36px', borderRadius: '50%', outline: 'none'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>

              {/* Submit */}
              <button
                className="forced-password-primary"
                type="submit"
                style={{
                  width: '100%', minHeight: '50px',
                  background: 'var(--brand)', color: 'white',
                  border: 0, borderRadius: '12px',
                  fontWeight: 'bold', cursor: 'pointer',
                  fontSize: '14px', marginTop: '4px',
                  boxShadow: '0 4px 10px rgba(0, 109, 119, 0.2)',
                  transition: 'all 0.2s'
                }}
              >
                تحديث كلمة المرور والدخول
              </button>
            </form>

              {/* Logout fallback */}
              <div className="forced-password-footer" style={{ borderTop: '1px solid #eef3f4', padding: '16px 24px 22px', textAlign: 'center', background: '#ffffff' }}>
                <p style={{ fontSize: '12px', color: '#90a4ae', margin: '0 0 10px' }}>
                  هل تواجه مشكلة؟ يمكنك تسجيل الخروج والمحاولة مجدداً
                </p>
                <button
                  type="button"
                  onClick={handleInitiateLogout}
                  style={{
                    alignItems: 'center', background: '#fff2f1',
                    border: '1px solid #ffc9c5', borderRadius: '10px',
                    color: '#c62828', cursor: 'pointer',
                    display: 'inline-flex', fontSize: '13px',
                    fontWeight: 'bold', gap: '6px',
                    minHeight: '40px', padding: '8px 20px',
                  }}
                >
                  <LogOut size={15} />
                  تسجيل الخروج
                </button>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
      {/* ===== LOGOUT CONFIRMATION MODAL POPUP ===== */}
      {showLogoutConfirmModal && (
        <div className="popup-backdrop-overlay" onClick={() => !isLoggingOut && setShowLogoutConfirmModal(false)}>
          <div
            className="logout-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="logout-modal-header">
              <div className="logout-icon-circle">🚪</div>
              <h3>تأكيد تسجيل الخروج</h3>
            </div>

            {showLogoutFarewellToast ? (
              <div className="logout-farewell-box">
                <span className="farewell-star">🌟</span>
                <p className="farewell-title">تم تسجيل الخروج بنجاح!</p>
                <p className="farewell-msg">
                  نشكرك جزيل الشكر على جهودك العظيمة والدؤوبة اليوم في خدمة المرضى والرعاية الصحية والوطن! 💙✨ نتطلع لرؤيتك مجدداً بكل خير.
                </p>
              </div>
            ) : (
              <>
                <p className="logout-question">
                  هل أنت تأكد من رغبتك في تسجيل الخروج من المنظومة؟
                </p>

                <div className="logout-motivational-preview">
                  <span className="preview-heart">💙</span>
                  <p className="preview-text">
                    نشكرك من القلب على جهودك العظيمة والدؤوبة في خدمة المرضى والرعاية الصحية والوطن! 🌟 نتطلع لرؤيتك مجدداً بكل خير.
                  </p>
                </div>

                <div className="logout-actions-row">
                  <button
                    type="button"
                    className="logout-cancel-btn"
                    onClick={() => setShowLogoutConfirmModal(false)}
                    disabled={isLoggingOut}
                  >
                    إلغاء (البقاء في المنظومة)
                  </button>
                  <button
                    type="button"
                    className="logout-confirm-btn"
                    onClick={handleConfirmLogout}
                    disabled={isLoggingOut}
                  >
                    {isLoggingOut ? 'جاري الخروج...' : 'تأكيد الخروج 👋'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </main>
  )
}

function readUserRoleFromCookie(): UserRole | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('maamouriyat_user_role='))
  return (match?.split('=')[1] as UserRole) || null
}

function Navigation({
  allowedKeysOverride,
  onNavigate,
  role,
  userProfile,
  onLogout,
}: {
  allowedKeysOverride?: readonly NavigationKey[] | null
  onNavigate?: () => void
  role: UserRole | null
  userProfile?: {
    name?: string | null
    jobTitle?: string | null
    department?: string | null
    email?: string | null
  }
  onLogout?: () => void
}) {
  const roleInfo = getRoleDefinition(role)
  const allowedKeys = new Set(allowedKeysOverride ?? getRoleNavigation(role ?? 'inspector'))

  const getContextualLabel = (key: NavigationKey, r: UserRole | null) => {
    if (key === 'dashboard') {
      if (r === 'inspector') return 'الرئيسية ومؤشرات أدائي'
      if (r === 'creator') return 'لوحة الإدارة الصحية'
      if (r === 'directorate') return 'لوحة مديرية الشئون الصحية'
      if (r === 'generalmanager') return 'لوحة الإدارة العامة'
      if (r === 'central') return 'لوحة الإدارة المركزية'
      if (r === 'sector') return 'لوحة القطاع المركزي'
      if (r === 'techadmin') return 'لوحة الدعم الفني'
      return 'لوحة المتابعة المركزية'
    }
    if (key === 'missions') {
      if (r === 'inspector') return 'مأمورياتي المكلف بها'
      if (r === 'creator') return 'مأموريات وتكليفات الإدارة'
      if (r === 'directorate') return 'مأموريات المحافظة'
      if (r === 'sector' || r === 'central' || r === 'generalmanager') return 'مأموريات القطاع'
      return 'المأموريات الميدانية'
    }
    if (key === 'violations') {
      if (r === 'inspector') return 'المخالفات المرصودة'
      if (r === 'creator') return 'مخالفات منشآت الإدارة'
      if (r === 'directorate') return 'مخالفات منشآت المحافظة'
      if (r === 'sector') return 'مخالفات منشآت القطاع'
      return 'المخالفات الميدانية'
    }
    if (key === 'facilities') {
      if (r === 'directorate') return 'منشآت المحافظة'
      if (r === 'sector') return 'منشآت القطاع'
      return 'المنشآت الصحية'
    }
    if (key === 'checklists') {
      return 'نماذج واستمارات المرور'
    }
    if (key === 'users') {
      if (r === 'sector') return 'كوادر ومفتشو القطاع'
      return 'إدارة الكوادر والموظفين'
    }
    if (key === 'settings') {
      return 'إعدادات المنظومة والصلاحيات'
    }
    return navigationDefinitions[key as NavigationKey]?.label || key
  }

  const sections = [
    {
      title: 'المتابعة والتشغيل الميداني',
      icon: '📊',
      keys: (['dashboard', 'missions'] as NavigationKey[]).filter(k => allowedKeys.has(k))
    },
    {
      title: 'الرقابة والمنشآت الصحية',
      icon: '🏥',
      keys: (['violations', 'facilities', 'checklists'] as NavigationKey[]).filter(k => allowedKeys.has(k))
    },
    {
      title: 'الحوكمة وإدارة النظام',
      icon: '⚙️',
      keys: (['users', 'settings'] as NavigationKey[]).filter(k => allowedKeys.has(k))
    }
  ].filter(sec => sec.keys.length > 0)

  return (
    <div className="sheet-nav-container">
      {/* User profile card */}
      <div className="drawer-user-card">
        <div className="drawer-avatar">
          {(userProfile?.name || roleInfo.name || 'م').charAt(0)}
        </div>
        <div className="drawer-user-text">
          <strong className="drawer-user-name">{userProfile?.name || roleInfo.name}</strong>
          <span className="drawer-user-job">{userProfile?.jobTitle || roleInfo.jobTitle}</span>
          <small className="drawer-user-dept">🏢 {userProfile?.department || 'ديوان عام وزارة الصحة'}</small>
        </div>
      </div>

      {/* Sections with Spacing */}
      <div className="drawer-sections-wrapper">
        {sections.map((section) => (
          <div key={section.title} className="drawer-nav-section">
            <div className="drawer-section-header">
              <span className="section-icon-badge">{section.icon}</span>
              <span className="section-title-text">{section.title}</span>
            </div>
            <div className="drawer-section-items">
              {section.keys.map((key) => {
                const def = navigationDefinitions[key]
                return (
                  <NavItem
                    href={def.href}
                    icon={def.icon}
                    isDrawer={true}
                    key={key}
                    label={getContextualLabel(key, role)}
                    onClick={onNavigate}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer block */}
      <div className="drawer-footer-block">
        <button
          type="button"
          className="drawer-logout-button"
          onClick={() => {
            onNavigate?.()
            onLogout?.()
          }}
        >
          <LogOut size={16} />
          <span>تسجيل الخروج من الحساب</span>
        </button>
        <div className="drawer-security-note">
          <span>جميع الحقوق محفوظة © 2026</span>
        </div>
      </div>
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


export function OfficialGovernmentFooter() {
  return (
    <footer className="official-gov-footer">
      <p style={{ margin: 0, fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
        جميع الحقوق محفوظة © 2026
      </p>
    </footer>
  )
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
  isDrawer = false,
}: {
  href: string
  icon: LucideIcon
  label: string
  onClick?: () => void
  isDrawer?: boolean
}) {
  const pathname = usePathname()
  const active = pathname === href || (href !== '/dashboard' && pathname?.startsWith(href))

  async function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (href === '/login') {
      event.preventDefault()
      onClick?.()

      if (supabase) {
        await supabase.auth.signOut()
      }

      window.location.assign('/login')
      return
    }

    onClick?.()
  }

  if (isDrawer) {
    return (
      <Link className={`drawer-nav-item ${active ? 'active' : ''}`} href={href} onClick={handleClick}>
        <div className="drawer-nav-icon">
          <Icon size={18} />
        </div>
        <span className="drawer-nav-label">{label}</span>
        <span className="drawer-nav-chevron">‹</span>
      </Link>
    )
  }

  return (
    <Link className={`nav-item ${active ? 'active' : ''}`} href={href} onClick={handleClick}>
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  )
}

export function DashboardScreen() {
  const [profileName, setProfileName] = useState<string>('قائم بالمرور')
  const [profileJob, setProfileJob] = useState<string>('مفتش صحي')
  const [stats, setStats] = useState([
    { label: 'المأموريات المنجزة', value: '0', tone: 'green', icon: CheckCircle2 },
    { label: 'قيد التنفيذ', value: '0', tone: 'blue', icon: ClipboardList },
    { label: 'مأموريات متأخرة', value: '0', tone: 'red', icon: AlertTriangle },
    { label: 'إجمالي المنشآت', value: '0', tone: 'amber', icon: Building2 },
  ])
  const [missionsList, setMissionsList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadDashboardData() {
      if (!supabase) {
        setLoading(false)
        return
      }
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user
        if (!user) {
          setLoading(false)
          return
        }

        // 1. Get real profile
        const { data: profile } = await supabase
          .from('users')
          .select('id, full_name, job_title')
          .eq('auth_id', user.id)
          .maybeSingle()

        if (profile?.id) {
          setProfileName(profile.full_name || user.email || 'قائم بالمرور')
          setProfileJob(profile.job_title || 'مفتش صحي')

          try {
            // Completed missions
            const { count: completedCount } = await supabase
              .from('missions')
              .select('id', { count: 'exact', head: true })
              .in('status', ['completed', 'approved', 'done'])

            // In progress
            const { count: inProgressCount } = await supabase
              .from('missions')
              .select('id', { count: 'exact', head: true })
              .in('status', ['assigned', 'in_progress', 'executing', 'under_review'])

            // Late missions
            const todayStr = new Date().toISOString().split('T')[0]
            const { data: maybeLateMissions } = await supabase
              .from('missions')
              .select('id, status, scheduled_date')
              .lt('scheduled_date', todayStr)

            const lateCount = maybeLateMissions
              ? maybeLateMissions.filter(m => !['completed', 'approved', 'done'].includes(m.status)).length
              : 0

            // Facilities count
            const { count: facilityCount } = await supabase
              .from('facilities')
              .select('id', { count: 'exact', head: true })
              .eq('is_active', true)

            setStats([
              { label: 'المأموريات المنجزة', value: String(completedCount || 0), tone: 'green', icon: CheckCircle2 },
              { label: 'قيد التنفيذ', value: String(inProgressCount || 0), tone: 'blue', icon: ClipboardList },
              { label: 'مأموريات متأخرة', value: String(lateCount || 0), tone: 'red', icon: AlertTriangle },
              { label: 'إجمالي المنشآت', value: String(facilityCount || 0), tone: 'amber', icon: Building2 },
            ])

            // Latest 5 missions
            const { data: latestMissions } = await supabase
              .from('missions')
              .select(`
                id,
                serial_number,
                status,
                scheduled_date,
                violation_count,
                facilities:target_facility_id(name)
              `)
              .order('scheduled_date', { ascending: false })
              .limit(5)

            if (latestMissions) {
              setMissionsList(latestMissions.map((m: any) => {
                const facilityObj = Array.isArray(m.facilities) ? m.facilities[0] : m.facilities
                
                let statusText = 'قيد الانتظار'
                let statusTone = 'amber'
                const s = (m.status || '').toLowerCase()
                if (['completed', 'approved', 'done'].includes(s)) {
                  statusText = 'مكتملة'
                  statusTone = 'green'
                } else if (['assigned', 'in_progress', 'executing'].includes(s)) {
                  statusText = 'قيد التنفيذ'
                  statusTone = 'blue'
                } else if (s === 'under_review') {
                  statusText = 'بانتظار الاعتماد'
                  statusTone = 'amber'
                } else if (s === 'rejected') {
                  statusText = 'مرفوضة'
                  statusTone = 'red'
                }

                return {
                  id: m.serial_number || m.id,
                  facility: facilityObj?.name || 'منشأة غير محددة',
                  inspector: profile.full_name || 'مفتش',
                  date: m.scheduled_date ? formatDateArabic(m.scheduled_date) : '',
                  status: statusText,
                  tone: statusTone,
                  violations: m.violation_count || 0
                }
              }))
            }
          } catch (err) {
            console.error('Error fetching dashboard stats:', err)
          }
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  function formatDateArabic(dateStr: string) {
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="stack">


      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)', fontSize: '14px', fontWeight: 'bold' }}>
          جاري تحميل البيانات الحية من قاعدة البيانات...
        </div>
      ) : (
        <>
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
          <MissionList compact missionsData={missionsList} />
        </>
      )}
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
      </div>
      <MissionList missionsData={visibleMissions} />
    </div>
  )
}

function MissionList({ compact = false, missionsData = [] }: { compact?: boolean; missionsData?: any[] }) {
  if (missionsData.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '36px 16px',
        background: 'var(--surface)',
        border: '1px dashed var(--line)',
        borderRadius: '8px',
        color: 'var(--muted)',
        fontSize: '13.5px',
        fontWeight: 'bold'
      }}>
        📋 لا توجد مأموريات مسجلة حالياً في قاعدة البيانات.
      </div>
    )
  }

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

      /* Popup Screen Wrapper */
      .login-screen-popup-wrapper {
        min-height: 100vh;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        padding: 24px 16px;
        background: radial-gradient(circle at 10% 20%, #e0f2fe 0%, #f0fdf4 40%, #e6fffa 90%);
        overflow-x: hidden;
      }

      .login-bg-overlay {
        position: absolute;
        inset: 0;
        background-image: 
          radial-gradient(at 80% 20%, rgba(0, 109, 119, 0.15) 0px, transparent 50%),
          radial-gradient(at 20% 80%, rgba(42, 157, 143, 0.15) 0px, transparent 50%);
        pointer-events: none;
      }

      /* Floating 2-Column Popup Modal Card Container */
      .login-modal-card-popup {
        position: relative;
        z-index: 10;
        width: 100%;
        max-width: 1080px;
        display: grid;
        grid-template-columns: 1.18fr 1fr;
        background: #ffffff;
        border-radius: 28px;
        box-shadow: 0 25px 60px -15px rgba(0, 75, 82, 0.28), 0 0 0 1px rgba(0, 109, 119, 0.08);
        overflow: hidden;
        animation: popupZoomIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes popupZoomIn {
        from {
          opacity: 0;
          transform: scale(0.95) translateY(16px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      /* Right Column: Modern Governmental Presentation Panel (Clean & Borderless) */
      .login-hero-panel-right {
        position: relative;
        background-image: url('/healthcare-hero.jpg');
        background-size: cover;
        background-position: center;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 34px 30px;
        color: white;
        overflow: hidden;
      }

      .hero-image-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(155deg, rgba(3, 38, 43, 0.93) 0%, rgba(6, 68, 75, 0.88) 45%, rgba(13, 108, 102, 0.91) 100%);
        backdrop-filter: blur(1.5px);
      }

      .hero-pattern-glow {
        position: absolute;
        inset: 0;
        background: 
          radial-gradient(circle at 85% 15%, rgba(20, 184, 166, 0.18) 0%, transparent 45%),
          radial-gradient(circle at 15% 85%, rgba(16, 185, 129, 0.14) 0%, transparent 45%);
        pointer-events: none;
      }

      .hero-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        gap: 16px;
        height: 100%;
        justify-content: space-between;
      }

      /* Official Ministerial Header - Borderless & Clean */
      .hero-official-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        background: none;
        border: none;
        padding: 0;
        box-shadow: none;
      }

      .official-logo-box {
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.96);
        padding: 4px;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      }

      .official-text-group {
        display: flex;
        flex-direction: column;
        gap: 1px;
      }

      .republic-text {
        font-size: 0.7rem;
        font-weight: 700;
        color: #99f6e4;
        letter-spacing: 0.02em;
        opacity: 0.95;
      }

      .ministry-text {
        margin: 0;
        font-size: 0.96rem;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.25;
      }

      .sector-text {
        font-size: 0.72rem;
        font-weight: 600;
        color: #ccfbf1;
        opacity: 0.9;
      }

      /* Quranic Verse Box - Seamless, Centered & Borderless */
      .quran-quote-box {
        background: none;
        border: none;
        padding: 2px 0;
        box-shadow: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 3px;
      }

      .quran-quote {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.7;
        font-weight: 700;
        color: #ecfdf5;
        font-family: Cairo, Tajawal, 'Segoe UI', sans-serif;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
      }

      .quran-verse-ref {
        font-size: 0.66rem;
        font-weight: 600;
        color: #99f6e4;
        opacity: 0.8;
      }

      /* Hero Main Title & Greeting - Borderless */
      .hero-main-title {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .system-official-tag {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(16, 185, 129, 0.16);
        border: none;
        padding: 3px 10px;
        border-radius: 100px;
        font-size: 0.68rem;
        font-weight: 700;
        color: #a7f3d0;
        width: fit-content;
      }

      .pulse-indicator {
        width: 6px;
        height: 6px;
        background: #34d399;
        border-radius: 50%;
        box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7);
        animation: pulseDot 2s infinite;
      }

      @keyframes pulseDot {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(52, 211, 153, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
      }

      .hero-main-title h1 {
        font-size: 1.3rem;
        margin: 0;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.35;
        text-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      }

      .hero-subtext {
        font-size: 0.8rem;
        line-height: 1.65;
        color: #e0f2fe;
        margin: 0;
        font-weight: 500;
        background: none;
        border: none;
        padding: 0;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      }

      /* Hero Features List - Seamless & Clean */
      .hero-features-list {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }

      .feature-pill {
        background: rgba(255, 255, 255, 0.07);
        border: none;
        padding: 7px 8px;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 2px;
        transition: all 0.2s ease;
      }

      .feature-pill:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      .pill-icon {
        font-size: 1.05rem;
      }

      .pill-title {
        font-size: 0.7rem;
        font-weight: 700;
        color: #ffffff;
        line-height: 1.25;
      }

      .hero-security-assurance {
        font-size: 0.68rem;
        font-weight: 600;
        color: #a7f3d0;
        text-align: center;
        opacity: 0.85;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }

      /* Left Column: Form Panel */
      .login-form-panel-left {
        padding: 38px 32px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 18px;
        background: #ffffff;
      }

      .header-logo-row {
        display: flex;
        align-items: center;
        gap: 14px;
      }

      .header-logo-row h2 {
        margin: 0;
        font-size: 1.35rem;
        font-weight: 900;
        color: #0f172a;
      }

      .header-logo-row .subhead {
        margin: 3px 0 0 0;
        font-size: 0.78rem;
        color: #64748b;
        font-weight: 600;
      }

      /* Alerts */
      .alert {
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 0.82rem;
        font-weight: 600;
        line-height: 1.5;
      }

      .alert-danger {
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }

      .alert-success {
        background: #f0fdf4;
        color: #166534;
        border: 1px solid #bbf7d0;
      }

      /* Inputs */
      .input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .input-group label {
        font-size: 0.875rem;
        font-weight: 700;
        color: #334155;
      }

      .input-wrapper {
        position: relative;
        display: flex;
        align-items: center;
      }

      .input-wrapper input {
        width: 100%;
        padding: 12px 14px 12px 42px;
        border: 1.5px solid #cbd5e1;
        border-radius: 12px;
        font-size: 0.95rem;
        outline: none;
        transition: all 0.2s ease;
        background: #ffffff;
      }

      .input-wrapper input:focus {
        border-color: #006d77;
        box-shadow: 0 0 0 3.5px rgba(0, 109, 119, 0.15);
      }

      .input-icon {
        position: absolute;
        left: 14px;
        color: #94a3b8;
        pointer-events: none;
      }

      /* Clean Password Input without default browser dots/icons artifacts */
      .clean-password-wrapper {
        position: relative;
      }

      .clean-password-input {
        letter-spacing: 0.08em;
        font-family: inherit;
      }

      .clean-password-input::-ms-reveal,
      .clean-password-input::-ms-clear,
      .clean-password-input::-webkit-credentials-auto-fill-button {
        display: none !important;
      }

      .toggle-password-btn {
        position: absolute;
        left: 10px;
        background: none;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: color 0.15s;
      }

      .toggle-password-btn:hover {
        color: #006d77;
      }

      .remember-row-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .remember-row {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 0.85rem;
        color: #475569;
        cursor: pointer;
      }

      .remember-row input[type="checkbox"] {
        width: 18px;
        height: 18px;
        accent-color: #006d77;
        cursor: pointer;
      }

      /* Primary Button */
      .primary-action-btn {
        background: linear-gradient(135deg, #006d77 0%, #004b52 100%);
        color: #ffffff;
        border: none;
        padding: 14px;
        border-radius: 12px;
        font-size: 1rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0, 109, 119, 0.25);
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .primary-action-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(0, 109, 119, 0.35);
      }

      .primary-action-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }

      .btn-spinner-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      .form-security-footer {
        text-align: center;
        padding-top: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        color: #64748b;
      }

      /* POPUP BACKDROP OVERLAY */
      .popup-backdrop-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        animation: backdropFadeIn 0.3s ease forwards;
      }

      @keyframes backdropFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* LOGOUT CONFIRMATION MODAL */
      .logout-modal-dialog {
        position: relative;
        width: 100%;
        max-width: 480px;
        background: #ffffff;
        border-radius: 24px;
        box-shadow: 0 25px 65px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2);
        padding: 28px;
        display: flex;
        flex-direction: column;
        gap: 18px;
        animation: popupZoomIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        direction: rtl;
        text-align: center;
      }

      .logout-modal-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
      }

      .logout-icon-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: #fef2f2;
        border: 2px solid #fecaca;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 26px;
      }

      .logout-modal-header h3 {
        margin: 0;
        font-size: 1.3rem;
        font-weight: 800;
        color: #0f172a;
      }

      .logout-question {
        font-size: 1.05rem;
        font-weight: 700;
        color: #334155;
        margin: 0;
        line-height: 1.5;
      }

      .logout-motivational-preview {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 16px;
        padding: 16px;
        display: flex;
        align-items: flex-start;
        gap: 12px;
        text-align: right;
      }

      .preview-heart {
        font-size: 1.3rem;
        flex-shrink: 0;
      }

      .preview-text {
        margin: 0;
        font-size: 0.9rem;
        line-height: 1.6;
        color: #166534;
        font-weight: 600;
      }

      .logout-actions-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-top: 8px;
      }

      .logout-cancel-btn {
        flex: 1;
        background: #f1f5f9;
        color: #475569;
        border: 1px solid #cbd5e1;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .logout-cancel-btn:hover:not(:disabled) {
        background: #e2e8f0;
        color: #0f172a;
      }

      .logout-confirm-btn {
        flex: 1;
        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        color: #ffffff;
        border: none;
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 14px rgba(239, 68, 68, 0.3);
      }

      .logout-confirm-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(239, 68, 68, 0.4);
      }

      .logout-farewell-box {
        background: #f0fdf4;
        border: 1px solid #86efac;
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        animation: backdropFadeIn 0.3s ease forwards;
      }

      .farewell-star {
        font-size: 2.2rem;
      }

      .farewell-title {
        font-size: 1.2rem;
        font-weight: 800;
        color: #15803d;
        margin: 0;
      }

      .farewell-msg {
        font-size: 0.95rem;
        line-height: 1.6;
        color: #166534;
        margin: 0;
        font-weight: 600;
      }

      /* Responsive Mobile Optimization */
      @media (max-width: 900px) {
        .login-screen-popup-wrapper {
          padding: 16px 12px;
          align-items: center;
        }

        .login-modal-card-popup {
          grid-template-columns: 1fr;
          max-width: 480px;
          border-radius: 22px;
        }

        /* Compact Header on Mobile */
        .login-hero-panel-right {
          min-height: auto;
          padding: 16px 18px;
          gap: 8px;
        }

        .hero-content {
          gap: 8px;
        }

        .hero-official-badge {
          justify-content: center;
          text-align: center;
        }

        .official-logo-box {
          padding: 3px;
        }

        .republic-text {
          font-size: 0.65rem;
        }

        .ministry-text {
          font-size: 0.88rem;
        }

        .quran-quote-box {
          padding: 0;
          margin-top: 2px;
        }

        .quran-quote {
          font-size: 0.78rem;
          line-height: 1.5;
        }

        .quran-verse-ref {
          font-size: 0.62rem;
        }

        /* Hide bulky duplicate sections on mobile to keep form visible immediately */
        .hero-main-title,
        .hero-features-list,
        .hero-security-assurance {
          display: none !important;
        }

        /* Streamlined Mobile Form */
        .login-form-panel-left {
          padding: 20px 18px 24px;
          gap: 14px;
        }

        .header-logo-row {
          justify-content: center;
          text-align: center;
        }

        .header-logo-row .ministry-logo {
          display: none; /* Already present in top header */
        }

        .header-logo-row h2 {
          font-size: 1.25rem;
        }

        .header-logo-row .subhead {
          font-size: 0.75rem;
        }
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

      .forced-password-modal input:focus {
        border-color: var(--brand) !important;
        box-shadow: 0 0 0 3px rgba(0, 109, 119, 0.12);
        background: #ffffff !important;
      }

      .forced-password-content {
        display: grid !important;
        gap: 0 !important;
      }

      .forced-password-header {
        background: #ffffff !important;
        border-bottom: 1px solid #e7eff1 !important;
        color: var(--ink);
        display: flex !important;
        gap: 14px !important;
        padding: 22px 24px 18px !important;
      }

      .forced-password-header > span {
        background: #e7f5f1 !important;
        border: 0;
        color: var(--brand) !important;
      }

      .forced-password-header h2,
      .forced-password-header p {
        color: inherit !important;
      }

      .forced-password-header p {
        color: var(--muted) !important;
      }

      .forced-password-content form {
        padding: 20px 24px 0 !important;
      }

      .forced-password-field {
        font-size: 14px !important;
      }

      .forced-password-field input {
        border-radius: 14px !important;
        min-height: 54px !important;
      }

      .forced-password-primary {
        border-radius: 14px !important;
        min-height: 54px !important;
      }

      .forced-password-footer {
        bottom: 0;
        position: sticky;
        z-index: 2;
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

      /* Reserved for future account switcher styles */

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

      .remember-row {
        align-items: center;
        color: var(--muted);
        cursor: pointer;
        display: inline-flex;
        font-size: 13px;
        font-weight: 800;
        gap: 9px;
        justify-self: start;
        min-height: 28px;
      }

      .remember-row input {
        accent-color: var(--brand);
        cursor: pointer;
        height: 17px;
        min-height: 17px;
        padding: 0;
        width: 17px;
      }

      .app-shell {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
        padding: 72px 14px calc(112px + env(safe-area-inset-bottom));
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

      /* ===================== TOPBAR ===================== */
      .topbar {
        align-items: center;
        background: rgba(248, 251, 251, 0.96);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-bottom: 1px solid var(--line);
        box-shadow: 0 1px 8px rgba(16, 32, 39, 0.06);
        display: grid;
        gap: 10px;
        grid-template-columns: 44px 1fr auto;
        height: 60px;
        left: 0;
        padding: 0 14px;
        position: fixed;
        right: 0;
        top: 0;
        z-index: 25;
      }

      /* Brand block */
      .topbar-title {
        align-items: center;
        display: flex;
        gap: 10px;
        min-width: 0;
        overflow: hidden;
      }

      .topbar-text {
        display: grid;
        gap: 0;
        min-width: 0;
      }

      .topbar-org {
        color: var(--muted);
        font-size: 10px;
        font-weight: 700;
        line-height: 1.2;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .topbar-page {
        color: var(--ink);
        font-size: 17px;
        font-weight: 900;
        line-height: 1.2;
        margin: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Actions side */
      .topbar-actions {
        align-items: center;
        display: flex;
        gap: 6px;
        justify-content: flex-end;
      }

      /* User chip button */
      .user-chip-btn {
        align-items: center;
        background: #edf7f7;
        border: 1px solid #cfe5e6;
        border-radius: 50px;
        color: var(--brand);
        cursor: pointer;
        display: inline-flex;
        gap: 8px;
        max-width: 200px;
        min-height: 40px;
        padding: 4px 10px 4px 6px;
      }

      .user-chip-avatar {
        align-items: center;
        background: var(--brand);
        border-radius: 50%;
        color: white;
        display: inline-flex;
        flex: 0 0 auto;
        height: 28px;
        justify-content: center;
        width: 28px;
      }

      .user-chip-info {
        display: grid;
        min-width: 0;
      }

      .user-chip-name {
        color: var(--ink);
        font-size: 13px;
        font-weight: 900;
        line-height: 1.2;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .user-chip-role {
        color: var(--muted);
        font-size: 10px;
        font-weight: 700;
        line-height: 1.2;
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

      .user-menu-wrap {
        position: relative;
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
        min-height: 40px;
        padding: 6px 12px;
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

      .bottom-nav .nav-item {
        font-size: 10px;
        padding: 6px 2px;
        min-height: 48px;
      }

      .bottom-nav .nav-item span {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
        display: block;
      }

      
      .official-gov-footer {
        background: linear-gradient(135deg, #ffffff 0%, #f8fbfb 100%);
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
        display: grid;
        gap: 16px;
        margin-top: 24px;
        padding: 20px 24px;
      }

      .gov-footer-content {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        justify-content: space-between;
      }

      .gov-footer-brand {
        align-items: center;
        display: flex;
        flex: 1;
        gap: 14px;
        min-width: 280px;
      }

      .gov-footer-text {
        display: grid;
        gap: 4px;
      }

      .gov-footer-title {
        color: #0f172a;
        font-size: 14.5px;
        font-weight: 900;
      }

      .gov-footer-desc {
        color: #64748b;
        font-size: 12px;
        line-height: 1.6;
        margin: 0;
        max-width: 680px;
      }

      .gov-footer-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
      }

      .gov-badge-item {
        align-items: center;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 10px;
        display: flex;
        gap: 10px;
        padding: 8px 12px;
      }

      .gov-badge-icon {
        font-size: 20px;
      }

      .gov-badge-item strong {
        color: #0f172a;
        display: block;
        font-size: 12px;
        font-weight: bold;
      }

      .gov-badge-item small {
        color: #64748b;
        display: block;
        font-size: 10.5px;
      }

      .gov-footer-bottom-line {
        border-top: 1px solid #e2e8f0;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        justify-content: space-between;
        padding-top: 14px;
      }

      .gov-footer-credits {
        color: #475569;
        font-size: 12px;
        line-height: 1.6;
      }

      .gov-footer-credits strong {
        color: #006d77;
      }

      .gov-footer-copyright {
        color: #64748b;
        font-size: 11.5px;
      }

      .gov-footer-copyright code {
        background: #edf7f7;
        border-radius: 4px;
        color: #006d77;
        font-family: monospace;
        font-size: 11px;
        padding: 2px 6px;
      }


      .side-sheet {
        background: #ffffff;
        border-left: 1px solid #e2e8f0;
        bottom: 0;
        box-shadow: -8px 0 28px rgba(15, 23, 42, 0.12);
        display: flex;
        flex-direction: column;
        max-width: 340px;
        overflow-y: auto;
        padding: 0;
        position: fixed;
        right: 0;
        top: 0;
        transform: translateX(105%);
        transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
        width: 88vw;
        z-index: 1000;
        -webkit-overflow-scrolling: touch;
      }

      .side-sheet.open {
        transform: translateX(0);
      }

      .sheet-head {
        align-items: center;
        background: linear-gradient(135deg, #f8fbfb 0%, #f0f7f7 100%);
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        padding: 16px 18px;
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .drawer-close-btn {
        align-items: center;
        background: #ffffff;
        border: 1px solid #cbd5e1;
        border-radius: 50%;
        color: #475569;
        cursor: pointer;
        display: inline-flex;
        height: 34px;
        justify-content: center;
        transition: all 0.15s ease;
        width: 34px;
      }

      .drawer-close-btn:hover {
        background: #f1f5f9;
        color: #0f172a;
      }

      .sheet-nav-container {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 16px;
        padding: 16px 14px 24px;
      }

      .drawer-user-card {
        align-items: center;
        background: linear-gradient(135deg, #f0faf8 0%, #e6f6f4 100%);
        border: 1px solid #b2dfdb;
        border-radius: 12px;
        display: flex;
        gap: 12px;
        padding: 12px 14px;
      }

      .drawer-avatar {
        align-items: center;
        background: linear-gradient(135deg, #006d77 0%, #2a9d8f 100%);
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0, 109, 119, 0.25);
        color: #ffffff;
        display: flex;
        flex-shrink: 0;
        font-size: 16px;
        font-weight: bold;
        height: 42px;
        justify-content: center;
        width: 42px;
      }

      .drawer-user-text {
        display: grid;
        gap: 2px;
        min-width: 0;
      }

      .drawer-user-name {
        color: #0f172a;
        font-size: 13.5px;
        font-weight: 800;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .drawer-user-job {
        color: #006d77;
        font-size: 11.5px;
        font-weight: bold;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .drawer-user-dept {
        color: #64748b;
        font-size: 11px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .drawer-sections-wrapper {
        display: grid;
        gap: 18px;
      }

      .drawer-nav-section {
        display: grid;
        gap: 6px;
      }

      .drawer-section-header {
        align-items: center;
        display: flex;
        gap: 6px;
        padding: 0 8px 4px;
      }

      .section-icon-badge {
        font-size: 13px;
      }

      .section-title-text {
        color: #475569;
        font-size: 11.5px;
        font-weight: 900;
        letter-spacing: 0.2px;
        text-transform: uppercase;
      }

      .drawer-section-items {
        display: grid;
        gap: 5px;
      }

      .drawer-nav-item {
        align-items: center;
        background: #ffffff;
        border: 1px solid transparent;
        border-radius: 10px;
        color: #334155;
        cursor: pointer;
        display: flex;
        gap: 12px;
        min-height: 48px;
        padding: 8px 12px;
        text-decoration: none;
        transition: all 0.18s ease;
      }

      .drawer-nav-item:hover {
        background: #f8fafc;
        border-color: #e2e8f0;
        color: #0f172a;
      }

      .drawer-nav-item.active {
        background: #e6f6f4;
        border-color: #b2dfdb;
        border-right: 3.5px solid #006d77;
        box-shadow: 0 2px 8px rgba(0, 109, 119, 0.08);
        color: #006d77;
        font-weight: 900;
      }

      .drawer-nav-icon {
        align-items: center;
        background: #f1f5f9;
        border-radius: 8px;
        color: inherit;
        display: flex;
        flex-shrink: 0;
        height: 34px;
        justify-content: center;
        transition: all 0.18s ease;
        width: 34px;
      }

      .drawer-nav-item.active .drawer-nav-icon {
        background: #006d77;
        color: #ffffff;
      }

      .drawer-nav-label {
        flex: 1;
        font-size: 13px;
        line-height: 1.35;
      }

      .drawer-nav-chevron {
        color: #94a3b8;
        font-size: 18px;
        font-weight: bold;
        transition: transform 0.18s ease;
      }

      .drawer-nav-item.active .drawer-nav-chevron {
        color: #006d77;
        transform: translateX(-3px);
      }

      .drawer-footer-block {
        border-top: 1px solid #e2e8f0;
        display: grid;
        gap: 10px;
        margin-top: auto;
        padding-top: 16px;
      }

      .drawer-logout-button {
        align-items: center;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 10px;
        color: #dc2626;
        cursor: pointer;
        display: flex;
        font-family: inherit;
        font-size: 13px;
        font-weight: bold;
        gap: 8px;
        justify-content: center;
        min-height: 44px;
        padding: 8px 16px;
        transition: all 0.15s ease;
        width: 100%;
      }

      .drawer-logout-button:hover {
        background: #fee2e2;
        border-color: #fca5a5;
      }

      .drawer-security-note {
        color: #64748b;
        font-size: 10.5px;
        font-weight: bold;
        text-align: center;
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
          padding: 76px 22px calc(120px + env(safe-area-inset-bottom));
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
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
          display: flex;
          flex-direction: column;
          gap: 16px;
          grid-area: sidebar;
          height: calc(100dvh - 48px);
          max-height: calc(100dvh - 48px);
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 16px 14px;
          position: sticky;
          top: 24px;
          z-index: 20;
        }

        .topbar {
          background: rgba(248, 251, 251, 0.97);
          border-bottom: none;
          border-radius: 12px;
          border: 1px solid var(--line);
          box-shadow: 0 2px 12px rgba(16, 32, 39, 0.08);
          grid-area: topbar;
          grid-template-columns: minmax(0, 1fr) auto;
          height: auto;
          left: auto;
          min-height: 60px;
          padding: 10px 16px;
          position: sticky;
          right: auto;
          top: 24px;
          z-index: 25;
          width: 100%;
        }

        .topbar-menu-btn {
          display: none;
        }

        .topbar-page {
          font-size: 20px;
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
        .forced-password-overlay {
          align-items: stretch !important;
          padding: 0 !important;
        }

        .forced-password-modal {
          border: 0 !important;
          border-radius: 0 !important;
          max-height: 100dvh !important;
          max-width: none !important;
          min-height: 100dvh;
        }

        .forced-password-content {
          min-height: 100dvh;
        }

        .forced-password-header {
          align-content: start;
          padding: 22px 16px 18px !important;
        }

        .forced-password-header h2 {
          font-size: 17px !important;
        }

        .forced-password-header p {
          font-size: 12.5px !important;
        }

        .forced-password-content form {
          align-content: start;
          padding: 22px 16px 8px !important;
        }

        .forced-password-field input {
          min-height: 50px !important;
        }

        .forced-password-footer {
          padding: 14px 16px calc(14px + env(safe-area-inset-bottom)) !important;
        }

        .user-chip-btn {
          max-width: 44px;
          padding: 6px;
        }

        .user-chip-info {
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

export function SearchableAddableSelect({
  options,
  value,
  onChange,
  placeholder = 'اختر خياراً...',
  onAdd,
  style,
  disabled = false,
}: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  onAdd?: (newLabel: string) => void
  style?: React.CSSProperties
  disabled?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [hoveredValue, setHoveredValue] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('.custom-select-container')) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const selectedOption = useMemo(() => {
    return options.find(opt => opt.value === value)
  }, [options, value])

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return options
    return options.filter(opt => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q))
  }, [options, searchQuery])

  const showAddBtn = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q || !onAdd) return false
    return !options.some(opt => opt.label.toLowerCase().trim() === q)
  }, [options, searchQuery, onAdd])

  return (
    <div 
      className="custom-select-container"
      style={{
        position: 'relative',
        width: '100%',
        fontFamily: 'inherit',
        direction: 'rtl',
        ...style
      }}
    >
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        style={{
          minHeight: '38px',
          borderRadius: '8px',
          border: isOpen ? '1px solid #006d77' : '1px solid #cfdcde',
          background: disabled ? '#eceff1' : 'white',
          padding: '8px 12px',
          fontSize: '13px',
          color: selectedOption ? '#102027' : '#78909c',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: isOpen ? '0 0 0 3px rgba(0, 109, 119, 0.1)' : 'none',
          transition: 'all 0.2s',
          userSelect: 'none'
        }}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <span style={{ fontSize: '10px', color: '#546e7a', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          ▼
        </span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          right: 0,
          background: 'white',
          border: '1px solid #cfdcde',
          borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: '260px'
        }}>
          {/* Search Input */}
          <div style={{ padding: '8px', borderBottom: '1px solid #f1f7f7', background: '#fcfdfd', display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ color: '#78909c', fontSize: '12px' }}>🔍</span>
            <input 
              type="text"
              placeholder="ابحث هنا..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                border: 0,
                outline: 'none',
                background: 'transparent',
                fontSize: '12.5px',
                color: '#102027',
                padding: '4px 0'
              }}
            />
            {searchQuery && (
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); setSearchQuery(''); }}
                style={{ background: 'transparent', border: 0, color: '#90a4ae', cursor: 'pointer', fontSize: '12px' }}
              >✕</button>
            )}
          </div>

          {/* Options List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filteredOptions.map((opt) => {
              const isSelected = opt.value === value
              const isHovered = opt.value === hoveredValue
              return (
                <div
                  key={opt.value}
                  onMouseEnter={() => setHoveredValue(opt.value)}
                  onMouseLeave={() => setHoveredValue(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onChange(opt.value)
                    setIsOpen(false)
                    setSearchQuery('')
                  }}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12.5px',
                    color: isSelected ? 'white' : '#37474f',
                    background: isSelected ? '#006d77' : (isHovered ? '#f1f7f7' : 'transparent'),
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    textAlign: 'right'
                  }}
                >
                  {opt.label}
                </div>
              )
            })}

            {filteredOptions.length === 0 && !showAddBtn && (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: '#90a4ae' }}>
                لا توجد نتائج مطابقة
              </div>
            )}
          </div>

          {/* Add Option Trigger Button */}
          {showAddBtn && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (onAdd) {
                  onAdd(searchQuery.trim())
                }
                setSearchQuery('')
                setIsOpen(false)
              }}
              style={{
                background: '#fff8e1',
                border: 'none',
                borderTop: '1px solid #ffe082',
                color: '#b78103',
                padding: '10px 12px',
                fontSize: '12px',
                fontWeight: 'bold',
                width: '100%',
                cursor: 'pointer',
                textAlign: 'right',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                justifyContent: 'flex-start'
              }}
            >
              ➕ إضافة خيار جديد: "{searchQuery.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
