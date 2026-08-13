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
  const [setupMessage, setSetupMessage] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [selectedDemo, setSelectedDemo] = useState<string | null>(null)

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
          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة، أو الحساب غير مسجل في Supabase Auth.')
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
      setError('تعذر الاتصال بسيرفر Supabase. يُرجى التحقق من اتصال الإنترنت أو تحديث بيانات الاتصال (NEXT_PUBLIC_SUPABASE_URL) في ملف البيئة .env.local')
    }
  }

  async function handleSetupDemoUsers() {
    setSetupLoading(true)
    setSetupMessage('')
    setError('')
    try {
      const res = await fetch('/api/setup-demo-users', { method: 'POST' })
      const data = await res.json()
      setSetupLoading(false)
      if (data.success) {
        setSetupMessage('تم تفعيل وتجهيز الحسابات التجريبية بنجاح! (كلمة المرور الإفتراضية: 123456)')
        setEmail('admin@admin.com')
        setPassword('123456')
        setSelectedDemo('admin@admin.com')
      } else {
        setError(data.error || 'فشل تهيئة الحسابات')
      }
    } catch (err: any) {
      setSetupLoading(false)
      setError('تعذر الاتصال بمسار تهيئة الحسابات')
    }
  }

  function fillDemoAccount(demoEmail: string, demoRoleName: string) {
    setEmail(demoEmail)
    setPassword('123456')
    setSelectedDemo(demoEmail)
    setError('')
    setSetupMessage(`تم اختيار حساب (${demoRoleName}) بنجاح! يمكنك الدخول الآن ✨`)
  }

  const demoAccounts = [
    { label: '👑 مدير النظام', email: 'admin@admin.com', name: 'أحمد محمود العشري' },
    { label: '🩺 مفتش صحي', email: 'inspector@inspector.com', name: 'سارة خالد البشري' },
    { label: '📋 مشرف ميداني', email: 'supervisor@supervisor.com', name: 'محمد علي سليم' },
    { label: '🏢 مدير تفتيش', email: 'director@director.com', name: 'مدير إدارة التفتيش' },
  ]

  return (
    <main className="login-screen-popup-wrapper">
      <Style />
      {/* Background Mesh Overlay */}
      <div className="login-bg-overlay" />

      {/* Floating Glassmorphism Modal Popup */}
      <div className="login-modal-card">
        {/* Right Section: Healthcare Hero Image & Inspiration */}
        <section className="login-hero-panel">
          <div className="hero-image-overlay" />
          <div className="hero-content">
            <div className="hero-badge">
              <MinistryLogo size="panel" />
              <span>جمهورية مصر العربية - وزارة الصحة والسكان</span>
            </div>

            <div className="quran-quote-box">
              <span className="quran-icon">🌿</span>
              <blockquote className="quran-quote">
                « وَقُلِ اعْمَلُوا فَسَيَرَى اللَّهُ عَمَلَكُمْ وَرَسُولُهُ وَالْمُؤْمِنُونَ »
              </blockquote>
            </div>

            <div className="hero-main-title">
              <h1>نظام حوكمة المأموريات الميدانية 🩺</h1>
              <p className="hero-subtext">
                أهلاً بك 👋 نتمنى لك يوماً موفقاً ومجهوداً كبيراً مقدراً في خدمة الوطن والرعاية الصحية 💙✨
              </p>
            </div>

            <div className="hero-features-list">
              <div className="feature-pill"><span>⚡</span> متابعة وحوكمة دقيقة</div>
              <div className="feature-pill"><span>🏥</span> ربط مباشر بالمنشآت</div>
              <div className="feature-pill"><span>🛡️</span> أعلى معايير الجودة</div>
            </div>
          </div>
        </section>

        {/* Left Section: Interactive Login Form & Demo Hints */}
        <form className="login-form-panel" onSubmit={handleLogin}>
          <div className="form-header">
            <div className="header-logo-row">
              <MinistryLogo size="panel" />
              <div>
                <h2>تسجيل الدخول</h2>
                <p className="subhead">البوابة الرقمية المركزية لقطاع الطب العلاجي</p>
              </div>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}
          {setupMessage && <div className="alert alert-success">{setupMessage}</div>}

          {/* Interactive Hints & Quick Demo Accounts */}
          <div className="demo-hints-container">
            <div className="hints-header">
              <span>💡 تلميحات الحسابات التجريبية (اضغط للتعبئة):</span>
            </div>
            <div className="demo-chips-grid">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemoAccount(acc.email, acc.label)}
                  className={`demo-chip ${selectedDemo === acc.email ? 'active' : ''}`}
                  title={`${acc.name} (${acc.email})`}
                >
                  <span className="chip-label">{acc.label}</span>
                </button>
              ))}
            </div>
          </div>

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
                placeholder="أدخل البريد الإلكتروني..."
                required
                type="email"
                value={email}
              />
            </div>
          </div>

          {/* Password Field with Clean Dots Fix */}
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
                <span className="spinner" /> جاري تسجيل الدخول...
              </span>
            ) : (
              'تسجيل الدخول إلى النظام 🚀'
            )}
          </button>

          <div className="setup-trigger-box">
            <button
              type="button"
              onClick={handleSetupDemoUsers}
              disabled={setupLoading}
              className="setup-link-btn"
            >
              {setupLoading ? '⚡ جاري تفعيل وتأكيد حسابات التجربة...' : '🔄 إعادة تهيئة وتفعيل حسابات التجربة (Supabase Auth)'}
            </button>
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
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            setUserEmail(user.email ?? user.id)
            if (user.user_metadata?.must_change_password !== false) {
              setMustChangePassword(true)
            }
            const { data: profileData } = await supabase
              .from('users')
              .select('id, level, full_name, job_title, department')
              .eq('auth_id', user.id)
              .maybeSingle()
            if (profileData) {
              setProfileName(profileData.full_name)
              setProfileJobTitle(profileData.job_title)
              setProfileDepartment(profileData.department)

              const level = profileData.level ?? 7
              const role = level === 0 ? 'techadmin' : level === 1 ? 'superadmin' : level === 2 ? 'central' : level === 3 ? 'generalmanager' : level === 4 ? 'creator' : level === 5 ? 'financial' : 'inspector'
              document.cookie = `maamouriyat_user_role=${role}; path=/; max-age=86400; SameSite=Lax`
              setCurrentRole(role)

              const { data: userPermission } = await supabase
                .from('user_permissions')
                .select('allowed_pages')
                .eq('user_id', profileData.id)
                .maybeSingle()

              const normalizedOverride = normalizeNavigationKeys(userPermission?.allowed_pages)
              setNavigationOverride(normalizedOverride.length > 0 ? normalizedOverride : null)
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
            <strong>نظام حوكمة المأمورية الميدانية</strong>
            <span>وزارة الصحة والسكان</span>
          </div>
        </div>
        <Navigation allowedKeysOverride={navigationOverride} role={currentRole} />
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
                      {profileDepartment || 'الإدارة المركزية للطب العلاجي'}
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
                    onClick={handleLogout} 
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
          <button className="logout-button" onClick={handleLogout} title="تسجيل الخروج" type="button">
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
              <strong>نظام حوكمة المأمورية الميدانية</strong>
            </div>
            <button aria-label="إغلاق القائمة" className="icon-button" onClick={() => setMenuOpen(false)}>
              <X size={20} />
            </button>
          </div>
          <Navigation allowedKeysOverride={navigationOverride} onNavigate={() => setMenuOpen(false)} role={currentRole} />
        </aside>
      )}

      {menuOpen && <button aria-label="إغلاق القائمة" className="scrim" onClick={() => setMenuOpen(false)} />}

      <section className="content-shell">
        <div className="content">
        {children}
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
                  onClick={handleLogout}
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
}: {
  allowedKeysOverride?: readonly NavigationKey[] | null
  onNavigate?: () => void
  role: UserRole | null
}) {
  const roleInfo = getRoleDefinition(role)
  const allowedKeys = allowedKeysOverride ?? getRoleNavigation(role ?? 'inspector')
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
        const { data: { user } } = await supabase.auth.getUser()
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

        if (profile) {
          setProfileName(profile.full_name || user.email || 'قائم بالمرور')
          setProfileJob(profile.job_title || 'مفتش صحي')

          // 2. Get real stats for this user
          // Completed missions (completed / approved / done)
          const { count: completedCount } = await supabase
            .from('missions')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_user_id', profile.id)
            .in('status', ['completed', 'approved', 'done'])

          // In progress (assigned / in_progress / executing / under_review)
          const { count: inProgressCount } = await supabase
            .from('missions')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_user_id', profile.id)
            .in('status', ['assigned', 'in_progress', 'executing', 'under_review'])

          // Late missions (scheduled_date < today and status not in completed/approved/done)
          const todayStr = new Date().toISOString().split('T')[0]
          const { data: maybeLateMissions } = await supabase
            .from('missions')
            .select('id, status, scheduled_date')
            .eq('assigned_user_id', profile.id)
            .lt('scheduled_date', todayStr)

          const lateCount = maybeLateMissions
            ? maybeLateMissions.filter(m => !['completed', 'approved', 'done'].includes(m.status)).length
            : 0

          // Facilities count (total active facilities in system)
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

          // 3. Get latest 5 assigned missions
          const { data: latestMissions } = await supabase
            .from('missions')
            .select(`
              id,
              serial_number,
              status,
              scheduled_date,
              violation_count,
              facilities:target_facility_id(name),
              users:assigned_user_id(full_name)
            `)
            .eq('assigned_user_id', profile.id)
            .order('scheduled_date', { ascending: false })
            .limit(5)

          if (latestMissions) {
            setMissionsList(latestMissions.map((m: any) => {
              const facilityObj = Array.isArray(m.facilities) ? m.facilities[0] : m.facilities
              const userObj = Array.isArray(m.users) ? m.users[0] : m.users
              
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
                id: m.serial_number,
                facility: facilityObj?.name || 'منشأة غير محددة',
                inspector: userObj?.full_name || profile.full_name || 'مفتش',
                date: m.scheduled_date ? formatDateArabic(m.scheduled_date) : '',
                status: statusText,
                tone: statusTone,
                violations: m.violation_count || 0
              }
            }))
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

      /* Floating Modal Card */
      .login-modal-card {
        position: relative;
        z-index: 10;
        width: 100%;
        max-width: 1050px;
        display: grid;
        grid-template-columns: 1.15fr 1fr;
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.8);
        border-radius: 24px;
        box-shadow: 0 25px 60px -15px rgba(0, 109, 119, 0.22), 0 0 1px 1px rgba(255, 255, 255, 0.9) inset;
        overflow: hidden;
        animation: modalAppear 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes modalAppear {
        from {
          opacity: 0;
          transform: translateY(24px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      /* Hero Panel (Right side in RTL) */
      .login-hero-panel {
        position: relative;
        background-image: url('/healthcare-hero.jpg');
        background-size: cover;
        background-position: center;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 40px 32px;
        color: white;
        overflow: hidden;
      }

      .hero-image-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(160deg, rgba(0, 75, 82, 0.88) 0%, rgba(0, 109, 119, 0.82) 45%, rgba(13, 148, 136, 0.85) 100%);
        backdrop-filter: blur(2px);
      }

      .hero-content {
        position: relative;
        z-index: 2;
        display: flex;
        flex-direction: column;
        gap: 24px;
        height: 100%;
        justify-content: space-between;
      }

      .hero-badge {
        display: flex;
        align-items: center;
        gap: 12px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.25);
        padding: 8px 16px;
        border-radius: 100px;
        width: fit-content;
        font-size: 0.85rem;
        font-weight: 500;
        color: #f0fdf4;
      }

      .quran-quote-box {
        background: rgba(255, 255, 255, 0.12);
        border-right: 4px solid #34d399;
        border-radius: 12px;
        padding: 16px 20px;
        backdrop-filter: blur(8px);
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .quran-icon {
        font-size: 1.4rem;
      }

      .quran-quote {
        margin: 0;
        font-size: 1.05rem;
        line-height: 1.6;
        font-weight: 600;
        color: #ecfdf5;
        font-family: Cairo, Tajawal, sans-serif;
      }

      .hero-main-title h1 {
        font-size: 1.75rem;
        margin: 0 0 10px 0;
        font-weight: 800;
        color: #ffffff;
        line-height: 1.3;
      }

      .hero-subtext {
        font-size: 0.95rem;
        line-height: 1.7;
        color: #e0f2fe;
        margin: 0;
      }

      .hero-features-list {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
      }

      .feature-pill {
        background: rgba(255, 255, 255, 0.18);
        border: 1px solid rgba(255, 255, 255, 0.25);
        padding: 6px 14px;
        border-radius: 100px;
        font-size: 0.8rem;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Form Panel (Left side in RTL) */
      .login-form-panel {
        padding: 40px 36px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 20px;
        background: #ffffff;
      }

      .header-logo-row {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .header-logo-row h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 800;
        color: #0f172a;
      }

      .header-logo-row .subhead {
        margin: 4px 0 0 0;
        font-size: 0.85rem;
        color: #64748b;
      }

      /* Alerts */
      .alert {
        padding: 12px 16px;
        border-radius: 12px;
        font-size: 0.875rem;
        font-weight: 500;
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

      /* Demo Chips Hints */
      .demo-hints-container {
        background: #f8fafc;
        border: 1px dashed #cbd5e1;
        border-radius: 14px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .hints-header {
        font-size: 0.8rem;
        font-weight: 700;
        color: #475569;
      }

      .demo-chips-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
      }

      .demo-chip {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        padding: 8px 12px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
      }

      .demo-chip:hover {
        background: #f1f5f9;
        border-color: #006d77;
        transform: translateY(-1px);
      }

      .demo-chip.active {
        background: #e0f2fe;
        border-color: #0284c7;
        color: #0369a1;
        font-weight: bold;
        box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
      }

      .chip-label {
        font-size: 0.8rem;
        font-weight: 600;
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

      .setup-trigger-box {
        text-align: center;
        margin-top: 4px;
      }

      .setup-link-btn {
        background: none;
        border: none;
        color: #0284c7;
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: color 0.15s;
        text-decoration: underline;
      }

      .setup-link-btn:hover {
        color: #0369a1;
      }

      /* Responsive Media Query */
      @media (max-width: 900px) {
        .login-modal-card {
          grid-template-columns: 1fr;
        }

        .login-hero-panel {
          min-height: 280px;
          padding: 28px 20px;
        }

        .login-form-panel {
          padding: 28px 20px;
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
