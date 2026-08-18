import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const filePath = path.resolve(__dirname, '../src/app/system-ui.tsx')
let content = fs.readFileSync(filePath, 'utf8')

// 1. Add OfficialGovernmentFooter component definition
const footerComponentCode = `
export function OfficialGovernmentFooter() {
  return (
    <footer className="official-gov-footer">
      <div className="gov-footer-content">
        <div className="gov-footer-brand">
          <MinistryLogo size="menu" />
          <div className="gov-footer-text">
            <strong className="gov-footer-title">جمهورية مصر العربية — وزارة الصحة والسكان</strong>
            <p className="gov-footer-desc">
              المنظومة الوطنية الموحدة لحوكمة ورقمنة المأموريات الميدانية والربط التكاملي بين قطاعات ديوان عام الوزارة ومديريات الشئون الصحية والإدارات والمستشفيات والوحدات.
            </p>
          </div>
        </div>

        <div className="gov-footer-badges">
          <div className="gov-badge-item">
            <span className="gov-badge-icon">🛡️</span>
            <div>
              <strong>الأمن والسرية</strong>
              <small>نظام مشفر ومؤمن سحابياً</small>
            </div>
          </div>
          <div className="gov-badge-item">
            <span className="gov-badge-icon">🇪🇬</span>
            <div>
              <strong>رؤية مصر 2030</strong>
              <small>التحول الرقمي للقطاع الصحي</small>
            </div>
          </div>
        </div>
      </div>

      <div className="gov-footer-bottom-line">
        <div className="gov-footer-credits">
          <span>إشراف وتطوير وتنفيذ: <strong>الإدارة المركزية لنظم المعلومات والتحول الرقمي</strong> بالتعاون مع <strong>قطاع الطب العلاجي</strong> و<strong>قطاع الرعاية الأساسية وتنمية الأسرة</strong></span>
        </div>
        <div className="gov-footer-copyright">
          <span>جميع الحقوق محفوظة © {new Date().getFullYear()} وزارة الصحة والسكان المصرية — إصدار الحوكمة الميدانية <code>v2.6.0</code></span>
        </div>
      </div>
    </footer>
  )
}
`

// Place footer component before SecurityFooter
if (!content.includes('function OfficialGovernmentFooter()')) {
  content = content.replace('function SecurityFooter()', `${footerComponentCode}\n\nfunction SecurityFooter()`)
  console.log('✓ Added OfficialGovernmentFooter component')
}

// 2. Add OfficialGovernmentFooter to DashboardShell content area
const oldContentArea = `<section className="content-shell">
        <div className="content">
        {children}
        </div>
      </section>`

const newContentArea = `<section className="content-shell">
        <div className="content">
          {children}
          <OfficialGovernmentFooter />
        </div>
      </section>`

if (content.includes(oldContentArea)) {
  content = content.replace(oldContentArea, newContentArea)
  console.log('✓ Injected OfficialGovernmentFooter into DashboardShell')
}

// 3. Update desktop-sidebar in DashboardShell to pass profile and onLogout
const oldDesktopSidebar = `<aside className="desktop-sidebar" aria-label="التنقل الرئيسي">
        <div className="desktop-brand">
          <MinistryLogo size="menu" />
          <div>
            <strong>نظام حوكمة المأمورية الميدانية</strong>
            <span>وزارة الصحة والسكان</span>
          </div>
        </div>
        <Navigation allowedKeysOverride={navigationOverride} role={currentRole} />
      </aside>`

const newDesktopSidebar = `<aside className="desktop-sidebar" aria-label="التنقل الرئيسي">
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
      </aside>`

if (content.includes(oldDesktopSidebar)) {
  content = content.replace(oldDesktopSidebar, newDesktopSidebar)
  console.log('✓ Updated desktop-sidebar in DashboardShell')
}

// 4. Update body scroll lock effect when menuOpen changes
const bodyLockEffect = `  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])`

if (!content.includes("document.body.style.overflow = 'hidden'")) {
  content = content.replace('function handleInitiateLogout() {', `${bodyLockEffect}\n\n  function handleInitiateLogout() {`)
  console.log('✓ Added body scroll lock on drawer open')
}

// 5. Update CSS styles for desktop-sidebar and official-gov-footer
const oldDesktopSidebarCss = `        .desktop-sidebar {
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
        }`

const newDesktopSidebarCss = `        .desktop-sidebar {
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
        }`

if (content.includes(oldDesktopSidebarCss)) {
  content = content.replace(oldDesktopSidebarCss, newDesktopSidebarCss)
  console.log('✓ Updated desktop-sidebar CSS')
}

// Add official-gov-footer styles into the main style section
const footerStyles = `
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
`

if (!content.includes('.official-gov-footer {')) {
  content = content.replace('.side-sheet {', `${footerStyles}\n\n      .side-sheet {`)
  console.log('✓ Injected footer CSS styles')
}

fs.writeFileSync(filePath, content, 'utf8')
console.log('Successfully patched sticky sidebar, scroll lock, and official government footer!')
