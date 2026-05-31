'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search,
  LayoutGrid,
  List,
  FileSpreadsheet,
  X,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  ChevronLeft,
  FileText,
  BadgeAlert
} from 'lucide-react'

type ViolationItem = {
  id: string
  description: string
  priority: string | null
  status: string | null
  correction_deadline: string | null
  created_at: string
  assigned_to_dept?: string | null
  violation_photo_url?: string | null
  facilities: { name: string } | null
  missions: { id: string; serial_number: string } | null
}

export function ViolationsPortal({
  initialViolations,
  roleName
}: {
  initialViolations: ViolationItem[]
  roleName?: string | null
}) {
  const router = useRouter()
  const [violations, setViolations] = useState<ViolationItem[]>(initialViolations)
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  // 1. DYNAMIC SEARCH & FILTERS INTERACTION
  const filteredViolations = useMemo(() => {
    return violations.filter((v) => {
      const desc = v.description.toLowerCase()
      const facName = (v.facilities?.name || '').toLowerCase()
      const dept = (v.assigned_to_dept || '').toLowerCase()
      const serial = (v.missions?.serial_number || '').toLowerCase()
      const query = searchQuery.toLowerCase()

      const matchesSearch =
        desc.includes(query) ||
        facName.includes(query) ||
        dept.includes(query) ||
        serial.includes(query)

      const matchesStatus = statusFilter === 'all' || v.status === statusFilter
      const matchesPriority = priorityFilter === 'all' || v.priority === priorityFilter

      return matchesSearch && matchesStatus && matchesPriority
    })
  }, [violations, searchQuery, statusFilter, priorityFilter])

  // 2. STATISTICS CALCULATOR
  const stats = useMemo(() => {
    const total = violations.length
    const critical = violations.filter(v => v.priority === 'critical' || v.priority === 'high').length
    const inProgress = violations.filter(v => v.status === 'in_progress').length
    const newCount = violations.filter(v => v.status === 'new' || !v.status).length
    const resolved = violations.filter(v => v.status === 'corrected' || v.status === 'verified' || v.status === 'closed').length
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 100

    return { total, critical, inProgress, newCount, resolved, resolutionRate }
  }, [violations])

  // 3. EXCEL/CSV ARABIC-COMPLIANT EXPORT HANDLER
  const handleExportToExcel = () => {
    if (filteredViolations.length === 0) {
      alert('لا توجد بيانات متاحة للتصدير.')
      return
    }

    // Standard high-density columns in Arabic
    const headers = [
      'رقم المخالفة',
      'الوصف والتفاصيل الحوكمية',
      'مستوى الخطورة',
      'حالة المعالجة',
      'المنشأة الطبية المستهدفة',
      'الإدارة المعنية بالتصحيح',
      'المأمورية المسببة',
      'تاريخ الرصد',
      'تاريخ المهلة النهائية',
      'رابط صورة التوثيق'
    ]

    const rows = filteredViolations.map((v) => [
      v.id,
      v.description.replace(/,/g, ' - '), // avoid CSV splitting issues
      getPriorityLabel(v.priority),
      getStatusLabel(v.status),
      v.facilities?.name || 'غير محددة',
      v.assigned_to_dept || 'غير محددة',
      v.missions?.serial_number || 'غير مرتبطة بمأمورية',
      v.created_at ? new Date(v.created_at).toLocaleDateString('en-CA') : 'غير مسجل',
      v.correction_deadline ? new Date(v.correction_deadline).toLocaleDateString('en-CA') : 'غير مسجل',
      v.violation_photo_url || 'لا توجد صورة'
    ])

    // Generate CSV content with standard BOM to prevent Arabic symbol corruption!
    const csvContent =
      '\uFEFF' + // UTF-8 BOM
      [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `maamouriyat_violations_report_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Visual Helper Utilities
  function getPriorityLabel(priority: string | null) {
    if (priority === 'critical') return 'حرجة للغاية'
    if (priority === 'high') return 'خطورة عالية'
    if (priority === 'medium') return 'خطورة متوسطة'
    if (priority === 'low') return 'مخالفة بسيطة'
    return 'غير محددة'
  }

  function getPriorityBadgeClass(priority: string | null) {
    if (priority === 'critical') return 'priority-urgent'
    if (priority === 'high') return 'priority-high'
    if (priority === 'medium') return 'priority-medium'
    return 'priority-normal'
  }

  function getStatusLabel(status: string | null) {
    if (status === 'new') return 'جديدة ورصدت للتو'
    if (status === 'in_progress') return 'جاري معالجتها'
    if (status === 'corrected') return 'تم التصحيح ميدانياً'
    if (status === 'verified') return 'تم التحقق والاعتماد'
    if (status === 'closed') return 'مغلقة كلياً'
    return 'جديدة'
  }

  function getStatusBadgeClass(status: string | null) {
    if (status === 'corrected' || status === 'verified' || status === 'closed') return 'status-green'
    if (status === 'in_progress') return 'status-blue'
    return 'status-amber'
  }

  return (
    <div className="violations-portal-container" style={{ display: 'grid', gap: '20px', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* 1. HIGH-DENSITY STATS CARDS */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px'
      }}>
        {/* Total */}
        <div style={{
          background: 'linear-gradient(135deg, #006d77 0%, #004d55 100%)',
          borderRadius: '16px',
          padding: '16px',
          color: 'white',
          boxShadow: '0 4px 15px rgba(0, 109, 119, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', opacity: 0.85, display: 'block', marginBottom: '4px' }}>إجمالي المخالفات</span>
            <strong style={{ fontSize: '26px', fontWeight: '800' }}>{stats.total}</strong>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '12px', padding: '10px', display: 'flex' }}>
            <FileText size={22} />
          </div>
        </div>

        {/* Critical */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #ffcdcd',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#b71c1c', display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>مخالفات حرجة وعالية</span>
            <strong style={{ fontSize: '26px', color: '#c62828', fontWeight: '800' }}>{stats.critical}</strong>
          </div>
          <div style={{ background: '#ffebee', borderRadius: '12px', padding: '10px', display: 'flex', color: '#c62828' }}>
            <AlertTriangle size={22} />
          </div>
        </div>

        {/* In Progress */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #dce7e8',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#546e7a', display: 'block', marginBottom: '4px' }}>تحت التصحيح والمعالجة</span>
            <strong style={{ fontSize: '26px', color: '#2c6fbb', fontWeight: '800' }}>{stats.inProgress}</strong>
          </div>
          <div style={{ background: '#e8f1fb', borderRadius: '12px', padding: '10px', display: 'flex', color: '#2c6fbb' }}>
            <Clock size={22} />
          </div>
        </div>

        {/* New / Pending */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #dce7e8',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#546e7a', display: 'block', marginBottom: '4px' }}>مخالفات جديدة معلقة</span>
            <strong style={{ fontSize: '26px', color: '#b7791f', fontWeight: '800' }}>{stats.newCount}</strong>
          </div>
          <div style={{ background: '#fdf4e3', borderRadius: '12px', padding: '10px', display: 'flex', color: '#b7791f' }}>
            <BadgeAlert size={22} />
          </div>
        </div>

        {/* Resolution Coverage */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '16px',
          border: '1px solid #dce7e8',
          boxShadow: '0 4px 10px rgba(0,0,0,0.02)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '12.5px', color: '#546e7a', display: 'block', marginBottom: '4px' }}>نسبة حل المخالفات</span>
            <strong style={{ fontSize: '26px', color: '#006d77', fontWeight: '800' }}>{stats.resolutionRate}%</strong>
          </div>
          <div style={{ background: '#eaf8f3', borderRadius: '12px', padding: '10px', display: 'flex', color: '#16725a' }}>
            <CheckCircle size={22} />
          </div>
        </div>
      </section>

      {/* 2. ADVANCED INTERACTIVE FILTERS */}
      <section style={{
        background: '#ffffff',
        border: '1px solid #cfdcde',
        borderRadius: '14px',
        padding: '16px',
        display: 'grid',
        gap: '12px',
        boxShadow: '0 4px 10px rgba(0,0,0,0.01)'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '12px'
        }}>
          {/* A. Search Input */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="ابحث بوصف المخالفة، المنشأة، الإدارة، أو رقم المأمورية..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                minHeight: '40px',
                padding: '0 32px 0 12px',
                border: '1px solid #cfdcde',
                borderRadius: '8px',
                fontSize: '12.5px',
                background: '#f8fbfb',
                outline: 'none'
              }}
            />
            <Search size={14} style={{ position: 'absolute', right: '10px', top: '13px', color: '#90a4ae' }} />
          </div>

          {/* B. Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              minHeight: '40px',
              border: '1px solid #cfdcde',
              borderRadius: '8px',
              fontSize: '12.5px',
              background: '#f8fbfb',
              padding: '0 8px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">كل الحالات المعالجة</option>
            <option value="new">جديدة</option>
            <option value="in_progress">تحت التصحيح</option>
            <option value="corrected">تم التصحيح ميدانياً</option>
            <option value="verified">تم التحقق</option>
            <option value="closed">مغلقة كلياً</option>
          </select>

          {/* C. Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              minHeight: '40px',
              border: '1px solid #cfdcde',
              borderRadius: '8px',
              fontSize: '12.5px',
              background: '#f8fbfb',
              padding: '0 8px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">كل مستويات الخطورة</option>
            <option value="critical">حرجة للغاية 🚨</option>
            <option value="high">عالية الخطورة</option>
            <option value="medium">متوسطة الخطورة</option>
            <option value="low">مخالفة بسيطة</option>
          </select>
        </div>
      </section>

      {/* 2.5 RESULTS COUNT & VIEW MODE TOGGLER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8fbfb',
        border: '1px solid #cfdcde',
        borderRadius: '12px',
        padding: '10px 16px',
        marginTop: '-10px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ fontSize: '13px', color: '#37474f', fontWeight: 'bold' }}>
          📋 تم العثور على <span style={{ color: 'var(--brand)' }}>{filteredViolations.length}</span> مخالفة محوكمة
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* Excel Export */}
          <button
            onClick={handleExportToExcel}
            style={{
              background: '#e8f5e9',
              color: '#2e7d32',
              border: '1px solid #a5d6a7',
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
            title="تصدير المخالفات الحالية إلى ملف إكسيل"
            type="button"
          >
            <FileSpreadsheet size={14} />
            تصدير للأكسيل 📊
          </button>

          {/* Layout View Toggler */}
          <div style={{ display: 'flex', gap: '4px', background: '#e0ecef', padding: '4px', borderRadius: '10px' }}>
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
      </div>

      {/* 3. CONTENT AREA: GRID OR TABLE */}
      {viewMode === 'grid' ? (
        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '16px'
        }}>
          {filteredViolations.map((v) => {
            const isCritical = v.priority === 'critical' || v.priority === 'high'
            return (
              <article
                className="mission-card"
                key={v.id}
                style={{
                  background: 'white',
                  border: isCritical ? '1px solid #ffcdcd' : '1px solid #cfdcde',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.01)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isCritical && (
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '4px', height: '100%', background: '#d32f2f' }} />
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }} className={getPriorityBadgeClass(v.priority)}>
                    {getPriorityLabel(v.priority)}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 'bold' }} className={getStatusBadgeClass(v.status)}>
                    {getStatusLabel(v.status)}
                  </span>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: '14px', color: '#102027', fontWeight: 'bold', lineHeight: '1.4' }}>
                    {v.description}
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#546e7a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {v.facilities?.name || 'منشأة غير محددة'}
                  </p>
                </div>

                <div style={{
                  background: '#f8fbfb',
                  border: '1px solid #e0f0f0',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  fontSize: '11.5px',
                  color: '#37474f',
                  display: 'grid',
                  gap: '4px'
                }}>
                  <div>🏢 الإدارة المختصة: <strong>{v.assigned_to_dept || 'غير محددة'}</strong></div>
                  {v.missions?.serial_number && (
                    <div>📋 المأمورية: <strong style={{ color: '#006d77' }}>{v.missions.serial_number}</strong></div>
                  )}
                  {v.created_at && (
                    <div>📅 تاريخ الرصد: <strong>{new Date(v.created_at).toLocaleDateString('ar-EG')}</strong></div>
                  )}
                  {v.correction_deadline && (
                    <div style={{ color: '#b71c1c' }}>🚨 مهلة التصحيح: <strong>{new Date(v.correction_deadline).toLocaleDateString('ar-EG')}</strong></div>
                  )}
                </div>

                {v.violation_photo_url && (
                  <button
                    onClick={() => setSelectedPhoto(v.violation_photo_url!)}
                    style={{
                      background: '#f0fcf9',
                      border: '1px solid #ccebe6',
                      borderRadius: '8px',
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      color: '#006d77',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      justifyContent: 'center',
                      marginTop: 'auto'
                    }}
                  >
                    📷 عرض صورة التوثيق الفني
                  </button>
                )}
              </article>
            )
          })}

          {filteredViolations.length === 0 && (
            <div style={{
              background: 'white',
              border: '1px solid #dce7e8',
              borderRadius: '16px',
              padding: '40px 20px',
              textAlign: 'center',
              gridColumn: '1 / -1',
              display: 'grid',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <strong style={{ fontSize: '15px', color: '#102027' }}>لا توجد مخالفات تطابق شروط الفلترة</strong>
              <p style={{ margin: 0, fontSize: '13px', color: '#78909c' }}>يرجى تعديل خيارات البحث أو التصفية.</p>
            </div>
          )}
        </section>
      ) : (
        /* 3. PREMIUM RESPONSIVE RTL TABLE VIEW */
        <section style={{
          background: 'white',
          border: '1px solid #cfdcde',
          borderRadius: '16px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.01)',
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              textAlign: 'right',
              fontSize: '13px',
              minWidth: '1000px'
            }}>
              <thead>
                <tr style={{
                  background: '#f8fbfb',
                  borderBottom: '1px solid #cfdcde',
                  color: '#37474f'
                }}>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>المخالفة المحوكمة وتفاصيلها</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>المنشأة الطبية</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>الأولوية والحالة</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>المأمورية المسببة</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>تاريخ الرصد والمهلة</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold' }}>الإدارة المختصة بالتصحيح</th>
                  <th style={{ padding: '16px 20px', fontWeight: 'bold', textAlign: 'center' }}>التوثيق بالصور</th>
                </tr>
              </thead>
              <tbody>
                {filteredViolations.map((v) => {
                  const isCritical = v.priority === 'critical' || v.priority === 'high'
                  return (
                    <tr
                      key={v.id}
                      style={{
                        borderBottom: '1px solid #eef2f3',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#f4f8f8'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Description */}
                      <td style={{ padding: '14px 20px', maxWidth: '300px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: 'bold', color: '#102027', fontSize: '13px', lineHeight: '1.4' }}>
                            {v.description}
                          </span>
                          <span style={{ fontSize: '11px', color: '#78909c' }}>كود المخالفة: {v.id}</span>
                        </div>
                      </td>

                      {/* Facility */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ background: '#eaf8f3', color: 'var(--brand)', borderRadius: '8px', padding: '6px', display: 'flex' }}>
                            <MapPin size={16} />
                          </div>
                          <strong style={{ color: '#263238' }}>{v.facilities?.name || 'منشأة غير مدرجة'}</strong>
                        </div>
                      </td>

                      {/* Priority & Status */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                          <span style={{ fontSize: '10px', fontWeight: 'bold', borderRadius: '6px', padding: '2px 8px' }} className={getPriorityBadgeClass(v.priority)}>
                            {getPriorityLabel(v.priority)}
                          </span>
                          <span style={{ borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', padding: '4px 10px' }} className={getStatusBadgeClass(v.status)}>
                            {getStatusLabel(v.status)}
                          </span>
                        </div>
                      </td>

                      {/* Mission Trigger */}
                      <td style={{ padding: '14px 20px' }}>
                        {v.missions ? (
                          <Link
                            href={`/dashboard/missions/${v.missions.id}/execute`}
                            style={{
                              fontWeight: 'bold',
                              color: '#006d77',
                              background: '#eef6f6',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              textDecoration: 'none',
                              fontSize: '12px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {v.missions.serial_number}
                            <ChevronLeft size={12} />
                          </Link>
                        ) : (
                          <span style={{ color: '#90a4ae', fontSize: '12px' }}>غير مرتبطة</span>
                        )}
                      </td>

                      {/* Dates */}
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '12px' }}>
                          <span style={{ color: '#37474f' }}>
                            📅 رصدت: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{v.created_at ? new Date(v.created_at).toLocaleDateString('en-CA') : 'غير مسجل'}</strong>
                          </span>
                          <span style={{ color: '#b71c1c' }}>
                            🚨 مهلة: <strong style={{ direction: 'ltr', display: 'inline-block' }}>{v.correction_deadline ? new Date(v.correction_deadline).toLocaleDateString('en-CA') : 'غير مسجل'}</strong>
                          </span>
                        </div>
                      </td>

                      {/* Correction Unit */}
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          fontWeight: 'bold',
                          color: '#546e7a',
                          background: '#eceff1',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}>
                          {v.assigned_to_dept || 'غير محددة'}
                        </span>
                      </td>

                      {/* Photo Thumbnail */}
                      <td style={{ padding: '14px 20px', textAlign: 'center' }}>
                        {v.violation_photo_url ? (
                          <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                            <img
                              src={v.violation_photo_url}
                              alt="التوثيق الفني"
                              onClick={() => setSelectedPhoto(v.violation_photo_url!)}
                              style={{
                                width: '48px',
                                height: '36px',
                                objectFit: 'cover',
                                borderRadius: '6px',
                                border: '1px solid #cfdcde',
                                cursor: 'zoom-in',
                                transition: 'transform 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'none'
                              }}
                            />
                            <span style={{ fontSize: '10px', color: '#006d77', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setSelectedPhoto(v.violation_photo_url!)}>
                              🔍 تكبير
                            </span>
                          </div>
                        ) : (
                          <span style={{ color: '#cfd8dc' }}>➖</span>
                        )}
                      </td>
                    </tr>
                  )
                })}

                {filteredViolations.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '40px 20px', textAlign: 'center', color: '#78909c' }}>
                      <strong style={{ fontSize: '14px', color: '#102027', display: 'block', marginBottom: '4px' }}>
                        لا توجد مخالفات تطابق شروط الفلترة
                      </strong>
                      يرجى تعديل خيارات التصفية أو البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 4. PHOTO LIGHTBOX MODAL */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(16, 32, 39, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px',
            cursor: 'zoom-out'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }} onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                position: 'absolute',
                top: '-40px',
                left: 0,
                background: 'white',
                border: 0,
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                color: '#102027'
              }}
            >
              <X size={18} />
            </button>
            <img
              src={selectedPhoto}
              alt="التوثيق الفني للمخالفة"
              style={{
                maxWidth: '100%',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
                border: '3px solid white'
              }}
            />
            <div style={{
              background: 'white',
              borderRadius: '8px',
              padding: '8px 16px',
              marginTop: '12px',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 'bold',
              color: '#102027'
            }}>
              📸 التوثيق المصور للمخالفة المحوكمة الميدانية المعتمدة
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
