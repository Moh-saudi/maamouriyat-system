import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(__dirname, '../src/app/system-ui.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Update side-sheet header and Navigation call in DashboardShell
const oldSideSheet = `{menuOpen && (
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
      )}`

const newSideSheet = `{menuOpen && (
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
      )}`

if (content.includes(oldSideSheet)) {
  content = content.replace(oldSideSheet, newSideSheet)
  console.log('✓ Replaced side-sheet call in DashboardShell')
} else {
  console.warn('! oldSideSheet string not found directly, checking partial replace...')
}

// 2. Replace Navigation and NavItem implementation
const oldNavigationRegex = /function Navigation\(\{[\s\S]*?function NotificationsPanel/

const newNavigation = `function Navigation({
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
    name?: string
    jobTitle?: string
    department?: string
    email?: string
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
    return navigationDefinitions[key]?.label || key
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
          <span>🔒 منظومة مؤمنة ومشفرة — وزارة الصحة والسكان</span>
        </div>
      </div>
    </div>
  )
}

function NotificationsPanel`

content = content.replace(oldNavigationRegex, newNavigation)
console.log('✓ Replaced Navigation component')

// 3. Update NavItem to support isDrawer
const oldNavItem = `function NavItem({
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
    <Link className={\`nav-item \${active ? 'active' : ''}\`} href={href} onClick={handleClick}>
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  )
}`

const newNavItem = `function NavItem({
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
      <Link className={\`drawer-nav-item \${active ? 'active' : ''}\`} href={href} onClick={handleClick}>
        <div className="drawer-nav-icon">
          <Icon size={18} />
        </div>
        <span className="drawer-nav-label">{label}</span>
        <span className="drawer-nav-chevron">‹</span>
      </Link>
    )
  }

  return (
    <Link className={\`nav-item \${active ? 'active' : ''}\`} href={href} onClick={handleClick}>
      <Icon size={19} />
      <span>{label}</span>
    </Link>
  )
}`

if (content.includes(oldNavItem)) {
  content = content.replace(oldNavItem, newNavItem)
  console.log('✓ Replaced NavItem component')
}

// 4. Update CSS styles for side-sheet and drawer
const oldSideSheetCss = `      .side-sheet {
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
      }`

const newSideSheetCss = `      .side-sheet {
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
      }`

if (content.includes(oldSideSheetCss)) {
  content = content.replace(oldSideSheetCss, newSideSheetCss)
  console.log('✓ Replaced side-sheet CSS')
} else {
  console.warn('! oldSideSheetCss not found directly')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully patched system-ui.tsx with government-grade sidebar and mobile drawer!')
