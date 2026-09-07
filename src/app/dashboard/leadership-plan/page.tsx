'use client'

import { useState, useEffect, useMemo } from 'react'
import { DashboardShell } from '@/app/system-ui'
import {
  Target,
  Plus,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Trash2,
  TrendingUp,
  Award,
  ChevronLeft,
  Sparkles,
  Search,
  Filter
} from 'lucide-react'

type LeadershipTarget = {
  id: string
  title: string
  sector_head_id: string
  sector_name: string
  undersecretary_id: string
  undersecretary_name: string
  undersecretary_email?: string
  governorate: string
  target_missions: number
  executed_missions?: number
  in_progress_missions?: number
  completion_rate?: number
  start_date: string
  end_date: string
  status: string
  instructions?: string
  created_at: string
}

type Candidate = {
  id: string
  full_name: string
  email: string
  job_title: string
  governorate: string
}

export default function LeadershipPlanPage() {
  const [loading, setLoading] = useState(true)
  const [targets, setTargets] = useState<LeadershipTarget[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [currentUser, setCurrentUser] = useState<any>({ isSectorHeadOrAbove: true, level: 1 })
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGovFilter, setSelectedGovFilter] = useState('all')

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    undersecretary_id: '',
    undersecretary_name: '',
    undersecretary_email: '',
    governorate: 'القاهرة',
    target_missions: 20,
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    instructions: ''
  })
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/leadership-targets')
      if (res.ok) {
        const data = await res.json()
        setTargets(data.targets || [])
        setCandidates(data.candidates || [])
        setCurrentUser(data.currentUser || { isSectorHeadOrAbove: true })
      }
    } catch (e) {
      console.error('Error fetching leadership targets:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCandidateChange = (candId: string) => {
    const cand = candidates.find(c => c.id === candId)
    if (cand) {
      setFormData(prev => ({
        ...prev,
        undersecretary_id: cand.id,
        undersecretary_name: cand.full_name,
        undersecretary_email: cand.email,
        governorate: cand.governorate,
        title: prev.title || `خطة مرور قيادات مديرية ${cand.governorate}`
      }))
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/leadership-targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      if (res.ok) {
        setShowModal(false)
        setFormData({
          title: '',
          undersecretary_id: '',
          undersecretary_name: '',
          undersecretary_email: '',
          governorate: 'القاهرة',
          target_missions: 20,
          start_date: new Date().toISOString().slice(0, 10),
          end_date: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
          instructions: ''
        })
        await loadData()
      } else {
        const err = await res.json()
        alert(err.error || 'حدث خطأ أثناء حفظ المستهدف')
      }
    } catch (e) {
      alert('تعذر الحفظ، يرجى المحاولة مرة أخرى')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المستهدف؟')) return
    try {
      const res = await fetch(`/api/admin/leadership-targets?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setTargets(prev => prev.filter(t => t.id !== id))
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalTargets = targets.length
    const totalTargetMissions = targets.reduce((sum, t) => sum + (Number(t.target_missions) || 0), 0)
    const totalExecutedMissions = targets.reduce((sum, t) => sum + (Number(t.executed_missions) || 0), 0)
    const avgRate = totalTargetMissions > 0 ? Math.min(100, Math.round((totalExecutedMissions / totalTargetMissions) * 100)) : 0
    return { totalTargets, totalTargetMissions, totalExecutedMissions, avgRate }
  }, [targets])

  // Filtered Targets
  const filteredTargets = useMemo(() => {
    return targets.filter(t => {
      const matchSearch = (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.undersecretary_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.governorate || '').toLowerCase().includes(searchQuery.toLowerCase())
      const matchGov = selectedGovFilter === 'all' || t.governorate === selectedGovFilter
      return matchSearch && matchGov
    })
  }, [targets, searchQuery, selectedGovFilter])

  const uniqueGovs = useMemo(() => {
    const govs = new Set(targets.map(t => t.governorate).filter(Boolean))
    return Array.from(govs)
  }, [targets])

  return (
    <DashboardShell view="leadership-plan">
      <div style={{ padding: '24px 32px', maxWidth: '1400px', margin: '0 auto', direction: 'rtl' }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          background: 'linear-gradient(135deg, #0a3d62 0%, #002d40 100%)',
          padding: '24px 28px',
          borderRadius: '16px',
          color: 'white',
          boxShadow: '0 8px 24px rgba(10, 61, 98, 0.2)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{
                background: 'rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '20px',
                fontSize: '11.5px',
                fontWeight: 'bold',
                letterSpacing: '0.5px'
              }}>
                ⭐ حوكمة خطط المرور ومستهدفات وكلاء الوزارة
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>خطة مرور القيادات والمستهدفات</h1>
            <p style={{ margin: '6px 0 0', fontSize: '13.5px', opacity: 0.85 }}>
              تحديد ومتابعة مستهدفات المرور الرقابي المعتمدة لوكلاء الوزارة ومديري المديريات الصحية وحساب المنفذ الفعلي
            </p>
          </div>

          {currentUser.isSectorHeadOrAbove && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#2ecc71',
                color: '#003318',
                border: 'none',
                padding: '12px 22px',
                borderRadius: '12px',
                fontWeight: '800',
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(46, 204, 113, 0.4)',
                transition: 'all 0.2s ease'
              }}
            >
              <Plus size={18} />
              إضافة مستهدف قيادي جديد
            </button>
          )}
        </div>

        {/* Top Summary Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          {/* Card 1: Total Plans */}
          <div style={{
            background: 'white',
            borderRadius: '14px',
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#e0f2fe',
              color: '#0369a1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Target size={24} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>خطط القيادات النشطة</span>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>
                {summaryMetrics.totalTargets} <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#64748b' }}>خطة</span>
              </div>
            </div>
          </div>

          {/* Card 2: Target Missions */}
          <div style={{
            background: 'white',
            borderRadius: '14px',
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#fef3c7',
              color: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Award size={24} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>المستهدف المطلوب تنفيذه</span>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#b45309' }}>
                {summaryMetrics.totalTargetMissions} <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#64748b' }}>مأمورية</span>
              </div>
            </div>
          </div>

          {/* Card 3: Executed Missions */}
          <div style={{
            background: 'white',
            borderRadius: '14px',
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#dcfce7',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>المنفذ الفعلي من المستهدف</span>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#16a34a' }}>
                {summaryMetrics.totalExecutedMissions} <span style={{ fontSize: '13px', fontWeight: 'normal', color: '#64748b' }}>مأمورية</span>
              </div>
            </div>
          </div>

          {/* Card 4: Completion Rate */}
          <div style={{
            background: 'white',
            borderRadius: '14px',
            padding: '18px 20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px'
          }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#f3e8ff',
              color: '#7e22ce',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={24} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold' }}>نسبة تحقيق المستهدف</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#7e22ce' }}>{summaryMetrics.avgRate}%</span>
              </div>
              <div style={{
                height: '7px',
                background: '#e2e8f0',
                borderRadius: '10px',
                overflow: 'hidden',
                marginTop: '6px'
              }}>
                <div style={{
                  height: '100%',
                  width: `${summaryMetrics.avgRate}%`,
                  background: summaryMetrics.avgRate >= 80 ? '#10b981' : (summaryMetrics.avgRate >= 50 ? '#f59e0b' : '#ef4444'),
                  borderRadius: '10px',
                  transition: 'width 0.6s ease'
                }} />
              </div>
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '14px 18px',
          marginBottom: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 300px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={16} style={{ position: 'absolute', right: '12px', top: '11px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="البحث باسم وكيل الوزارة، الخطة، أو المحافظة..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 36px 9px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: '#64748b' }} />
            <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 'bold' }}>المحافظة:</span>
            <select
              value={selectedGovFilter}
              onChange={e => setSelectedGovFilter(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '12.5px',
                background: '#f8fafc',
                outline: 'none',
                fontWeight: 'bold',
                color: '#334155'
              }}
            >
              <option value="all">كافة المحافظات ({targets.length})</option>
              {uniqueGovs.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Targets Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>جاري تحميل خطط ومستهدفات القيادات...</div>
          </div>
        ) : filteredTargets.length === 0 ? (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '50px 20px',
            textAlign: 'center',
            border: '2px dashed #cbd5e1'
          }}>
            <Target size={48} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 6px', fontSize: '17px', color: '#334155' }}>لا توجد خطط مستهدفة مسجلة حالياً</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              {currentUser.isSectorHeadOrAbove 
                ? 'يمكنك البدء بإضافة مستهدف مروري جديد لوكلاء الوزارة من الزر بالأعلى'
                : 'لم يتم تعيين مستهدفات لمديريتك في هذه الفترة'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))', gap: '20px' }}>
            {filteredTargets.map(target => {
              const completion = target.completion_rate || 0
              const isHigh = completion >= 80
              const isMed = completion >= 50 && completion < 80
              const progressColor = isHigh ? '#10b981' : (isMed ? '#f59e0b' : '#ef4444')

              return (
                <div
                  key={target.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                    padding: '22px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    position: 'relative'
                  }}
                >
                  {/* Top Row: Governorate & Status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: '#e0f2fe',
                        color: '#0284c7',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <MapPin size={12} />
                        محافظة {target.governorate}
                      </span>
                      <span style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {target.sector_name}
                      </span>
                    </div>

                    {currentUser.isSectorHeadOrAbove && (
                      <button
                        onClick={() => handleDelete(target.id)}
                        title="حذف المستهدف"
                        style={{
                          background: 'transparent',
                          border: 0,
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '6px'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  {/* Title & Undersecretary */}
                  <div>
                    <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                      {target.title}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#3b82f6', fontWeight: 'bold' }}>
                      <User size={15} />
                      {target.undersecretary_name}
                    </div>
                  </div>

                  {/* Progress and Target Stats */}
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    border: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
                      <div>
                        <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 'bold' }}>موقف التنفيذ الفعلي</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                          <span style={{ color: progressColor }}>{target.executed_missions || 0}</span>
                          <span style={{ fontSize: '13px', color: '#64748b', margin: '0 4px' }}>/</span>
                          <span>{target.target_missions}</span>
                          <span style={{ fontSize: '12px', color: '#64748b', marginRight: '4px', fontWeight: 'normal' }}>مأمورية</span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'left' }}>
                        <span style={{
                          background: isHigh ? '#dcfce7' : (isMed ? '#fef3c7' : '#fee2e2'),
                          color: progressColor,
                          padding: '3px 10px',
                          borderRadius: '12px',
                          fontSize: '13px',
                          fontWeight: '800'
                        }}>
                          {completion}% إنجاز
                        </span>
                      </div>
                    </div>

                    <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${completion}%`,
                        background: progressColor,
                        borderRadius: '10px',
                        transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>

                  {/* Instructions */}
                  {target.instructions && (
                    <div style={{
                      fontSize: '12px',
                      color: '#475569',
                      background: '#fffbeb',
                      borderRight: '3px solid #f59e0b',
                      padding: '8px 12px',
                      borderRadius: '0 8px 8px 0',
                      lineHeight: '1.5'
                    }}>
                      <strong>توجيهات رئيس القطاع: </strong>
                      {target.instructions}
                    </div>
                  )}

                  {/* Dates Footer */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '12px',
                    fontSize: '11.5px',
                    color: '#64748b'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} />
                      <span>الفترة: من {target.start_date} إلى {target.end_date}</span>
                    </div>
                    <span style={{
                      color: '#10b981',
                      fontWeight: 'bold',
                      background: '#ecfdf5',
                      padding: '2px 8px',
                      borderRadius: '6px'
                    }}>
                      نشطة ومحدثة
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal: Add New Leadership Target */}
        {showModal && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '20px',
              maxWidth: '560px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              direction: 'rtl'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Target size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: '#0f172a' }}>
                    اعتماد مستهدف مروري لوكيل الوزارة / مدير المديرية
                  </h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                    صادر من مكتب رئيس القطاع المركزي لمتابعة مؤشرات الإنجاز
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Undersecretary / User Candidate Select */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                    وكيل الوزارة / مدير المديرية المستهدف *
                  </label>
                  <select
                    required
                    value={formData.undersecretary_id}
                    onChange={e => handleCandidateChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      background: '#fff'
                    }}
                  >
                    <option value="">-- اختر المسؤول والمديرية المستهدفة --</option>
                    {candidates.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.full_name} ({c.job_title} - {c.governorate})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Plan Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                    عنوان الخطة أو المستهدف *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: خطة المرور على المستشفيات المركزية - سبتمبر 2026"
                    value={formData.title}
                    onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Governorate & Target Missions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                      المحافظة *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.governorate}
                      onChange={e => setFormData(prev => ({ ...prev, governorate: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                      المستهدف (عدد المأموريات) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={500}
                      value={formData.target_missions}
                      onChange={e => setFormData(prev => ({ ...prev, target_missions: Number(e.target.value) }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        fontWeight: 'bold'
                      }}
                    />
                  </div>
                </div>

                {/* Start and End Date */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                      تاريخ بدء الخطة *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.start_date}
                      onChange={e => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                      تاريخ نهاية الخطة *
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.end_date}
                      onChange={e => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>

                {/* Instructions */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' }}>
                    توجيهات وملاحظات رئيس القطاع للمرور
                  </label>
                  <textarea
                    rows={2}
                    placeholder="مثال: التركيز على أقسام الطوارئ وسلاسل تبريد الأمصال وتوافر الأدوية المنقذة للحياة..."
                    value={formData.instructions}
                    onChange={e => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 0,
                      padding: '10px 18px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    style={{
                      background: '#0a3d62',
                      color: 'white',
                      border: 0,
                      padding: '10px 22px',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {saving ? 'جاري الحفظ...' : 'اعتماد وحفظ المستهدف'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  )
}
