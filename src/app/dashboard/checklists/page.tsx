'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import {
  ClipboardList,
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  FileText,
  ShieldCheck,
  Filter,
  RefreshCw,
  Sliders,
  CheckSquare,
  Building2,
  Calendar,
  UserCheck,
  Lock,
  Unlock,
  ArrowRight,
  ChevronLeft,
  ExternalLink,
  BookOpen
} from 'lucide-react'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

type CriterionItem = {
  id: string
  section_id: string
  template_id: string
  criterion_text: string
  guidance?: string | null
  score_type: string
  score_0_label: string
  score_mid_label?: string | null
  score_mid_value?: number | null
  score_max_label: string
  score_max_value: number
  requires_photo?: boolean
  requires_note?: boolean
  sort_order: number
  is_base: boolean
  is_active: boolean
}

type SectionItem = {
  id: string
  template_id: string
  name: string
  section_number: number
  sort_order: number
  max_score?: number
  is_base: boolean
  is_active: boolean
  criteria: CriterionItem[]
}

type TemplateItem = {
  id: string
  name: string
  version: string
  description?: string
  applicable_sectors?: string[] | null
  is_base: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
  updated_by_name?: string
  sections: SectionItem[]
}

type SectorItem = {
  id: string
  name: string
  level: number
}

type UserContext = {
  level: number
  roleTitle: string
  orgName: string
  sectorId: string | null
  sectorName: string
  canEdit: boolean
  canCustomize: boolean
}

export default function ChecklistsPage() {
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [sectors, setSectors] = useState<SectorItem[]>([])
  const [userContext, setUserContext] = useState<UserContext>({
    level: 1,
    roleTitle: 'المشرف العام (ديوان عام الوزارة)',
    orgName: 'وزارة الصحة والسكان',
    sectorId: null,
    sectorName: 'كافة قطاعات الوزارة',
    canEdit: true,
    canCustomize: true
  })

  const [selectedSectorId, setSelectedSectorId] = useState<string>('all')
  
  // Navigation State: null = Master Templates View, string = Detail Template View
  const [openedTemplateId, setOpenedTemplateId] = useState<string | null>(null)
  
  // Search and filter inside opened template
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [selectedSectionFilter, setSelectedSectionFilter] = useState<string>('all')

  // Modal: Create New Template
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateSectorId, setNewTemplateSectorId] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Modal: Add Criterion inside template
  const [showAddCriterionModal, setShowAddCriterionModal] = useState(false)
  const [targetSectionId, setTargetSectionId] = useState('')
  const [newCriterionText, setNewCriterionText] = useState('')
  const [newScoreMaxValue, setNewScoreMaxValue] = useState(2)
  const [savingCriterion, setSavingCriterion] = useState(false)

  // Modal: Add Section inside template
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [savingSection, setSavingSection] = useState(false)

  // Load Data
  const loadTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/checklists')
      if (res.ok) {
        const data = await res.json()
        if (data.templates && data.templates.length > 0) {
          setTemplates(data.templates)
        }
        if (data.sectors) {
          setSectors(data.sectors)
          if (data.sectors.length > 0 && !newTemplateSectorId) {
            setNewTemplateSectorId(data.sectors[0].id)
          }
        }
        if (data.userContext) {
          setUserContext(data.userContext)
          if (data.userContext.sectorId) {
            setSelectedSectorId(data.userContext.sectorId)
          }
        }
      }
    } catch (err) {
      console.error('Error loading checklist templates:', err)
    } finally {
      setLoading(false)
    }
  }, [newTemplateSectorId])

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  // The template currently opened in detail view
  const activeTemplate = useMemo(() => {
    if (!openedTemplateId) return null
    return templates.find((t) => t.id === openedTemplateId) || null
  }, [templates, openedTemplateId])

  const sections = activeTemplate?.sections || []

  // Filter templates list on Master view
  const filteredTemplates = useMemo(() => {
    if (selectedSectorId === 'all') return templates
    return templates.filter((t) => {
      if (!t.applicable_sectors || t.applicable_sectors.length === 0) return true
      return t.applicable_sectors.includes(selectedSectorId)
    })
  }, [templates, selectedSectorId])

  // Filter sections & criteria inside the opened template
  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return sections
      .map((section) => {
        if (selectedSectionFilter !== 'all' && section.id !== selectedSectionFilter) {
          return null
        }

        const sectionMatches = section.name.toLowerCase().includes(q)
        const matchingCriteria = (section.criteria || []).filter((c) => {
          if (!q) return true
          return (
            c.criterion_text.toLowerCase().includes(q) ||
            (c.guidance || '').toLowerCase().includes(q) ||
            sectionMatches
          )
        })

        if (!q || sectionMatches || matchingCriteria.length > 0) {
          return {
            ...section,
            criteria: q ? matchingCriteria : section.criteria
          }
        }
        return null
      })
      .filter(Boolean) as SectionItem[]
  }, [sections, searchQuery, selectedSectionFilter])

  // Toggle expand section
  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const expandAll = () => {
    const next: Record<string, boolean> = {}
    sections.forEach((s) => {
      next[s.id] = true
    })
    setExpandedSections(next)
  }

  const collapseAll = () => {
    setExpandedSections({})
  }

  // Create new Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTemplateName.trim()) return

    setSavingTemplate(true)
    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_template',
          name: newTemplateName.trim(),
          applicable_sectors: newTemplateSectorId ? [newTemplateSectorId] : null,
          description: newTemplateDescription.trim(),
          version: '1.0'
        })
      })

      if (res.ok) {
        setShowCreateTemplateModal(false)
        setNewTemplateName('')
        setNewTemplateDescription('')
        await loadTemplates()
      } else {
        const data = await res.json()
        alert('حدث خطأ: ' + (data.error || 'فشل إنشاء الاستمارة'))
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  // Add custom criterion
  const handleSaveCriterion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCriterionText.trim() || !targetSectionId || !activeTemplate) return

    setSavingCriterion(true)
    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_criterion',
          template_id: activeTemplate.id,
          section_id: targetSectionId,
          criterion_text: newCriterionText.trim(),
          score_max_value: Number(newScoreMaxValue) || 2
        })
      })

      if (res.ok) {
        setShowAddCriterionModal(false)
        setNewCriterionText('')
        await loadTemplates()
      } else {
        const data = await res.json()
        alert('حدث خطأ: ' + (data.error || 'فشل حفظ المعيار'))
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message)
    } finally {
      setSavingCriterion(false)
    }
  }

  // Add custom section
  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSectionName.trim() || !activeTemplate) return

    setSavingSection(true)
    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_section',
          template_id: activeTemplate.id,
          name: newSectionName.trim(),
          section_number: sections.length + 1
        })
      })

      if (res.ok) {
        setShowAddSectionModal(false)
        setNewSectionName('')
        await loadTemplates()
      } else {
        const data = await res.json()
        alert('حدث خطأ: ' + (data.error || 'فشل إضافة القسم'))
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message)
    } finally {
      setSavingSection(false)
    }
  }

  return (
    <DashboardShell>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* ════════════════════════════════════════════════════════════════════
            LEVEL 1: MASTER TEMPLATES DIRECTORY (قائمة استمارات المرور)
        ════════════════════════════════════════════════════════════════════ */}
        {!activeTemplate && (
          <>
            {/* Top Header Banner */}
            <div style={{
              background: 'linear-gradient(135deg, #0e4b5a 0%, #16725a 50%, #1abc9c 100%)',
              borderRadius: '16px',
              padding: '24px 28px',
              color: 'white',
              boxShadow: '0 8px 24px rgba(22, 114, 90, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px', borderRadius: '10px' }}>
                    <ClipboardList size={22} />
                  </div>
                  <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
                    دليل استمارات المرور الميداني للقطاعات الصحية
                  </h1>
                </div>
                <p style={{ margin: 0, fontSize: '13px', opacity: 0.9, lineHeight: '1.6' }}>
                  المنظومة المركزية لإدارة استمارات ومعايير التفتيش والمطابقة المعتمدة بوزارة الصحة والسكان
                </p>
              </div>

              {/* Prominent "+ إنشاء استمارة جديدة" Button */}
              {userContext.canEdit && (
                <button
                  onClick={() => setShowCreateTemplateModal(true)}
                  style={{
                    background: 'white',
                    color: '#16725a',
                    border: 0,
                    borderRadius: '10px',
                    padding: '10px 20px',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    transition: 'transform 0.15s'
                  }}
                  type="button"
                >
                  <Plus size={18} />
                  إنشاء استمارة مرور جديدة ➕
                </button>
              )}
            </div>

            {/* Sector Tabs (For Level 1 / Level 2) */}
            {userContext.level <= 2 && sectors.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '14px',
                border: '1px solid #e2ecee',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#546e7a', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Building2 size={15} style={{ color: 'var(--brand)' }} />
                  تصفية بحسب القطاع:
                </span>
                <button
                  onClick={() => setSelectedSectorId('all')}
                  style={{
                    background: selectedSectorId === 'all' ? 'var(--brand)' : '#f1f5f7',
                    color: selectedSectorId === 'all' ? 'white' : '#37474f',
                    border: 0,
                    borderRadius: '20px',
                    padding: '5px 14px',
                    fontSize: '11.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  type="button"
                >
                  كافة القطاعات ({templates.length})
                </button>
                {sectors.map((sec) => (
                  <button
                    key={sec.id}
                    onClick={() => setSelectedSectorId(sec.id)}
                    style={{
                      background: selectedSectorId === sec.id ? 'var(--brand)' : '#f1f5f7',
                      color: selectedSectorId === sec.id ? 'white' : '#37474f',
                      border: 0,
                      borderRadius: '20px',
                      padding: '5px 14px',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    type="button"
                  >
                    {sec.name}
                  </button>
                ))}
              </div>
            )}

            {/* Templates Cards Grid */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px', color: '#78909c' }}>
                <RefreshCw size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--brand)' }} />
                <div>جاري تحميل دليل الاستمارات الرسمية...</div>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div style={{
                background: 'white',
                borderRadius: '14px',
                padding: '40px',
                textAlign: 'center',
                color: '#78909c',
                border: '1px solid #e2ecee'
              }}>
                <AlertCircle size={36} style={{ color: '#f39c12', margin: '0 auto 10px' }} />
                <strong>لا توجد استمارات مسجلة لهذا القطاع حالياً</strong>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
                {filteredTemplates.map((template) => {
                  const secCount = template.sections?.length || 0
                  const critCount = template.sections?.reduce((acc, s) => acc + (s.criteria?.length || 0), 0) || 0

                  return (
                    <div
                      key={template.id}
                      style={{
                        background: 'white',
                        borderRadius: '16px',
                        border: '1px solid #e2ecee',
                        padding: '24px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '18px',
                        transition: 'all 0.2s',
                        position: 'relative'
                      }}
                    >
                      {/* Card Header */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                          <span style={{
                            background: '#eaf8f3',
                            color: '#16725a',
                            border: '1px solid #c2ebd9',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            إصدار {template.version || '1.0'}
                          </span>

                          <span style={{
                            background: '#f8fbfb',
                            color: '#546e7a',
                            border: '1px solid #cfdcde',
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            قطاع الرعاية الصحية الأولية
                          </span>
                        </div>

                        <h2 style={{ fontSize: '16px', color: '#102027', fontWeight: '800', margin: '0 0 8px', lineHeight: '1.4' }}>
                          {template.name}
                        </h2>

                        <p style={{ fontSize: '12.5px', color: '#78909c', margin: 0, lineHeight: '1.5' }}>
                          {template.description || 'الاستمارة الموحدة الشاملة لتفتيش وتقييم وحدات ومراكز طب الأسرة والمستشفيات التابعة.'}
                        </p>
                      </div>

                      {/* Card Metric Grid */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '10px',
                        background: '#f8fbfb',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        border: '1px solid #eef3f4'
                      }}>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#90a4ae', display: 'block' }}>أقسام التفتيش</span>
                          <strong style={{ fontSize: '15px', color: '#263238' }}>{secCount} قسماً</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: '10.5px', color: '#90a4ae', display: 'block' }}>معايير التقييم</span>
                          <strong style={{ fontSize: '15px', color: '#263238' }}>{critCount} معياراً</strong>
                        </div>
                      </div>

                      {/* Audit info */}
                      <div style={{ fontSize: '11px', color: '#90a4ae', display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #eceff1', paddingTop: '10px' }}>
                        <span>📅 الاعتماد: 16 أغسطس 2026</span>
                        <span>✍️ ديوان عام الوزارة</span>
                      </div>

                      {/* Action Button: Open Template */}
                      <button
                        onClick={() => {
                          setOpenedTemplateId(template.id)
                          setExpandedSections({})
                        }}
                        style={{
                          background: 'var(--brand)',
                          color: 'white',
                          border: 0,
                          borderRadius: '10px',
                          padding: '12px 16px',
                          fontSize: '13px',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(22,160,133,0.2)',
                          transition: 'background 0.15s'
                        }}
                        type="button"
                      >
                        <BookOpen size={16} />
                        <span>فتح واستعراض معايير الاستمارة</span>
                        <ChevronLeft size={16} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            LEVEL 2: DETAIL VIEW INSIDE A SPECIFIC TEMPLATE (داخل الاستمارة)
        ════════════════════════════════════════════════════════════════════ */}
        {activeTemplate && (
          <>
            {/* Back Button & Template Header */}
            <div style={{
              background: 'linear-gradient(135deg, #0e4b5a 0%, #16725a 50%, #1abc9c 100%)',
              borderRadius: '16px',
              padding: '22px 28px',
              color: 'white',
              boxShadow: '0 8px 24px rgba(22, 114, 90, 0.2)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div>
                <button
                  onClick={() => setOpenedTemplateId(null)}
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '10px'
                  }}
                  type="button"
                >
                  <ArrowRight size={14} />
                  العودة إلى قائمة الاستمارات
                </button>

                <h1 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800' }}>
                  {activeTemplate.name}
                </h1>
                <p style={{ margin: 0, fontSize: '12.5px', opacity: 0.9 }}>
                  {activeTemplate.description || 'الاستمارة الموحدة المعتمدة لتفتيش وتقييم منشآت الرعاية الصحية الأولية'} • إصدار {activeTemplate.version}
                </p>
              </div>

              {/* Action Buttons: Add Section & Add Criterion */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {userContext.canEdit && (
                  <>
                    <button
                      onClick={() => setShowAddSectionModal(true)}
                      style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: '1px solid rgba(255,255,255,0.4)',
                        color: 'white',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      type="button"
                    >
                      <Plus size={15} />
                      إضافة قسم جديد
                    </button>

                    <button
                      onClick={() => {
                        if (sections.length > 0) {
                          setTargetSectionId(sections[0].id)
                          setShowAddCriterionModal(true)
                        }
                      }}
                      style={{
                        background: 'white',
                        color: '#16725a',
                        border: 0,
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                      }}
                      type="button"
                    >
                      <Plus size={15} />
                      إضافة معيار جديد
                    </button>
                  </>
                )}

                <button
                  onClick={expandAll}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  توسيع الكل ⤢
                </button>
                <button
                  onClick={collapseAll}
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.3)',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  type="button"
                >
                  طي الكل ⤡
                </button>
              </div>
            </div>

            {/* Audit & Modification Metadata Bar */}
            <div style={{
              background: 'white',
              borderRadius: '14px',
              border: '1px solid #e2ecee',
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              fontSize: '12px',
              color: '#546e7a',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar size={15} style={{ color: 'var(--brand)' }} />
                  <span><strong>تاريخ الاعتماد:</strong> 16 أغسطس 2026</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UserCheck size={15} style={{ color: '#2980b9' }} />
                  <span><strong>جهة الاعتماد:</strong> ديوان عام الوزارة - قطاع الرعاية الصحية الأولية وتنمية الأسرة</span>
                </div>
              </div>

              <div>
                {userContext.canEdit ? (
                  <span style={{
                    background: '#eafaf1',
                    color: '#27ae60',
                    border: '1px solid #c2ebd9',
                    borderRadius: '20px',
                    padding: '3px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Unlock size={12} />
                    تملك صلاحية تعديل واعتماد الاستمارة والمعايير
                  </span>
                ) : (
                  <span style={{
                    background: '#f8fbfb',
                    color: '#78909c',
                    border: '1px solid #cfdcde',
                    borderRadius: '20px',
                    padding: '3px 12px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Lock size={12} />
                    استمارة معتمدة رسمياً (صلاحية استعراض وتنفيذ فقط)
                  </span>
                )}
              </div>
            </div>

            {/* Search & Filter Controls inside template */}
            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '14px 20px',
              border: '1px solid #e2ecee',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'space-between',
              alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: '#f8fbfb',
                border: '1px solid #cfdcde',
                borderRadius: '10px',
                padding: '0 12px',
                flex: '1 1 300px',
                minHeight: '38px'
              }}>
                <Search size={15} style={{ color: '#78909c' }} />
                <input
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث في نصوص المعايير أو أسماء الأقسام..."
                  style={{
                    border: 0,
                    background: 'transparent',
                    outline: 'none',
                    width: '100%',
                    fontSize: '12.5px',
                    color: '#263238'
                  }}
                  type="text"
                  value={searchQuery}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    style={{ background: 'transparent', border: 0, color: '#90a4ae', cursor: 'pointer', fontSize: '12px' }}
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} style={{ color: '#78909c' }} />
                <select
                  onChange={(e) => setSelectedSectionFilter(e.target.value)}
                  style={{
                    minHeight: '38px',
                    border: '1px solid #cfdcde',
                    borderRadius: '10px',
                    padding: '0 12px',
                    fontSize: '12px',
                    background: '#f8fbfb',
                    outline: 'none',
                    color: '#37474f'
                  }}
                  value={selectedSectionFilter}
                >
                  <option value="all">كل الأقسام التفتيشية ({sections.length})</option>
                  {sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.section_number}. {sec.name} ({sec.criteria?.length || 0} معيار)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 37 Sections Accordion Tree (CLOSED BY DEFAULT) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredSections.map((section) => {
                const isExpanded = expandedSections[section.id] || Boolean(searchQuery)
                const criteriaList = section.criteria || []

                return (
                  <div
                    key={section.id}
                    style={{
                      background: 'white',
                      borderRadius: '12px',
                      border: isExpanded ? '1.5px solid #16a085' : '1px solid #e2ecee',
                      boxShadow: isExpanded ? '0 4px 14px rgba(22, 160, 133, 0.08)' : '0 1px 4px rgba(0,0,0,0.02)',
                      overflow: 'hidden',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {/* Section Header Accordion Bar (Clicking opens and closes the section) */}
                    <div
                      onClick={() => toggleSection(section.id)}
                      style={{
                        padding: '14px 18px',
                        background: isExpanded ? '#f0fcf9' : '#fafcfc',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          background: isExpanded ? 'var(--brand)' : '#cfdcde',
                          color: isExpanded ? 'white' : '#37474f',
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {section.section_number}
                        </span>
                        <div>
                          <strong style={{ fontSize: '14px', color: '#102027', display: 'block' }}>{section.name}</strong>
                          <span style={{ fontSize: '11px', color: '#78909c' }}>
                            {isExpanded ? 'انقر للطي' : 'انقر لفتح واستعراض المعايير'}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          fontSize: '11px',
                          background: 'white',
                          border: '1px solid #cfdcde',
                          padding: '3px 10px',
                          borderRadius: '12px',
                          color: '#546e7a',
                          fontWeight: '600'
                        }}>
                          {criteriaList.length} معيار
                        </span>
                        {isExpanded ? <ChevronUp size={18} style={{ color: 'var(--brand)' }} /> : <ChevronDown size={18} style={{ color: '#90a4ae' }} />}
                      </div>
                    </div>

                    {/* Section Criteria Items (Visible only when expanded) */}
                    {isExpanded && (
                      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #eef3f4' }}>
                        {criteriaList.length === 0 ? (
                          <div style={{ fontSize: '12px', color: '#90a4ae', textAlign: 'center', padding: '10px' }}>
                            لا توجد معايير في هذا القسم
                          </div>
                        ) : (
                          criteriaList.map((criterion, idx) => (
                            <div
                              key={criterion.id}
                              style={{
                                background: '#f8fbfb',
                                border: '1px solid #eef2f3',
                                borderRadius: '8px',
                                padding: '12px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                gap: '14px'
                              }}
                            >
                              <div style={{ display: 'flex', gap: '10px', flex: 1 }}>
                                <span style={{ fontSize: '11.5px', color: '#90a4ae', fontWeight: 'bold', paddingTop: '2px' }}>
                                  #{idx + 1}
                                </span>
                                <div>
                                  <div style={{ fontSize: '13px', color: '#263238', fontWeight: '600', lineHeight: '1.5' }}>
                                    {criterion.criterion_text}
                                  </div>
                                  {criterion.guidance && (
                                    <div style={{ fontSize: '11px', color: '#78909c', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <HelpCircle size={12} />
                                      <span>دليل التحقق: {criterion.guidance}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Evaluation Scoring Scheme Badge */}
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                                <span style={{
                                  fontSize: '10.5px',
                                  background: '#eaf8f3',
                                  color: '#16725a',
                                  border: '1px solid #c2ebd9',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 'bold'
                                }}>
                                  {criterion.score_max_label} ({criterion.score_max_value} درجات)
                                </span>
                                {criterion.score_mid_value != null && (
                                  <span style={{
                                    fontSize: '10.5px',
                                    background: '#fef9e7',
                                    color: '#b7950b',
                                    border: '1px solid #f9e79f',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold'
                                  }}>
                                    {criterion.score_mid_label || 'متوسط'} ({criterion.score_mid_value})
                                  </span>
                                )}
                                <span style={{
                                  fontSize: '10.5px',
                                  background: '#fdedec',
                                  color: '#c0392b',
                                  border: '1px solid #fadbd8',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: 'bold'
                                }}>
                                  {criterion.score_0_label} (0)
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {/* ── Modal: Create New Template ── */}
        {showCreateTemplateModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              direction: 'rtl'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#102027', fontWeight: 'bold' }}>
                إنشاء وتصميم استمارة مرور قطاعية جديدة
              </h3>

              <form onSubmit={handleCreateTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                  اسم استمارة المرور *
                  <input
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="مثال: استمارة المرور والتفتيش على المستشفيات العامة"
                    required
                    style={{
                      minHeight: '38px',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '0 10px',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                    type="text"
                    value={newTemplateName}
                  />
                </label>

                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                  القطاع التابع له الاستمارة *
                  <select
                    onChange={(e) => setNewTemplateSectorId(e.target.value)}
                    style={{
                      minHeight: '38px',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '0 8px',
                      fontSize: '12.5px',
                      outline: 'none',
                      background: 'white'
                    }}
                    value={newTemplateSectorId}
                  >
                    {sectors.map((sec) => (
                      <option key={sec.id} value={sec.id}>{sec.name}</option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                  وصف ونطاق تطبيق الاستمارة
                  <textarea
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                    placeholder="وصف مختصر للغرض من الاستمارة والمنشآت المستهدفة..."
                    rows={3}
                    style={{
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                    value={newTemplateDescription}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => setShowCreateTemplateModal(false)}
                    style={{
                      background: '#eceff1',
                      color: '#546e7a',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                    type="button"
                  >
                    إلغاء
                  </button>

                  <button
                    disabled={savingTemplate}
                    style={{
                      background: 'var(--brand)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: savingTemplate ? 'not-allowed' : 'pointer'
                    }}
                    type="submit"
                  >
                    {savingTemplate ? 'جاري الإنشاء...' : 'إنشاء الاستمارة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Add Custom Section ── */}
        {showAddSectionModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              direction: 'rtl'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#102027', fontWeight: 'bold' }}>
                إضافة قسم تفتيشي جديد إلى الاستمارة
              </h3>

              <form onSubmit={handleSaveSection} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                  اسم القسم الجديد *
                  <input
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="مثال: قسم العيادات المسائية والتخصصية"
                    required
                    style={{
                      minHeight: '38px',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '0 10px',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                    type="text"
                    value={newSectionName}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => setShowAddSectionModal(false)}
                    style={{
                      background: '#eceff1',
                      color: '#546e7a',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                    type="button"
                  >
                    إلغاء
                  </button>

                  <button
                    disabled={savingSection}
                    style={{
                      background: 'var(--brand)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: savingSection ? 'not-allowed' : 'pointer'
                    }}
                    type="submit"
                  >
                    {savingSection ? 'جاري الحفظ...' : 'إضافة القسم'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Add Custom Criterion ── */}
        {showAddCriterionModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '540px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              direction: 'rtl'
            }}>
              <h3 style={{ margin: '0 0 16px', fontSize: '16px', color: '#102027', fontWeight: 'bold' }}>
                إضافة معيار رقابي جديد إلى الاستمارة
              </h3>

              <form onSubmit={handleSaveCriterion} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                  القسم التفتيشي التابع له *
                  <select
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    style={{
                      minHeight: '38px',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '0 8px',
                      fontSize: '12.5px',
                      outline: 'none',
                      background: 'white'
                    }}
                    value={targetSectionId}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.section_number}. {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                  نص المعيار الرقابي *
                  <textarea
                    onChange={(e) => setNewCriterionText(e.target.value)}
                    placeholder="مثال: هل يتوافر بالمنشأة سجل معتمد لمتابعة درجات حرارة الثلاجات بانتظام؟"
                    required
                    rows={3}
                    style={{
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '12.5px',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                    value={newCriterionText}
                  />
                </label>

                <label style={{ display: 'grid', gap: '4px', fontSize: '12px', color: '#37474f', fontWeight: 'bold' }}>
                  الدرجة القصوى للمعيار عند المطابقة *
                  <select
                    onChange={(e) => setNewScoreMaxValue(Number(e.target.value))}
                    style={{
                      minHeight: '38px',
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '0 8px',
                      fontSize: '12.5px',
                      outline: 'none',
                      background: 'white'
                    }}
                    value={newScoreMaxValue}
                  >
                    <option value={2}>2 درجات (معيار قياسي)</option>
                    <option value={4}>4 درجات (معيار ذو أولوية عالية)</option>
                    <option value={6}>6 درجات (معيار حرج / سلامة مرضى)</option>
                  </select>
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button
                    onClick={() => setShowAddCriterionModal(false)}
                    style={{
                      background: '#eceff1',
                      color: '#546e7a',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                    type="button"
                  >
                    إلغاء
                  </button>

                  <button
                    disabled={savingCriterion}
                    style={{
                      background: 'var(--brand)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: savingCriterion ? 'not-allowed' : 'pointer'
                    }}
                    type="submit"
                  >
                    {savingCriterion ? 'جاري الحفظ...' : 'حفظ المعيار'}
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
