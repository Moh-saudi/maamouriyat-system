'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Mail, Phone, Hash, Search, Shield, Activity, MapPin, BadgeCheck, Filter, Trash2, LayoutGrid, List, Copy, Check, FileSpreadsheet, Edit2 } from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { normalizeDemoRole } from '@/lib/roles'

type UserRow = {
  id: string
  full_name: string
  job_title: string | null
  level: number
  department: string | null
  is_active: boolean | null
  email?: string | null
  phone?: string | null
  facility_id?: string | null
  financial_code?: string | null
}

type FacilityOption = {
  id: string
  name: string
  address?: string
}

function levelLabel(level: number) {
  if (level === 1) return 'سوبر أدمن المنظومة'
  if (level === 2) return 'رئيس إدارة مركزية'
  if (level === 3) return 'مدير عام إدارة عامة'
  if (level === 4) return 'موظف مختص بالتشغيل'
  if (level === 5) return 'مستخدم مالي ومراجع'
  return 'مفتش قائم بالمرور'
}

function levelToneColors(level: number) {
  // Returns highly curated custom colors for badges (text, background, border)
  if (level === 1) return { text: '#d32f2f', bg: '#ffebee', border: '#ffcdd2' } // Super Admin
  if (level === 2) return { text: '#e65100', bg: '#fff3e0', border: '#ffe0b2' } // Central President
  if (level === 3) return { text: '#4a148c', bg: '#f3e5f5', border: '#e1bee7' } // General Manager
  if (level === 4) return { text: '#0d47a1', bg: '#e3f2fd', border: '#bbdefb' } // Specialist
  if (level === 5) return { text: '#004d40', bg: '#e0f2f1', border: '#b2dfdb' } // Financial
  return { text: '#1b5e20', bg: '#e8f5e9', border: '#c8e6c9' } // Inspector
}

function UserAvatar({ name, level }: { name: string; level: number }) {
  // Consistent gradient based on character codes
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  
  const gradients = [
    'linear-gradient(135deg, #ff6b6b 0%, #ff8e53 100%)', // Coral Gold
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', // Cyan Dream
    'linear-gradient(135deg, #b180ff 0%, #8240ff 100%)', // Violet Magic
    'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', // Emerald Breeze
    'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)', // Rose Flame
    'linear-gradient(135deg, #fc00ff 0%, #00dbde 100%)', // Purple Neon
    'linear-gradient(135deg, #1fa2ff 0%, #12d8fa 100%, #29ffc6 100%)', // Mint Sea
    'linear-gradient(135deg, #f7971e 0%, #ffd200 100%)', // Sunset Gold
  ]
  
  const gradient = gradients[hash % gradients.length]
  
  let roleBadge = '👤'
  if (level === 1) roleBadge = '👑'
  if (level === 2) roleBadge = '🏛️'
  if (level === 3) roleBadge = '💼'
  if (level === 4) roleBadge = '⚙️'
  if (level === 5) roleBadge = '🪙'
  if (level === 7) roleBadge = '🔍'

  // Render a customized premium SVG vector based on the staff role/level
  const renderSvgAvatar = () => {
    if (level <= 3) {
      // Executive Avatar (Super Admin, Central President, General Manager) - Suit & Tie
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" style={{ width: '85%', height: '85%', color: 'rgba(255,255,255,0.95)' }}>
          <circle cx="32" cy="22" r="10" />
          <path d="M14 50 C14 40, 22 36, 32 36 C42 36, 50 40, 50 50 C50 54, 42 54, 32 54 C22 54, 14 54, 14 50 Z" />
          <path d="M26 38 L32 45 L38 38 Z" fill="#ffffff" opacity="0.3" />
          <path d="M30 42 L34 42 L33 52 L31 52 Z" fill="#ffffff" opacity="0.4" />
        </svg>
      )
    } else if (level === 7) {
      // Field Inspector - Medical/Clinical Outfit (Lab Coat / Stethoscope Silhouette)
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" style={{ width: '85%', height: '85%', color: 'rgba(255,255,255,0.95)' }}>
          <circle cx="32" cy="22" r="10" />
          <path d="M14 50 C14 40, 22 36, 32 36 C42 36, 50 40, 50 50 C50 54, 42 54, 32 54 C22 54, 14 54, 14 50 Z" />
          <path d="M22 38 A10 10 0 0 0 42 38" fill="none" stroke="#ffffff" strokeWidth="2.5" opacity="0.6" strokeLinecap="round" />
          <circle cx="42" cy="36" r="2" fill="#ffffff" opacity="0.8" />
          <circle cx="22" cy="36" r="2" fill="#ffffff" opacity="0.8" />
        </svg>
      )
    } else if (level === 5) {
      // Financial Auditor - Glasses and clean ledger silhouette
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" style={{ width: '85%', height: '85%', color: 'rgba(255,255,255,0.95)' }}>
          <circle cx="32" cy="22" r="10" />
          <path d="M14 50 C14 40, 22 36, 32 36 C42 36, 50 40, 50 50 C50 54, 42 54, 32 54 C22 54, 14 54, 14 50 Z" />
          <rect x="24" y="19" width="7" height="5" rx="1.5" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity="0.8" />
          <rect x="33" y="19" width="7" height="5" rx="1.5" fill="none" stroke="#ffffff" strokeWidth="1.8" opacity="0.8" />
          <line x1="31" y1="21.5" x2="33" y2="21.5" stroke="#ffffff" strokeWidth="1.8" opacity="0.8" />
        </svg>
      )
    } else {
      // Support Coordinator (Level 4 / Others) - Headset / Communication lines
      return (
        <svg viewBox="0 0 64 64" fill="currentColor" style={{ width: '85%', height: '85%', color: 'rgba(255,255,255,0.95)' }}>
          <circle cx="32" cy="22" r="10" />
          <path d="M14 50 C14 40, 22 36, 32 36 C42 36, 50 40, 50 50 C50 54, 42 54, 32 54 C22 54, 14 54, 14 50 Z" />
          <path d="M20 22 A12 12 0 0 1 44 22" fill="none" stroke="#ffffff" strokeWidth="2.2" opacity="0.75" />
          <rect x="18" y="20" width="3" height="5" rx="1" fill="#ffffff" opacity="0.9" />
          <rect x="43" y="20" width="3" height="5" rx="1" fill="#ffffff" opacity="0.9" />
        </svg>
      )
    }
  }

  return (
    <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
      <div style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 3px 8px rgba(0, 0, 0, 0.08)',
        border: '2px solid white',
        overflow: 'hidden'
      }}>
        {renderSvgAvatar()}
      </div>
      <span style={{
        position: 'absolute',
        bottom: '-2px',
        left: '-2px',
        background: 'white',
        width: '18px',
        height: '18px',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '9.5px',
        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
        border: '1px solid #eef2f3'
      }} title={levelLabel(level)}>
        {roleBadge}
      </span>
      <span style={{
        position: 'absolute',
        top: '0px',
        right: '0px',
        width: '9px',
        height: '9px',
        borderRadius: '50%',
        background: '#2ecc71',
        border: '2px solid white',
        boxShadow: '0 0 0 1.5px rgba(46, 204, 113, 0.2)'
      }} />
    </div>
  )
}

export function UserPortal({
  initialUsers,
  demoMode = false,
  facilities = [],
  currentUserLevel = 7,
}: {
  initialUsers: UserRow[]
  demoMode?: boolean
  facilities?: FacilityOption[]
  currentUserLevel?: number
}) {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const [users, setUsers] = useState<UserRow[]>(initialUsers)
  const [showAddForm, setShowAddForm] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [selectedDetailUser, setSelectedDetailUser] = useState<UserRow | null>(null)

  const handleImpersonateUser = (userEmail: string) => {
    if (!userEmail) return;
    const resolvedRole = normalizeDemoRole(userEmail) || 'inspector'
    document.cookie = `maamouriyat_demo_session=${resolvedRole}; path=/; max-age=86400; SameSite=Lax`
    document.cookie = `maamouriyat_user_role=${resolvedRole}; path=/; max-age=86400; SameSite=Lax`
    window.location.href = '/dashboard'
  }

  const handleExportToExcel = () => {
    // CSV columns headers
    const headers = [
      'الاسم الكامل',
      'المسمى الوظيفي',
      'مستوى الصلاحية',
      'المنشأة/الإدارة التابع لها',
      'البريد الإلكتروني',
      'رقم الهاتف',
      'الكود المالي',
      'حالة الحساب'
    ]

    // Map each filtered user to a row
    const rows = filteredUsers.map(u => [
      u.full_name,
      u.job_title || 'مفتش تفتيش ميداني',
      levelLabel(u.level),
      u.department || 'ديوان عام الوزارة',
      u.email || '',
      u.phone || '',
      u.financial_code || '',
      u.is_active !== false ? 'نشط وموثق' : 'معلق'
    ])

    // Convert rows to CSV, using double quotes to handle values that might contain commas
    const csvRows = [
      headers.join(','),
      ...rows.map(row => 
        row.map(val => {
          const escaped = String(val ?? '').replace(/"/g, '""')
          return `"${escaped}"`
        }).join(',')
      )
    ]

    // Add UTF-8 BOM prefix \ufeff so MS Excel recognizes the Arabic characters
    const csvContent = '\ufeff' + csvRows.join('\n')

    // Create a blob and download it
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().split('T')[0]
    
    link.setAttribute('href', url)
    link.setAttribute('download', `دليل_موظفي_المنظومة_${dateStr}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const [editingUser, setEditingUser] = useState<UserRow | null>(null)
  
  // Edit Form States
  const [editFullName, setEditFullName] = useState('')
  const [editJobTitle, setEditJobTitle] = useState('')
  const [editLevel, setEditLevel] = useState(7)
  const [editDepartment, setEditDepartment] = useState('')
  const [editFacilityId, setEditFacilityId] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editFinancialCode, setEditFinancialCode] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  const startEditingUser = (u: UserRow) => {
    setEditingUser(u)
    setEditFullName(u.full_name)
    setEditJobTitle(u.job_title || '')
    setEditLevel(u.level)
    setEditDepartment(u.department || '')
    setEditFacilityId(u.facility_id || '')
    setEditEmail(u.email || '')
    setEditPhone(u.phone || '')
    setEditFinancialCode(u.financial_code || '')
    setEditIsActive(u.is_active !== false)
  }

  async function handleUpdateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingUser) return
    setError('')
    setSuccess('')

    const name = editFullName.trim()
    const job = editJobTitle.trim()
    const userEmail = editEmail.trim().toLowerCase()
    const userPhone = editPhone.trim()
    const finCode = editFinancialCode.trim()

    if (!name) {
      setError('يرجى إدخال الاسم الكامل للموظف.')
      return
    }

    if (!userEmail) {
      setError('يرجى إدخال بريد إلكتروني صالح.')
      return
    }

    setLoading(true)

    const selectedFac = facilities.find(f => f.id === editFacilityId)
    const finalDepartment = selectedFac ? selectedFac.name : editDepartment || 'ديوان عام الوزارة'

    if (demoMode) {
      const updatedUser: UserRow = {
        ...editingUser,
        full_name: name,
        job_title: job || 'مفتش ميداني',
        level: editLevel,
        department: finalDepartment,
        is_active: editIsActive,
        email: userEmail,
        phone: userPhone || null,
        facility_id: editFacilityId || null,
        financial_code: finCode || null,
      }

      const cookieName = 'maamouriyat_demo_users'
      const updatedList = users.map(u => u.id === editingUser.id ? updatedUser : u)
      document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(updatedList))}; path=/; max-age=604800; SameSite=Lax`

      setUsers(updatedList)
      setSuccess('تم تحديث بيانات وصلاحيات الموظف بنجاح في وضع المحاكاة.')
      resetEditForm()
      return
    }

    if (!supabase) {
      setError('إعداد قاعدة بيانات Supabase غير متوفر حالياً.')
      setLoading(false)
      return
    }

    try {
      const payload = {
        full_name: name,
        job_title: job || null,
        level: editLevel,
        department: finalDepartment,
        facility_id: editFacilityId || null,
        email: userEmail,
        phone: userPhone || null,
        financial_code: finCode || null,
        is_active: editIsActive,
      }

      const { data, error: updateError } = await supabase
        .from('users')
        .update(payload)
        .eq('id', editingUser.id)
        .select('id, full_name, job_title, level, department, is_active, email, phone, facility_id, financial_code')
        .single()

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      if (data) {
        setUsers((current) => current.map(u => u.id === editingUser.id ? (data as UserRow) : u))
        setSuccess('تم تحديث صلاحيات وبيانات الموظف على قاعدة البيانات الحية بنجاح.')
        resetEditForm()
      }
    } catch (err: any) {
      setError(err.message || 'خطأ أثناء الاتصال بالخادم الرئيسي.')
    } finally {
      setLoading(false)
    }
  }

  function resetEditForm() {
    setEditingUser(null)
    setEditFullName('')
    setEditJobTitle('')
    setEditLevel(7)
    setEditDepartment('')
    setEditFacilityId('')
    setEditEmail('')
    setEditPhone('')
    setEditFinancialCode('')
    setEditIsActive(true)
    setLoading(false)
    router.refresh()
  }
  
  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState<'all' | 'admins' | 'inspectors' | 'staff'>('all')

  // Form States
  const [fullName, setFullName] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [level, setLevel] = useState(7)
  const [department, setDepartment] = useState('')
  const [facilityId, setFacilityId] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [financialCode, setFinancialCode] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const activeCount = useMemo(() => users.filter((u) => u.is_active !== false).length, [users])

  // Filtered & Searched staff members list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // 0. Hierarchy: hide higher rank users (u.level < currentUserLevel)
      if (u.level < currentUserLevel) return false;

      // 1. Search Query filter
      const matchesSearch = 
        u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.financial_code || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.job_title || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // 2. Tab filter
      if (filterTab === 'admins') return u.level <= 3; // Superadmin, Central, GM
      if (filterTab === 'inspectors') return u.level === 7; // Inspectors
      if (filterTab === 'staff') return u.level === 4 || u.level === 5; // Support Staff
      return true; // 'all'
    }).sort((a, b) => a.level - b.level || a.full_name.localeCompare(b.full_name, 'ar'))
  }, [users, searchQuery, filterTab, currentUserLevel])

  async function handleAddUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const name = fullName.trim()
    const job = jobTitle.trim()
    const userEmail = email.trim().toLowerCase()
    const userPhone = phone.trim()
    const finCode = financialCode.trim()

    if (!name) {
      setError('يرجى إدخال الاسم الكامل للموظف.')
      return
    }

    if (!userEmail) {
      setError('يرجى إدخال بريد إلكتروني صالح ومكتمل للربط الوظيفي.')
      return
    }

    setLoading(true)

    // Resolve facility dropdown
    const selectedFac = facilities.find(f => f.id === facilityId)
    const finalDepartment = selectedFac ? selectedFac.name : department || 'ديوان عام الوزارة'

    if (demoMode) {
      const newUser: UserRow = {
        id: `demo-user-${Date.now()}`,
        full_name: name,
        job_title: job || 'مفتش ميداني',
        level,
        department: finalDepartment,
        is_active: true,
        email: userEmail,
        phone: userPhone || null,
        facility_id: facilityId || null,
        financial_code: finCode || null,
      }

      // Save to cookie
      const cookieName = 'maamouriyat_demo_users'
      const existingCookie = document.cookie
        .split('; ')
        .find((item) => item.startsWith(`${cookieName}=`))
        ?.split('=')[1]
      let existing: UserRow[] = []
      try {
        existing = existingCookie ? JSON.parse(decodeURIComponent(existingCookie)) : []
      } catch {}

      const next = [newUser, ...existing]
      document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=604800; SameSite=Lax`

      setUsers((current) => [newUser, ...current])
      setSuccess('تم تسجيل الموظف الجديد وحفظه بنجاح بالدورة التدريبية.')
      resetForm()
      return
    }

    if (!supabase) {
      setError('إعداد قاعدة بيانات Supabase غير متوفر حالياً.')
      setLoading(false)
      return
    }

    try {
      const payload = {
        full_name: name,
        job_title: job || null,
        level,
        department: finalDepartment,
        facility_id: facilityId || null,
        email: userEmail,
        phone: userPhone || null,
        financial_code: finCode || null,
        is_active: true,
      }

      const { data, error: insertError } = await supabase
        .from('users')
        .insert(payload)
        .select('id, full_name, job_title, level, department, is_active, email, phone, facility_id, financial_code')
        .single()

      if (insertError) {
        setError(insertError.message)
        setLoading(false)
        return
      }

      if (data) {
        setUsers((current) => [data as UserRow, ...current])
        setSuccess('تم ترحيل الموظف الجديد وتسكينه على قاعدة البيانات الحية بنجاح.')
        resetForm()
      }
    } catch (err: any) {
      setError(err.message || 'خطأ أثناء الاتصال بالخادم الرئيسي.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteUser(userId: string) {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا الموظف نهائياً من قاعدة البيانات والمنظومة؟')) {
      setLoading(true)
      setError('')
      setSuccess('')

      if (demoMode) {
        const cookieName = 'maamouriyat_demo_users'
        const next = users.filter(u => u.id !== userId)
        document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=604800; SameSite=Lax`
        setUsers(next)
        setSuccess('تم حذف الموظف بنجاح من قائمة المحاكاة.')
        setLoading(false)
        return
      }

      if (supabase) {
        try {
          const { error: deleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', userId)

          if (deleteError) {
            setError(deleteError.message)
            setLoading(false)
            return
          }

          setUsers(current => current.filter(u => u.id !== userId))
          setSuccess('تم حذف الموظف نهائياً من قاعدة البيانات الحية بنجاح.')
        } catch (err: any) {
          setError(err.message || 'خطأ أثناء حذف الموظف.')
        } finally {
          setLoading(false)
        }
      }
    }
  }

  function resetForm() {
    setFullName('')
    setJobTitle('')
    setLevel(7)
    setDepartment('')
    setFacilityId('')
    setEmail('')
    setPhone('')
    setFinancialCode('')
    setShowAddForm(false)
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="stack" style={{ direction: 'rtl', padding: '16px', display: 'grid', gap: '20px' }}>
      
      {/* Compact Header Section */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        padding: '4px 0 10px 0',
        borderBottom: '1px solid var(--line)',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#102027' }}>
              دليل الموظفين والكوادر الرقابية
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: 'var(--brand)',
              background: '#eef6f6',
              padding: '2px 8px',
              borderRadius: '20px',
              border: '1px solid #cfdcde'
            }}>
              {users.length} موظف مسجل
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#546e7a' }}>
            تسجيل وتسكين أعضاء التفتيش الميداني، مراجعي الحسابات المالية، ورؤساء الإدارات.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(true)}
          style={{
            background: 'var(--brand)',
            color: 'white',
            border: 0,
            borderRadius: '6px',
            minHeight: '36px',
            padding: '0 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '12.5px',
            boxShadow: '0 2px 6px rgba(16, 122, 102, 0.12)',
            transition: 'background 0.2s',
          }}
          type="button"
        >
          <Plus size={16} />
          إضافة مستخدم جديد
        </button>
      </section>

      {/* Live State messages */}
      {error && <div className="alert error-box" style={{ background: '#fff1f1', color: '#a02f2f', padding: '16px', borderRadius: '12px', border: '1px solid #f5c2c2', fontWeight: 'bold' }}>{error}</div>}
      {success && <div className="alert success-box" style={{ background: '#eaf8f3', color: '#16725a', padding: '16px', borderRadius: '12px', border: '1px solid #c7ebd8', fontWeight: 'bold' }}>{success}</div>}

      {/* Filter and Search Bar Container */}
      <section style={{
        background: 'white',
        border: '1px solid var(--line)',
        padding: '16px',
        borderRadius: '16px',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#78909c' }} />
          <input
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن موظف بالاسم، الإيميل، الكود المالي أو المسمى..."
            style={{
              width: '100%',
              minHeight: '42px',
              border: '1px solid #cfdcde',
              borderRadius: '10px',
              padding: '0 40px 0 12px',
              fontSize: '13.5px',
              background: '#f8fbfb',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
            type="text"
            value={searchQuery}
            onFocus={(e) => e.target.style.borderColor = 'var(--brand)'}
            onBlur={(e) => e.target.style.borderColor = '#cfdcde'}
          />
        </div>

        {/* Tab filters */}
        <div style={{ display: 'flex', gap: '8px', background: '#f0f4f5', padding: '4px', borderRadius: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterTab('all')}
            style={{
              background: filterTab === 'all' ? 'white' : 'transparent',
              color: filterTab === 'all' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: filterTab === 'all' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
            type="button"
          >
            الكل ({users.length})
          </button>
          
          <button
            onClick={() => setFilterTab('admins')}
            style={{
              background: filterTab === 'admins' ? 'white' : 'transparent',
              color: filterTab === 'admins' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: filterTab === 'admins' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
            type="button"
          >
            الإدارة العليا والمدراء
          </button>

          <button
            onClick={() => setFilterTab('inspectors')}
            style={{
              background: filterTab === 'inspectors' ? 'white' : 'transparent',
              color: filterTab === 'inspectors' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: filterTab === 'inspectors' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
            type="button"
          >
            القائمون بالمرور (المفتشين)
          </button>

          <button
            onClick={() => setFilterTab('staff')}
            style={{
              background: filterTab === 'staff' ? 'white' : 'transparent',
              color: filterTab === 'staff' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: filterTab === 'staff' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s'
            }}
            type="button"
          >
            الدعم والتنسيق المالي
          </button>
        </div>

        {/* Actions Wrapper: Excel Export + Layout Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Export to Excel Button */}
          <button
            onClick={handleExportToExcel}
            style={{
              background: '#e8f5e9',
              color: '#2e7d32',
              border: '1px solid #c8e6c9',
              borderRadius: '8px',
              minHeight: '34px',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#c8e6c9'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#e8f5e9'
            }}
            title="تصدير الموظفين الحاليين إلى ملف إكسيل"
            type="button"
          >
            <FileSpreadsheet size={14} />
            تصدير للأكسيل 📊
          </button>

          {/* Layout View Toggler */}
          <div style={{ display: 'flex', gap: '4px', background: '#f0f4f5', padding: '4px', borderRadius: '10px' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                background: viewMode === 'grid' ? 'white' : 'transparent',
                color: viewMode === 'grid' ? 'var(--brand)' : '#546e7a',
                border: 0,
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: viewMode === 'grid' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s'
              }}
              title="عرض كشبكة كروت"
              type="button"
            >
              <LayoutGrid size={16} />
            </button>
            
            <button
              onClick={() => setViewMode('table')}
              style={{
                background: viewMode === 'table' ? 'white' : 'transparent',
                color: viewMode === 'table' ? 'var(--brand)' : '#546e7a',
                border: 0,
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: viewMode === 'table' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.2s'
              }}
              title="عرض كجدول بيانات"
              type="button"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Staff Directory List/Grid Wrapper */}
      {viewMode === 'grid' ? (
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
          marginTop: '8px'
        }}>
          {filteredUsers.map((u) => {
            const badgeStyle = levelToneColors(u.level)
            
            // Deterministic statistics and meta information based on user profile
            const hash = u.full_name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
            
            const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
            const joinMonth = months[hash % 12]
            const joinYear = 2024 + (hash % 3)
            const joinDate = `انضم في ${joinMonth} ${joinYear}`
            
            let systemScope = 'صلاحية محدودة بالمنظومة'
            if (u.level === 1) systemScope = 'إشراف كامل وإدارة المنظومة واعتماد عام'
            else if (u.level === 2) systemScope = 'اعتماد مأموريات الإدارات والتقارير العامة'
            else if (u.level === 3) systemScope = 'اعتماد خطط وتكليفات الإدارة العامة'
            else if (u.level === 4) systemScope = 'إنشاء التكليفات وتسجيل الكوادر'
            else if (u.level === 5) systemScope = 'مراجعة المالي وتدقيق بنود الصرف'
            else if (u.level === 7) systemScope = 'التنفيذ الميداني ورصد المخالفات الفورية'

            let missionStats = ''
            if (u.level === 7) {
              const activeM = (hash % 3) + 1
              const compM = (hash % 15) + 5
              missionStats = `المأموريات الميدانية: ${activeM} جارية | ${compM} مكتملة`
            } else if (u.level === 5) {
              const audited = (hash % 20) + 10
              missionStats = `معاملات مالية مدققة: ${audited} مطالبة`
            } else if (u.level === 4) {
              const assigned = (hash % 25) + 12
              missionStats = `مأموريات مجدولة ومكلفة: ${assigned}`
            } else {
              const approved = (hash % 35) + 20
              missionStats = `مأموريات تم اعتمادها: ${approved} خطة`
            }

            const isVerified = u.is_active !== false
            
            return (
              <article
                key={u.id}
                onClick={() => setSelectedDetailUser(u)}
                style={{
                  background: 'white',
                  border: '1px solid var(--line)',
                  borderRadius: '12px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.01)',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-3px)'
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16,32,39,0.05)'
                  e.currentTarget.style.borderColor = 'var(--brand)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.01)'
                  e.currentTarget.style.borderColor = 'var(--line)'
                }}
              >
                {/* Top Details (Avatar, Name, Pill) */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <UserAvatar name={u.full_name} level={u.level} />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '13.5px', color: '#102027', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.full_name}</h4>
                      <BadgeCheck size={14} style={{ color: 'var(--brand)', flexShrink: 0 }} />
                    </div>
                    
                    <span style={{
                      fontSize: '9.5px',
                      fontWeight: 'bold',
                      color: badgeStyle.text,
                      background: badgeStyle.bg,
                      border: `1px solid ${badgeStyle.border}`,
                      padding: '1px 6px',
                      borderRadius: '20px',
                      alignSelf: 'flex-start',
                      whiteSpace: 'nowrap'
                    }}>
                      {levelLabel(u.level)}
                    </span>
                  </div>
                </div>

                {/* Middle Section details */}
                <div style={{
                  background: '#f8fbfb',
                  padding: '10px',
                  borderRadius: '8px',
                  border: '1px solid #cfdcde',
                  display: 'grid',
                  gap: '6px',
                  fontSize: '11.5px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <Shield size={13} style={{ color: '#546e7a', marginTop: '2px', flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ color: '#263238', fontSize: '12px' }}>{u.job_title ?? 'مفتش تفتيش ميداني'}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={13} style={{ color: '#546e7a', marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ color: '#455a64', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.department ?? 'ديوان عام وزارة الصحة والسكان'}</span>
                  </div>

                  {/* Email Display */}
                  {u.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={13} style={{ color: '#546e7a', flexShrink: 0 }} />
                      <span style={{ color: '#455a64', userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</span>
                    </div>
                  )}

                  {/* Mobile Phone Display */}
                  {u.phone && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} style={{ color: '#546e7a', flexShrink: 0 }} />
                      <span style={{ color: '#455a64' }}>{u.phone}</span>
                    </div>
                  )}

                  {/* Dynamic Joined Date & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed #cfdcde', paddingTop: '6px', marginTop: '2px' }}>
                    <span style={{ color: '#78909c', fontSize: '10.5px' }}>{joinDate}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: isVerified ? '#2ecc71' : '#e74c3c', fontSize: '10.5px', fontWeight: 'bold' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isVerified ? '#2ecc71' : '#e74c3c' }} />
                      {isVerified ? 'موثق ونشط' : 'معلق'}
                    </span>
                  </div>

                  {/* Dynamic Scope Capabilities */}
                  <div style={{ borderTop: '1px dashed #cfdcde', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ color: '#78909c', fontSize: '10px', fontWeight: 'bold' }}>الصلاحية والمؤشرات:</span>
                    <span style={{ color: '#546e7a', fontSize: '11px', lineHeight: '1.4' }}>• {systemScope}</span>
                    <span style={{ color: 'var(--brand)', fontSize: '11px', fontWeight: 'bold' }}>• {missionStats}</span>
                  </div>

                  {u.financial_code && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderTop: '1px dashed #cfdcde', paddingTop: '6px', marginTop: '2px' }}>
                      <Hash size={12} style={{ color: '#546e7a' }} />
                      <span style={{ color: '#455a64' }}>الكود المالي:</span>
                      <code style={{ background: '#e0f2f1', color: '#004d40', padding: '1px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>{u.financial_code}</code>
                    </div>
                  )}
                </div>

                {/* Bottom Quick Actions (Email, Call) - Compact design */}
                <div style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '2px' }}>
                  {u.email && (
                    <a
                      href={`mailto:${u.email}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        background: '#eef6f6',
                        color: 'var(--brand)',
                        border: '1px solid #cfdcde',
                        borderRadius: '6px',
                        minHeight: '32px',
                        textDecoration: 'none',
                        fontSize: '11.5px',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#e0f2f1'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#eef6f6'}
                    >
                      <Mail size={12} />
                      مراسلة
                    </a>
                  )}

                  {u.phone && (
                    <a
                      href={`tel:${u.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px',
                        background: '#ffffff',
                        color: '#263238',
                        border: '1px solid #cfdcde',
                        borderRadius: '6px',
                        minHeight: '32px',
                        textDecoration: 'none',
                        fontSize: '11.5px',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f7f8'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#ffffff'}
                    >
                      <Phone size={12} />
                      اتصال
                    </a>
                  )}

                  {currentUserLevel <= 1 && u.email && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleImpersonateUser(u.email!)
                      }}
                      style={{
                        background: '#eef6f6',
                        color: 'var(--brand)',
                        border: '1px solid #cfdcde',
                        borderRadius: '6px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        flexShrink: 0
                      }}
                      title="محاكاة الدخول الفوري بهذا الحساب"
                      type="button"
                      onMouseEnter={(e) => e.currentTarget.style.background = '#e0f2f1'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#eef6f6'}
                    >
                      <Shield size={13} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  )}

                  {currentUserLevel <= 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditingUser(u)
                      }}
                      style={{
                        background: '#eef6f6',
                        color: 'var(--brand)',
                        border: '1px solid #cfdcde',
                        borderRadius: '6px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                        flexShrink: 0
                      }}
                      title="تعديل بيانات وصلاحيات الموظف"
                      type="button"
                      onMouseEnter={(e) => e.currentTarget.style.background = '#e0f2f1'}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#eef6f6'}
                    >
                      <Edit2 size={13} />
                    </button>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteUser(u.id)
                    }}
                    style={{
                      background: '#fff1f1',
                      color: '#e74c3c',
                      border: '1px solid #f9d5d5',
                      borderRadius: '6px',
                      width: '32px',
                      height: '32px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                      flexShrink: 0
                    }}
                    title="حذف الموظف نهائياً"
                    type="button"
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fcd9d9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fff1f1'}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </article>
            )
          })}

          {filteredUsers.length === 0 && (
            <div style={{
              gridColumn: '1 / -1',
              textAlign: 'center',
              background: 'white',
              padding: '48px 24px',
              borderRadius: '16px',
              border: '1px dashed #cfdcde',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Activity size={40} style={{ color: '#90a4ae' }} />
              <h3 style={{ margin: 0, fontSize: '16px', color: '#102027', fontWeight: 'bold' }}>لا يوجد موظفون يطابقون خيارات البحث</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#78909c' }}>يرجى تعديل مصطلح البحث أو اختيار تصنيف فلترة مختلف.</p>
            </div>
          )}
        </section>
      ) : (
        /* Staff Table Directory View */
        <section style={{
          background: 'white',
          border: '1px solid var(--line)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow)',
          overflow: 'hidden',
          marginTop: '8px'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'right',
              fontSize: '13px',
              minWidth: '950px'
            }}>
              <thead>
                <tr style={{
                  background: '#f8fbfb',
                  borderBottom: '1px solid var(--line)',
                  color: '#37474f'
                }}>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>الموظف والكادر</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>المسمى الوظيفي</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>مستوى الصلاحية</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>الجهة / الإدارة</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>البيانات المالية</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>وسائل الاتصال</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>الحالة</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold', textAlign: 'center' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => {
                  const badgeStyle = levelToneColors(u.level)
                  const isVerified = u.is_active !== false
                  return (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedDetailUser(u)}
                      style={{
                        borderBottom: '1px solid #eef2f3',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f4f8f8'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Avatar & Name */}
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <UserAvatar name={u.full_name} level={u.level} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{ fontWeight: 'bold', color: '#102027' }}>{u.full_name}</span>
                            <span style={{ fontSize: '11px', color: '#78909c' }}>موثق بالكامل</span>
                          </div>
                        </div>
                      </td>

                      {/* Job Title */}
                      <td style={{ padding: '12px 20px', color: '#263238', fontWeight: '500' }}>
                        {u.job_title ?? 'مفتش تفتيش ميداني'}
                      </td>

                      {/* Level Label Badge */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: badgeStyle.text,
                          background: badgeStyle.bg,
                          border: `1px solid ${badgeStyle.border}`,
                          padding: '3px 8px',
                          borderRadius: '20px',
                          whiteSpace: 'nowrap'
                        }}>
                          {levelLabel(u.level)}
                        </span>
                      </td>

                      {/* Department */}
                      <td style={{ padding: '12px 20px', color: '#455a64' }}>
                        {u.department ?? 'ديوان عام وزارة الصحة والسكان'}
                      </td>

                      {/* Financial Code */}
                      <td style={{ padding: '12px 20px' }}>
                        {u.financial_code ? (
                          <code style={{
                            background: '#e0f2f1',
                            color: '#004d40',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: 'bold'
                          }}>
                            {u.financial_code}
                          </code>
                        ) : (
                          <span style={{ color: '#b0bec5', fontSize: '12px' }}>—</span>
                        )}
                      </td>

                      {/* Contact Info (Quick Mail/Call Icons with text) */}
                      <td style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px' }}>
                          {u.email && (
                            <a
                              href={`mailto:${u.email}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--brand)', textDecoration: 'none' }}
                            >
                              <Mail size={12} />
                              <span style={{ textDecoration: 'underline' }}>{u.email}</span>
                            </a>
                          )}
                          {u.phone && (
                            <a
                              href={`tel:${u.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#455a64', textDecoration: 'none' }}
                            >
                              <Phone size={12} />
                              <span>{u.phone}</span>
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 20px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: isVerified ? '#2ecc71' : '#e74c3c',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isVerified ? '#2ecc71' : '#e74c3c' }} />
                          {isVerified ? 'نشط وموثق' : 'معلق'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 20px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          {currentUserLevel <= 1 && u.email && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleImpersonateUser(u.email!)
                              }}
                              style={{
                                background: '#eef6f6',
                                color: 'var(--brand)',
                                border: '1px solid #cfdcde',
                                borderRadius: '6px',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                              }}
                              title="محاكاة الدخول الفوري بهذا الحساب"
                              type="button"
                              onMouseEnter={(e) => e.currentTarget.style.background = '#e0f2f1'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#eef6f6'}
                            >
                              <Shield size={12} style={{ transform: 'rotate(180deg)' }} />
                            </button>
                          )}
                          {currentUserLevel <= 1 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startEditingUser(u)
                              }}
                              style={{
                                background: '#eef6f6',
                                color: 'var(--brand)',
                                border: '1px solid #cfdcde',
                                borderRadius: '6px',
                                width: '28px',
                                height: '28px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'background 0.2s',
                              }}
                              title="تعديل الموظف"
                              type="button"
                              onMouseEnter={(e) => e.currentTarget.style.background = '#e0f2f1'}
                              onMouseLeave={(e) => e.currentTarget.style.background = '#eef6f6'}
                            >
                              <Edit2 size={12} />
                            </button>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteUser(u.id)
                            }}
                            style={{
                              background: '#fff1f1',
                              color: '#e74c3c',
                              border: '1px solid #f9d5d5',
                              borderRadius: '6px',
                              width: '28px',
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'background 0.2s',
                            }}
                            title="حذف الموظف نهائياً"
                            type="button"
                            onMouseEnter={(e) => e.currentTarget.style.background = '#fcd9d9'}
                            onMouseLeave={(e) => e.currentTarget.style.background = '#fff1f1'}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '48px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Activity size={40} style={{ color: '#90a4ae' }} />
              <h3 style={{ margin: 0, fontSize: '16px', color: '#102027', fontWeight: 'bold' }}>لا يوجد موظفون يطابقون خيارات البحث</h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#78909c' }}>يرجى تعديل مصطلح البحث أو اختيار تصنيف فلترة مختلف.</p>
            </div>
          )}
        </section>
      )}

      {/* Staff Registration Modal overlay */}
      {showAddForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 32, 39, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 999,
          overflowY: 'auto'
        }}>
          <form
            onSubmit={handleAddUser}
            style={{
              background: 'white',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '540px',
              width: '100%',
              display: 'grid',
              gap: '16px',
              boxShadow: '0 8px 32px rgba(16,32,39,0.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              animation: 'modalSlideUp 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eef6f6', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#102027', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={22} style={{ color: 'var(--brand)' }} />
                تسجيل وتسكين موظف جديد بالمنظومة
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
                type="button"
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ background: '#eef6f6', padding: '12px 14px', borderRadius: '10px', fontSize: '12.5px', color: 'var(--brand)', lineHeight: '1.5', border: '1px solid #c7ebd8' }}>
              سيتم استخدام البريد الإلكتروني المدخل كحساب لتسجيل دخول الكادر، ومن خلاله سيتلقى المفتش الإشعارات الفورية بمأمورياته والتنبيهات المباشرة.
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
              الاسم الكامل للموظف *
              <input
                onChange={(event) => setFullName(event.target.value)}
                placeholder="مثال: د. أحمد محمد السيد"
                required
                style={{
                  background: '#f8fbfb',
                  border: '1px solid #cfdcde',
                  borderRadius: '8px',
                  minHeight: '40px',
                  padding: '0 12px',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
                type="text"
                value={fullName}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                المسمى الوظيفي *
                <input
                  onChange={(event) => setJobTitle(event.target.value)}
                  placeholder="مثال: مفتش مكافحة العدوى"
                  required
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 12px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                  type="text"
                  value={jobTitle}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                الصلاحيات التنظيمية بالمنظومة
                <select
                  onChange={(event) => setLevel(parseInt(event.target.value))}
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 8px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                  value={level}
                >
                  <option value={7}>مستوى 7 — قائم بالمرور (مفتش ميداني)</option>
                  <option value={5}>مستوى 5 — مراجع مالي للمستندات</option>
                  <option value={4}>مستوى 4 — موظف مختص بالتكليفات</option>
                  <option value={3}>مستوى 3 — مدير عام الإدارة العامة</option>
                  <option value={2}>مستوى 2 — رئيس رئيس الإدارة المركزية</option>
                  <option value={1}>مستوى 1 — سوبر أدمن (مدير المنظومة)</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
              البريد الإلكتروني للربط وتلقي الإشعارات *
              <input
                onChange={(event) => setEmail(event.target.value)}
                placeholder="أدخل بريد Gmail أو Hotmail أو البريد الحكومي المعتمد"
                required
                style={{
                  background: '#f8fbfb',
                  border: '1px solid #cfdcde',
                  borderRadius: '8px',
                  minHeight: '40px',
                  padding: '0 12px',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
                type="email"
                value={email}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                رقم الهاتف المحمول للتواصل المباشر
                <input
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="01xxxxxxxxx"
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  type="tel"
                  value={phone}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                كود الموظف بالنظام المالي الموحد
                <input
                  onChange={(event) => setFinancialCode(event.target.value)}
                  placeholder="مثال: FIN-103948"
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  type="text"
                  value={financialCode}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
              الجهة أو المنشأة الطبية التابع لها الموظف الرئيسي *
              <select
                onChange={(event) => setFacilityId(event.target.value)}
                required
                style={{
                  background: '#f8fbfb',
                  border: '1px solid #cfdcde',
                  borderRadius: '8px',
                  minHeight: '40px',
                  padding: '0 8px',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
                value={facilityId}
              >
                <option value="">-- اختر المنشأة المسجلة --</option>
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} {fac.address ? `(${fac.address})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginTop: '14px', borderTop: '1px solid #eef6f6', paddingTop: '16px' }}>
              <button
                disabled={loading}
                style={{
                  background: 'var(--brand)',
                  color: 'white',
                  border: 0,
                  borderRadius: '8px',
                  minHeight: '42px',
                  padding: '0 24px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  boxShadow: '0 4px 12px rgba(16, 122, 102, 0.15)'
                }}
                type="submit"
              >
                {loading ? 'جاري الحفظ والترحيل...' : 'تسجيل وتسكين الموظف بالكامل'}
              </button>
              
              <button
                onClick={() => setShowAddForm(false)}
                style={{
                  background: '#f0f4f5',
                  color: '#546e7a',
                  border: 0,
                  borderRadius: '8px',
                  minHeight: '42px',
                  padding: '0 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13.5px'
                }}
                type="button"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detailed User Profile Modal overlay */}
      {selectedDetailUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 32, 39, 0.6)',
          backdropFilter: 'blur(5px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 999,
        }}>
          {/* Modal Card */}
          <div style={{
            background: 'white',
            border: '1px solid var(--line)',
            borderRadius: '20px',
            maxWidth: '580px',
            width: '100%',
            boxShadow: '0 12px 40px rgba(16,32,39,0.2)',
            maxHeight: '92vh',
            overflowY: 'auto',
            position: 'relative',
          }}>
            {/* Modal Header Cover with dynamic role gradient */}
            <div style={{
              background: 'linear-gradient(135deg, #006d77 0%, #11998e 100%)',
              padding: '24px 28px',
              color: 'white',
              position: 'relative',
              borderTopLeftRadius: '19px',
              borderTopRightRadius: '19px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px'
            }}>
              <button
                onClick={() => setSelectedDetailUser(null)}
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  background: 'rgba(255, 255, 255, 0.15)',
                  border: 0,
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
                type="button"
              >
                <X size={18} />
              </button>

              {/* Avatar Inside Header */}
              <div style={{
                border: '3px solid white',
                borderRadius: '50%',
                overflow: 'hidden',
                background: 'white',
                width: '64px',
                height: '64px',
                boxShadow: '0 4px 10px rgba(0,0,0,0.15)'
              }}>
                <UserAvatar name={selectedDetailUser.full_name} level={selectedDetailUser.level} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>{selectedDetailUser.full_name}</h3>
                <span style={{
                  fontSize: '11px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  alignSelf: 'flex-start',
                  fontWeight: 'bold',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}>
                  {levelLabel(selectedDetailUser.level)}
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Job Title and Org */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold' }}>المسمى الوظيفي الفعلي:</span>
                  <span style={{ fontSize: '13.5px', color: '#263238', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={16} style={{ color: 'var(--brand)' }} />
                    {selectedDetailUser.job_title ?? 'مفتش ميداني'}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold' }}>المنشأة الطبية / الإدارة:</span>
                  <span style={{ fontSize: '13.5px', color: '#263238', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={16} style={{ color: 'var(--brand)' }} />
                    {selectedDetailUser.department ?? 'ديوان عام الوزارة'}
                  </span>
                </div>
              </div>

              {/* Status and Financial Code */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px dashed #cfdcde', paddingTop: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold' }}>حالة الحساب والموثوقية:</span>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: selectedDetailUser.is_active !== false ? '#2ecc71' : '#e74c3c',
                    fontSize: '13.5px',
                    fontWeight: 'bold'
                  }}>
                    <BadgeCheck size={16} />
                    {selectedDetailUser.is_active !== false ? 'نشط وموثق بالكامل' : 'معلق'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold' }}>الكود المالي المعتمد:</span>
                  {selectedDetailUser.financial_code ? (
                    <code style={{
                      background: '#e0f2f1',
                      color: '#004d40',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      alignSelf: 'flex-start'
                    }}>
                      {selectedDetailUser.financial_code}
                    </code>
                  ) : (
                    <span style={{ color: '#90a4ae', fontSize: '13px' }}>غير متاح</span>
                  )}
                </div>
              </div>

              {/* System Capabilities Section */}
              <div style={{
                background: '#f8fbfb',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #cfdcde',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#102027', fontWeight: 'bold', borderBottom: '1px solid #cfdcde', paddingBottom: '6px' }}>
                  الصلاحيات التفصيلية بالمنظومة:
                </h4>
                <ul style={{ margin: 0, paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: '#546e7a', listStyleType: 'disc' }}>
                  <li>
                    <strong>صلاحيات التنفيذ: </strong> 
                    {selectedDetailUser.level === 1 && 'التحكم الهيكلي الشامل وإعادة بذر المنظومة وتدقيق التراخيص.'}
                    {selectedDetailUser.level === 2 && 'اعتماد مأموريات القطاعات بالكامل والمطابقة الجغرافية.'}
                    {selectedDetailUser.level === 3 && 'إصدار واعتماد التكليفات الطبية والموافقة على المبيت.'}
                    {selectedDetailUser.level === 4 && 'إنشاء التكليفات ومتابعة الفروع الإقليمية.'}
                    {selectedDetailUser.level === 5 && 'مراجعة المعاملات وبنود صرف بدلات الانتقال والمبيت.'}
                    {selectedDetailUser.level === 7 && 'تنفيذ المأموريات الميدانية ورصد التباين الجغرافي بالـ GPS.'}
                  </li>
                  <li>
                    <strong>مستوى الترخيص: </strong> مستوى صلاحية {selectedDetailUser.level} إداري
                  </li>
                </ul>
              </div>

              {/* Contact Information with Copy Feature */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px dashed #cfdcde', paddingTop: '16px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#102027', fontWeight: 'bold' }}>قنوات الاتصال المباشر:</h4>
                
                {/* Email Item */}
                {selectedDetailUser.email && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fbfb',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cfdcde'
                  }}>
                    <a
                      href={`mailto:${selectedDetailUser.email}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--brand)', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      <Mail size={16} />
                      <span style={{ textDecoration: 'underline' }}>{selectedDetailUser.email}</span>
                    </a>
                    
                    <button
                      onClick={() => {
                        if (selectedDetailUser.email) {
                          navigator.clipboard.writeText(selectedDetailUser.email)
                          alert('تم نسخ البريد الإلكتروني للحافظة!')
                        }
                      }}
                      style={{
                        background: 'white',
                        border: '1px solid #cfdcde',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#546e7a',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f7f8'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      type="button"
                    >
                      <Copy size={12} />
                      نسخ البريد
                    </button>
                  </div>
                )}

                {/* Phone Item */}
                {selectedDetailUser.phone && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: '#f8fbfb',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cfdcde'
                  }}>
                    <a
                      href={`tel:${selectedDetailUser.phone}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#263238', textDecoration: 'none', fontSize: '13px', fontWeight: 'bold' }}
                    >
                      <Phone size={16} style={{ color: 'var(--brand)' }} />
                      <span>{selectedDetailUser.phone}</span>
                    </a>
                    
                    <button
                      onClick={() => {
                        if (selectedDetailUser.phone) {
                          navigator.clipboard.writeText(selectedDetailUser.phone)
                          alert('تم نسخ رقم الهاتف للحافظة!')
                        }
                      }}
                      style={{
                        background: 'white',
                        border: '1px solid #cfdcde',
                        borderRadius: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        color: '#546e7a',
                        fontWeight: 'bold',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f5f7f8'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                      type="button"
                    >
                      <Copy size={12} />
                      نسخ الهاتف
                    </button>
                  </div>
                )}
              </div>

              {/* Actions Footer inside Modal */}
              <div style={{
                display: 'flex',
                gap: '10px',
                borderTop: '1px solid #eef6f6',
                paddingTop: '20px',
                marginTop: '10px'
              }}>
                {currentUserLevel <= 1 && selectedDetailUser.email && (
                  <button
                    onClick={() => handleImpersonateUser(selectedDetailUser.email!)}
                    style={{
                      flex: 1,
                      background: 'var(--brand)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      minHeight: '40px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 6px rgba(16, 122, 102, 0.15)'
                    }}
                    type="button"
                  >
                    <Shield size={16} style={{ transform: 'rotate(180deg)' }} />
                    محاكاة الدخول بهذا الكادر
                  </button>
                )}

                {currentUserLevel <= 1 && (
                  <button
                    onClick={() => {
                      const userToEdit = selectedDetailUser
                      setSelectedDetailUser(null)
                      startEditingUser(userToEdit)
                    }}
                    style={{
                      flex: 1,
                      background: '#eef6f6',
                      color: 'var(--brand)',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      minHeight: '40px',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      fontSize: '12.5px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    type="button"
                  >
                    <Edit2 size={16} />
                    تعديل الصلاحيات والبيانات
                  </button>
                )}

                <button
                  onClick={() => {
                    const idToDelete = selectedDetailUser.id
                    setSelectedDetailUser(null)
                    handleDeleteUser(idToDelete)
                  }}
                  style={{
                    background: '#fff1f1',
                    color: '#e74c3c',
                    border: '1px solid #f9d5d5',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 16px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  type="button"
                >
                  <Trash2 size={16} />
                  حذف الحساب نهائياً
                </button>

                <button
                  onClick={() => setSelectedDetailUser(null)}
                  style={{
                    background: '#f0f4f5',
                    color: '#546e7a',
                    border: 0,
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 20px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '12.5px'
                  }}
                  type="button"
                >
                  إغلاق
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Staff Editing Modal overlay */}
      {editingUser && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(16, 32, 39, 0.55)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          zIndex: 999,
          overflowY: 'auto'
        }}>
          <form
            onSubmit={handleUpdateUser}
            style={{
              background: 'white',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '540px',
              width: '100%',
              display: 'grid',
              gap: '16px',
              boxShadow: '0 8px 32px rgba(16,32,39,0.15)',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative',
              animation: 'modalSlideUp 0.3s ease-out'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eef6f6', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#102027', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={22} style={{ color: 'var(--brand)' }} />
                تعديل صلاحيات وبيانات الموظف
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}
                type="button"
              >
                <X size={22} />
              </button>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
              الاسم الكامل للموظف *
              <input
                onChange={(event) => setEditFullName(event.target.value)}
                placeholder="مثال: د. أحمد محمد السيد"
                required
                style={{
                  background: '#f8fbfb',
                  border: '1px solid #cfdcde',
                  borderRadius: '8px',
                  minHeight: '40px',
                  padding: '0 12px',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
                type="text"
                value={editFullName}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                المسمى الوظيفي *
                <input
                  onChange={(event) => setEditJobTitle(event.target.value)}
                  placeholder="مثال: مفتش مكافحة العدوى"
                  required
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 12px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                  type="text"
                  value={editJobTitle}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                الصلاحيات التنظيمية بالمنظومة
                <select
                  onChange={(event) => setEditLevel(parseInt(event.target.value))}
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 8px',
                    fontSize: '13px',
                    outline: 'none'
                  }}
                  value={editLevel}
                >
                  <option value={7}>مستوى 7 — قائم بالمرور (مفتش ميداني)</option>
                  <option value={5}>مستوى 5 — مراجع مالي للمستندات</option>
                  <option value={4}>مستوى 4 — موظف مختص بالتكليفات</option>
                  <option value={3}>مستوى 3 — مدير عام الإدارة العامة</option>
                  <option value={2}>مستوى 2 — رئيس رئيس الإدارة المركزية</option>
                  <option value={1}>مستوى 1 — سوبر أدمن (مدير المنظومة)</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
              البريد الإلكتروني للربط وتلقي الإشعارات *
              <input
                onChange={(event) => setEditEmail(event.target.value)}
                placeholder="أدخل بريد Gmail أو Hotmail أو البريد الحكومي المعتمد"
                required
                style={{
                  background: '#f8fbfb',
                  border: '1px solid #cfdcde',
                  borderRadius: '8px',
                  minHeight: '40px',
                  padding: '0 12px',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
                type="email"
                value={editEmail}
              />
            </label>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                رقم الهاتف المحمول للتواصل المباشر
                <input
                  onChange={(event) => setEditPhone(event.target.value)}
                  placeholder="01xxxxxxxxx"
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  type="tel"
                  value={editPhone}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
                كود الموظف بالنظام المالي الموحد
                <input
                  onChange={(event) => setEditFinancialCode(event.target.value)}
                  placeholder="مثال: FIN-103948"
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    outline: 'none'
                  }}
                  type="text"
                  value={editFinancialCode}
                />
              </label>
            </div>

            <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold' }}>
              الجهة أو المنشأة الطبية التابع لها الموظف الرئيسي *
              <select
                onChange={(event) => setEditFacilityId(event.target.value)}
                required
                style={{
                  background: '#f8fbfb',
                  border: '1px solid #cfdcde',
                  borderRadius: '8px',
                  minHeight: '40px',
                  padding: '0 8px',
                  fontSize: '13.5px',
                  outline: 'none'
                }}
                value={editFacilityId}
              >
                <option value="">-- اختر المنشأة المسجلة --</option>
                {facilities.map((fac) => (
                  <option key={fac.id} value={fac.id}>
                    {fac.name} {fac.address ? `(${fac.address})` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: '#37474f', fontWeight: 'bold', cursor: 'pointer' }}>
              <input
                checked={editIsActive}
                onChange={(event) => setEditIsActive(event.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                type="checkbox"
              />
              حساب نشط وموثق لتأدية المأموريات
            </label>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', marginTop: '14px', borderTop: '1px solid #eef6f6', paddingTop: '16px' }}>
              <button
                disabled={loading}
                style={{
                  background: 'var(--brand)',
                  color: 'white',
                  border: 0,
                  borderRadius: '8px',
                  minHeight: '42px',
                  padding: '0 24px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  boxShadow: '0 4px 12px rgba(16, 122, 102, 0.15)'
                }}
                type="submit"
              >
                {loading ? 'جاري الحفظ والتعديل...' : 'حفظ التعديلات بالكامل'}
              </button>
              
              <button
                onClick={() => setEditingUser(null)}
                style={{
                  background: '#f0f4f5',
                  color: '#546e7a',
                  border: 0,
                  borderRadius: '8px',
                  minHeight: '42px',
                  padding: '0 20px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '13.5px'
                }}
                type="button"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
