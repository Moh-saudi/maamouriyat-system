'use client'

import React, { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Building2,
  Building,
  Activity,
  Compass,
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Users,
  Filter,
  FileSpreadsheet,
  ArrowUpDown,
  ExternalLink
} from 'lucide-react'
import {
  MinistryUnit,
  realEgyptianSectors,
  realEgyptianMinistryUnits,
  getSectorById,
  getMinistryUnitsForSector
} from '@/lib/real-facilities'
import { AddMinistryUnitModal, ParentUnitOption } from '../facilities/add-ministry-unit-modal'

export type OrgItem = {
  id: string
  name: string
  level: number
  level_label?: string
  governorate?: string | null
  health_admin?: string | null
  sector_id?: string | null
  code?: string | null
  parent_id?: string | null
  is_active?: boolean
  created_at?: string
}

export type UserRow = {
  id: string
  full_name: string
  job_title?: string | null
  org_level: number
  organization_id?: string | null
  department?: string | null
  is_active: boolean
  email?: string
}

export function OrganizationsTablePortal({
  role = null,
  userOrgLevel = 7,
  userSectorId = null,
  userEmail = '',
  initialOrganizations = [],
  initialUsers = [],
  missionsCount = 0
}: {
  role?: string | null
  userOrgLevel?: number
  userSectorId?: string | null
  userEmail?: string | null
  initialOrganizations: OrgItem[]
  initialUsers: UserRow[]
  missionsCount?: number
}) {
  const isWritable = role === 'superadmin' || role === 'techadmin'
  const isMinisterialLevel = userOrgLevel === 1 || (isWritable && userSectorId === 'all')

  // الحظر الأمني: رئيس القطاع محصور في قطاعه فقط
  const defaultSectorId = isMinisterialLevel
    ? (userSectorId || 'all')
    : (userSectorId && userSectorId !== 'all' ? userSectorId : '00000000-0000-0000-0000-000000000010')

  const [selectedSectorId, setSelectedSectorId] = useState<string>(defaultSectorId)
  const effectiveSectorId = isMinisterialLevel ? selectedSectorId : defaultSectorId
  const activeSector = useMemo(() => getSectorById(effectiveSectorId), [effectiveSectorId])

  // حالة قاعدة البيانات المحلية
  const [localOrganizations, setLocalOrganizations] = useState<OrgItem[]>(initialOrganizations)
  useEffect(() => {
    setLocalOrganizations(initialOrganizations)
  }, [initialOrganizations])

  // Custom units from localStorage
  const [customUnits, setCustomUnits] = useState<MinistryUnit[]>([])
  useEffect(() => {
    try {
      const saved = localStorage.getItem('maamouriyat_custom_ministry_units')
      if (saved) setCustomUnits(JSON.parse(saved))
    } catch (e) {}
  }, [])

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<MinistryUnit | null>(null)

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<'all' | '1' | '2' | '3'>('all')

  // دمج وحدات قاعدة البيانات للقطاع الحالي
  const dbUnitsForSector = useMemo(() => {
    if (!localOrganizations || localOrganizations.length === 0) return []
    const sectorOrgs = localOrganizations.filter(o => 
      (o.level >= 3 && o.level <= 5) && (
        o.sector_id === effectiveSectorId || 
        (isMinisterialLevel && effectiveSectorId === 'all')
      )
    )

    return sectorOrgs.map(org => {
      const existsInStatic = realEgyptianMinistryUnits.some(u => 
        u.name.trim() === org.name.trim() && 
        (u.sectorId === org.sector_id || effectiveSectorId === 'all')
      )
      if (existsInStatic) return null

      const parentOrg = localOrganizations.find(p => p.id === org.parent_id)
      const parentName = parentOrg?.name || ''
      const parentStaticUnit = realEgyptianMinistryUnits.find(u => u.name.trim() === parentName.trim())

      let levelTitle = 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)'
      let typeLabel = 'إدارة عامة تخصصية'
      let levelIdx = 2
      let icon = 'Building2'

      if (org.level === 3) {
        levelTitle = 'المستوى الأول: الإدارات المركزية (المستوى العالي)'
        typeLabel = 'إدارة مركزية رئيسية'
        levelIdx = 1
        icon = 'Building'
      } else if (org.level === 5) {
        levelTitle = 'المستوى الثالث: الوظائف والأقسام الإشرافية والتنفيذية'
        typeLabel = 'قسم / وحدة تنظيمية'
        levelIdx = 3
        icon = 'Activity'
      }

      return {
        id: org.id,
        sectorId: org.sector_id || effectiveSectorId,
        name: org.name,
        level: levelTitle,
        type: typeLabel,
        icon: icon,
        parent: parentStaticUnit ? parentStaticUnit.id : (org.parent_id || activeSector.id),
        color: activeSector.color,
        badgeColor: activeSector.badgeColor,
        description: `وحدة تنظيمية مسجلة بالهيكل التنظيمي المعتمد لـ ${activeSector.name}.`,
        coreTasks: ['متابعة الخطط التشغيلية وتطبيق معايير الجودة الفنية'],
        director: '',
        staffCount: 0,
        levelIndex: levelIdx,
        isCustom: true
      } as MinistryUnit
    }).filter(Boolean) as MinistryUnit[]
  }, [localOrganizations, effectiveSectorId, activeSector, isMinisterialLevel])

  const mergedCustomUnits = useMemo(() => {
    const map = new Map<string, MinistryUnit>()
    customUnits.forEach(u => {
      if (u.sectorId === effectiveSectorId || (isMinisterialLevel && effectiveSectorId === 'all')) {
        map.set(u.id, u)
      }
    })
    dbUnitsForSector.forEach(u => map.set(u.id, u))
    return Array.from(map.values())
  }, [customUnits, dbUnitsForSector, effectiveSectorId, isMinisterialLevel])

  // جميع وحدات القطاع الحالي مرتبة
  const sectorUnits = useMemo(() => 
    getMinistryUnitsForSector(effectiveSectorId, mergedCustomUnits), 
    [effectiveSectorId, mergedCustomUnits]
  )

  // حساب عدد الموظفين لكل إدارة
  const staffCountMap = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const u of initialUsers) {
      if (u.department) {
        const cleanDept = u.department.trim().toLowerCase()
        counts[cleanDept] = (counts[cleanDept] || 0) + 1
      }
      if (u.organization_id) {
        counts[u.organization_id] = (counts[u.organization_id] || 0) + 1
      }
    }
    return counts
  }, [initialUsers])

  const getStaffCount = (unit: MinistryUnit): number => {
    const byId = staffCountMap[unit.id] || 0
    const byName = staffCountMap[unit.name.trim().toLowerCase()] || 0
    return Math.max(byId, byName, unit.staffCount || 0)
  }

  // قائمة الجهات الأم للاختيار
  const parentUnitsForModal = useMemo(() => {
    const list: ParentUnitOption[] = []

    if (activeSector && activeSector.id !== 'all') {
      list.push({
        id: activeSector.id,
        name: `رئاسة ${activeSector.name} مباشرة (ديوان القطاع)`,
        type: 'قطاع'
      })
    }

    // الإدارات المركزية
    for (const u of sectorUnits) {
      if (u.levelIndex === 1 && !list.some(item => item.id === u.id || item.name.trim() === u.name.trim())) {
        list.push({ id: u.id, name: u.name, type: 'إدارة مركزية' })
      }
    }

    // الإدارات العامة
    for (const u of sectorUnits) {
      if (u.levelIndex === 2 && !list.some(item => item.id === u.id || item.name.trim() === u.name.trim())) {
        list.push({ id: u.id, name: u.name, type: 'إدارة عامة' })
      }
    }

    return list
  }, [activeSector, sectorUnits])

  // التصفية والبحث
  const filteredUnits = useMemo(() => {
    return sectorUnits.filter(unit => {
      // استبعاد قمة القطاع من الجدول إذا أردنا عرض الإدارات والأقسام فقط، أو إبقاؤها
      const matchesLevel = 
        levelFilter === 'all' ? true :
        unit.levelIndex.toString() === levelFilter

      const q = searchQuery.trim().toLowerCase()
      const matchesSearch = !q || 
        unit.name.toLowerCase().includes(q) ||
        unit.type.toLowerCase().includes(q) ||
        (unit.director && unit.director.toLowerCase().includes(q)) ||
        unit.description.toLowerCase().includes(q)

      return matchesLevel && matchesSearch
    })
  }, [sectorUnits, levelFilter, searchQuery])

  // استخراج اسم الجهة الأم
  const getParentName = (unit: MinistryUnit): string => {
    if (!unit.parent || unit.parent === activeSector.id || unit.levelIndex === 0) {
      return activeSector.name
    }
    const parentUnit = sectorUnits.find(u => u.id === unit.parent)
    if (parentUnit) return parentUnit.name
    const parentOrg = localOrganizations.find(o => o.id === unit.parent)
    return parentOrg?.name || activeSector.name
  }

  // كود الوحدة
  const getUnitCode = (unit: MinistryUnit): string => {
    const org = localOrganizations.find(o => o.id === unit.id || o.name.trim() === unit.name.trim())
    if (org?.code) return org.code
    return unit.id.startsWith('custom-') ? `GEN-${unit.id.slice(-6).toUpperCase()}` : `MOHP-${unit.levelIndex}0${unit.name.length}`
  }

  // إحصائيات القطاع
  const stats = useMemo(() => {
    const centralCount = sectorUnits.filter(u => u.levelIndex === 1).length
    const generalCount = sectorUnits.filter(u => u.levelIndex === 2).length
    const sectionCount = sectorUnits.filter(u => u.levelIndex === 3).length
    let totalStaff = 0
    sectorUnits.forEach(u => { totalStaff += getStaffCount(u) })

    return { centralCount, generalCount, sectionCount, totalStaff }
  }, [sectorUnits, staffCountMap])

  // عمليات الحفظ والتعديل
  const handleSaveUnit = async (newUnit: MinistryUnit) => {
    const parentOrg = parentUnitsForModal.find(u => u.id === newUnit.parent)
    const parentName = parentOrg?.name || ''

    const isSection = newUnit.levelIndex === 3
    const isGeneral = newUnit.levelIndex === 2
    const targetLevel = isSection ? 5 : isGeneral ? 4 : 3
    const targetLabel = isSection ? 'unit' : isGeneral ? 'general_admin' : 'central_admin'
    const codePrefix = isSection ? 'SEC' : isGeneral ? 'GEN' : 'CEN'

    const isExistingInDb = localOrganizations.some(o => o.id === newUnit.id)

    if (isExistingInDb) {
      const response = await fetch('/api/admin/organizations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newUnit.id,
          name: newUnit.name.trim(),
        })
      })

      const res = await response.json()
      if (!response.ok || res.error) {
        throw new Error(res.error || 'فشل تحديث بيانات الإدارة في قاعدة البيانات')
      }

      const updatedOrg = res.data
      if (updatedOrg) {
        setLocalOrganizations(prev => prev.map(o => o.id === updatedOrg.id ? { ...o, ...updatedOrg } : o))
      }
    } else {
      const response = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUnit.name.trim(),
          code: `${codePrefix}-${Date.now().toString(36).toUpperCase()}`,
          parent_id: newUnit.parent,
          parent_name: parentName,
          sector_id: activeSector.id,
          level: targetLevel,
          level_label: targetLabel,
          can_issue_missions: true,
          can_approve_missions: false,
          can_view_all_governorate: false,
          can_view_sector_facilities: true,
        })
      })

      const res = await response.json()
      if (!response.ok || res.error) {
        throw new Error(res.error || 'فشل حفظ الإدارة أو الوحدة في قاعدة البيانات')
      }

      const savedOrg = res.data
      if (savedOrg) {
        newUnit.id = savedOrg.id
        setLocalOrganizations(prev => [...prev.filter(o => o.id !== savedOrg.id), savedOrg])
      }
    }

    const updated = [...customUnits.filter(u => u.id !== newUnit.id), newUnit]
    setCustomUnits(updated)
    try {
      localStorage.setItem('maamouriyat_custom_ministry_units', JSON.stringify(updated))
    } catch (e) {}

    setIsModalOpen(false)
    setEditingUnit(null)
  }

  // حذف الوحدة
  const handleDeleteUnit = async (unitId: string) => {
    const existsInDb = localOrganizations.some(o => o.id === unitId)
    if (existsInDb) {
      const response = await fetch(`/api/admin/organizations?id=${unitId}`, {
        method: 'DELETE'
      })
      const res = await response.json()
      if (!response.ok || res.error) {
        throw new Error(res.error || 'فشل حذف الوحدة من قاعدة البيانات')
      }
      setLocalOrganizations(prev => prev.filter(o => o.id !== unitId))
    }

    const updated = customUnits.filter(u => u.id !== unitId)
    setCustomUnits(updated)
    try {
      localStorage.setItem('maamouriyat_custom_ministry_units', JSON.stringify(updated))
    } catch (e) {}
  }

  // تصدير Excel (CSV UTF-8 with BOM)
  const exportToExcel = () => {
    const headers = [
      'م',
      'اسم الإدارة / الوحدة التنظيمية',
      'المستوى التنظيمي',
      'الجهة التابعة لها',
      'الكود التنظيمي',
      'المدير / المشرف المسؤول',
      'عدد العاملين',
      'الحالة'
    ]

    const rows = filteredUnits.map((unit, index) => [
      index + 1,
      `"${unit.name.replace(/"/g, '""')}"`,
      `"${unit.levelIndex === 0 ? 'قمة القطاع' : unit.levelIndex === 1 ? 'إدارة مركزية' : unit.levelIndex === 2 ? 'إدارة عامة' : 'قسم إشرافي'}"`,
      `"${getParentName(unit).replace(/"/g, '""')}"`,
      `"${getUnitCode(unit)}"`,
      `"${(unit.director || 'غير محدد').replace(/"/g, '""')}"`,
      getStaffCount(unit),
      'معتمد ونشط'
    ])

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `الهيكل_التنظيمي_${activeSector.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // طباعة / تصدير PDF
  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'grid', gap: '24px', direction: 'rtl' }}>
      
      {/* 1. Header Banner & Sector Scope */}
      <div style={{
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: activeSector.badgeColor + '15',
              color: activeSector.badgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1.5px solid ${activeSector.badgeColor}30`
            }}>
              <Building2 size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold', color: '#102027' }}>
                جدول الهيكل التنظيمي والإدارات
              </h1>
              <span style={{ fontSize: '13px', color: '#546e7a' }}>
                {activeSector.name} — ديوان عام وزارة الصحة والسكان
              </span>
            </div>
          </div>

          <p style={{ margin: 0, fontSize: '12.5px', color: '#78909c', maxWidth: '720px', lineHeight: '1.6' }}>
            قائمة رسمية معتمدة ومسجلة مركزياً بقاعدة البيانات لكافة الإدارات المركزية والعامة والأقسام التابعة للقطاع، مع إمكانية التعديل والتكليف والتصدير الرسمي.
          </p>

          {/* Sector Switcher for Level 1 only */}
          {isMinisterialLevel ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
              <span style={{ fontSize: '11.5px', color: '#546e7a', fontWeight: 'bold' }}>عرض قطاع:</span>
              <button
                type="button"
                onClick={() => setSelectedSectorId('all')}
                style={{
                  border: selectedSectorId === 'all' ? '1.5px solid #102027' : '1px solid #cfdcde',
                  background: selectedSectorId === 'all' ? '#102027' : '#ffffff',
                  color: selectedSectorId === 'all' ? '#ffffff' : '#37474f',
                  padding: '4px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: selectedSectorId === 'all' ? 'bold' : 'normal',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                🌟 كافة القطاعات
              </button>
              {realEgyptianSectors.map((sector) => {
                const isCurrent = sector.id === selectedSectorId
                return (
                  <button
                    key={sector.id}
                    type="button"
                    onClick={() => setSelectedSectorId(sector.id)}
                    style={{
                      border: isCurrent ? `1.5px solid ${sector.badgeColor}` : '1px solid #cfdcde',
                      background: isCurrent ? sector.badgeColor : '#ffffff',
                      color: isCurrent ? '#ffffff' : '#37474f',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: isCurrent ? 'bold' : 'normal',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {sector.shortName}
                  </button>
                )
              })}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span style={{ fontSize: '11.5px', color: '#546e7a', fontWeight: 'bold' }}>نطاق الصلاحيات التنظيمية:</span>
              <span style={{
                fontSize: '11.5px',
                fontWeight: 'bold',
                padding: '3px 12px',
                borderRadius: '6px',
                background: activeSector.badgeColor + '18',
                color: activeSector.badgeColor,
                border: `1px solid ${activeSector.badgeColor}40`
              }}>
                {activeSector.name}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons: Add Unit, Export Excel, Print PDF */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }} className="no-print">
          <button
            type="button"
            onClick={exportToExcel}
            style={{
              background: '#ffffff',
              color: '#2e7d32',
              border: '1.5px solid #a5d6a7',
              borderRadius: '8px',
              padding: '9px 14px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <FileSpreadsheet size={16} />
            تصدير Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            style={{
              background: '#ffffff',
              color: '#1565c0',
              border: '1.5px solid #90caf9',
              borderRadius: '8px',
              padding: '9px 14px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 5px rgba(0,0,0,0.04)',
              transition: 'all 0.15s ease'
            }}
          >
            <Printer size={16} />
            طباعة / PDF
          </button>

          {(userOrgLevel <= 3 || isWritable) && (
            <button
              type="button"
              onClick={() => {
                setEditingUnit(null)
                setIsModalOpen(true)
              }}
              style={{
                background: 'var(--brand)',
                color: 'white',
                border: 0,
                borderRadius: '8px',
                padding: '9px 18px',
                fontSize: '12.5px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(0,109,119,0.2)'
              }}
            >
              <Plus size={16} />
              إضافة إدارة أو قسم ➕
            </button>
          )}

          <Link
            href="/dashboard/facilities"
            style={{
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '9px 14px',
              fontSize: '12.5px',
              fontWeight: 'bold',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Compass size={16} />
            عرض الشجرة
          </Link>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }} className="no-print">
        <div style={{
          background: 'white',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#e0f2f1',
            color: '#00796b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold', display: 'block' }}>
              الإدارات المركزية
            </span>
            <strong style={{ fontSize: '20px', color: '#102027' }}>
              {stats.centralCount}
            </strong>
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#e8eaf6',
            color: '#3f51b5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Building2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold', display: 'block' }}>
              الإدارات العامة
            </span>
            <strong style={{ fontSize: '20px', color: '#102027' }}>
              {stats.generalCount}
            </strong>
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#e0f7fa',
            color: '#006064',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Activity size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold', display: 'block' }}>
              الأقسام والوحدات الإشرافية
            </span>
            <strong style={{ fontSize: '20px', color: '#102027' }}>
              {stats.sectionCount}
            </strong>
          </div>
        </div>

        <div style={{
          background: 'white',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: 'var(--shadow)',
          display: 'flex',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: '#f1f8e9',
            color: '#33691e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Users size={20} />
          </div>
          <div>
            <span style={{ fontSize: '11.5px', color: '#78909c', fontWeight: 'bold', display: 'block' }}>
              إجمالي القوى البشرية بالمنظومة
            </span>
            <strong style={{ fontSize: '20px', color: '#102027' }}>
              {stats.totalStaff} موظف ومفتش
            </strong>
          </div>
        </div>
      </div>

      {/* 3. Search & Level Filters */}
      <div style={{
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: 'var(--shadow)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }} className="no-print">
        {/* Search Input */}
        <div style={{ position: 'relative', width: 'min(100%, 340px)' }}>
          <input
            type="text"
            placeholder="🔍 ابحث بالاسم، الكود، أو اسم المدير..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              minHeight: '38px',
              borderRadius: '8px',
              border: '1px solid #cfdcde',
              padding: '0 36px 0 12px',
              fontSize: '13px',
              outline: 'none',
              background: '#f8fbfb'
            }}
          />
          <Search size={16} style={{ position: 'absolute', right: '12px', top: '11px', color: '#78909c' }} />
        </div>

        {/* Level Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#546e7a', fontWeight: 'bold' }}>المستوى التنظيمي:</span>
          
          <button
            type="button"
            onClick={() => setLevelFilter('all')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: levelFilter === 'all' ? 'bold' : 'normal',
              cursor: 'pointer',
              border: levelFilter === 'all' ? '1.5px solid var(--brand)' : '1px solid #cfdcde',
              background: levelFilter === 'all' ? 'var(--brand)' : 'white',
              color: levelFilter === 'all' ? 'white' : '#37474f'
            }}
          >
            الكل ({sectorUnits.length})
          </button>

          <button
            type="button"
            onClick={() => setLevelFilter('1')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: levelFilter === '1' ? 'bold' : 'normal',
              cursor: 'pointer',
              border: levelFilter === '1' ? '1.5px solid #00796b' : '1px solid #cfdcde',
              background: levelFilter === '1' ? '#00796b' : 'white',
              color: levelFilter === '1' ? 'white' : '#37474f'
            }}
          >
            إدارات مركزية ({stats.centralCount})
          </button>

          <button
            type="button"
            onClick={() => setLevelFilter('2')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: levelFilter === '2' ? 'bold' : 'normal',
              cursor: 'pointer',
              border: levelFilter === '2' ? '1.5px solid #3f51b5' : '1px solid #cfdcde',
              background: levelFilter === '2' ? '#3f51b5' : 'white',
              color: levelFilter === '2' ? 'white' : '#37474f'
            }}
          >
            إدارات عامة ({stats.generalCount})
          </button>

          <button
            type="button"
            onClick={() => setLevelFilter('3')}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: levelFilter === '3' ? 'bold' : 'normal',
              cursor: 'pointer',
              border: levelFilter === '3' ? '1.5px solid #006064' : '1px solid #cfdcde',
              background: levelFilter === '3' ? '#006064' : 'white',
              color: levelFilter === '3' ? 'white' : '#37474f'
            }}
          >
            أقسام ووحدات ({stats.sectionCount})
          </button>
        </div>
      </div>

      {/* 4. Main Data Table */}
      <div style={{
        background: 'white',
        border: '1px solid var(--line)',
        borderRadius: '16px',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden'
      }}>
        {/* Printable Official Header (Only in print) */}
        <div className="print-only" style={{ display: 'none', padding: '24px 30px', borderBottom: '2px solid #102027', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'right' }}>
              <strong style={{ fontSize: '14px', display: 'block' }}>جمهورية مصر العربية</strong>
              <strong style={{ fontSize: '13px', display: 'block' }}>وزارة الصحة والسكان</strong>
              <span style={{ fontSize: '12px' }}>{activeSector.name}</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>بيان الهيكل التنظيمي والإدارات المعتمدة</h2>
              <small style={{ fontSize: '12px', color: '#555' }}>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</small>
            </div>
            <div style={{ textAlign: 'left' }}>
              <span style={{ fontSize: '11px', color: '#666', border: '1px solid #ccc', padding: '4px 8px', borderRadius: '4px' }}>منظومة المأموريات والحوكمة</span>
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: '#f8fbfb', borderBottom: '2px solid #cfdcde', color: '#37474f' }}>
                <th style={{ padding: '14px 16px', width: '48px', fontWeight: 'bold' }}>#</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>اسم الإدارة / الوحدة التنظيمية</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>المستوى التنظيمي</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>الجهة التابعة لها مباشرة</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>الكود التنظيمي</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold' }}>المدير / المشرف المسئول</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold', textAlign: 'center' }}>العاملين</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold', textAlign: 'center' }}>الحالة</th>
                <th style={{ padding: '14px 16px', fontWeight: 'bold', textAlign: 'center' }} className="no-print">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnits.map((unit, index) => {
                const staffCount = getStaffCount(unit)
                const unitCode = getUnitCode(unit)
                const parentName = getParentName(unit)

                return (
                  <tr
                    key={unit.id}
                    style={{
                      borderBottom: '1px solid #eef2f3',
                      transition: 'background 0.1s ease',
                      background: index % 2 === 0 ? '#ffffff' : '#fcfdfd'
                    }}
                  >
                    {/* Index */}
                    <td style={{ padding: '14px 16px', color: '#78909c', fontWeight: 'bold' }}>
                      {index + 1}
                    </td>

                    {/* Name & Icon */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: unit.levelIndex === 0 ? '#fff8e1' : unit.levelIndex === 1 ? '#e0f2f1' : unit.levelIndex === 2 ? '#e8eaf6' : '#e0f7fa',
                          color: unit.levelIndex === 0 ? '#b7791f' : unit.levelIndex === 1 ? '#00796b' : unit.levelIndex === 2 ? '#3f51b5' : '#006064',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {unit.levelIndex === 0 ? <Compass size={16} /> :
                           unit.levelIndex === 1 ? <Building size={16} /> :
                           unit.levelIndex === 2 ? <Building2 size={16} /> :
                           <Activity size={16} />}
                        </div>
                        <div>
                          <strong style={{ fontSize: '13px', color: '#102027', display: 'block' }}>
                            {unit.name}
                          </strong>
                          <span style={{ fontSize: '11px', color: '#90a4ae' }}>
                            {unit.type}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Level Badge */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '3px 10px',
                        borderRadius: '6px',
                        background: unit.levelIndex === 0 ? '#fff8e1' : unit.levelIndex === 1 ? '#e0f2f1' : unit.levelIndex === 2 ? '#e8eaf6' : '#e0f7fa',
                        color: unit.levelIndex === 0 ? '#b7791f' : unit.levelIndex === 1 ? '#00796b' : unit.levelIndex === 2 ? '#3f51b5' : '#006064',
                        border: `1px solid ${unit.levelIndex === 0 ? '#ffe082' : unit.levelIndex === 1 ? '#b2dfdb' : unit.levelIndex === 2 ? '#c5cae9' : '#b2ebf2'}`
                      }}>
                        {unit.levelIndex === 0 ? 'قمة القطاع (ممتاز)' :
                         unit.levelIndex === 1 ? 'إدارة مركزية (عالي)' :
                         unit.levelIndex === 2 ? 'إدارة عامة (مدير عام)' :
                         'قسم إشرافي وتنفيذي'}
                      </span>
                    </td>

                    {/* Parent Name */}
                    <td style={{ padding: '14px 16px', color: '#37474f', fontWeight: '500' }}>
                      {parentName}
                    </td>

                    {/* Code */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{
                        fontFamily: 'monospace',
                        fontSize: '11px',
                        color: '#455a64',
                        background: '#f1f5f9',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #e2e8f0'
                      }}>
                        {unitCode}
                      </span>
                    </td>

                    {/* Director */}
                    <td style={{ padding: '14px 16px', color: '#263238' }}>
                      {unit.director ? (
                        <span style={{ fontWeight: '500' }}>{unit.director}</span>
                      ) : (
                        <span style={{ color: '#b0bec5', fontSize: '12px' }}>غير مسجل</span>
                      )}
                    </td>

                    {/* Staff Count */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        fontWeight: 'bold',
                        color: staffCount > 0 ? '#00796b' : '#78909c',
                        background: staffCount > 0 ? '#e0f2f1' : '#f5f5f5',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '11.5px'
                      }}>
                        {staffCount} موظف
                      </span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        background: '#e8f5e9',
                        color: '#2e7d32',
                        border: '1px solid #c8e6c9'
                      }}>
                        <CheckCircle2 size={12} /> معتمد ونشط
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }} className="no-print">
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        {/* Edit button */}
                        {(userOrgLevel <= 3 || isWritable) && (
                          <button
                            type="button"
                            title="تعديل بيانات الإدارة"
                            onClick={() => {
                              setEditingUnit(unit)
                              setIsModalOpen(true)
                            }}
                            style={{
                              background: '#f0fdfa',
                              color: '#00796b',
                              border: '1px solid #b2dfdb',
                              borderRadius: '6px',
                              width: '30px',
                              height: '30px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                        )}

                        {/* Mission Action */}
                        <Link
                          href={`/dashboard/missions/new?orgUnit=${encodeURIComponent(unit.name)}`}
                          title="تكليف مأمورية للإدارة"
                          style={{
                            background: '#e0f2fe',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            borderRadius: '6px',
                            width: '30px',
                            height: '30px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Plus size={14} />
                        </Link>

                        {/* Delete button (for custom or added units) */}
                        {(userOrgLevel <= 3 || isWritable) && unit.isCustom && (
                          <button
                            type="button"
                            title="حذف الوحدة التنظيمية"
                            onClick={async () => {
                              if (confirm(`هل أنت متأكد من حذف وإلغاء هذه الإدارة (${unit.name}) من قاعدة البيانات؟`)) {
                                try {
                                  await handleDeleteUnit(unit.id)
                                } catch (err: any) {
                                  alert(err.message || 'حدث خطأ أثناء الحذف')
                                }
                              }
                            }}
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              width: '30px',
                              height: '30px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filteredUnits.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '36px', textAlign: 'center', color: '#78909c', fontSize: '13px' }}>
                    لا توجد إدارات أو أقسام مطابقة للبحث أو الفلتر المحدد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Footer (Signatures) */}
        <div className="print-only" style={{ display: 'none', padding: '30px 40px', borderTop: '1px solid #cfdcde', marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: '13px', display: 'block' }}>إدارة الحوكمة والمتابعة</strong>
              <div style={{ height: '50px' }} />
              <span style={{ fontSize: '12px' }}>التوقيع: ................................</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: '13px', display: 'block' }}>مدير عام الشؤون الإدارية</strong>
              <div style={{ height: '50px' }} />
              <span style={{ fontSize: '12px' }}>التوقيع: ................................</span>
            </div>
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: '13px', display: 'block' }}>يعتمد،، رئيس القطاع</strong>
              <div style={{ height: '50px' }} />
              <span style={{ fontSize: '12px' }}>الاسم والتوقيع: ................................</span>
            </div>
          </div>
        </div>

        {/* Table footer info */}
        <div style={{
          padding: '12px 20px',
          background: '#f8fbfb',
          borderTop: '1px solid #cfdcde',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '12px',
          color: '#546e7a'
        }} className="no-print">
          <span>إجمالي الوحدات المعروضة: <strong>{filteredUnits.length}</strong> وحدة</span>
          <span>الهيكل التنظيمي المعتمد لديوان عام الوزارة</span>
        </div>
      </div>

      {/* MODAL: ADD / EDIT UNIT */}
      <AddMinistryUnitModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingUnit(null)
        }}
        activeSector={activeSector}
        centralUnits={parentUnitsForModal}
        onAddUnit={handleSaveUnit}
        initialData={editingUnit}
        onDeleteUnit={handleDeleteUnit}
      />

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          table {
            border: 1px solid #999 !important;
          }
          th, td {
            border: 1px solid #ccc !important;
            padding: 8px 10px !important;
            font-size: 11px !important;
          }
        }
      `}</style>

    </div>
  )
}
