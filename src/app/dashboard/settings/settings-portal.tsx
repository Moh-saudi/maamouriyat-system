'use client'

import { useMemo, useState, useEffect } from 'react'
import { Plus, Trash2, ShieldCheck, Database, Zap, CheckCircle2, Sliders, RefreshCw, Lock, Check, Users, Building2, MapPin, CheckSquare, Layers, Edit, Eye, Filter, Search, X } from 'lucide-react'
import { type CorrectionUnitOption } from '@/lib/correction-units'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'
import { type UserRole } from '@/lib/roles'

export function SettingsPortal({
  initialUnits,
  initialOrganizations = [],
  centralStoreReady,
}: {
  initialUnits: CorrectionUnitOption[]
  initialOrganizations?: any[]
  centralStoreReady: boolean
}) {
  const supabase = createBrowserSupabaseClient()
  const [activeTab, setActiveTab] = useState<'org_structure' | 'units' | 'diagnostics' | 'permissions' | 'user_permissions'>('org_structure')
  
  // State for Correction Units
  const [units, setUnits] = useState<CorrectionUnitOption[]>(initialUnits)
  const [unitName, setUnitName] = useState('')
  const [unitError, setUnitError] = useState('')
  const [unitSuccess, setUnitSuccess] = useState('')
  const [unitLoading, setUnitLoading] = useState(false)

  // ── State for Organizations & Sub-Units
  const [orgs, setOrgs] = useState<any[]>(initialOrganizations)
  const [orgSearchQuery, setOrgSearchQuery] = useState('')
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<'all' | 'ministry' | 'sectors' | 'directorates' | 'health_admins' | 'sub_units'>('all')
  const [showAddSubUnitModal, setShowAddSubUnitModal] = useState(false)
  const [editingOrg, setEditingOrg] = useState<any | null>(null)

  // Add Sub-Unit Form
  const [subUnitName, setSubUnitName] = useState('')
  const [subUnitCode, setSubUnitCode] = useState('')
  const [subUnitParentId, setSubUnitParentId] = useState('')
  const [subUnitLevel, setSubUnitLevel] = useState(4)
  const [subUnitLevelLabel, setSubUnitLevelLabel] = useState('إدارة عامة نوعية')
  const [subUnitGov, setSubUnitGov] = useState('')
  const [subUnitHealthAdmin, setSubUnitHealthAdmin] = useState('')
  const [subUnitCanIssueMissions, setSubUnitCanIssueMissions] = useState(true)
  const [subUnitCanApproveMissions, setSubUnitCanApproveMissions] = useState(true)
  const [subUnitCanViewGov, setSubUnitCanViewGov] = useState(false)
  const [subUnitCanViewSector, setSubUnitCanViewSector] = useState(false)
  const [subUnitLoading, setSubUnitLoading] = useState(false)
  const [subUnitError, setSubUnitError] = useState('')
  const [subUnitSuccess, setSubUnitSuccess] = useState('')

  // Handle Parent Org Change in Modal to auto-fill Governorate / Health Admin
  const handleParentOrgChange = (parentId: string) => {
    setSubUnitParentId(parentId)
    const parent = orgs.find(o => o.id === parentId)
    if (parent) {
      if (parent.governorate) setSubUnitGov(parent.governorate)
      if (parent.health_admin) setSubUnitHealthAdmin(parent.health_admin)
      if (parent.level === 2) {
        setSubUnitLevel(3)
        setSubUnitLevelLabel('إدارة مركزية بالقطاع')
      } else if (parent.level === 3) {
        setSubUnitLevel(4)
        setSubUnitLevelLabel('إدارة عامة نوعية')
      } else if (parent.level === 5) {
        setSubUnitLevel(6)
        setSubUnitLevelLabel('إدارة نوعية / صحية بالمديرية')
      } else {
        setSubUnitLevel(7)
        setSubUnitLevelLabel('قسم / وحدة تفتيش فرعية')
      }
    }
  }

  // Create Sub-Unit
  const handleCreateSubUnit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubUnitLoading(true)
    setSubUnitError('')
    setSubUnitSuccess('')

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: subUnitName,
          code: subUnitCode || undefined,
          parent_id: subUnitParentId,
          level: subUnitLevel,
          level_label: subUnitLevelLabel,
          governorate: subUnitGov || undefined,
          health_admin: subUnitHealthAdmin || undefined,
          can_issue_missions: subUnitCanIssueMissions,
          can_approve_missions: subUnitCanApproveMissions,
          can_view_all_governorate: subUnitCanViewGov,
          can_view_sector_facilities: subUnitCanViewSector,
        }),
      })

      const res = await response.json()
      if (!response.ok || res.error) {
        throw new Error(res.error || 'فشل إنشاء الوحدة الفرعية')
      }

      if (res.data) {
        setOrgs(prev => [res.data, ...prev])
        setSubUnitSuccess(res.message || 'تمت إضافة الوحدة وتفعيل صلاحياتها بنجاح.')
        setTimeout(() => {
          setShowAddSubUnitModal(false)
          setSubUnitName('')
          setSubUnitCode('')
          setSubUnitParentId('')
          setSubUnitError('')
          setSubUnitSuccess('')
        }, 1500)
      }
    } catch (err: any) {
      setSubUnitError(err.message || 'حدث خطأ أثناء حفظ الوحدة الفرعية')
    } finally {
      setSubUnitLoading(false)
    }
  }

  // Update Org Permissions
  const handleUpdateOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingOrg) return
    setSubUnitLoading(true)
    setSubUnitError('')
    setSubUnitSuccess('')

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOrg.id,
          name: editingOrg.name,
          code: editingOrg.code,
          can_issue_missions: editingOrg.can_issue_missions,
          can_approve_missions: editingOrg.can_approve_missions,
          can_view_all_governorate: editingOrg.can_view_all_governorate,
          can_view_sector_facilities: editingOrg.can_view_sector_facilities,
          is_active: editingOrg.is_active,
        }),
      })

      const res = await response.json()
      if (!response.ok || res.error) {
        throw new Error(res.error || 'فشل تحديث بيانات الوحدة')
      }

      if (res.data) {
        setOrgs(prev => prev.map(o => o.id === editingOrg.id ? res.data : o))
        setSubUnitSuccess(res.message || 'تم تحديث الصلاحيات بنجاح.')
        setTimeout(() => {
          setEditingOrg(null)
          setSubUnitError('')
          setSubUnitSuccess('')
        }, 1200)
      }
    } catch (err: any) {
      setSubUnitError(err.message || 'حدث خطأ أثناء تحديث بيانات الوحدة')
    } finally {
      setSubUnitLoading(false)
    }
  }

  // Toggle single permission fast
  const handleFastToggleOrgPerm = async (orgId: string, permKey: 'can_issue_missions' | 'can_approve_missions' | 'can_view_all_governorate' | 'can_view_sector_facilities') => {
    const target = orgs.find(o => o.id === orgId)
    if (!target) return
    const nextVal = !target[permKey]

    // Optimistic UI update
    setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, [permKey]: nextVal } : o))

    try {
      await fetch('/api/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: orgId,
          [permKey]: nextVal,
        }),
      })
    } catch (err) {
      console.error('Failed to toggle org permission:', err)
    }
  }

  // Filtered organizations
  const filteredOrgs = useMemo(() => {
    return orgs.filter(o => {
      // Filter by level tab
      if (selectedOrgFilter === 'ministry' && o.level !== 1) return false
      if (selectedOrgFilter === 'sectors' && o.level !== 2) return false
      if (selectedOrgFilter === 'directorates' && o.level !== 5) return false
      if (selectedOrgFilter === 'health_admins' && o.level !== 6) return false
      if (selectedOrgFilter === 'sub_units' && (o.level === 1 || o.level === 2 || o.level === 5)) return false

      // Search Query
      if (orgSearchQuery.trim()) {
        const q = orgSearchQuery.trim().toLowerCase()
        return (
          (o.name || '').toLowerCase().includes(q) ||
          (o.code || '').toLowerCase().includes(q) ||
          (o.governorate || '').toLowerCase().includes(q) ||
          (o.health_admin || '').toLowerCase().includes(q) ||
          (o.level_label || '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [orgs, selectedOrgFilter, orgSearchQuery])

  // Fallback users list (shown if DB users not yet loaded)
  const fallbackUsersList = [
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
            jobTitle: u.job_title || 'موظف بالقطاع',
            isDatabaseUser: true,
          }))
          setDbUsers(mapped)
        }
      }
    }
    fetchUsers()
  }, [])

  // Load user overrides from the central database.
  useEffect(() => {
    async function loadUserOverrides() {
      if (!supabase) return
      try {
        const [{ data: permissions, error: permissionsError }, { data: users, error: usersError }] = await Promise.all([
          supabase.from('user_permissions').select('user_id, allowed_pages'),
          supabase.from('users').select('id, email'),
        ])

        if (permissionsError || usersError) {
          return
        }

        const emailById = new Map((users ?? []).map((user) => [user.id, user.email]))
        const overrides: Record<string, string[]> = {}
        ;(permissions ?? []).forEach((permission) => {
          const email = emailById.get(permission.user_id)
          if (email && Array.isArray(permission.allowed_pages)) {
            overrides[email.toLowerCase()] = permission.allowed_pages
          }
        })
        setUserOverrides(overrides)
      } catch {}
    }
    loadUserOverrides()
  }, [supabase])

  // One-time migration from the old browser-local cookie if it exists.
  useEffect(() => {
    async function migrateCookieOverrides() {
      if (!supabase || dbUsers.length === 0) return
      const matchPerms = document.cookie
        .split('; ')
        .find((item) => item.startsWith('maamouriyat_user_permissions='))
        ?.split('=')[1]
      if (!matchPerms) return

      try {
        const parsed = JSON.parse(decodeURIComponent(matchPerms))
        if (!parsed || typeof parsed !== 'object') return

        const rows = Object.entries(parsed)
          .map(([email, allowed_pages]) => {
            const user = dbUsers.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase())
            return user && Array.isArray(allowed_pages)
              ? { user_id: user.id, allowed_pages }
              : null
          })
          .filter(Boolean)

        if (rows.length > 0) {
          const { error } = await supabase.from('user_permissions').upsert(rows as any[], { onConflict: 'user_id' })
          if (!error) {
            document.cookie = 'maamouriyat_user_permissions=; path=/; max-age=0; SameSite=Lax'
            setUserOverrides((current) => ({ ...current, ...(parsed as Record<string, string[]>) }))
          }
        }
      } catch {}
    }
    migrateCookieOverrides()
  }, [dbUsers, supabase])

  const allUsers = useMemo(() => {
    const list = [...fallbackUsersList]
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
      const current = prev[userKey] !== undefined ? prev[userKey] : defaultNavs[selectedUser.role as UserRole] || []
      const next = current.includes(pageKey)
        ? current.filter(k => k !== pageKey)
        : [...current, pageKey]
      return { ...prev, [userKey]: next }
    })
  }

  // Save User Overrides
  const handleSaveUserOverrides = async () => {
    if (!selectedUser) return
    setUnitLoading(true)
    setUnitError('')
    setUnitSuccess('')
    try {
      if (!supabase || !selectedUser.isDatabaseUser) {
        throw new Error('يجب اختيار موظف مسجل فعلياً في قاعدة البيانات.')
      }

      const userKey = selectedUser.email.toLowerCase()
      const allowedPages = userOverrides[userKey] ?? defaultNavs[selectedUser.role as UserRole] ?? []
      const { error } = await supabase
        .from('user_permissions')
        .upsert({ user_id: selectedUser.id, allowed_pages: allowedPages }, { onConflict: 'user_id' })

      if (error) throw error

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
  const handleClearUserOverrides = async () => {
    if (!selectedUser) return
    const userKey = selectedUser.email.toLowerCase()
    setUnitLoading(true)
    setUnitError('')
    setUnitSuccess('')
    try {
      const copy = { ...userOverrides }
      delete copy[userKey]
      setUserOverrides(copy)
      if (!supabase || !selectedUser.isDatabaseUser) {
        throw new Error('يجب اختيار موظف مسجل فعلياً في قاعدة البيانات.')
      }
      const { error } = await supabase.from('user_permissions').delete().eq('user_id', selectedUser.id)
      if (error) throw error
      setUnitSuccess(`تمت إعادة ضبط صلاحيات الموظف (${selectedUser?.name}) للقيم الافتراضية بنجاح!`)
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setUnitError('فشل إعادة ضبط الصلاحيات: ' + (err.message || ''))
    } finally {
      setUnitLoading(false)
    }
  }

  // Dynamic Permissions Roles & Pages Definition
  const systemRolesList = [
    { key: 'superadmin', name: 'سوبر أدمن (مدير عام المنظومة)', desc: 'أعلى سلطة إدارية وحوكمية، يمتلك الصلاحية الكاملة لتكليف المأموريات واعتماد التقارير وإجراء المراجعات.' },
    { key: 'techadmin', name: 'الدعم الفني (مدير الإدارة التقنية)', desc: 'المسؤول التقني عن حوكمة وإدارة البنية الأساسية، إدارة المستخدمين والمنشآت وتصميم قوالب التقييم والتشخيصات الفنية.' },
    { key: 'central', name: 'رئيس إدارة مركزية', desc: 'صلاحيات حوكمية وإشرافية عليا لمتابعة مستويات التغطية الميدانية في المحافظات واعتماد التقارير العامة.' },
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
    setActiveSession('مستخدم مباشر (Supabase / Live)')

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
            تحكم بالجهات والإدارات الحوكمية المسؤولة عن معالجة وتصويب المخالفات المرصودة.
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
            onClick={() => setActiveTab('org_structure')}
            style={{
              background: activeTab === 'org_structure' ? 'white' : 'transparent',
              color: activeTab === 'org_structure' ? 'var(--brand)' : '#546e7a',
              border: 0,
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: activeTab === 'org_structure' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            type="button"
          >
            <Building2 size={15} />
            الهيكل والوحدات الفرعية ({orgs.length})
          </button>

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

        {/* TAB 0: ORGANIZATIONS & SUB-UNITS MANAGEMENT */}
        {activeTab === 'org_structure' && (
          <div style={{ display: 'grid', gap: '20px', animation: 'fadeIn 0.2s ease-out' }}>
            
            {/* 1. Header & Actions Bar */}
            <div style={{
              background: 'white',
              border: '1px solid var(--line)',
              borderRadius: '16px',
              padding: '20px',
              boxShadow: 'var(--shadow)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <strong style={{ fontSize: '15px', color: '#102027', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={20} style={{ color: 'var(--brand)' }} />
                  إدارة الهيكل التنظيمي والوحدات والإدارات الفرعية (Sub-Units)
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#546e7a' }}>
                  إضافة إدارات وأقسام فرعية تحت القطاعات أو مديريات المحافظات مع ضبط صلاحيات التكليف، الاعتماد، والتغطية الجغرافية.
                </p>
              </div>

              <button
                onClick={() => {
                  setSubUnitError('')
                  setSubUnitSuccess('')
                  setShowAddSubUnitModal(true)
                }}
                style={{
                  background: 'var(--brand)',
                  color: 'white',
                  border: 0,
                  borderRadius: '8px',
                  minHeight: '40px',
                  padding: '0 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 3px 10px rgba(16, 122, 102, 0.15)'
                }}
                type="button"
              >
                <Plus size={17} />
                إضافة وحدة / إدارة فرعية جديدة
              </button>
            </div>

            {/* 2. Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #dce7e8', display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#546e7a', fontWeight: 'bold' }}>🏛️ ديوان الوزارة والقطاعات</span>
                <strong style={{ fontSize: '20px', color: '#102027' }}>
                  {orgs.filter(o => o.level <= 2).length} قطاع وهيئة
                </strong>
              </div>
              <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #dce7e8', display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#546e7a', fontWeight: 'bold' }}>📍 مديريات المحافظات</span>
                <strong style={{ fontSize: '20px', color: '#0277bd' }}>
                  {orgs.filter(o => o.level === 5).length} مديرية صحية
                </strong>
              </div>
              <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #dce7e8', display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#546e7a', fontWeight: 'bold' }}>🏥 الإدارات الصحية والمراكز</span>
                <strong style={{ fontSize: '20px', color: '#00796b' }}>
                  {orgs.filter(o => o.level === 6).length} إدارة صحية
                </strong>
              </div>
              <div style={{ background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #dce7e8', display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: '#546e7a', fontWeight: 'bold' }}>⚙️ الإدارات والأقسام الفرعية</span>
                <strong style={{ fontSize: '20px', color: '#7b1fa2' }}>
                  {orgs.filter(o => o.level === 3 || o.level === 4 || o.level === 7).length} وحدة فرعية
                </strong>
              </div>
            </div>

            {/* 3. Search and Type Filter */}
            <div style={{
              background: 'white',
              border: '1px solid var(--line)',
              padding: '12px 16px',
              borderRadius: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '340px' }}>
                <Search size={16} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#78909c' }} />
                <input
                  onChange={(e) => setOrgSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم، الكود، المحافظة أو الإدارة..."
                  style={{
                    width: '100%',
                    minHeight: '38px',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    padding: '0 38px 0 10px',
                    fontSize: '13px',
                    background: '#f8fbfb',
                    outline: 'none'
                  }}
                  type="text"
                  value={orgSearchQuery}
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedOrgFilter('all')}
                  style={{
                    background: selectedOrgFilter === 'all' ? 'var(--brand)' : '#f0f4f5',
                    color: selectedOrgFilter === 'all' ? 'white' : '#546e7a',
                    border: 0,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  الكل ({orgs.length})
                </button>
                <button
                  onClick={() => setSelectedOrgFilter('sectors')}
                  style={{
                    background: selectedOrgFilter === 'sectors' ? '#0d47a1' : '#f0f4f5',
                    color: selectedOrgFilter === 'sectors' ? 'white' : '#546e7a',
                    border: 0,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  القطاعات المركزية ({orgs.filter(o => o.level === 2).length})
                </button>
                <button
                  onClick={() => setSelectedOrgFilter('directorates')}
                  style={{
                    background: selectedOrgFilter === 'directorates' ? '#0277bd' : '#f0f4f5',
                    color: selectedOrgFilter === 'directorates' ? 'white' : '#546e7a',
                    border: 0,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  المديريات بالمحافظات ({orgs.filter(o => o.level === 5).length})
                </button>
                <button
                  onClick={() => setSelectedOrgFilter('sub_units')}
                  style={{
                    background: selectedOrgFilter === 'sub_units' ? '#7b1fa2' : '#f0f4f5',
                    color: selectedOrgFilter === 'sub_units' ? 'white' : '#546e7a',
                    border: 0,
                    borderRadius: '6px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  الوحدات والإدارات الفرعية ({orgs.filter(o => o.level === 3 || o.level === 4 || o.level === 7).length})
                </button>
              </div>
            </div>

            {/* 4. Organizations Table with Permissions Controls */}
            <div style={{ background: 'white', border: '1px solid var(--line)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ background: '#f8fbfb', borderBottom: '1px solid #e2ecee', color: '#455a64' }}>
                      <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>اسم الجهة / الإدارة الفرعية</th>
                      <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>المستوى التنظيمي</th>
                      <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>الجهة الأم التابعة لها</th>
                      <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>النطاق الجغرافي</th>
                      <th style={{ padding: '14px 16px', fontWeight: 'bold', textAlign: 'center' }}>صلاحيات التكليف والحوكمة</th>
                      <th style={{ padding: '14px 16px', fontWeight: 'bold', textAlign: 'center' }}>الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrgs.slice(0, 100).map((org) => {
                      const parent = orgs.find(p => p.id === org.parent_id)
                      let levelBadgeColor = '#e0f2f1'
                      let levelTextColor = '#004d40'
                      let levelIcon = '🏢'
                      if (org.level === 1) { levelBadgeColor = '#ffebee'; levelTextColor = '#d32f2f'; levelIcon = '🏛️'; }
                      else if (org.level === 2) { levelBadgeColor = '#e3f2fd'; levelTextColor = '#0d47a1'; levelIcon = '🏢'; }
                      else if (org.level === 5) { levelBadgeColor = '#e1f5fe'; levelTextColor = '#0277bd'; levelIcon = '📍'; }
                      else if (org.level === 6) { levelBadgeColor = '#e8f5e9'; levelTextColor = '#2e7d32'; levelIcon = '🏥'; }
                      else if (org.level === 3 || org.level === 4) { levelBadgeColor = '#f3e5f5'; levelTextColor = '#7b1fa2'; levelIcon = '⚙️'; }

                      return (
                        <tr key={org.id} style={{ borderBottom: '1px solid #eef3f4', transition: 'background 0.15s' }}>
                          
                          {/* Name & Code */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '16px' }}>{levelIcon}</span>
                              <div>
                                <strong style={{ color: '#102027', display: 'block', fontSize: '13.5px' }}>{org.name}</strong>
                                <span style={{ fontSize: '11px', color: '#78909c' }}>كود: {org.code || org.id.slice(0, 8)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Level Badge */}
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{
                              background: levelBadgeColor,
                              color: levelTextColor,
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11.5px',
                              fontWeight: 'bold',
                              display: 'inline-block'
                            }}>
                              {org.level_label || `مستوى ${org.level}`}
                            </span>
                          </td>

                          {/* Parent */}
                          <td style={{ padding: '14px 16px', color: '#546e7a' }}>
                            {parent ? (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                <span>↳</span>
                                <strong>{parent.name}</strong>
                              </span>
                            ) : (
                              <span style={{ fontSize: '11.5px', color: '#90a4ae' }}>جهة رئيسية (مستوى أعلى)</span>
                            )}
                          </td>

                          {/* Location */}
                          <td style={{ padding: '14px 16px', color: '#546e7a', fontSize: '12.5px' }}>
                            {org.governorate ? (
                              <span>{org.governorate} {org.health_admin ? `• ${org.health_admin}` : ''}</span>
                            ) : (
                              <span style={{ color: '#90a4ae' }}>ديوان عام / على مستوى الجمهورية</span>
                            )}
                          </td>

                          {/* Permissions Flags */}
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                              
                              {/* 1. can_issue_missions */}
                              <button
                                onClick={() => handleFastToggleOrgPerm(org.id, 'can_issue_missions')}
                                title="صلاحية إصدار وتكليف المأموريات (اضغط للتبديل)"
                                style={{
                                  background: org.can_issue_missions ? '#e8f5e9' : '#f5f5f5',
                                  color: org.can_issue_missions ? '#2e7d32' : '#9e9e9e',
                                  border: `1px solid ${org.can_issue_missions ? '#c8e6c9' : '#e0e0e0'}`,
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                type="button"
                              >
                                📝 تكليف مأمورية
                              </button>

                              {/* 2. can_approve_missions */}
                              <button
                                onClick={() => handleFastToggleOrgPerm(org.id, 'can_approve_missions')}
                                title="صلاحية اعتماد المأموريات والمخالفات (اضغط للتبديل)"
                                style={{
                                  background: org.can_approve_missions ? '#e3f2fd' : '#f5f5f5',
                                  color: org.can_approve_missions ? '#1565c0' : '#9e9e9e',
                                  border: `1px solid ${org.can_approve_missions ? '#bbdefb' : '#e0e0e0'}`,
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                type="button"
                              >
                                ✍️ اعتماد تقارير
                              </button>

                              {/* 3. can_view_all_governorate */}
                              <button
                                onClick={() => handleFastToggleOrgPerm(org.id, 'can_view_all_governorate')}
                                title="صلاحية رؤية منشآت المحافظة كاملة (اضغط للتبديل)"
                                style={{
                                  background: org.can_view_all_governorate ? '#fff3e0' : '#f5f5f5',
                                  color: org.can_view_all_governorate ? '#e65100' : '#9e9e9e',
                                  border: `1px solid ${org.can_view_all_governorate ? '#ffe0b2' : '#e0e0e0'}`,
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                type="button"
                              >
                                🗺️ كل المحافظة
                              </button>

                              {/* 4. can_view_sector_facilities */}
                              <button
                                onClick={() => handleFastToggleOrgPerm(org.id, 'can_view_sector_facilities')}
                                title="صلاحية رؤية منشآت القطاع بالجمهورية (اضغط للتبديل)"
                                style={{
                                  background: org.can_view_sector_facilities ? '#f3e5f5' : '#f5f5f5',
                                  color: org.can_view_sector_facilities ? '#7b1fa2' : '#9e9e9e',
                                  border: `1px solid ${org.can_view_sector_facilities ? '#e1bee7' : '#e0e0e0'}`,
                                  borderRadius: '6px',
                                  padding: '3px 8px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                                type="button"
                              >
                                🏥 كل القطاع
                              </button>

                            </div>
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                setEditingOrg(org)
                                setSubUnitError('')
                                setSubUnitSuccess('')
                              }}
                              style={{
                                background: '#f0f4f5',
                                border: '1px solid #cfdcde',
                                borderRadius: '6px',
                                padding: '5px 10px',
                                fontSize: '11.5px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                color: '#37474f',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              type="button"
                            >
                              <Edit size={13} />
                              تعديل
                            </button>
                          </td>

                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              
              {filteredOrgs.length > 100 && (
                <div style={{ padding: '12px 16px', background: '#f8fbfb', textAlign: 'center', fontSize: '12px', color: '#78909c' }}>
                  يتم عرض أول 100 جهة من إجمالي {filteredOrgs.length} جهة مطابقة. استخدم شريط البحث أعلاه لتصفية جهة محددة.
                </div>
              )}
            </div>

            {/* 5. ADD SUB-UNIT MODAL */}
            {showAddSubUnitModal && (
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(10, 24, 31, 0.62)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '24px 16px',
                zIndex: 999,
                overflowY: 'auto'
              }}>
                <form
                  onSubmit={handleCreateSubUnit}
                  style={{
                    background: 'white',
                    border: '1px solid var(--line)',
                    borderRadius: '16px',
                    padding: '24px',
                    maxWidth: '680px',
                    width: '100%',
                    display: 'grid',
                    gap: '16px',
                    boxShadow: '0 18px 52px rgba(10,24,31,0.24)',
                    maxHeight: '92vh',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e7eff1', paddingBottom: '14px' }}>
                    <strong style={{ fontSize: '16px', color: '#102027', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={22} style={{ color: 'var(--brand)' }} />
                      إضافة وتسكين وحدة / إدارة فرعية جديدة (Add Sub-Unit)
                    </strong>
                    <button
                      onClick={() => setShowAddSubUnitModal(false)}
                      style={{ background: '#f3f7f8', border: 0, borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      type="button"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {subUnitError && <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{subUnitError}</div>}
                  {subUnitSuccess && <div style={{ background: '#eaf8f3', color: '#16725a', padding: '12px', borderRadius: '8px', fontSize: '12.5px', fontWeight: 'bold' }}>{subUnitSuccess}</div>}

                  <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', fontWeight: 'bold', color: '#37474f' }}>
                    الجهة أو القطاع الرئيسي التابع له (الجهة الأم) *
                    <select
                      onChange={(e) => handleParentOrgChange(e.target.value)}
                      required
                      style={{
                        background: '#f8fbfb',
                        border: '1px solid #cfdcde',
                        borderRadius: '8px',
                        minHeight: '42px',
                        padding: '0 10px',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                      value={subUnitParentId}
                    >
                      <option value="">-- اختر الجهة أو القطاع التابع له (495 جهة مسجلة) --</option>
                      {orgs.map((org) => {
                        let badge = '🏢'
                        if (org.level === 1) badge = '🏛️'
                        else if (org.level === 2) badge = '🏢'
                        else if (org.level === 5) badge = '📍'
                        else if (org.level === 6) badge = '🏥'
                        return (
                          <option key={org.id} value={org.id}>
                            {badge} {org.name} {org.governorate ? `(${org.governorate})` : ''} — [{org.level_label || `مستوى ${org.level}`}]
                          </option>
                        )
                      })}
                    </select>
                  </label>

                  <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', fontWeight: 'bold', color: '#37474f' }}>
                    اسم الإدارة أو الوحدة الفرعية الجديدة *
                    <input
                      onChange={(e) => setSubUnitName(e.target.value)}
                      placeholder="مثال: إدارة الطوارئ والرعاية العاجلة / قسم التفتيش الميداني"
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
                      value={subUnitName}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                    <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', fontWeight: 'bold', color: '#37474f' }}>
                      المستوى التنظيمي للوحدة *
                      <select
                        onChange={(e) => {
                          const lvl = parseInt(e.target.value)
                          setSubUnitLevel(lvl)
                          if (lvl === 3) setSubUnitLevelLabel('إدارة مركزية')
                          else if (lvl === 4) setSubUnitLevelLabel('إدارة عامة نوعية')
                          else if (lvl === 6) setSubUnitLevelLabel('إدارة نوعية / صحية بالمديرية')
                          else if (lvl === 7) setSubUnitLevelLabel('قسم / وحدة تفتيش فرعية')
                        }}
                        style={{
                          background: '#f8fbfb',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          minHeight: '40px',
                          padding: '0 8px',
                          fontSize: '13px',
                          outline: 'none'
                        }}
                        value={subUnitLevel}
                      >
                        <option value={3}>مستوى 3 — إدارة مركزية بالقطاع</option>
                        <option value={4}>مستوى 4 — إدارة عامة نوعية بالقطاع</option>
                        <option value={6}>مستوى 6 — إدارة نوعية / صحية بالمديرية</option>
                        <option value={7}>مستوى 7 — قسم / وحدة تفتيش فرعية</option>
                      </select>
                    </label>

                    <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', fontWeight: 'bold', color: '#37474f' }}>
                      كود الوحدة التنظيمية (اختياري)
                      <input
                        onChange={(e) => setSubUnitCode(e.target.value)}
                        placeholder="مثال: SEC-EMERG-01"
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
                        value={subUnitCode}
                      />
                    </label>
                  </div>

                  {/* Governance Permissions Checkboxes */}
                  <div style={{ background: '#f8fbfb', border: '1px solid #dce7e8', borderRadius: '10px', padding: '14px', display: 'grid', gap: '10px' }}>
                    <strong style={{ fontSize: '13px', color: '#102027' }}>صلاحيات التكليف والاعتماد والحوكمة للوحدة الفرعية:</strong>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={subUnitCanIssueMissions}
                        onChange={(e) => setSubUnitCanIssueMissions(e.target.checked)}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>📝 <strong>صلاحية إصدار وتكليف المأموريات:</strong> يحق لهذه الوحدة إنشاء مأموريات وتكليف المفتشين.</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={subUnitCanApproveMissions}
                        onChange={(e) => setSubUnitCanApproveMissions(e.target.checked)}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>✍️ <strong>صلاحية اعتماد تقارير المرور:</strong> يحق لرئيس هذه الوحدة اعتماد نتائج التفتيش والمخالفات.</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={subUnitCanViewGov}
                        onChange={(e) => setSubUnitCanViewGov(e.target.checked)}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>🗺️ <strong>صلاحية رؤية منشآت المحافظة كاملة:</strong> التفتيش على كافة المنشآت بنطاق المحافظة التابع لها.</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={subUnitCanViewSector}
                        onChange={(e) => setSubUnitCanViewSector(e.target.checked)}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>🏥 <strong>صلاحية رؤية منشآت القطاع بالجمهورية:</strong> التفتيش على كافة منشآت القطاع على مستوى كافة المحافظات.</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start', borderTop: '1px solid #eef6f6', paddingTop: '14px' }}>
                    <button
                      disabled={subUnitLoading}
                      style={{
                        background: 'var(--brand)',
                        color: 'white',
                        border: 0,
                        borderRadius: '8px',
                        minHeight: '40px',
                        padding: '0 24px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        fontSize: '13px'
                      }}
                      type="submit"
                    >
                      {subUnitLoading ? 'جاري الحفظ والتسجيل...' : 'حفظ وتسكين الوحدة الفرعية'}
                    </button>
                    <button
                      onClick={() => setShowAddSubUnitModal(false)}
                      style={{ background: '#f0f4f5', border: 0, borderRadius: '8px', minHeight: '40px', padding: '0 18px', cursor: 'pointer', fontSize: '13px', color: '#546e7a' }}
                      type="button"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* 6. EDIT SUB-UNIT MODAL */}
            {editingOrg && (
              <div style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(10, 24, 31, 0.62)',
                backdropFilter: 'blur(6px)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '24px 16px',
                zIndex: 999,
                overflowY: 'auto'
              }}>
                <form
                  onSubmit={handleUpdateOrg}
                  style={{
                    background: 'white',
                    border: '1px solid var(--line)',
                    borderRadius: '16px',
                    padding: '24px',
                    maxWidth: '560px',
                    width: '100%',
                    display: 'grid',
                    gap: '16px',
                    boxShadow: '0 18px 52px rgba(10,24,31,0.24)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e7eff1', paddingBottom: '12px' }}>
                    <strong style={{ fontSize: '15px', color: '#102027' }}>تعديل صلاحيات وبيانات الوحدة: {editingOrg.name}</strong>
                    <button
                      onClick={() => setEditingOrg(null)}
                      style={{ background: '#f3f7f8', border: 0, borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      type="button"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {subUnitError && <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>{subUnitError}</div>}
                  {subUnitSuccess && <div style={{ background: '#eaf8f3', color: '#16725a', padding: '10px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}>{subUnitSuccess}</div>}

                  <label style={{ display: 'grid', gap: '6px', fontSize: '13px', fontWeight: 'bold', color: '#37474f' }}>
                    اسم الوحدة التنظيمية
                    <input
                      onChange={(e) => setEditingOrg({ ...editingOrg, name: e.target.value })}
                      style={{ background: '#f8fbfb', border: '1px solid #cfdcde', borderRadius: '8px', minHeight: '38px', padding: '0 12px', fontSize: '13px', outline: 'none' }}
                      type="text"
                      value={editingOrg.name}
                    />
                  </label>

                  <div style={{ background: '#f8fbfb', border: '1px solid #dce7e8', borderRadius: '10px', padding: '14px', display: 'grid', gap: '10px' }}>
                    <strong style={{ fontSize: '12.5px', color: '#102027' }}>صلاحيات التكليف والاعتماد والحوكمة:</strong>
                    
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={editingOrg.can_issue_missions}
                        onChange={(e) => setEditingOrg({ ...editingOrg, can_issue_missions: e.target.checked })}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>📝 صلاحية إصدار وتكليف المأموريات</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={editingOrg.can_approve_missions}
                        onChange={(e) => setEditingOrg({ ...editingOrg, can_approve_missions: e.target.checked })}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>✍️ صلاحية اعتماد تقارير المرور والمخالفات</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={editingOrg.can_view_all_governorate}
                        onChange={(e) => setEditingOrg({ ...editingOrg, can_view_all_governorate: e.target.checked })}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>🗺️ صلاحية رؤية منشآت المحافظة كاملة</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#37474f', cursor: 'pointer' }}>
                      <input
                        checked={editingOrg.can_view_sector_facilities}
                        onChange={(e) => setEditingOrg({ ...editingOrg, can_view_sector_facilities: e.target.checked })}
                        style={{ width: '17px', height: '17px' }}
                        type="checkbox"
                      />
                      <span>🏥 صلاحية رؤية منشآت القطاع بالجمهورية</span>
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start', borderTop: '1px solid #eef6f6', paddingTop: '12px' }}>
                    <button
                      disabled={subUnitLoading}
                      style={{ background: 'var(--brand)', color: 'white', border: 0, borderRadius: '8px', minHeight: '38px', padding: '0 20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                      type="submit"
                    >
                      {subUnitLoading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                    </button>
                    <button
                      onClick={() => setEditingOrg(null)}
                      style={{ background: '#f0f4f5', border: 0, borderRadius: '8px', minHeight: '38px', padding: '0 16px', cursor: 'pointer', fontSize: '13px', color: '#546e7a' }}
                      type="button"
                    >
                      إلغاء
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>
        )}
        
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
                          : defaultNavs[selectedUser.role as UserRole] || []
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
