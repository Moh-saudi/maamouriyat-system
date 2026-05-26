'use client'

import { useMemo, useState, useEffect } from 'react'
import { Plus, Trash2, ShieldCheck, Database, Zap, CheckCircle2, Sliders, RefreshCw, Lock, Check, Users } from 'lucide-react'
import { type CorrectionUnitOption } from '@/lib/correction-units'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { type DemoRole } from '@/lib/roles'

export function SettingsPortal({
  initialUnits,
  centralStoreReady,
}: {
  initialUnits: CorrectionUnitOption[]
  centralStoreReady: boolean
}) {
  const supabase = createBrowserSupabaseClient()
  const [activeTab, setActiveTab] = useState<'units' | 'diagnostics' | 'permissions' | 'user_permissions'>('units')
  
  // State for Correction Units
  const [units, setUnits] = useState<CorrectionUnitOption[]>(initialUnits)
  const [unitName, setUnitName] = useState('')
  const [unitError, setUnitError] = useState('')
  const [unitSuccess, setUnitSuccess] = useState('')
  const [unitLoading, setUnitLoading] = useState(false)

  // Employees list & overrides
  const demoUsersList = [
    { id: '1', name: 'المهندس أحمد الدمرداش', email: 'techadmin@mohp.gov.eg', phone: '01012345678', nationalId: '29001010101234', role: 'techadmin', jobTitle: 'مدير عام النظم والتحول الرقمي' },
    { id: '2', name: 'الأستاذ الدكتور خالد عبد الغفار', email: 'superadmin@mohp.gov.eg', phone: '01223456789', nationalId: '26508080105678', role: 'superadmin', jobTitle: 'وزير الصحة والسكان' },
    { id: '3', name: 'د. أحمد عبد الرحمن', email: 'central@mohp.gov.eg', phone: '01134567890', nationalId: '27805120109012', role: 'central', jobTitle: 'رئيس الإدارة المركزية للطب العلاجي' },
    { id: '4', name: 'د. سارة خالد', email: 'generalmanager@mohp.gov.eg', phone: '01545678901', nationalId: '28409150103456', role: 'generalmanager', jobTitle: 'مدير عام الإدارة العامة للمستشفيات' },
    { id: '5', name: 'أ. محمد علي', email: 'creator@mohp.gov.eg', phone: '01056789012', nationalId: '28911020107890', role: 'creator', jobTitle: 'رئيس قسم التشغيل والتكليف' },
    { id: '6', name: 'أ. منى حسن', email: 'financial@mohp.gov.eg', phone: '01267890123', nationalId: '29102030104567', role: 'financial', jobTitle: 'مراجع مالي أول بالقطاع' },
    { id: '7', name: 'د. خالد إبراهيم', email: 'inspector@mohp.gov.eg', phone: '01178901234', nationalId: '28604050101234', role: 'inspector', jobTitle: 'مفتش صحي ومسؤول المأموريات الميدانية' }
  ]

  const [dbUsers, setDbUsers] = useState<any[]>([])
  const [userSearchQuery, setUserSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<any | null>(null)
  
  // User overrides state: Record<email, allowedPages[]>
  const [userOverrides, setUserOverrides] = useState<Record<string, string[]>>({})

  // Load database users
  useEffect(() => {
    async function fetchUsers() {
      if (supabase) {
        const { data, error } = await supabase
          .from('users')
          .select('id, full_name, email, phone, financial_code, level, department, job_title')
          .limit(100)
        if (!error && data) {
          const mapped = data.map(u => ({
            id: u.id,
            name: u.full_name || 'مستخدم غير مسمى',
            email: u.email || `${u.id}@mohp.gov.eg`,
            phone: u.phone || 'غير مسجل',
            nationalId: u.financial_code || 'غير مسجل',
            role: u.level === 0 ? 'techadmin' : u.level === 1 ? 'superadmin' : u.level === 2 ? 'central' : u.level === 3 ? 'generalmanager' : u.level === 4 ? 'creator' : u.level === 5 ? 'financial' : 'inspector',
            jobTitle: u.job_title || 'موظف بالقطاع'
          }))
          setDbUsers(mapped)
        }
      }
    }
    fetchUsers()
  }, [])

  // Load user overrides from cookie on mount
  useEffect(() => {
    const matchPerms = document.cookie
      .split('; ')
      .find((item) => item.startsWith('maamouriyat_user_permissions='))
      ?.split('=')[1]
    if (matchPerms) {
      try {
        const decoded = decodeURIComponent(matchPerms)
        const parsed = JSON.parse(decoded)
        if (parsed && typeof parsed === 'object') {
          setUserOverrides(parsed)
        }
      } catch {}
    }
  }, [])

  const allUsers = useMemo(() => {
    const list = [...demoUsersList]
    dbUsers.forEach(dbU => {
      if (!list.some(u => u.email.toLowerCase() === dbU.email.toLowerCase())) {
        list.push(dbU)
      }
    })
    return list
  }, [dbUsers])

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase()
    if (!q) return []
    return allUsers.filter(u => 
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.nationalId.includes(q)
    )
  }, [allUsers, userSearchQuery])

  // Custom User Toggle
  const handleToggleUserPermission = (pageKey: string) => {
    if (!selectedUser) return
    const userKey = selectedUser.email.toLowerCase()
    setUserOverrides(prev => {
      const current = prev[userKey] !== undefined ? prev[userKey] : defaultNavs[selectedUser.role as DemoRole] || []
      const next = current.includes(pageKey)
        ? current.filter(k => k !== pageKey)
        : [...current, pageKey]
      return { ...prev, [userKey]: next }
    })
  }

  // Save User Overrides
  const handleSaveUserOverrides = () => {
    setUnitLoading(true)
    setUnitError('')
    setUnitSuccess('')
    try {
      const serialized = encodeURIComponent(JSON.stringify(userOverrides))
      document.cookie = `maamouriyat_user_permissions=${serialized}; path=/; max-age=604800; SameSite=Lax`
      setUnitSuccess(`تم حفظ وتطبيق الصلاحيات المخصصة للموظف (${selectedUser?.name}) بنجاح! سيتم تحديث النظام.`)
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setUnitError('فشل حفظ الصلاحيات المخصصة: ' + err.message)
    } finally {
      setUnitLoading(false)
    }
  }

  // Clear Overrides for a user
  const handleClearUserOverrides = () => {
    if (!selectedUser) return
    const userKey = selectedUser.email.toLowerCase()
    setUnitLoading(true)
    setUnitError('')
    setUnitSuccess('')
    try {
      const copy = { ...userOverrides }
      delete copy[userKey]
      setUserOverrides(copy)
      const serialized = encodeURIComponent(JSON.stringify(copy))
      document.cookie = `maamouriyat_user_permissions=${serialized}; path=/; max-age=604800; SameSite=Lax`
      setUnitSuccess(`تمت إعادة ضبط صلاحيات الموظف (${selectedUser?.name}) للقيم الافتراضية بنجاح!`)
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setUnitError('فشل إعادة ضبط الصلاحيات.')
    } finally {
      setUnitLoading(false)
    }
  }

  // Dynamic Permissions Roles & Pages Definition
  const systemRolesList = [
    { key: 'superadmin', name: 'سوبر أدمن (مدير عام المنظومة)', desc: 'أعلى سلطة إدارية ورقابية، يمتلك الصلاحية الكاملة لتكليف المأموريات واعتماد التقارير وإجراء المراجعات.' },
    { key: 'techadmin', name: 'الدعم الفني (مدير الإدارة التقنية)', desc: 'المسؤول التقني عن حوكمة وإدارة البنية الأساسية، إدارة المستخدمين والمنشآت وتصميم قوالب التقييم والتشخيصات الفنية.' },
    { key: 'central', name: 'رئيس إدارة مركزية', desc: 'صلاحيات رقابية وإشرافية عليا لمتابعة مستويات التغطية الميدانية في المحافظات واعتماد التقارير العامة.' },
    { key: 'generalmanager', name: 'مدير عام المستشفيات', desc: 'إشراف عام ومتابعة على مستوى الإدارات الفرعية وتوزيع التكليفات الميدانية ومطابقتها.' },
    { key: 'creator', name: 'موظف مختص بالتكليفات', desc: 'التنفيذ التشغيلي اليومي لجدولة وتسكين المأموريات وتنسيق فرق العمل بالمرور.' },
    { key: 'financial', name: 'مستخدم مالي ومراجع', desc: 'مراجع مالي مركزي لتدقيق بنود الصرف ومصروفات المبيت والبدلات وربطها بالتوقيع الإلكتروني.' },
    { key: 'inspector', name: 'القائم بالمرور (المفتش الميداني)', desc: 'عضو فريق التفتيش الميداني، ينفذ المأموريات ويثبت الحضور بالـ GPS ويسجل المخالفات المباشرة بالخريطة.' }
  ]

  const systemPagesList = [
    { key: 'dashboard', name: 'لوحة التحكم (Dashboard)', desc: 'التحليلات والمقاييس البيانية للمستخدمين.' },
    { key: 'missions', name: 'المأموريات (Missions)', desc: 'إنشاء وجدولة وتنفيذ وتدقيق المأموريات.' },
    { key: 'violations', name: 'المخالفات الميدانية (Violations)', desc: 'رصد وتسجيل وتصويب المخالفات.' },
    { key: 'facilities', name: 'المنشآت الصحية (Facilities)', desc: 'دليل المستشفيات وجهات التبعية الجغرافية.' },
    { key: 'users', name: 'إدارة الموظفين (Users)', desc: 'تسجيل وتسكين وتعديل صلاحيات الكوادر.' },
    { key: 'checklists', name: 'نماذج التقييم (Checklists)', desc: 'مصمم نماذج وبنود التفتيش والتقييم.' },
    { key: 'settings', name: 'إعدادات المنظومة (Settings)', desc: 'جهات المتابعة، التشخيصات الفنية وحوكمة الصفحات.' }
  ]

  const defaultNavs: Record<string, string[]> = {
    superadmin: ['dashboard', 'missions', 'violations', 'facilities', 'users', 'settings', 'checklists'],
    techadmin: ['dashboard', 'facilities', 'users', 'checklists', 'settings'],
    central: ['dashboard', 'missions', 'violations', 'facilities'],
    generalmanager: ['dashboard', 'missions', 'violations', 'facilities'],
    creator: ['dashboard', 'missions'],
    financial: ['dashboard', 'missions'],
    inspector: ['dashboard', 'missions', 'violations']
  }

  const [permissions, setPermissions] = useState<Record<string, string[]>>(defaultNavs)

  // Diagnostic states
  const [dbLatency, setDbLatency] = useState('24ms')
  const [cookieSize, setCookieSize] = useState('0B')
  const [activeSession, setActiveSession] = useState('مجهول')

  useEffect(() => {
    // Measure cookies size
    const size = document.cookie.length
    setCookieSize(size > 1024 ? `${(size / 1024).toFixed(2)} KB` : `${size} Bytes`)

    // Resolve active session
    const sessionMatch = document.cookie
      .split('; ')
      .find((item) => item.startsWith('maamouriyat_demo_session='))
      ?.split('=')[1]
    if (sessionMatch) {
      setActiveSession(decodeURIComponent(sessionMatch))
    } else {
      setActiveSession('مستخدم مباشر (Supabase / Live)')
    }

    // Read dynamic permissions cookie
    const matchPerms = document.cookie
      .split('; ')
      .find((item) => item.startsWith('maamouriyat_dynamic_permissions='))
      ?.split('=')[1]
    if (matchPerms) {
      try {
        const decoded = decodeURIComponent(matchPerms)
        const parsed = JSON.parse(decoded)
        if (parsed && typeof parsed === 'object') {
          const merged = { ...defaultNavs }
          Object.keys(parsed).forEach(roleKey => {
            if (Array.isArray(parsed[roleKey])) {
              merged[roleKey] = parsed[roleKey]
            }
          })
          setPermissions(merged)
        }
      } catch {}
    }

    // Simulate database ping latency
    const pingDb = async () => {
      if (!supabase) {
        setDbLatency('غير متصل')
        return
      }
      try {
        const start = performance.now()
        await supabase.from('facilities').select('count', { count: 'exact', head: true }).limit(1)
        const lat = (performance.now() - start).toFixed(0)
        setDbLatency(`${lat}ms`)
      } catch {
        setDbLatency('فشل الاتصال')
      }
    }
    pingDb()
  }, [])

  const handleTogglePermission = (roleKey: string, pageKey: string) => {
    setPermissions(prev => {
      const current = prev[roleKey] || []
      const next = current.includes(pageKey)
        ? current.filter(k => k !== pageKey)
        : [...current, pageKey]
      return { ...prev, [roleKey]: next }
    })
  }

  const handleSavePermissions = () => {
    setUnitLoading(true)
    setUnitError('')
    setUnitSuccess('')
    try {
      const serialized = encodeURIComponent(JSON.stringify(permissions))
      document.cookie = `maamouriyat_dynamic_permissions=${serialized}; path=/; max-age=604800; SameSite=Lax`
      setUnitSuccess('تم حفظ حوكمة الصلاحيات وتعديلات الصفحات بنجاح! سيتم إعادة تحميل المنظومة لتفعيل القيود الجديدة.')
      
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setUnitError('فشل حفظ الصلاحيات: ' + err.message)
    } finally {
      setUnitLoading(false)
    }
  }

  const handleResetPermissions = () => {
    if (confirm('هل أنت متأكد من رغبتك في إعادة ضبط صلاحيات المنظومة بالكامل إلى قيم المصنع الأساسية؟')) {
      setUnitLoading(true)
      setUnitError('')
      setUnitSuccess('')
      try {
        document.cookie = 'maamouriyat_dynamic_permissions=; path=/; max-age=0; SameSite=Lax'
        setPermissions(defaultNavs)
        setUnitSuccess('تمت إعادة ضبط صلاحيات المنظومة بالكامل بنجاح! جاري التحديث...')
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      } catch (err: any) {
        setUnitError('فشل إعادة ضبط الصلاحيات.')
      } finally {
        setUnitLoading(false)
      }
    }
  }

  // Sorts
  const sortedUnits = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name, 'ar')), [units])

  // --- ACTIONS ---
  async function handleAddUnit(event: React.FormEvent) {
    event.preventDefault()
    const nextName = unitName.trim()
    setUnitError('')
    setUnitSuccess('')

    if (!nextName) return
    if (units.some((u) => u.name === nextName)) {
      setUnitError('هذه الإدارة موجودة بالفعل.')
      return
    }

    setUnitLoading(true)

    if (centralStoreReady && supabase) {
      try {
        const { data, error: insertError } = await supabase
          .from('correction_units')
          .insert({ name: nextName, sort_order: units.length * 10 + 10 })
          .select('id, name')
          .single()

        if (insertError) {
          setUnitError(insertError.message)
          setUnitLoading(false)
          return
        }

        setUnits((current) => [...current, data])
      } catch (err: any) {
        setUnitError(err.message || 'فشل الاتصال بقاعدة البيانات.')
        setUnitLoading(false)
        return
      }
    } else {
      setUnits((current) => [...current, { name: nextName }])
    }

    setUnitName('')
    setUnitLoading(false)
    setUnitSuccess(centralStoreReady ? 'تم حفظ الإدارة بنجاح بالقائمة المركزية الموحدة.' : 'تمت الإضافة مؤقتاً في جلسة الاختبار الجارية.')
    setTimeout(() => setUnitSuccess(''), 5000)
  }

  async function handleRemoveUnit(unit: CorrectionUnitOption) {
    setUnitError('')
    setUnitSuccess('')

    if (centralStoreReady && supabase && unit.id) {
      setUnitLoading(true)
      const { error: updateError } = await supabase
        .from('correction_units')
        .update({ is_active: false })
        .eq('id', unit.id)
      setUnitLoading(false)

      if (updateError) {
        setUnitError(updateError.message)
        return
      }
    }

    setUnits((current) => current.filter((item) => item.name !== unit.name))
    setUnitSuccess('تم إبطال وتحديث حالة الإدارة بنجاح.')
    setTimeout(() => setUnitSuccess(''), 4000)
  }

  return (
    <div style={{ display: 'grid', gap: '20px', direction: 'rtl' }}>
      
      {/* SaaS Sub-header Section */}
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
              إعدادات تشغيل المنظومة
            </h2>
            <span style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#004d40',
              background: '#e0f2f1',
              padding: '2px 8px',
              borderRadius: '20px',
              border: '1px solid #b2dfdb',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ecc71' }} />
              قنوات التحكم نشطة
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', color: '#546e7a' }}>
            تحكم بالجهات والإدارات الرقابية المسؤولة عن معالجة وتصويب المخالفات المرصودة.
          </p>
        </div>
      </section>

      {/* Tabs Container */}
      <section style={{
        background: 'white',
        border: '1px solid var(--line)',
        padding: '12px',
        borderRadius: '16px',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Navigation pills */}
        <div style={{ display: 'flex', gap: '8px', background: '#f0f4f5', padding: '4px', borderRadius: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('units')}
            style={{
              background: activeTab === 'units' ? 'white' : 'transparent',
              color: activeTab === 'units' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'units' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <ShieldCheck size={15} />
            جهات تصحيح المخالفات ({units.length})
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            style={{
              background: activeTab === 'diagnostics' ? 'white' : 'transparent',
              color: activeTab === 'diagnostics' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'diagnostics' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <Zap size={15} />
            حالة المنظومة والسرعة
          </button>

          <button
            onClick={() => setActiveTab('permissions')}
            style={{
              background: activeTab === 'permissions' ? 'white' : 'transparent',
              color: activeTab === 'permissions' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'permissions' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <Sliders size={15} />
            صلاحيات وحوكمة الصفحات (جديد ⚡)
          </button>

          <button
            onClick={() => setActiveTab('user_permissions')}
            style={{
              background: activeTab === 'user_permissions' ? 'white' : 'transparent',
              color: activeTab === 'user_permissions' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'user_permissions' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <Users size={15} />
            صلاحيات وحوكمة الموظفين تفصيلياً (جديد 👥)
          </button>
        </div>

        {/* Database state label */}
        <span style={{
          fontSize: '11.5px',
          fontWeight: 'bold',
          color: centralStoreReady ? '#16725a' : '#b7791f',
          background: centralStoreReady ? '#eaf8f3' : '#fdf4e3',
          border: `1px solid ${centralStoreReady ? '#c7ebd8' : '#fbe3b5'}`,
          padding: '6px 12px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <Database size={14} />
          {centralStoreReady ? 'مخزن البيانات السحابي متصل' : 'وضع جلسة العمل المؤقتة'}
        </span>
      </section>

      {/* --- TAB CONTENT PANELS --- */}
      <section style={{ minHeight: '300px' }}>
        
        {/* TAB 1: CORRECTION UNITS */}
        {activeTab === 'units' && (
          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)', display: 'grid', gap: '16px' }}>
              <div>
                <strong style={{ fontSize: '14.5px', color: '#102027', display: 'block', marginBottom: '4px' }}>تسجيل جهة تصحيحية مركزية</strong>
                <p style={{ margin: 0, fontSize: '12px', color: '#546e7a', lineHeight: '1.5' }}>
                  هذه القوائم تظهر بشكل فوري وتفاعلي للمفتشين عند رصد مخالفة ميدانية بالمستشفى لتوجيهها فوراً للقسم المختص بتعديلها.
                </p>
              </div>

              {unitError && <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{unitError}</div>}
              {unitSuccess && <div style={{ background: '#eaf8f3', color: '#16725a', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{unitSuccess}</div>}

              <form onSubmit={handleAddUnit} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  onChange={(e) => setUnitName(e.target.value)}
                  placeholder="مثال: إدارة مكافحة العدوى بالمديرية"
                  required
                  style={{
                    flex: '1',
                    minWidth: '240px',
                    minHeight: '40px',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    background: '#f8fbfb',
                    outline: 'none'
                  }}
                  type="text"
                  value={unitName}
                />
                <button
                  disabled={unitLoading || !unitName.trim()}
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: 0,
                    borderRadius: '8px',
                    minHeight: '40px',
                    padding: '0 18px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  type="submit"
                >
                  <Plus size={16} />
                  إضافة جهة
                </button>
              </form>

              {/* Tag / Chip layout for correction units (high-density redesign) */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '4px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#546e7a', display: 'block', marginBottom: '12px' }}>جهات المتابعة المعتمدة حالياً ({units.length} جهات):</span>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {sortedUnits.map((unit) => (
                    <div
                      key={unit.id ?? unit.name}
                      style={{
                        background: '#f0f7f7',
                        border: '1px solid #cce3e3',
                        color: 'var(--brand)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '12.5px',
                        fontWeight: 'bold',
                        transition: 'all 0.15s'
                      }}
                    >
                      <span>{unit.name}</span>
                      <button
                        onClick={() => handleRemoveUnit(unit)}
                        style={{
                          background: 'transparent',
                          color: '#e74c3c',
                          border: 0,
                          padding: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          borderRadius: '50%',
                          transition: 'color 0.2s'
                        }}
                        title="حذف وحظر من القائمة"
                        type="button"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: SYSTEM DIAGNOSTICS */}
        {activeTab === 'diagnostics' && (
          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)', display: 'grid', gap: '16px' }}>
              <div>
                <strong style={{ fontSize: '14.5px', color: '#102027', display: 'block', marginBottom: '4px' }}>أدوات التشخيص وسرعة اتصال الخادم</strong>
                <p style={{ margin: 0, fontSize: '12px', color: '#546e7a', lineHeight: '1.5' }}>
                  مؤشرات فنية حية توضح كفاءة الاتصال البرمجي بقاعدة بيانات Supabase، وتحليل التخزين للملفات المؤقتة وجلسات الأمان النشطة.
                </p>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '14px',
                marginTop: '8px'
              }}>
                {/* Latency card */}
                <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <Zap size={32} style={{ color: '#f1c40f' }} />
                  <div>
                    <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>زمن استجابة الشبكة (Latency)</span>
                    <strong style={{ fontSize: '18px', color: '#102027', fontWeight: 'bold' }}>{dbLatency}</strong>
                  </div>
                </div>

                {/* Session Card */}
                <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <ShieldCheck size={32} style={{ color: 'var(--brand)' }} />
                  <div style={{ minWidth: 0 }}>
                    <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>جلسة التحقق النشطة</span>
                    <strong style={{ fontSize: '13.5px', color: '#102027', fontWeight: 'bold', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeSession}>{activeSession}</strong>
                  </div>
                </div>

                {/* Storage Card */}
                <div style={{ background: '#f8fbfb', border: '1px solid #cfdcde', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <Database size={32} style={{ color: '#004d40' }} />
                  <div>
                    <span style={{ fontSize: '11px', color: '#78909c', display: 'block' }}>تخزين ملفات التعريف (Cookies)</span>
                    <strong style={{ fontSize: '18px', color: '#102027', fontWeight: 'bold' }}>{cookieSize}</strong>
                  </div>
                </div>
              </div>

              {/* Diagnostic table lists */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', display: 'grid', gap: '8px' }}>
                <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#546e7a', display: 'block' }}>جاهزية جداول قاعدة البيانات (Database Schema Status):</span>
                
                <div style={{ display: 'grid', gap: '8px', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#eaf8f3', borderRadius: '8px', border: '1px solid #c7ebd8', fontSize: '12.5px' }}>
                    <strong style={{ color: '#263238' }}>جدول المستخدمين (users)</strong>
                    <span style={{ color: '#16725a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} />
                      جاهز ونشط
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#eaf8f3', borderRadius: '8px', border: '1px solid #c7ebd8', fontSize: '12.5px' }}>
                    <strong style={{ color: '#263238' }}>جدول المأموريات (missions)</strong>
                    <span style={{ color: '#16725a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} />
                      جاهز ونشط
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#eaf8f3', borderRadius: '8px', border: '1px solid #c7ebd8', fontSize: '12.5px' }}>
                    <strong style={{ color: '#263238' }}>جدول التوجيهات (correction_units)</strong>
                    <span style={{ color: '#16725a', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CheckCircle2 size={14} />
                      {centralStoreReady ? 'متصل برمجياً' : 'محاكاة محلية'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: ROLE PERMISSIONS GOVERNANCE */}
        {activeTab === 'permissions' && (
          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)', display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #eef6f6', paddingBottom: '14px' }}>
                <div>
                  <strong style={{ fontSize: '15px', color: '#102027', display: 'block', marginBottom: '4px' }}>لوحة حوكمة صلاحيات المستويات والصفحات</strong>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#546e7a', lineHeight: '1.5' }}>
                    تحكم ديناميكي كامل في إظهار وحجب صفحات المنظومة السبعة لأي مستوى إداري أو صلاحية على الفور.
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleResetPermissions}
                    style={{
                      background: '#fff1f1',
                      color: '#e74c3c',
                      border: '1px solid #f9d5d5',
                      borderRadius: '8px',
                      minHeight: '36px',
                      padding: '0 14px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    type="button"
                  >
                    <RefreshCw size={13} />
                    إعادة ضبط المصنع
                  </button>
                </div>
              </div>

              {unitError && <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{unitError}</div>}
              {unitSuccess && <div style={{ background: '#eaf8f3', color: '#16725a', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{unitSuccess}</div>}

              {/* Roles Matrix Grid */}
              <div style={{ display: 'grid', gap: '16px' }}>
                {systemRolesList.map((role) => {
                  const allowed = permissions[role.key] || []
                  
                  return (
                    <div
                      key={role.key}
                      style={{
                        background: '#f8fbfb',
                        border: '1px solid #cfdcde',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'grid',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '13.5px', color: '#102027', fontWeight: 'bold' }}>{role.name}</h4>
                          <span style={{ fontSize: '11px', color: '#78909c', display: 'block', marginTop: '2px' }}>{role.desc}</span>
                        </div>
                        <span style={{ fontSize: '10.5px', color: 'var(--brand)', background: '#e0f2f1', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                          {allowed.length} صفحات مسموحة
                        </span>
                      </div>

                      {/* Checkboxes Row */}
                      <div style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '10px 14px',
                        background: 'white',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #eef2f3'
                      }}>
                        {systemPagesList.map((page) => {
                          const isChecked = allowed.includes(page.key)
                          
                          return (
                            <label
                              key={page.key}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '12px',
                                color: isChecked ? '#102027' : '#78909c',
                                cursor: 'pointer',
                                fontWeight: isChecked ? 'bold' : 'normal',
                                userSelect: 'none'
                              }}
                              title={page.desc}
                            >
                              <input
                                checked={isChecked}
                                onChange={() => handleTogglePermission(role.key, page.key)}
                                style={{
                                  accentColor: 'var(--brand)',
                                  width: '15px',
                                  height: '15px',
                                  cursor: 'pointer'
                                }}
                                type="checkbox"
                              />
                              {page.name}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Main Save Action */}
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '8px', display: 'flex', justifyContent: 'flex-start' }}>
                <button
                  disabled={unitLoading}
                  onClick={handleSavePermissions}
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: 0,
                    borderRadius: '8px',
                    minHeight: '42px',
                    padding: '0 24px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(16, 122, 102, 0.15)'
                  }}
                  type="button"
                >
                  <Lock size={15} />
                  حفظ وتطبيق صلاحيات المنظومة بالكامل
                </button>
              </div>

            </div>
          </div>
        )}

        {/* TAB 4: PER-USER PERMISSIONS GOVERNANCE */}
        {activeTab === 'user_permissions' && (
          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', boxShadow: 'var(--shadow)', display: 'grid', gap: '16px' }}>
              <div>
                <strong style={{ fontSize: '15px', color: '#102027', display: 'block', marginBottom: '4px' }}>بوابة الحوكمة وتخصيص صلاحيات الموظفين تفصيلياً 👥</strong>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#546e7a', lineHeight: '1.5' }}>
                  ابحث عن أي موظف بالاسم، أو رقم الهاتف، أو البريد الإلكتروني، أو الرقم القومي لتخصيص صلاحيات استثنائية لصفحاته بمعزل عن مستواه الوظيفي.
                </p>
              </div>

              {/* Search Bar */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderBottom: '1px solid var(--line)', paddingBottom: '16px' }}>
                <input
                  onChange={(e) => {
                    setUserSearchQuery(e.target.value)
                    setSelectedUser(null)
                  }}
                  placeholder="🔍 ابحث عن الموظف (الاسم، الهاتف، الايميل، أو الرقم القومي)..."
                  style={{
                    flex: '1',
                    minWidth: '280px',
                    minHeight: '42px',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    padding: '0 12px',
                    fontSize: '13.5px',
                    background: '#f8fbfb',
                    outline: 'none'
                  }}
                  type="text"
                  value={userSearchQuery}
                />
              </div>

              {/* Search Results List */}
              {userSearchQuery.trim() && !selectedUser && (
                <div style={{ display: 'grid', gap: '10px', maxHeight: '200px', overflowY: 'auto', background: '#f8fbfb', border: '1px solid var(--line)', borderRadius: '8px', padding: '10px' }}>
                  {filteredUsers.map(user => {
                    const hasOverride = userOverrides[user.email.toLowerCase()] !== undefined
                    return (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUser(user)}
                        style={{
                          background: 'white',
                          border: '1px solid var(--line)',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--brand)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--line)'}
                      >
                        <div>
                          <strong style={{ fontSize: '13px', color: '#102027', display: 'block' }}>{user.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{user.jobTitle} | 📧 {user.email} | 📞 {user.phone}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {hasOverride ? (
                            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#e67e22', background: '#fef5e7', padding: '2px 8px', borderRadius: '12px' }}>
                              ⚠️ صلاحية مخصصة استثنائياً
                            </span>
                          ) : (
                            <span style={{ fontSize: '9px', fontWeight: 'bold', color: '#27ae60', background: '#eafaf1', padding: '2px 8px', borderRadius: '12px' }}>
                              ✓ يتبع الدور الافتراضي
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: 'var(--brand)', fontWeight: 'bold' }}>تعديل ⚙️</span>
                        </div>
                      </div>
                    )
                  })}
                  {filteredUsers.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '14px', fontSize: '12px' }}>
                      لا توجد نتائج مطابقة لبحثك.
                    </div>
                  )}
                </div>
              )}

              {/* Expanded User permission configuration panel */}
              {selectedUser && (
                <div style={{
                  background: '#fcfefe',
                  border: '2px solid var(--brand)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'grid',
                  gap: '16px',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  {/* User Meta Summary */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px dashed #cfdcde', paddingBottom: '14px' }}>
                    <div>
                      <span style={{ fontSize: '11.5px', color: 'var(--brand)', fontWeight: 'bold', display: 'block' }}>{selectedUser.jobTitle}</span>
                      <h4 style={{ margin: '2px 0 0 0', fontSize: '16px', color: '#102027', fontWeight: 'bold' }}>{selectedUser.name}</h4>
                      <p style={{ margin: '4px 0 0 0', fontSize: '11.5px', color: '#78909c' }}>
                        📧 {selectedUser.email} | 📞 {selectedUser.phone} | 🪪 رقم قومي/كود مالي: {selectedUser.nationalId}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span style={{ fontSize: '10.5px', color: '#004d40', background: '#e0f2f1', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                        الدور الافتراضي: {selectedUser.role}
                      </span>
                      {userOverrides[selectedUser.email.toLowerCase()] !== undefined ? (
                        <span style={{ fontSize: '10px', color: '#d35400', background: '#fdf2e9', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                          حالة الاستثناء: ⚙️ مخصص ونشط حالياً
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', color: '#27ae60', background: '#e8f8f5', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                          حالة الاستثناء: غير مخصص (يخضع لدور الموظف)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Overrides Success/Error Messages */}
                  {unitError && <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{unitError}</div>}
                  {unitSuccess && <div style={{ background: '#eaf8f3', color: '#16725a', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{unitSuccess}</div>}

                  {/* Pages Checkboxes for individual user */}
                  <div>
                    <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#546e7a', display: 'block', marginBottom: '10px' }}>
                      حدد الصفحات التي يُسمح لهذا الموظف رؤيتها حصراً (أو احجب صفحاته كلياً):
                    </span>

                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '12px',
                      background: 'white',
                      padding: '16px',
                      borderRadius: '8px',
                      border: '1px solid #eef2f3'
                    }}>
                      {systemPagesList.map((page) => {
                        const userKey = selectedUser.email.toLowerCase()
                        const allowed = userOverrides[userKey] !== undefined
                          ? userOverrides[userKey]
                          : defaultNavs[selectedUser.role as DemoRole] || []
                        const isChecked = allowed.includes(page.key)

                        return (
                          <label
                            key={page.key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              fontSize: '12.5px',
                              color: isChecked ? '#102027' : '#78909c',
                              cursor: 'pointer',
                              fontWeight: isChecked ? 'bold' : 'normal',
                              padding: '6px',
                              borderRadius: '4px',
                              background: isChecked ? '#f0fcf9' : 'transparent',
                              transition: 'all 0.1s'
                            }}
                            title={page.desc}
                          >
                            <input
                              checked={isChecked}
                              onChange={() => handleToggleUserPermission(page.key)}
                              style={{
                                accentColor: 'var(--brand)',
                                width: '15px',
                                height: '15px',
                                cursor: 'pointer'
                              }}
                              type="checkbox"
                            />
                            {page.name}
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Actions for Override configuration */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderTop: '1px dashed #cfdcde', paddingTop: '16px', marginTop: '6px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        disabled={unitLoading}
                        onClick={handleSaveUserOverrides}
                        style={{
                          background: 'var(--brand)',
                          color: 'white',
                          border: 0,
                          borderRadius: '8px',
                          minHeight: '40px',
                          padding: '0 20px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '12.5px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 4px 10px rgba(16, 122, 102, 0.15)'
                        }}
                        type="button"
                      >
                        <Lock size={14} />
                        حفظ صلاحيات الموظف المخصصة
                      </button>

                      <button
                        onClick={() => setSelectedUser(null)}
                        style={{
                          background: '#f1f5f7',
                          color: '#546e7a',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          minHeight: '40px',
                          padding: '0 16px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '12.5px'
                        }}
                        type="button"
                      >
                        إلغاء
                      </button>
                    </div>

                    {userOverrides[selectedUser.email.toLowerCase()] !== undefined && (
                      <button
                        disabled={unitLoading}
                        onClick={handleClearUserOverrides}
                        style={{
                          background: '#fff1f1',
                          color: '#e74c3c',
                          border: '1px solid #f9d5d5',
                          borderRadius: '8px',
                          minHeight: '40px',
                          padding: '0 16px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                        type="button"
                      >
                        <RefreshCw size={13} />
                        إلغاء التخصيص والعودة لقيم الدور الافتراضية
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Informative block when no user selected */}
              {!selectedUser && !userSearchQuery.trim() && (
                <div style={{
                  border: '1px dashed #cfdcde',
                  borderRadius: '12px',
                  padding: '40px 16px',
                  textAlign: 'center',
                  color: '#90a4ae'
                }}>
                  <Users size={32} style={{ color: '#cfdcde', marginBottom: '10px' }} />
                  <strong style={{ display: 'block', fontSize: '13.5px', color: '#546e7a' }}>ابدأ بالبحث عن موظف معين</strong>
                  <span style={{ fontSize: '12px', color: '#90a4ae', marginTop: '4px', display: 'block' }}>
                    اكتب الاسم، أو رقم الهاتف، أو البريد الإلكتروني، أو الرقم القومي في شريط البحث بالأعلى للتحكم الفردي الدقيق.
                  </span>
                </div>
              )}

            </div>
          </div>
        )}

      </section>

    </div>
  )
}
