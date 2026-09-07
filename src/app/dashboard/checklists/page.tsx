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
  BookOpen,
  Star,
  Trash2,
  Scale,
  Percent,
  Award,
  Edit2,
  Eye,
  Play,
  Camera,
  Check,
  X,
  Printer,
  AlertTriangle
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
  const [newScoreMaxValue, setNewScoreMaxValue] = useState(5)
  const [newScoreType, setNewScoreType] = useState<'yes_no' | 'availability' | 'rating_5' | 'percentage' | 'compliance_3level'>('yes_no')
  const [newRequiresPhoto, setNewRequiresPhoto] = useState(false)
  const [newRequiresNote, setNewRequiresNote] = useState(false)
  const [savingCriterion, setSavingCriterion] = useState(false)
  const [balancingWeights, setBalancingWeights] = useState(false)
  const [previewAnswer, setPreviewAnswer] = useState<any>(null)
  const [showWeightGuide, setShowWeightGuide] = useState(false)

  // Modal: Add Section inside template
  const [showAddSectionModal, setShowAddSectionModal] = useState(false)
  const [newSectionName, setNewSectionName] = useState('')
  const [savingSection, setSavingSection] = useState(false)

  // Modal / Action: Edit / Rename Section
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionName, setEditingSectionName] = useState('')
  const [savingEditSection, setSavingEditSection] = useState(false)

  // Modal / Action: Edit / Rename Template
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateName, setEditingTemplateName] = useState('')
  const [editingTemplateDescription, setEditingTemplateDescription] = useState('')
  const [savingEditTemplate, setSavingEditTemplate] = useState(false)

  // Feature: Interactive Form Simulator (Sandbox)
  const [simulatorTemplateId, setSimulatorTemplateId] = useState<string | null>(null)
  const [simAnswers, setSimAnswers] = useState<Record<string, any>>({})
  const [simNotes, setSimNotes] = useState<Record<string, string>>({})
  const [simPhotos, setSimPhotos] = useState<Record<string, boolean>>({})
  const [showSimSummaryModal, setShowSimSummaryModal] = useState(false)

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
        if (data.sectors && data.sectors.length > 0) {
          setSectors(data.sectors)
          setNewTemplateSectorId((prev) => prev || data.sectors[0].id)
        }
        if (data.userContext) {
          setUserContext(data.userContext)
          // Only auto-filter by sector if user is strictly a sector-level officer (Level 2)
          // Superadmins (Level 1) should always see 'all' (all templates across all sectors)
          if (data.userContext.level === 2 && data.userContext.sectorId) {
            setSelectedSectorId(data.userContext.sectorId)
          } else {
            setSelectedSectorId('all')
          }
        }
      }
    } catch (err) {
      console.error('Error loading checklist templates:', err)
    } finally {
      setLoading(false)
    }
  }, [])

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
      // Base / universal templates appear in all sectors
      if (t.is_base || !t.applicable_sectors || t.applicable_sectors.length === 0 || t.applicable_sectors.includes('all')) {
        return true
      }
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

  // ──────────────────────────────────────────────────────────────────────────
  // Interactive Form Simulator Logic (Sandbox Engine)
  // ──────────────────────────────────────────────────────────────────────────
  const simTemplate = useMemo(() => {
    if (!simulatorTemplateId) return null
    return templates.find((t) => t.id === simulatorTemplateId) || null
  }, [templates, simulatorTemplateId])

  const simAllCriteria = useMemo(() => {
    if (!simTemplate) return []
    return (simTemplate.sections || []).flatMap((s) =>
      (s.criteria || []).map((c) => ({ ...c, sectionName: s.name, sectionId: s.id }))
    )
  }, [simTemplate])

  const simMetrics = useMemo(() => {
    if (!simAllCriteria.length) {
      return {
        totalWeight: 0,
        earnedScore: 0,
        percentage: 0,
        answeredCount: 0,
        totalCount: 0,
        violationCount: 0,
        violationsList: [] as any[],
        sectionScores: {} as Record<string, { name: string; earned: number; max: number; pct: number }>
      }
    }

    let totalWeight = 0
    let earnedScore = 0
    let answeredCount = 0
    let violationCount = 0
    const violationsList: any[] = []
    const sectionScores: Record<string, { name: string; earned: number; max: number; pct: number }> = {}

    for (const c of simAllCriteria) {
      const weight = Number(c.score_max_value) || 5
      totalWeight += weight

      if (!sectionScores[c.sectionId]) {
        sectionScores[c.sectionId] = { name: c.sectionName, earned: 0, max: 0, pct: 0 }
      }
      sectionScores[c.sectionId].max += weight

      const ans = simAnswers[c.id]
      if (ans !== undefined && ans !== null) {
        answeredCount++
        let earned = 0
        let isViolation = false
        let severity: 'critical' | 'warning' | 'normal' = 'normal'

        const qType = c.score_type
        if (qType === 'yes_no') {
          if (ans === 'yes') {
            earned = weight
          } else {
            isViolation = true
            severity = weight >= 8 ? 'critical' : 'warning'
          }
        } else if (qType === 'availability') {
          if (ans === 'available_compliant') {
            earned = weight
          } else if (ans === 'available_noncompliant') {
            earned = weight * 0.5
            isViolation = true
            severity = 'warning'
          } else {
            isViolation = true
            severity = weight >= 8 ? 'critical' : 'warning'
          }
        } else if (qType === 'rating_5') {
          const stars = Number(ans) || 1
          earned = (stars / 5) * weight
          if (stars < 3) {
            isViolation = true
            severity = 'warning'
          }
        } else if (qType === 'percentage') {
          const pct = Number(ans) || 0
          earned = (pct / 100) * weight
          if (pct < 70) {
            isViolation = true
            severity = 'warning'
          }
        } else {
          // compliance_3level / scale_3 / binary
          if (ans === 'full' || ans === 'compliant' || ans === 'yes') {
            earned = weight
          } else if (ans === 'partial') {
            earned = weight * 0.5
            isViolation = true
            severity = 'warning'
          } else {
            isViolation = true
            severity = weight >= 8 ? 'critical' : 'warning'
          }
        }

        earnedScore += earned
        sectionScores[c.sectionId].earned += earned

        if (isViolation) {
          violationCount++
          violationsList.push({
            id: c.id,
            sectionName: c.sectionName,
            criterionText: c.criterion_text,
            weight,
            earned: Number(earned.toFixed(1)),
            loss: Number((weight - earned).toFixed(1)),
            severity,
            note: simNotes[c.id] || '',
            hasPhoto: Boolean(simPhotos[c.id])
          })
        }
      }
    }

    Object.keys(sectionScores).forEach((k) => {
      const s = sectionScores[k]
      s.pct = s.max > 0 ? Math.round((s.earned / s.max) * 100) : 0
      s.earned = Number(s.earned.toFixed(1))
    })

    const percentage = totalWeight > 0 ? Math.min(100, Math.round((earnedScore / totalWeight) * 100)) : 0

    return {
      totalWeight,
      earnedScore: Number(earnedScore.toFixed(1)),
      percentage,
      answeredCount,
      totalCount: simAllCriteria.length,
      violationCount,
      violationsList,
      sectionScores
    }
  }, [simAllCriteria, simAnswers, simNotes, simPhotos])

  const fillPerfectSimulation = () => {
    const newAns: Record<string, any> = {}
    for (const c of simAllCriteria) {
      if (c.score_type === 'yes_no') newAns[c.id] = 'yes'
      else if (c.score_type === 'availability') newAns[c.id] = 'available_compliant'
      else if (c.score_type === 'rating_5') newAns[c.id] = 5
      else if (c.score_type === 'percentage') newAns[c.id] = 100
      else newAns[c.id] = 'full'
    }
    setSimAnswers(newAns)
  }

  const fillRealisticSimulation = () => {
    const newAns: Record<string, any> = {}
    const newNotes: Record<string, string> = {}
    const newPhotos: Record<string, boolean> = {}

    simAllCriteria.forEach((c, idx) => {
      const mod = idx % 5
      if (mod === 0 || mod === 1 || mod === 2) {
        if (c.score_type === 'yes_no') newAns[c.id] = 'yes'
        else if (c.score_type === 'availability') newAns[c.id] = 'available_compliant'
        else if (c.score_type === 'rating_5') newAns[c.id] = 5
        else if (c.score_type === 'percentage') newAns[c.id] = 95
        else newAns[c.id] = 'full'
      } else if (mod === 3) {
        if (c.score_type === 'yes_no') newAns[c.id] = 'yes'
        else if (c.score_type === 'availability') {
          newAns[c.id] = 'available_noncompliant'
          newNotes[c.id] = 'الأجهزة متوفرة ولكن تحتاج إلى صيانة دورية ومعايرة'
          newPhotos[c.id] = true
        } else if (c.score_type === 'rating_5') newAns[c.id] = 3
        else if (c.score_type === 'percentage') newAns[c.id] = 60
        else {
          newAns[c.id] = 'partial'
          newNotes[c.id] = 'تم استيفاء الإجراء جزئياً مع وجود نقص في السجلات'
          newPhotos[c.id] = true
        }
      } else {
        if (c.score_type === 'yes_no') {
          newAns[c.id] = 'no'
          newNotes[c.id] = 'رصد عدم التزام بالمعيار الرقابي'
          newPhotos[c.id] = true
        } else if (c.score_type === 'availability') {
          newAns[c.id] = 'not_available'
          newNotes[c.id] = 'غير متوفر بالمنشأة وقت المرور الميداني'
          newPhotos[c.id] = true
        } else if (c.score_type === 'rating_5') newAns[c.id] = 1
        else if (c.score_type === 'percentage') newAns[c.id] = 20
        else {
          newAns[c.id] = 'non'
          newNotes[c.id] = 'مخالفة معايير السلامة والجودة المعتمدة'
          newPhotos[c.id] = true
        }
      }
    })

    setSimAnswers(newAns)
    setSimNotes(newNotes)
    setSimPhotos(newPhotos)
  }

  const resetSimulation = () => {
    setSimAnswers({})
    setSimNotes({})
    setSimPhotos({})
    setShowSimSummaryModal(false)
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

  // Calculate total weight of active template
  const totalTemplateWeight = useMemo(() => {
    if (!activeTemplate) return 0
    let sum = 0
    for (const s of activeTemplate.sections) {
      for (const c of s.criteria) {
        sum += Number(c.score_max_value) || 0
      }
    }
    return Number(sum.toFixed(1))
  }, [activeTemplate])

  // Delete custom criterion
  const handleDeleteCriterion = async (criterionId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المعيار من الاستمارة؟')) return
    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_criterion', criterion_id: criterionId })
      })
      if (res.ok) {
        await loadTemplates()
      } else {
        const d = await res.json()
        alert('حدث خطأ أثناء الحذف: ' + (d.error || ''))
      }
    } catch (e: any) {
      alert('خطأ في الاتصال: ' + e.message)
    }
  }

  // Auto balance weights to reach 100%
  const handleAutoBalanceWeights = async () => {
    if (!activeTemplate) return
    if (!confirm('سيتم إعادة توزيع الأوزان بالتساوي على جميع معايير الاستمارة ليصل المجموع الكلي إلى 100% بالضبط. هل تريد المتابعة؟')) return
    setBalancingWeights(true)
    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'auto_balance_weights', template_id: activeTemplate.id })
      })
      if (res.ok) {
        await loadTemplates()
      } else {
        const d = await res.json()
        alert('حدث خطأ: ' + (d.error || ''))
      }
    } catch (e: any) {
      alert('خطأ في الاتصال: ' + e.message)
    } finally {
      setBalancingWeights(false)
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
          score_type: newScoreType,
          score_max_value: Number(newScoreMaxValue) || 5,
          requires_photo: newRequiresPhoto,
          requires_note: newRequiresNote
        })
      })

      if (res.ok) {
        setShowAddCriterionModal(false)
        setNewCriterionText('')
        setNewScoreMaxValue(5)
        setNewRequiresPhoto(false)
        setNewRequiresNote(false)
        setPreviewAnswer(null)
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

  // Update / Rename Section
  const handleUpdateSectionName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingSectionId || !editingSectionName.trim()) return

    setSavingEditSection(true)
    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_section',
          section_id: editingSectionId,
          name: editingSectionName.trim()
        })
      })

      if (res.ok) {
        setEditingSectionId(null)
        setEditingSectionName('')
        await loadTemplates()
      } else {
        const d = await res.json()
        alert('حدث خطأ أثناء تعديل اسم القسم: ' + (d.error || ''))
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message)
    } finally {
      setSavingEditSection(false)
    }
  }

  // Delete Section
  const handleDeleteSection = async (sectionId: string, sectionName: string) => {
    if (!confirm(`هل أنت متأكد من حذف القسم «${sectionName}» وكافة المعايير التابعة له؟`)) return

    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_section',
          section_id: sectionId
        })
      })

      if (res.ok) {
        await loadTemplates()
      } else {
        const d = await res.json()
        alert('حدث خطأ أثناء حذف القسم: ' + (d.error || ''))
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message)
    }
  }

  // Update / Rename Template
  const handleUpdateTemplateName = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTemplateId || !editingTemplateName.trim()) return

    setSavingEditTemplate(true)
    try {
      const res = await fetch('/api/admin/checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_template',
          template_id: editingTemplateId,
          name: editingTemplateName.trim(),
          description: editingTemplateDescription.trim()
        })
      })

      if (res.ok) {
        setEditingTemplateId(null)
        setEditingTemplateName('')
        setEditingTemplateDescription('')
        await loadTemplates()
      } else {
        const d = await res.json()
        alert('حدث خطأ أثناء تعديل اسم الاستمارة: ' + (d.error || ''))
      }
    } catch (err: any) {
      alert('خطأ في الاتصال: ' + err.message)
    } finally {
      setSavingEditTemplate(false)
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Print Report Helper: Converts stored answer value → human-readable Arabic
  // ──────────────────────────────────────────────────────────────────────────
  const getAnswerDisplay = (c: CriterionItem, ans: any): { label: string; color: string; symbol: string } => {
    if (ans === undefined || ans === null || ans === '') {
      return { label: 'لم يُجب', color: '#94a3b8', symbol: '—' }
    }
    const qType = c.score_type
    if (qType === 'yes_no') {
      if (ans === 'yes') return { label: c.score_max_label || 'نعم / مطابق', color: '#16a34a', symbol: '✓' }
      return { label: c.score_0_label || 'لا / غير مطابق', color: '#dc2626', symbol: '✗' }
    }
    if (qType === 'availability') {
      if (ans === 'available_compliant') return { label: 'متوفر ومطابق', color: '#16a34a', symbol: '✓' }
      if (ans === 'available_noncompliant') return { label: 'متوفر غير مطابق', color: '#d97706', symbol: '⚠' }
      return { label: 'غير متوفر', color: '#dc2626', symbol: '✗' }
    }
    if (qType === 'rating_5') {
      const stars = Number(ans)
      const starStr = '★'.repeat(stars) + '☆'.repeat(5 - stars)
      const col = stars >= 4 ? '#16a34a' : stars >= 3 ? '#d97706' : '#dc2626'
      return { label: `${starStr}  (${stars}/5)`, color: col, symbol: `${stars}★` }
    }
    if (qType === 'percentage') {
      const pct = Number(ans)
      const col = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626'
      return { label: `${pct}%`, color: col, symbol: `${pct}%` }
    }
    // compliance_3level / scale_3 / binary
    if (ans === 'full' || ans === 'compliant') return { label: c.score_max_label || 'مطابق كلياً', color: '#16a34a', symbol: '✓' }
    if (ans === 'partial') return { label: c.score_mid_label || 'مطابق جزئياً', color: '#d97706', symbol: '⚠' }
    if (ans === 'non' || ans === 'non_compliant') return { label: c.score_0_label || 'غير مطابق', color: '#dc2626', symbol: '✗' }
    return { label: String(ans), color: '#475569', symbol: '—' }
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
                            background: template.is_base || !template.applicable_sectors || template.applicable_sectors.length === 0 ? '#eff6ff' : '#f8fbfb',
                            color: template.is_base || !template.applicable_sectors || template.applicable_sectors.length === 0 ? '#1d4ed8' : '#546e7a',
                            border: `1px solid ${template.is_base || !template.applicable_sectors || template.applicable_sectors.length === 0 ? '#bfdbfe' : '#cfdcde'}`,
                            padding: '3px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {template.is_base || !template.applicable_sectors || template.applicable_sectors.length === 0
                              ? 'عام (كافة القطاعات)'
                              : (sectors.find(s => template.applicable_sectors!.includes(s.id))?.name || 'قطاع مخصص')}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                          <h2 style={{ fontSize: '16px', color: '#102027', fontWeight: '800', margin: 0, lineHeight: '1.4' }}>
                            {template.name}
                          </h2>
                          {userContext.canEdit && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingTemplateId(template.id)
                                setEditingTemplateName(template.name)
                                setEditingTemplateDescription(template.description || '')
                              }}
                              title="إعادة تسمية وتعديل هذه الاستمارة"
                              style={{
                                background: '#f1f5f9',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '3px 8px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: '#0f172a',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                flexShrink: 0
                              }}
                            >
                              <Edit2 size={12} />
                              <span>تعديل</span>
                            </button>
                          )}
                        </div>

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

                      {/* Action Buttons: Open & Simulate */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
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
                            padding: '10px 12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(22,160,133,0.2)',
                            transition: 'background 0.15s'
                          }}
                          type="button"
                        >
                          <BookOpen size={15} />
                          <span>فتح المعايير</span>
                          <ChevronLeft size={15} />
                        </button>

                        <button
                          onClick={() => {
                            setSimulatorTemplateId(template.id)
                            setSimAnswers({})
                            setSimNotes({})
                            setSimPhotos({})
                            setShowSimSummaryModal(false)
                          }}
                          style={{
                            background: '#f0f9ff',
                            color: '#0284c7',
                            border: '1.5px solid #bae6fd',
                            borderRadius: '10px',
                            padding: '10px 12px',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          type="button"
                          title="محاكاة وتجربة الاستمارة في بيئة آمنة"
                        >
                          <Eye size={15} />
                          <span>محاكاة الاستمارة</span>
                        </button>
                      </div>
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
                    {activeTemplate.name}
                  </h1>
                  {userContext.canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplateId(activeTemplate.id)
                        setEditingTemplateName(activeTemplate.name)
                        setEditingTemplateDescription(activeTemplate.description || '')
                      }}
                      title="إعادة تسمية وتعديل بيانات الاستمارة"
                      style={{
                        background: 'rgba(255,255,255,0.25)',
                        border: '1px solid rgba(255,255,255,0.45)',
                        color: 'white',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <Edit2 size={13} />
                      <span>تعديل اسم الاستمارة</span>
                    </button>
                  )}
                </div>
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
                  onClick={() => {
                    setSimulatorTemplateId(activeTemplate.id)
                    setSimAnswers({})
                    setSimNotes({})
                    setSimPhotos({})
                    setShowSimSummaryModal(false)
                  }}
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: 'white',
                    border: '1px solid rgba(255,255,255,0.4)',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 10px rgba(2,132,199,0.3)',
                    transition: 'all 0.15s ease'
                  }}
                  type="button"
                  title="تجربة ومحاكاة التفتيش الميداني في بيئة آمنة"
                >
                  <Eye size={16} />
                  <span>محاكاة وتجربة الاستمارة (Sandbox)</span>
                </button>

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

            {/* Smart 100% Weight Progress Bar */}
            <div style={{
              background: 'white',
              borderRadius: '16px',
              border: '1px solid #e2ecee',
              padding: '18px 24px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '10px',
                    background: totalTemplateWeight === 100 ? '#dcfce7' : (totalTemplateWeight < 100 ? '#fef3c7' : '#fee2e2'),
                    color: totalTemplateWeight === 100 ? '#15803d' : (totalTemplateWeight < 100 ? '#b45309' : '#b91c1c'),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Scale size={20} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>ميزان أوزان الاستمارة الرقابية</strong>
                      <span style={{
                        fontSize: '11px',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontWeight: '800',
                        background: totalTemplateWeight === 100 ? '#dcfce7' : (totalTemplateWeight < 100 ? '#fef3c7' : '#fee2e2'),
                        color: totalTemplateWeight === 100 ? '#15803d' : (totalTemplateWeight < 100 ? '#b45309' : '#b91c1c')
                      }}>
                        {totalTemplateWeight === 100 
                          ? '✅ الاستمارة موزونة ومكتملة 100%' 
                          : (totalTemplateWeight < 100 ? `⏳ المتبقي ${Number((100 - totalTemplateWeight).toFixed(1))}% لاكتمال الاستمارة` : `⚠️ تحذير: تجاوزت 100% بفارق ${Number((totalTemplateWeight - 100).toFixed(1))}%`)}
                      </span>
                    </div>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      إجمالي الأوزان الحالية: <strong style={{ color: '#0f172a' }}>{totalTemplateWeight}%</strong> من أصل <strong style={{ color: '#0f172a' }}>100%</strong>
                    </span>
                  </div>
                </div>

                {userContext.canEdit && (
                  <button
                    type="button"
                    onClick={handleAutoBalanceWeights}
                    disabled={balancingWeights}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#334155',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: balancingWeights ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Percent size={15} style={{ color: '#0284c7' }} />
                    {balancingWeights ? 'جاري الموازنة...' : 'موازنة وتوزيع الأوزان بالتساوي (100%)'}
                  </button>
                )}
              </div>

              {/* Progress Track */}
              <div style={{ height: '10px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, totalTemplateWeight)}%`,
                  background: totalTemplateWeight === 100 ? '#10b981' : (totalTemplateWeight < 100 ? '#f59e0b' : '#ef4444'),
                  borderRadius: '10px',
                  transition: 'width 0.4s ease'
                }} />
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {userContext.canEdit && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingSectionId(section.id)
                                setEditingSectionName(section.name)
                              }}
                              title="إعادة تسمية هذا القسم"
                              style={{
                                background: '#ffffff',
                                border: '1px solid #cfdcde',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                color: 'var(--brand)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.15s'
                              }}
                            >
                              <Edit2 size={12} />
                              <span>إعادة التسمية</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteSection(section.id, section.name)
                              }}
                              title="حذف هذا القسم"
                              style={{
                                background: '#ffffff',
                                border: '1px solid #ffcdd2',
                                borderRadius: '6px',
                                padding: '4px 6px',
                                fontSize: '11px',
                                color: '#c62828',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}

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
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
                                {/* Question Type Badge */}
                                {criterion.score_type === 'rating_5' && (
                                  <span style={{ fontSize: '10.5px', background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                    ⭐ تقييم 5 نجوم
                                  </span>
                                )}
                                {criterion.score_type === 'percentage' && (
                                  <span style={{ fontSize: '10.5px', background: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                    📊 مقياس نسبة 0-100%
                                  </span>
                                )}
                                {criterion.score_type === 'availability' && (
                                  <span style={{ fontSize: '10.5px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                    📦 موجود / غير موجود
                                  </span>
                                )}
                                {criterion.score_type === 'yes_no' && (
                                  <span style={{ fontSize: '10.5px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                    🔘 نعم / لا
                                  </span>
                                )}
                                {(criterion.score_type === 'compliance_3level' || criterion.score_type === 'binary' || criterion.score_type === 'scale_3') && (
                                  <span style={{ fontSize: '10.5px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                    📋 مطابقة معيارية
                                  </span>
                                )}

                                {/* Weight Badge */}
                                <span style={{
                                  fontSize: '11px',
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  border: '1px solid #fde68a',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontWeight: '800'
                                }}>
                                  الوزن: {criterion.score_max_value}%
                                </span>

                                {/* Delete Criterion Button */}
                                {userContext.canEdit && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCriterion(criterion.id)}
                                    title="حذف هذا المعيار"
                                    style={{
                                      background: 'transparent',
                                      border: 0,
                                      color: '#94a3b8',
                                      cursor: 'pointer',
                                      padding: '3px',
                                      borderRadius: '4px',
                                      display: 'flex',
                                      alignItems: 'center'
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
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

        {/* ── Modal: Add Custom Criterion with Rich Question Types & Live Preview ── */}
        {showAddCriterionModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(16, 32, 39, 0.65)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflowY: 'auto'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              maxWidth: '680px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
              direction: 'rtl',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid #f0f4f6', paddingBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(21, 101, 192, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                    <Plus size={22} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '17px', color: '#102027', fontWeight: 'bold' }}>
                      إضافة سؤال / معيار رقابي جديد
                    </h3>
                    <p style={{ margin: 0, fontSize: '12px', color: '#607d8b' }}>
                      اختر نوع السؤال وحدد وزنه النسبي ليصل إجمالي الاستمارة إلى 100%
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddCriterionModal(false)}
                  style={{ background: '#f5f7fa', border: 'none', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', color: '#607d8b', fontSize: '16px' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveCriterion} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {/* Section Selector */}
                <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', color: '#37474f', fontWeight: 'bold' }}>
                  القسم التفتيشي التابع له المعيار *
                  <select
                    onChange={(e) => setTargetSectionId(e.target.value)}
                    style={{
                      minHeight: '40px',
                      border: '1.5px solid #cfdcde',
                      borderRadius: '10px',
                      padding: '0 12px',
                      fontSize: '13px',
                      outline: 'none',
                      background: 'white',
                      fontWeight: 'normal'
                    }}
                    value={targetSectionId}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        القسم {s.section_number}: {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Visual Question Types Selector */}
                <div>
                  <div style={{ fontSize: '12.5px', color: '#37474f', fontWeight: 'bold', marginBottom: '8px' }}>
                    نوع السؤال / طريقة التقييم *
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: '8px' }}>
                    {[
                      { id: 'yes_no', label: 'نعم / لا', desc: 'ثنائي الإجابة', icon: CheckCircle2 },
                      { id: 'availability', label: 'جاهزية وتوفر', desc: 'متوفر ومطابق / غير مطابق', icon: CheckSquare },
                      { id: 'rating_5', label: 'تقييم 5 نجوم', desc: 'مقياس خماسي', icon: Star },
                      { id: 'percentage', label: 'نسبة مئوية %', desc: 'شريط سحب 0-100%', icon: Percent },
                      { id: 'compliance_3level', label: 'مطابقة ثلاثية', desc: 'مطابق / جزئي / غير', icon: ShieldCheck }
                    ].map((typeItem) => {
                      const IconComp = typeItem.icon
                      const isSelected = newScoreType === typeItem.id
                      return (
                        <button
                          key={typeItem.id}
                          type="button"
                          onClick={() => {
                            setNewScoreType(typeItem.id as any)
                            setPreviewAnswer(null)
                          }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '10px 6px',
                            borderRadius: '12px',
                            border: isSelected ? '2px solid var(--brand)' : '1.5px solid #e0e6ed',
                            background: isSelected ? '#f0f7ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: isSelected ? 'var(--brand)' : '#f5f7fa',
                            color: isSelected ? '#ffffff' : '#607d8b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IconComp size={18} />
                          </div>
                          <span style={{ fontSize: '11.5px', fontWeight: isSelected ? 'bold' : '600', color: isSelected ? 'var(--brand)' : '#263238' }}>
                            {typeItem.label}
                          </span>
                          <span style={{ fontSize: '9.5px', color: '#90a4ae' }}>
                            {typeItem.desc}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Criterion Question Text */}
                <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', color: '#37474f', fontWeight: 'bold' }}>
                  نص السؤال / المعيار الرقابي *
                  <textarea
                    onChange={(e) => setNewCriterionText(e.target.value)}
                    placeholder="اكتب صيغة السؤال بوضوح، مثال: هل يتم تسجيل درجات حرارة ثلاجة الطعوم مرتين يومياً بالدفتر المعتمد؟"
                    required
                    rows={3}
                    style={{
                      border: '1.5px solid #cfdcde',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'vertical',
                      lineHeight: '1.5'
                    }}
                    value={newCriterionText}
                  />
                </label>

                {/* Weight Input (% of 100) - Compact & Collapsible Guide */}
                <div style={{
                  background: '#f8fafc',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid #e2e8f0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  {/* Compact Primary Bar */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>⚖️ الوزن النسبي للمعيار:</span>
                      </span>

                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          step={1}
                          required
                          value={newScoreMaxValue}
                          onChange={(e) => setNewScoreMaxValue(Math.max(1, Math.round(Number(e.target.value)) || 1))}
                          style={{
                            width: '65px',
                            height: '36px',
                            textAlign: 'center',
                            fontSize: '15px',
                            fontWeight: 'bold',
                            color: 'var(--brand)',
                            border: '2px solid #90caf9',
                            borderRadius: '8px',
                            background: '#ffffff',
                            outline: 'none',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                          }}
                        />
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#334155' }}>%</span>
                      </div>

                      {/* Remaining indicator */}
                      <span style={{
                        fontSize: '11px',
                        color: '#64748b',
                        background: '#f1f5f9',
                        border: '1px solid #e2e8f0',
                        padding: '4px 8px',
                        borderRadius: '6px'
                      }}>
                        المتبقي: <strong style={{ color: totalTemplateWeight > 100 ? '#dc2626' : '#0284c7' }}>
                          {Math.max(0, Math.round(100 - totalTemplateWeight))}%
                        </strong>
                      </span>

                      {totalTemplateWeight < 100 && (
                        <button
                          type="button"
                          onClick={() => setNewScoreMaxValue(Math.max(1, Math.round(100 - totalTemplateWeight)))}
                          style={{
                            background: '#e0f2fe',
                            border: '1px solid #bae6fd',
                            borderRadius: '6px',
                            padding: '4px 9px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color: '#0369a1',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="ضبط وزن هذا السؤال ليعادل كامل النسبة المتبقية"
                        >
                          🎯 ملء المتبقي ({Math.round(100 - totalTemplateWeight)}%)
                        </button>
                      )}
                    </div>

                    {/* Toggle Button for Educational Scoring & Preset Guidance */}
                    <button
                      type="button"
                      onClick={() => setShowWeightGuide(!showWeightGuide)}
                      style={{
                        background: showWeightGuide ? '#e2e8f0' : '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '5px 10px',
                        fontSize: '11.5px',
                        fontWeight: 'bold',
                        color: '#334155',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span>💡 {showWeightGuide ? 'إخفاء دليل ونماذج الأوزان' : 'دليل الأوزان والنماذج الاسترشادية'}</span>
                      <span style={{ fontSize: '10px' }}>{showWeightGuide ? '▲' : '▼'}</span>
                    </button>
                  </div>

                  {/* Collapsible Drawer Section */}
                  {showWeightGuide && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      paddingTop: '10px',
                      borderTop: '1px dashed #cbd5e1'
                    }}>
                      <p style={{ margin: 0, fontSize: '11.5px', color: '#64748b', lineHeight: '1.5' }}>
                        يحدد مدى تأثير هذا السؤال على التقييم النهائي للمنشأة (كلما كان السؤال أكثر خطورة على صحة وسلامة المرضى زاد وزنه).
                      </p>

                      {/* Educational scoring rule breakdown */}
                      <div style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        fontSize: '11.5px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        color: '#475569'
                      }}>
                        <strong style={{ color: '#0f172a' }}>
                          💡 كيف تُحسب درجة هذا السؤال ميدانياً طبقاً للوزن المحدد ({newScoreMaxValue}%)؟
                        </strong>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '2px' }}>
                          <span>• المطابقة الكاملة / متوفر: <strong style={{ color: '#16a34a' }}>+{newScoreMaxValue}%</strong> (كامل الدرجة)</span>
                          <span>• المطابقة الجزئية / متوفر وغير مطابق: <strong style={{ color: '#d97706' }}>+{(newScoreMaxValue * 0.5).toFixed(1)}%</strong> (نصف الدرجة)</span>
                          <span>• غير مطابق / غير متوفر: <strong style={{ color: '#dc2626' }}>0%</strong> (رصد مخالفة)</span>
                        </div>
                      </div>

                      {/* Quick Preset Buttons with Standards Guidance */}
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', marginBottom: '6px' }}>
                          ⚡ نماذج استرشادية سريعة للأوزان (اضغط للاختيار المباشر):
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                          {[
                            { label: 'معيار روتيني (2%)', val: 2, desc: 'لوحات، بطاقات تعريف، ترتيب' },
                            { label: 'معيار متوسط (5%)', val: 5, desc: 'نظافة، سجلات، جداول نوبتجيات' },
                            { label: 'معيار عالي (8%)', val: 8, desc: 'ثلاجة طعوم، نفايات طبية' },
                            { label: 'معيار حرج (12%)', val: 12, desc: 'طوارئ، عناية مركزة، تعقيم' }
                          ].map((preset) => (
                            <button
                              key={preset.val}
                              type="button"
                              onClick={() => setNewScoreMaxValue(preset.val)}
                              style={{
                                background: newScoreMaxValue === preset.val ? '#e0f2fe' : '#ffffff',
                                border: newScoreMaxValue === preset.val ? '1.5px solid var(--brand)' : '1px solid #cbd5e1',
                                borderRadius: '8px',
                                padding: '6px 8px',
                                textAlign: 'right',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px',
                                transition: 'all 0.15s'
                              }}
                            >
                              <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: newScoreMaxValue === preset.val ? 'var(--brand)' : '#1e293b' }}>
                                {preset.label}
                              </span>
                              <span style={{ fontSize: '9.5px', color: '#64748b' }}>
                                {preset.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Template Balance summary */}
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        الوزن الحالي المسجل بالاستمارة: <strong style={{ color: '#0f172a' }}>{totalTemplateWeight}%</strong> | المتبقي للوصول إلى 100%: <strong style={{ color: totalTemplateWeight > 100 ? '#dc2626' : '#0284c7' }}>{Math.max(0, Number((100 - totalTemplateWeight).toFixed(1)))}%</strong>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Interactive Preview Box */}
                <div style={{
                  background: 'linear-gradient(135deg, #f0f7ff 0%, #f7fafc 100%)',
                  border: '1.5px dashed #90caf9',
                  borderRadius: '14px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 'bold', color: '#1565c0' }}>
                      <Sparkles size={14} />
                      معاينة حية تفاعلية (كما ستظهر للمفتش بالمرور الميداني)
                    </div>
                    <span style={{ fontSize: '11px', background: '#e3f2fd', color: '#1565c0', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                      الوزن: {newScoreMaxValue}%
                    </span>
                  </div>

                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>
                    {newCriterionText.trim() || 'مثال: هل يتوافر بالمنشأة سجل معتمد لمتابعة درجات حرارة الثلاجات بانتظام؟'}
                  </div>

                  {/* Interactive preview widgets */}
                  <div style={{ background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '4px' }}>
                    {newScoreType === 'yes_no' && (
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('yes')}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: previewAnswer === 'yes' ? '2px solid #2e7d32' : '1px solid #c8e6c9',
                            background: previewAnswer === 'yes' ? '#e8f5e9' : '#ffffff',
                            color: '#2e7d32',
                            fontWeight: 'bold',
                            fontSize: '12.5px',
                            cursor: 'pointer'
                          }}
                        >
                          ✓ نعم ({newScoreMaxValue}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('no')}
                          style={{
                            flex: 1,
                            padding: '8px',
                            borderRadius: '8px',
                            border: previewAnswer === 'no' ? '2px solid #c62828' : '1px solid #ffcdd2',
                            background: previewAnswer === 'no' ? '#ffebee' : '#ffffff',
                            color: '#c62828',
                            fontWeight: 'bold',
                            fontSize: '12.5px',
                            cursor: 'pointer'
                          }}
                        >
                          ✕ لا (0%)
                        </button>
                      </div>
                    )}

                    {newScoreType === 'availability' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('available_compliant')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: previewAnswer === 'available_compliant' ? '2px solid #00796b' : '1px solid #b2dfdb',
                            background: previewAnswer === 'available_compliant' ? '#e0f2f1' : '#ffffff',
                            color: '#00796b',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          ✓ متوفر ومطابق ({newScoreMaxValue}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('available_noncompliant')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: previewAnswer === 'available_noncompliant' ? '2px solid #f57c00' : '1px solid #ffe0b2',
                            background: previewAnswer === 'available_noncompliant' ? '#fff3e0' : '#ffffff',
                            color: '#f57c00',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          ⚠️ متوفر وغير مطابق ({(newScoreMaxValue * 0.5).toFixed(1)}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('not_available')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: previewAnswer === 'not_available' ? '2px solid #d84315' : '1px solid #ffccbc',
                            background: previewAnswer === 'not_available' ? '#fbe9e7' : '#ffffff',
                            color: '#d84315',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          ✕ غير متوفر (0%)
                        </button>
                      </div>
                    )}

                    {newScoreType === 'rating_5' && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setPreviewAnswer(star)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                            >
                              <Star
                                size={28}
                                fill={(previewAnswer || 0) >= star ? '#f59e0b' : 'transparent'}
                                color={(previewAnswer || 0) >= star ? '#f59e0b' : '#cbd5e1'}
                              />
                            </button>
                          ))}
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                          {previewAnswer ? `التقييم المحدد: ${previewAnswer} من 5 (${((previewAnswer / 5) * newScoreMaxValue).toFixed(1)}%)` : 'اضغط على النجوم للتجربة'}
                        </span>
                      </div>
                    )}

                    {newScoreType === 'percentage' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>
                          <span>نسبة التحقق المقدرة:</span>
                          <span style={{ color: 'var(--brand)' }}>{previewAnswer ?? 75}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={previewAnswer ?? 75}
                          onChange={(e) => setPreviewAnswer(Number(e.target.value))}
                          style={{ width: '100%', cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#94a3b8' }}>
                          <span>0% (منعدم)</span>
                          <span>50% (متوسط)</span>
                          <span>100% (مكتمل تماماً)</span>
                        </div>
                      </div>
                    )}

                    {newScoreType === 'compliance_3level' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('full')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: previewAnswer === 'full' ? '2px solid #2e7d32' : '1px solid #c8e6c9',
                            background: previewAnswer === 'full' ? '#e8f5e9' : '#ffffff',
                            color: '#2e7d32',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          مطابق كلياً ({newScoreMaxValue}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('partial')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: previewAnswer === 'partial' ? '2px solid #f57c00' : '1px solid #ffe0b2',
                            background: previewAnswer === 'partial' ? '#fff3e0' : '#ffffff',
                            color: '#f57c00',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          مطابق جزئياً ({(newScoreMaxValue * 0.5).toFixed(1)}%)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewAnswer('non')}
                          style={{
                            padding: '8px 4px',
                            borderRadius: '8px',
                            border: previewAnswer === 'non' ? '2px solid #c62828' : '1px solid #ffcdd2',
                            background: previewAnswer === 'non' ? '#ffebee' : '#ffffff',
                            color: '#c62828',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            cursor: 'pointer'
                          }}
                        >
                          غير مطابق (0%)
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Requirements */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '2px' }}>
                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    background: newRequiresPhoto ? '#f0fdf4' : '#f8fafc',
                    border: newRequiresPhoto ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    transition: 'all 0.15s ease'
                  }}>
                    <input
                      type="checkbox"
                      checked={newRequiresPhoto}
                      onChange={(e) => setNewRequiresPhoto(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        minHeight: '18px',
                        maxHeight: '18px',
                        accentColor: 'var(--brand)',
                        cursor: 'pointer',
                        margin: 0,
                        flexShrink: 0
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>إلزامية إرفاق صورة</span>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>صورة فوتوغرافية توثيقية بالميدان</span>
                    </div>
                  </label>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    cursor: 'pointer',
                    background: newRequiresNote ? '#f0fdf4' : '#f8fafc',
                    border: newRequiresNote ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '10px 14px',
                    transition: 'all 0.15s ease'
                  }}>
                    <input
                      type="checkbox"
                      checked={newRequiresNote}
                      onChange={(e) => setNewRequiresNote(e.target.checked)}
                      style={{
                        width: '18px',
                        height: '18px',
                        minHeight: '18px',
                        maxHeight: '18px',
                        accentColor: 'var(--brand)',
                        cursor: 'pointer',
                        margin: 0,
                        flexShrink: 0
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>إلزامية كتابة ملاحظة</span>
                      <span style={{ fontSize: '10.5px', color: '#64748b' }}>تدوين ملاحظة تفصيلية عند المخالفة</span>
                    </div>
                  </label>
                </div>

                {/* Modal Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px', borderTop: '1px solid #f0f4f6', paddingTop: '16px' }}>
                  <button
                    onClick={() => setShowAddCriterionModal(false)}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 0,
                      borderRadius: '10px',
                      padding: '10px 18px',
                      fontSize: '13px',
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
                      borderRadius: '10px',
                      padding: '10px 22px',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      cursor: savingCriterion ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(21, 101, 192, 0.25)'
                    }}
                    type="submit"
                  >
                    {savingCriterion ? 'جاري الحفظ...' : 'حفظ المعيار في الاستمارة'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Rename Section ── */}
        {editingSectionId && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(16, 32, 39, 0.6)',
            backdropFilter: 'blur(5px)',
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
              boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
              direction: 'rtl'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#e0f2fe', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Edit2 size={18} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', color: '#102027', fontWeight: 'bold' }}>
                      إعادة تسمية القسم التفتيشي
                    </h3>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>عدّل اسم هذا القسم وسيتم تحديثه في الاستمارة فوراً</span>
                  </div>
                </div>
                <button
                  onClick={() => setEditingSectionId(null)}
                  style={{ background: '#f1f5f9', border: 0, borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateSectionName} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', color: '#37474f', fontWeight: 'bold' }}>
                  اسم القسم المعدل *
                  <input
                    type="text"
                    required
                    value={editingSectionName}
                    onChange={(e) => setEditingSectionName(e.target.value)}
                    style={{
                      minHeight: '40px',
                      border: '1.5px solid #90caf9',
                      borderRadius: '8px',
                      padding: '0 12px',
                      fontSize: '13.5px',
                      outline: 'none',
                      fontWeight: '600'
                    }}
                    autoFocus
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingSectionId(null)}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={savingEditSection}
                    style={{
                      background: 'var(--brand)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: savingEditSection ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {savingEditSection ? 'جاري الحفظ...' : 'حفظ التعديل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Modal: Rename / Edit Template ── */}
        {editingTemplateId && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(16, 32, 39, 0.65)',
            backdropFilter: 'blur(5px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
              direction: 'rtl'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e0f2fe', color: 'var(--brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ClipboardList size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#102027', fontWeight: 'bold' }}>
                      إعادة تسمية وتعديل الاستمارة الرقابية
                    </h3>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>تعديل اسم الاستمارة والوصف التعريفي لها</span>
                  </div>
                </div>
                <button
                  onClick={() => setEditingTemplateId(null)}
                  style={{ background: '#f1f5f9', border: 0, borderRadius: '8px', width: '28px', height: '28px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleUpdateTemplateName} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', color: '#37474f', fontWeight: 'bold' }}>
                  اسم الاستمارة *
                  <input
                    type="text"
                    required
                    value={editingTemplateName}
                    onChange={(e) => setEditingTemplateName(e.target.value)}
                    style={{
                      minHeight: '40px',
                      border: '1.5px solid #90caf9',
                      borderRadius: '8px',
                      padding: '0 12px',
                      fontSize: '13.5px',
                      outline: 'none',
                      fontWeight: '600'
                    }}
                    autoFocus
                  />
                </label>

                <label style={{ display: 'grid', gap: '6px', fontSize: '12.5px', color: '#37474f', fontWeight: 'bold' }}>
                  الوصف التعريفي للاستمارة
                  <textarea
                    rows={3}
                    value={editingTemplateDescription}
                    onChange={(e) => setEditingTemplateDescription(e.target.value)}
                    placeholder="وصف مختصر لمجال تطبيق هذه الاستمارة والمنشآت المستهدفة..."
                    style={{
                      border: '1px solid #cfdcde',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      fontSize: '12.5px',
                      outline: 'none',
                      resize: 'vertical',
                      lineHeight: '1.5'
                    }}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEditingTemplateId(null)}
                    style={{
                      background: '#f1f5f9',
                      color: '#475569',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 16px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    إلغاء
                  </button>

                  <button
                    type="submit"
                    disabled={savingEditTemplate}
                    style={{
                      background: 'var(--brand)',
                      color: 'white',
                      border: 0,
                      borderRadius: '8px',
                      padding: '8px 20px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      cursor: savingEditTemplate ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {savingEditTemplate ? 'جاري الحفظ...' : 'حفظ التعديل'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            LEVEL 3: INTERACTIVE FORM SIMULATOR MODAL (SANDBOX MODE)
        ════════════════════════════════════════════════════════════════════ */}
        {/* ════════════════════════════════════════════════════════════════════
            LEVEL 3: FULL-PAGE INTERACTIVE FORM SIMULATOR (SANDBOX MODE)
        ════════════════════════════════════════════════════════════════════ */}
        {simulatorTemplateId && simTemplate && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: '#f1f5f9',
            zIndex: 9999,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Full-Width Ministerial Top Header */}
            <div style={{
              background: '#0f172a',
              color: 'white',
              padding: '14px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '12px',
              position: 'sticky',
              top: 0,
              zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}>
                  <Play size={18} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>
                      محاكاة ومعاينة التفتيش الميداني: {simTemplate.name}
                    </h2>
                    <span style={{
                      background: 'rgba(2,132,199,0.25)',
                      color: '#38bdf8',
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      fontWeight: 'bold'
                    }}>
                      Sandbox Mode
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#94a3b8' }}>
                    بيئة تجريبية معزولة لمحاكاة تقييم المفتش الميداني واحتساب الأوزان التراكمية
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSimulatorTemplateId(null)}
                style={{
                  background: '#dc2626',
                  border: 0,
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                }}
              >
                <X size={16} />
                <span>إغلاق المحاكاة والعودة</span>
              </button>
            </div>

            {/* Sticky Score & Actions Control Toolbar */}
            <div style={{
              background: '#ffffff',
              borderBottom: '1px solid #e2e8f0',
              padding: '12px 24px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              position: 'sticky',
              top: '64px',
              zIndex: 40,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              {/* Score & Counters */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: simMetrics.percentage >= 85 ? '#f0fdf4' : (simMetrics.percentage >= 65 ? '#fffbeb' : '#fef2f2'),
                  border: `1.5px solid ${simMetrics.percentage >= 85 ? '#86efac' : (simMetrics.percentage >= 65 ? '#fde047' : '#fca5a5')}`,
                  padding: '6px 14px',
                  borderRadius: '10px'
                }}>
                  <strong style={{
                    fontSize: '18px',
                    color: simMetrics.percentage >= 85 ? '#16a34a' : (simMetrics.percentage >= 65 ? '#d97706' : '#dc2626')
                  }}>
                    {simMetrics.percentage}%
                  </strong>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: simMetrics.percentage >= 85 ? '#15803d' : (simMetrics.percentage >= 65 ? '#b45309' : '#b91c1c')
                  }}>
                    {simMetrics.percentage >= 85 ? 'مطابقة ممتازة' : (simMetrics.percentage >= 65 ? 'مقبول مع ملاحظات' : 'غير مطابق')}
                  </span>
                </div>

                <span style={{ fontSize: '12.5px', color: '#475569' }}>
                  الدرجة: <strong style={{ color: '#0f172a' }}>{simMetrics.earnedScore}%</strong> من {simMetrics.totalWeight}%
                </span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ fontSize: '12.5px', color: '#475569' }}>
                  المجابة: <strong style={{ color: '#0f172a' }}>{simMetrics.answeredCount}</strong>/{simMetrics.totalCount}
                </span>
                <span style={{ color: '#cbd5e1' }}>•</span>
                <span style={{ fontSize: '12.5px', color: simMetrics.violationCount > 0 ? '#dc2626' : '#16a34a', fontWeight: 'bold' }}>
                  المخالفات: {simMetrics.violationCount}
                </span>
              </div>

              {/* Quick Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={fillPerfectSimulation}
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    color: '#065f46',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  title="ملء كافة الأسئلة بمطابقة تامة 100%"
                >
                  ⚡ تجربة 100%
                </button>

                <button
                  type="button"
                  onClick={fillRealisticSimulation}
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  title="ملء خليط واقعي من المطابقات والملاحظات"
                >
                  ⚠️ تجربة واقعية
                </button>

                <button
                  type="button"
                  onClick={resetSimulation}
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    color: '#475569',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                  title="مسح الإجابات"
                >
                  🔄 تصفير
                </button>

                <button
                  type="button"
                  onClick={() => setShowSimSummaryModal(true)}
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: 0,
                    padding: '7px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FileText size={15} />
                  <span>تقرير المرور التجريبي</span>
                </button>
              </div>
            </div>

            {/* Page Centered Main Content Area */}
            <div style={{
              width: '100%',
              maxWidth: '960px',
              margin: '0 auto',
              padding: '24px 16px 60px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
                {(simTemplate.sections || []).map((sec, secIdx) => {
                  const secStats = simMetrics.sectionScores[sec.id] || { earned: 0, max: 0, pct: 0 }
                  return (
                    <div
                      key={sec.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        overflow: 'hidden',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* Compact Section Header */}
                      <div style={{
                        background: '#f8fafc',
                        padding: '10px 14px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            background: 'var(--brand)',
                            color: 'white',
                            fontSize: '10.5px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '6px'
                          }}>
                            القسم {secIdx + 1}
                          </span>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{sec.name}</strong>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11.5px', color: '#64748b' }}>
                            وزن القسم: <strong style={{ color: '#0f172a' }}>{secStats.max}%</strong>
                          </span>
                          <span style={{
                            fontSize: '11px',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            background: secStats.pct >= 85 ? '#dcfce7' : (secStats.pct >= 65 ? '#fef3c7' : '#fee2e2'),
                            color: secStats.pct >= 85 ? '#15803d' : (secStats.pct >= 65 ? '#b45309' : '#b91c1c')
                          }}>
                            المحقق: {secStats.earned}% ({secStats.pct}%)
                          </span>
                        </div>
                      </div>

                      {/* Criteria List */}
                      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {(sec.criteria || []).length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '10px', color: '#94a3b8', fontSize: '11.5px' }}>
                            لا توجد معايير مضافة في هذا القسم.
                          </div>
                        ) : (
                          (sec.criteria || []).map((c, cIdx) => {
                            const ans = simAnswers[c.id]
                            const weight = Number(c.score_max_value) || 5
                            const qType = c.score_type
                            const isViolation = ans === 'no' || ans === 'not_available' || ans === 'available_noncompliant' || ans === 'partial' || ans === 'non' || (qType === 'rating_5' && ans < 3)

                            return (
                              <div
                                key={c.id}
                                style={{
                                  background: ans ? (isViolation ? '#fffbfb' : '#f0fdf4') : '#ffffff',
                                  border: `1px solid ${ans ? (isViolation ? '#fecaca' : '#bbf7d0') : '#e2e8f0'}`,
                                  borderRadius: '10px',
                                  padding: '12px 14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '8px'
                                }}
                              >
                                {/* Question Content Row: Text & Weight */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', flex: 1 }}>
                                    <span style={{
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      color: '#64748b',
                                      background: '#f1f5f9',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      minWidth: '22px',
                                      textAlign: 'center',
                                      marginTop: '2px'
                                    }}>
                                      {cIdx + 1}
                                    </span>
                                    <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#0f172a', lineHeight: '1.5' }}>
                                      {c.criterion_text}
                                    </span>
                                  </div>

                                  <span style={{
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    color: '#0369a1',
                                    background: '#f0f9ff',
                                    border: '1px solid #bae6fd',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0
                                  }}>
                                    وزن {weight}%
                                  </span>
                                </div>

                                {/* Answers Row */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                                  {qType === 'yes_no' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'yes' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 16px',
                                          borderRadius: '8px',
                                          border: ans === 'yes' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                                          background: ans === 'yes' ? '#dcfce7' : '#ffffff',
                                          color: ans === 'yes' ? '#15803d' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✓ نعم (+{weight}%)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'no' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 16px',
                                          borderRadius: '8px',
                                          border: ans === 'no' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                                          background: ans === 'no' ? '#fee2e2' : '#ffffff',
                                          color: ans === 'no' ? '#b91c1c' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✕ لا (0% مخالفة)
                                      </button>
                                    </>
                                  )}

                                  {qType === 'availability' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'available_compliant' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 14px',
                                          borderRadius: '8px',
                                          border: ans === 'available_compliant' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                                          background: ans === 'available_compliant' ? '#dcfce7' : '#ffffff',
                                          color: ans === 'available_compliant' ? '#15803d' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✓ متوفر ومطابق (+{weight}%)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'available_noncompliant' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 14px',
                                          borderRadius: '8px',
                                          border: ans === 'available_noncompliant' ? '2px solid #d97706' : '1px solid #cbd5e1',
                                          background: ans === 'available_noncompliant' ? '#fef3c7' : '#ffffff',
                                          color: ans === 'available_noncompliant' ? '#b45309' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ⚠️ متوفر وغير مطابق (+{(weight * 0.5).toFixed(1)}%)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'not_available' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 14px',
                                          borderRadius: '8px',
                                          border: ans === 'not_available' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                                          background: ans === 'not_available' ? '#fee2e2' : '#ffffff',
                                          color: ans === 'not_available' ? '#b91c1c' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✕ غير متوفر (0% مخالفة)
                                      </button>
                                    </>
                                  )}

                                  {qType === 'rating_5' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      {[1, 2, 3, 4, 5].map((starVal) => {
                                        const isSelected = ans === starVal
                                        return (
                                          <button
                                            key={starVal}
                                            type="button"
                                            onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: starVal }))}
                                            style={{
                                              height: '32px',
                                              padding: '0 10px',
                                              borderRadius: '6px',
                                              border: isSelected ? '2px solid #f59e0b' : '1px solid #cbd5e1',
                                              background: isSelected ? '#fef3c7' : '#ffffff',
                                              color: isSelected ? '#b45309' : '#334155',
                                              cursor: 'pointer',
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: '4px',
                                              fontSize: '11px',
                                              fontWeight: 'bold'
                                            }}
                                          >
                                            <Star size={13} fill={isSelected ? '#f59e0b' : 'none'} color="#f59e0b" />
                                            <span>{starVal} ({((starVal / 5) * weight).toFixed(1)}%)</span>
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}

                                  {qType === 'percentage' && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                      {[100, 75, 50, 25, 0].map((pctVal) => {
                                        const isSelected = ans === pctVal
                                        return (
                                          <button
                                            key={pctVal}
                                            type="button"
                                            onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: pctVal }))}
                                            style={{
                                              height: '32px',
                                              padding: '0 10px',
                                              borderRadius: '6px',
                                              border: isSelected ? '2px solid #0284c7' : '1px solid #cbd5e1',
                                              background: isSelected ? '#e0f2fe' : '#ffffff',
                                              color: isSelected ? '#0369a1' : '#334155',
                                              fontSize: '11px',
                                              fontWeight: 'bold',
                                              cursor: 'pointer'
                                            }}
                                          >
                                            {pctVal}% ({((pctVal / 100) * weight).toFixed(1)}%)
                                          </button>
                                        )
                                      })}
                                    </div>
                                  )}

                                  {(qType === 'compliance_3level' || qType === 'scale_3' || (!['yes_no', 'availability', 'rating_5', 'percentage'].includes(qType))) && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'full' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 14px',
                                          borderRadius: '8px',
                                          border: ans === 'full' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                                          background: ans === 'full' ? '#dcfce7' : '#ffffff',
                                          color: ans === 'full' ? '#15803d' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✓ مطابق كلياً (+{weight}%)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'partial' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 14px',
                                          borderRadius: '8px',
                                          border: ans === 'partial' ? '2px solid #d97706' : '1px solid #cbd5e1',
                                          background: ans === 'partial' ? '#fef3c7' : '#ffffff',
                                          color: ans === 'partial' ? '#b45309' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ⚠️ مطابق جزئياً (+{(weight * 0.5).toFixed(1)}%)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setSimAnswers(prev => ({ ...prev, [c.id]: 'non' }))}
                                        style={{
                                          height: '34px',
                                          padding: '0 14px',
                                          borderRadius: '8px',
                                          border: ans === 'non' ? '2px solid #dc2626' : '1px solid #cbd5e1',
                                          background: ans === 'non' ? '#fee2e2' : '#ffffff',
                                          color: ans === 'non' ? '#b91c1c' : '#334155',
                                          fontWeight: '700',
                                          fontSize: '12px',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        ✕ غير مطابق (0% مخالفة)
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Interactive Violation Box */}
                                {isViolation && (
                                  <div style={{
                                    marginTop: '6px',
                                    background: '#fff1f2',
                                    border: '1.5px dashed #fca5a5',
                                    borderRadius: '10px',
                                    padding: '12px 14px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    animation: 'fadeIn 0.2s ease-in-out'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <AlertTriangle size={15} color="#e11d48" />
                                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#be123c' }}>
                                          تم رصد ملاحظة رقابية / مخالفة ميدانية
                                        </span>
                                      </div>

                                      {/* Photo Upload Sandbox Button */}
                                      <button
                                        type="button"
                                        onClick={() => setSimPhotos(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                                        style={{
                                          background: simPhotos[c.id] ? '#dcfce7' : '#ffffff',
                                          border: simPhotos[c.id] ? '1.5px solid #22c55e' : '1px solid #cbd5e1',
                                          color: simPhotos[c.id] ? '#15803d' : '#334155',
                                          padding: '5px 12px',
                                          borderRadius: '6px',
                                          fontSize: '11.5px',
                                          fontWeight: 'bold',
                                          cursor: 'pointer',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '6px',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                          transition: 'all 0.15s ease'
                                        }}
                                      >
                                        <Camera size={14} color={simPhotos[c.id] ? '#16a34a' : '#64748b'} />
                                        <span>{simPhotos[c.id] ? '✓ تم إرفاق صورة تجريبية' : '📷 إرفاق صورة توثيق المخالفة'}</span>
                                      </button>
                                    </div>

                                    {/* Observation Textarea */}
                                    <div style={{ position: 'relative', width: '100%' }}>
                                      <input
                                        type="text"
                                        value={simNotes[c.id] || ''}
                                        onChange={(e) => {
                                          const v = e.target.value
                                          setSimNotes(prev => ({ ...prev, [c.id]: v }))
                                        }}
                                        placeholder="اكتب هنا تفاصيل الملاحظة أو سبب رصد المخالفة ميدانياً..."
                                        style={{
                                          width: '100%',
                                          height: '38px',
                                          background: '#ffffff',
                                          border: '1px solid #fda4af',
                                          borderRadius: '8px',
                                          padding: '0 12px',
                                          fontSize: '12.5px',
                                          color: '#1e293b',
                                          outline: 'none',
                                          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.03)'
                                        }}
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════
            SIMULATED FINAL INSPECTION REPORT SUMMARY MODAL
        ════════════════════════════════════════════════════════════════════ */}
        {showSimSummaryModal && simTemplate && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '860px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
              {/* Report Header */}
              <div style={{
                background: 'linear-gradient(135deg, #0e4b5a 0%, #16725a 100%)',
                color: 'white',
                padding: '20px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginBottom: '2px' }}>
                    جمهورية مصر العربية • وزارة الصحة والسكان • قطاع الطب العلاجي
                  </div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800' }}>
                    تقرير نتائج المرور والتفتيش الميداني (محاكاة تجريبية)
                  </h3>
                  <div style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '2px' }}>
                    استمارة التفتيش: <strong>{simTemplate.name}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Printer size={15} />
                    <span>طباعة التقرير</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSimSummaryModal(false)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      color: 'white',
                      padding: '7px 12px',
                      borderRadius: '8px',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Report Body */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Result Card */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px',
                  background: simMetrics.percentage >= 85 ? '#f0fdf4' : (simMetrics.percentage >= 65 ? '#fffbeb' : '#fef2f2'),
                  border: `2px solid ${simMetrics.percentage >= 85 ? '#86efac' : (simMetrics.percentage >= 65 ? '#fde047' : '#fca5a5')}`,
                  padding: '18px 24px',
                  borderRadius: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>التقييم النهائي للمنشأة (طبقاً للأوزان النسبية)</div>
                    <div style={{
                      fontSize: '32px',
                      fontWeight: '900',
                      color: simMetrics.percentage >= 85 ? '#16a34a' : (simMetrics.percentage >= 65 ? '#d97706' : '#dc2626'),
                      lineHeight: '1.2',
                      marginTop: '4px'
                    }}>
                      {simMetrics.percentage}%
                    </div>
                  </div>

                  <div style={{ textAlign: 'left' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '6px 14px',
                      borderRadius: '20px',
                      fontWeight: '800',
                      fontSize: '13px',
                      background: simMetrics.percentage >= 85 ? '#dcfce7' : (simMetrics.percentage >= 65 ? '#fef3c7' : '#fee2e2'),
                      color: simMetrics.percentage >= 85 ? '#15803d' : (simMetrics.percentage >= 65 ? '#b45309' : '#b91c1c')
                    }}>
                      {simMetrics.percentage >= 85 ? '🟢 منشأة ممتازة ومطابقة' : (simMetrics.percentage >= 65 ? '🟡 منشأة مقبولة مع ملاحظات' : '🔴 منشأة غير مطابقة')}
                    </span>
                    <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '6px' }}>
                      الدرجة المحققة: <strong>{simMetrics.earnedScore}</strong> من <strong>{simMetrics.totalWeight}</strong> نقطة
                    </div>
                  </div>
                </div>

                {/* Section Breakdown Table */}
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#1e293b', fontWeight: 'bold' }}>
                    📊 تفصيل الدرجات والمطابقة طبقاً لأقسام الاستمارة:
                  </h4>
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                          <th style={{ padding: '10px 14px' }}>القسم الرقابي</th>
                          <th style={{ padding: '10px 14px' }}>الوزن النسبي للقسم</th>
                          <th style={{ padding: '10px 14px' }}>الدرجة المحققة</th>
                          <th style={{ padding: '10px 14px' }}>نسبة المطابقة %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.keys(simMetrics.sectionScores).map((secId) => {
                          const s = simMetrics.sectionScores[secId]
                          return (
                            <tr key={secId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                              <td style={{ padding: '10px 14px', fontWeight: 'bold', color: '#1e293b' }}>{s.name}</td>
                              <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.max}%</td>
                              <td style={{ padding: '10px 14px', fontWeight: 'bold', color: '#0284c7' }}>{s.earned}%</td>
                              <td style={{ padding: '10px 14px' }}>
                                <span style={{
                                  fontWeight: 'bold',
                                  color: s.pct >= 85 ? '#16a34a' : (s.pct >= 65 ? '#d97706' : '#dc2626')
                                }}>
                                  {s.pct}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Violations Summary Table */}
                <div>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13.5px', color: '#1e293b', fontWeight: 'bold' }}>
                    ⚠️ سجل الملاحظات والمخالفات المرصودة ({simMetrics.violationCount}):
                  </h4>
                  {simMetrics.violationsList.length === 0 ? (
                    <div style={{
                      background: '#f0fdf4',
                      border: '1px solid #86efac',
                      color: '#15803d',
                      borderRadius: '10px',
                      padding: '14px',
                      fontSize: '12.5px',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}>
                      ✅ لا توجد أي مخالفات مرصودة، حققت المنشأة التزاماً كاملاً بنسبة 100%!
                    </div>
                  ) : (
                    <div style={{ border: '1px solid #fecdd3', borderRadius: '12px', overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                        <thead>
                          <tr style={{ background: '#fff1f2', color: '#9f1239', borderBottom: '1px solid #fecdd3' }}>
                            <th style={{ padding: '10px 12px' }}>المعيار المخالف</th>
                            <th style={{ padding: '10px 12px' }}>القسم</th>
                            <th style={{ padding: '10px 12px' }}>النقاط المفقودة</th>
                            <th style={{ padding: '10px 12px' }}>ملاحظات المفتش</th>
                            <th style={{ padding: '10px 12px' }}>توثيق بالصورة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {simMetrics.violationsList.map((v, vIdx) => (
                            <tr key={v.id || vIdx} style={{ borderBottom: '1px solid #fff1f2' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold', color: '#1e293b' }}>{v.criterionText}</td>
                              <td style={{ padding: '10px 12px', color: '#64748b' }}>{v.sectionName}</td>
                              <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: 'bold' }}>-{v.loss}%</td>
                              <td style={{ padding: '10px 12px', color: '#475569' }}>
                                {v.note ? v.note : <span style={{ color: '#94a3b8' }}>لم تُدون ملاحظة</span>}
                              </td>
                              <td style={{ padding: '10px 12px' }}>
                                {v.hasPhoto ? <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓ مرفقة</span> : <span style={{ color: '#94a3b8' }}>غير مرفقة</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Notice Banner */}
                <div style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  fontSize: '11.5px',
                  color: '#64748b',
                  lineHeight: '1.6'
                }}>
                  🔒 <strong>تنبيه نظام الحوكمة:</strong> هذا التقرير صادر عن بيئة المحاكاة التفاعلية (Sandbox Mode) لمراجعة وتدقيق معايير وأوزان الاستمارة قبل نشرها الميداني، ولم يتم تسجيل أي مأمورية رسمية على قاعدة البيانات.
                </div>
              </div>

              {/* Footer Actions */}
              <div style={{
                background: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                padding: '14px 24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}>
                <button
                  type="button"
                  onClick={() => setShowSimSummaryModal(false)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    color: '#334155',
                    padding: '8px 18px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ↩️ العودة للمحاكاة
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowSimSummaryModal(false)
                    setSimulatorTemplateId(null)
                  }}
                  style={{
                    background: 'var(--brand)',
                    color: 'white',
                    border: 0,
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  ✕ إنهاء المحاكاة
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PRINT-ONLY REPORT (hidden on screen, A4 formatted for @media print)
          Note: Global rules are in app/print.css — this block only adds
          page-specific overrides needed for the simulator report.
      ══════════════════════════════════════════════════════════════════════ */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          #__sim_print_report__ { display: none !important; }
        }
        @media print {
          /* Hide everything except the print report */
          body > * { display: none !important; }
          body > #__sim_print_report__,
          body > * > #__sim_print_report__,
          body * #__sim_print_report__ { display: block !important; }

          /* The simulator print container — static flow so pages work */
          #__sim_print_report__ {
            display: block !important;
            position: static !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            direction: rtl !important;
            font-family: 'Tajawal', 'Segoe UI', Tahoma, Arial, sans-serif !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Make all children of the report visible */
          #__sim_print_report__ * {
            visibility: visible !important;
          }

          /* Page breaks between sections */
          #__sim_print_report__ .print-page-break {
            page-break-before: always !important;
            break-before: page !important;
          }

          /* Signature block must not break mid-page */
          #__sim_print_report__ .print-signatures,
          #__sim_print_report__ .print-no-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Tables should not break mid-row */
          #__sim_print_report__ table { page-break-inside: auto; }
          #__sim_print_report__ tr    { page-break-inside: avoid; break-inside: avoid; }
        }
      `}} />


      {showSimSummaryModal && simTemplate && (
        <div id="__sim_print_report__" style={{ fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif", direction: 'rtl', color: '#1e293b', background: 'white', padding: '0' }}>

          {/* ── PAGE 1: COVER / SUMMARY ── */}
          <div style={{ padding: '0 0 20px' }}>

            {/* Ministry Header */}
            <div style={{ background: 'linear-gradient(135deg, #0e4b5a 0%, #16725a 100%)', color: 'white', padding: '18px 24px', borderRadius: '8px 8px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: '10px', opacity: 0.85, letterSpacing: '0.5px' }}>جمهورية مصر العربية</div>
                <div style={{ fontSize: '10px', opacity: 0.85 }}>وزارة الصحة والسكان • قطاع الطب العلاجي</div>
                <div style={{ fontSize: '14px', fontWeight: '900', marginTop: '6px' }}>الإدارة العامة لمرور وتفتيش المنشآت الصحية</div>
              </div>
            </div>

            {/* Report Title Strip */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 0, padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '800', color: '#0e4b5a' }}>تقرير نتائج المرور والتفتيش الميداني</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>استمارة التفتيش: <strong>{simTemplate.name}</strong></div>
              </div>
              <div style={{ textAlign: 'left', fontSize: '11px', color: '#64748b', lineHeight: '1.8' }}>
                <div>تاريخ التقرير: <strong>{new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</strong></div>
                <div>نوع التقرير: <strong style={{ color: '#d97706' }}>محاكاة تجريبية</strong></div>
              </div>
            </div>

            {/* Score Summary Card */}
            <div style={{ margin: '16px 0 0', border: `3px solid ${simMetrics.percentage >= 85 ? '#86efac' : simMetrics.percentage >= 65 ? '#fde047' : '#fca5a5'}`, borderRadius: '10px', padding: '16px 24px', background: simMetrics.percentage >= 85 ? '#f0fdf4' : simMetrics.percentage >= 65 ? '#fffbeb' : '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>التقييم النهائي</div>
                <div style={{ fontSize: '40px', fontWeight: '900', lineHeight: '1', color: simMetrics.percentage >= 85 ? '#16a34a' : simMetrics.percentage >= 65 ? '#d97706' : '#dc2626' }}>{simMetrics.percentage}%</div>
                <div style={{ fontSize: '11px', fontWeight: 'bold', marginTop: '4px', color: simMetrics.percentage >= 85 ? '#15803d' : simMetrics.percentage >= 65 ? '#b45309' : '#b91c1c' }}>
                  {simMetrics.percentage >= 85 ? '🟢 ممتازة — مطابقة' : simMetrics.percentage >= 65 ? '🟡 مقبولة مع ملاحظات' : '🔴 غير مطابقة'}
                </div>
              </div>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'white', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>الدرجة المحققة</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#0284c7' }}>{simMetrics.earnedScore}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>من {simMetrics.totalWeight} نقطة</div>
                </div>
                <div style={{ background: 'white', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>الأسئلة المُجابة</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#0e4b5a' }}>{simMetrics.answeredCount}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>من {simMetrics.totalCount} معيار</div>
                </div>
                <div style={{ background: 'white', borderRadius: '8px', padding: '10px 14px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>المخالفات المرصودة</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: simMetrics.violationCount > 0 ? '#dc2626' : '#16a34a' }}>{simMetrics.violationCount}</div>
                  <div style={{ fontSize: '10px', color: '#94a3b8' }}>مخالفة</div>
                </div>
              </div>
            </div>

            {/* Section Breakdown Table */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#0e4b5a', marginBottom: '8px', borderBottom: '2px solid #0e4b5a', paddingBottom: '4px' }}>📊 توزيع الدرجات على أقسام الاستمارة:</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#0e4b5a', color: 'white' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold' }}>القسم الرقابي</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>الوزن النسبي</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>الدرجة المحققة</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>نسبة المطابقة</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 'bold' }}>التقييم</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(simMetrics.sectionScores).map((secId, idx) => {
                    const s = simMetrics.sectionScores[secId]
                    return (
                      <tr key={secId} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '7px 12px', fontWeight: 'bold', color: '#1e293b' }}>{s.name}</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center', color: '#64748b' }}>{s.max}%</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 'bold', color: '#0284c7' }}>{s.earned}%</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center', fontWeight: 'bold', color: s.pct >= 85 ? '#16a34a' : s.pct >= 65 ? '#d97706' : '#dc2626' }}>{s.pct}%</td>
                        <td style={{ padding: '7px 12px', textAlign: 'center', fontSize: '10px' }}>
                          {s.pct >= 85 ? '🟢 ممتاز' : s.pct >= 65 ? '🟡 مقبول' : '🔴 ضعيف'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

          </div>

          {/* ── PAGE 2+: DETAILED QUESTIONS & ANSWERS ── */}
          {(simTemplate.sections || []).map((section, sIdx) => (
            <div key={section.id} style={{ marginTop: sIdx === 0 ? '0' : '0' }} className={sIdx > 0 ? 'print-page-break' : ''}>

              {/* Section Header */}
              <div style={{ background: '#0e4b5a', color: 'white', padding: '10px 16px', borderRadius: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
                  القسم {section.section_number}: {section.name}
                </div>
                <div style={{ fontSize: '11px', opacity: 0.9 }}>
                  {(() => {
                    const ss = simMetrics.sectionScores[section.id]
                    if (!ss) return ''
                    return `${ss.earned}% من ${ss.max}% • مطابقة: ${ss.pct}%`
                  })()}
                </div>
              </div>

              {/* Criteria Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10.5px', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#e2e8f0', color: '#334155' }}>
                    <th style={{ padding: '7px 10px', textAlign: 'center', width: '32px', fontWeight: 'bold' }}>#</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 'bold' }}>المعيار الرقابي</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', width: '80px', fontWeight: 'bold' }}>الوزن</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', width: '130px', fontWeight: 'bold' }}>نتيجة التفتيش</th>
                    <th style={{ padding: '7px 10px', textAlign: 'right', width: '160px', fontWeight: 'bold' }}>ملاحظات المفتش</th>
                    <th style={{ padding: '7px 10px', textAlign: 'center', width: '55px', fontWeight: 'bold' }}>صورة</th>
                  </tr>
                </thead>
                <tbody>
                  {(section.criteria || []).map((criterion, cIdx) => {
                    const ans = simAnswers[criterion.id]
                    const note = simNotes[criterion.id] || ''
                    const hasPhoto = Boolean(simPhotos[criterion.id])
                    const display = getAnswerDisplay(criterion, ans)
                    const isViolation = simMetrics.violationsList.some((v: any) => v.id === criterion.id)
                    return (
                      <tr key={criterion.id} style={{ background: isViolation ? '#fff5f5' : cIdx % 2 === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '7px 10px', textAlign: 'center', color: '#94a3b8', fontWeight: 'bold' }}>{cIdx + 1}</td>
                        <td style={{ padding: '7px 10px', color: '#1e293b', lineHeight: '1.5' }}>
                          {criterion.criterion_text}
                          {criterion.guidance && (
                            <div style={{ fontSize: '9.5px', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>{criterion.guidance}</div>
                          )}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold', color: '#0284c7' }}>{criterion.score_max_value}</td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold', color: display.color }}>
                          {display.symbol}&nbsp;{display.label}
                        </td>
                        <td style={{ padding: '7px 10px', color: '#475569', fontSize: '10px' }}>
                          {note || <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 10px', textAlign: 'center', fontSize: '11px' }}>
                          {hasPhoto ? <span style={{ color: '#16a34a', fontWeight: 'bold' }}>✓</span> : <span style={{ color: '#cbd5e1' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}

          {/* ── SIGNATURE & APPROVAL FOOTER ── */}
          <div className="print-page-break print-signatures" style={{ paddingTop: '20px' }}>
            <div className="print-no-break" style={{ border: '2px solid #0e4b5a', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ background: '#0e4b5a', color: 'white', padding: '10px 16px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center' }}>بيانات التوقيع والاعتماد</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0', borderTop: '1px solid #e2e8f0' }}>

                <div style={{ padding: '16px', borderLeft: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0e4b5a', marginBottom: '12px' }}>المفتش المنفذ للمرور</div>
                  <div style={{ borderBottom: '1.5px solid #334155', height: '40px', marginBottom: '8px' }}></div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>الاسم: .........................</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>التوقيع: .........................</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>التاريخ: .........................</div>
                </div>

                <div style={{ padding: '16px', borderLeft: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0e4b5a', marginBottom: '12px' }}>المسئول المباشر عن المنشأة</div>
                  <div style={{ borderBottom: '1.5px solid #334155', height: '40px', marginBottom: '8px' }}></div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>الاسم: .........................</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>التوقيع: .........................</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>التاريخ: .........................</div>
                </div>

                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#0e4b5a', marginBottom: '12px' }}>اعتماد الجهة الرقابية المختصة</div>
                  <div style={{ borderBottom: '1.5px solid #334155', height: '40px', marginBottom: '8px' }}></div>
                  <div style={{ fontSize: '10px', color: '#64748b' }}>الاسم: .........................</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>التوقيع: .........................</div>
                  <div style={{ fontSize: '10px', color: '#64748b', marginTop: '4px' }}>الختم الرسمي: ................</div>
                </div>

              </div>
            </div>

            {/* Disclaimer Footer */}
            <div className="print-no-break" style={{ marginTop: '12px', background: '#fff7ed', border: '1px dashed #fed7aa', borderRadius: '6px', padding: '10px 14px', fontSize: '10px', color: '#78350f', lineHeight: '1.6', textAlign: 'center' }}>
              🔒 <strong>تنبيه نظام الحوكمة:</strong> هذا التقرير صادر عن بيئة المحاكاة التفاعلية (Sandbox Mode) لمراجعة وتدقيق معايير وأوزان الاستمارة قبل نشرها الميداني. لم يتم تسجيل أي مأمورية رسمية على قاعدة البيانات. للاستخدام الرسمي يجب إنشاء مأمورية تفتيش فعلية من خلال النظام.
            </div>
            <div className="print-footer-stamp" style={{ marginTop: '8px', textAlign: 'center', fontSize: '9.5px', color: '#94a3b8' }}>
              تم إنشاء هذا التقرير بواسطة نظام الحوكمة الصحية الرقمية — {new Date().toLocaleString('ar-EG')}
            </div>
          </div>


        </div>
      )}

    </DashboardShell>
  )
}
