'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardShell } from '@/app/system-ui'
import { defaultCorrectionUnits } from '@/lib/correction-units'
import { Plus, Trash2, Save, FileText, Check, ShieldAlert, Layers } from 'lucide-react'

type CustomItem = {
  id: string
  text: string
  answer_type: 'yes_no' | 'dropdown' | 'checkbox' | 'text_short' | 'text_long' | 'rating_10' | 'rating_5' | 'rating_stars'
  options?: string // Comma-separated list for select or multi-select
  is_required: boolean
  violation_priority: 'low' | 'medium' | 'high' | 'critical'
  correction_dept: string
}

type CustomSection = {
  id: string
  name: string // اسم استمارة المرور
  dept_name: string // اسم الإدارة التابعة لها الاستمارة (مثال: إدارة الصيدلة)
  checklist_type: string // نوع الاستمارة (دوري، مفاجئ، إلخ)
  items: CustomItem[]
}

export default function ChecklistsPage() {
  const router = useRouter()
  const [demoRole, setDemoRole] = useState<any>('inspector')
  const [checklists, setChecklists] = useState<CustomSection[]>([])
  
  // New Checklist Form States
  const [checklistName, setChecklistName] = useState('')
  const [deptName, setDeptName] = useState('إدارة مكافحة العدوى')
  const [checklistType, setChecklistType] = useState('دوري')
  
  const [items, setItems] = useState<CustomItem[]>([
    {
      id: `item-cust-${Date.now()}-1`,
      text: 'هل تلتزم المنشأة ببروتوكولات مكافحة العدوى المقررة؟',
      answer_type: 'yes_no',
      options: '',
      is_required: true,
      violation_priority: 'medium',
      correction_dept: 'إدارة مكافحة العدوى',
    }
  ])
  
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  // Load active demo role and custom checklists
  useEffect(() => {
    const sessionMatch = document.cookie
      .split('; ')
      .find((item) => item.startsWith('maamouriyat_demo_session='))
      ?.split('=')[1]
    
    if (sessionMatch) {
      setDemoRole(sessionMatch)
    }

    // Read stored checklists from cookies
    const cookieName = 'maamouriyat_demo_checklists'
    const cookie = document.cookie
      .split('; ')
      .find((item) => item.startsWith(`${cookieName}=`))
      ?.split('=')[1]
    if (cookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(cookie))
        if (Array.isArray(parsed)) setChecklists(parsed)
      } catch {}
    }
  }, [])

  // Check if current user has permission to design checklists
  const hasPermission = useMemo(() => {
    return ['superadmin', 'central', 'generalmanager', 'creator'].includes(demoRole)
  }, [demoRole])

  function handleAddItem() {
    setItems((current) => [
      ...current,
      {
        id: `item-cust-${Date.now()}-${current.length + 1}`,
        text: '',
        answer_type: 'yes_no',
        options: '',
        is_required: true,
        violation_priority: 'medium',
        correction_dept: deptName,
      }
    ])
  }

  function handleRemoveItem(index: number) {
    if (items.length <= 1) {
      setError('يجب أن تحتوي استمارة المرور على سؤال واحد على الأقل.')
      setTimeout(() => setError(''), 5000)
      return
    }
    setItems((current) => current.filter((_, i) => i !== index))
  }

  function handleItemChange(index: number, key: keyof CustomItem, value: any) {
    setItems((current) => {
      const next = [...current]
      next[index] = { ...next[index], [key]: value }
      return next
    })
  }

  function handleDeleteChecklist(id: string) {
    const nextChecklists = checklists.filter((item) => item.id !== id)
    const cookieName = 'maamouriyat_demo_checklists'
    document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(nextChecklists))}; path=/; max-age=604800; SameSite=Lax`
    setChecklists(nextChecklists)
    setSuccess('تم حذف نموذج الاستمارة بنجاح.')
    setTimeout(() => setSuccess(''), 4000)
    router.refresh()
  }

  function handleSaveChecklist(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const title = checklistName.trim()
    const dept = deptName.trim()
    const type = checklistType.trim()

    if (!title) {
      setError('يرجى كتابة اسم استمارة المرور.')
      return
    }

    if (!dept) {
      setError('يرجى تحديد أو كتابة اسم الإدارة المالكة للاستمارة.')
      return
    }

    const hasEmptyText = items.some((item) => !item.text.trim())
    if (hasEmptyText) {
      setError('يرجى كتابة نص الأسئلة لجميع بنود الفحص.')
      return
    }

    // Save the new checklist section
    const newChecklist: CustomSection = {
      id: `sec-cust-${Date.now()}`,
      name: title,
      dept_name: dept,
      checklist_type: type,
      items: items.map((item, idx) => ({
        ...item,
        id: `item-cust-${Date.now()}-${idx}`,
        text: item.text.trim(),
        options: item.options ? item.options.trim() : ''
      }))
    }

    const updatedChecklists = [newChecklist, ...checklists].slice(0, 30)
    
    // Save to cookies
    const cookieName = 'maamouriyat_demo_checklists'
    document.cookie = `${cookieName}=${encodeURIComponent(JSON.stringify(updatedChecklists))}; path=/; max-age=604800; SameSite=Lax`

    setChecklists(updatedChecklists)
    setSuccess(`تم إنشاء وتعميم استمارة المرور الجديدة "${title}" بنجاح! ستظهر فوراً للمفتشين عند تنفيذ مأمورياتهم الموجهة للقسم المحدد.`)
    
    // Reset Form
    setChecklistName('')
    setItems([
      {
        id: `item-cust-${Date.now()}-1`,
        text: '',
        answer_type: 'yes_no',
        options: '',
        is_required: true,
        violation_priority: 'medium',
        correction_dept: dept,
      }
    ])

    setTimeout(() => setSuccess(''), 8000)
    router.refresh()
  }

  if (!hasPermission) {
    return (
      <DashboardShell role={demoRole} view="checklists">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '24px' }}>
          <div style={{ background: '#fff1f1', color: '#a02f2f', padding: '24px', borderRadius: '16px', border: '1px solid #f5c2c2', maxWidth: '500px', boxShadow: '0 4px 12px rgba(160, 47, 47, 0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <ShieldAlert size={48} style={{ color: '#d32f2f' }} />
            <h2 style={{ fontSize: '1.4rem', margin: 0, fontWeight: 'bold' }}>غير مصرح بالدخول</h2>
            <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#6d7f85', margin: 0 }}>
              عذراً، تصميم وتعديل استمارات ونماذج المرور التفتيشية هو صلاحية حصرية لـ **المدير العام (General Manager)** أو **الموظف المختص المعتمد (Specialist Staff)** بديوان عام الوزارة لضمان وحدة استمارات التقييم ونمطيتها عبر جميع المنشآت الصحية.
            </p>
            <span style={{ fontSize: '12px', background: '#fce8e8', color: '#c62828', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>
              دورك الحالي: {demoRole === 'inspector' ? 'قائم بالمرور (مفتش ميداني)' : demoRole}
            </span>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell role={demoRole} view="checklists">
      <div className="stack" style={{ display: 'grid', gap: '20px', padding: '16px', direction: 'rtl' }}>
        
        {/* Header section */}
        <section style={{ background: 'linear-gradient(135deg, #102027 0%, #37474f 100%)', color: 'white', padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#4fc3f7', background: 'rgba(79, 195, 247, 0.15)', padding: '4px 12px', borderRadius: '20px', alignSelf: 'flex-start' }}>صلاحية الإدارة والتخطيط</span>
          <h2 style={{ fontSize: '1.6rem', margin: 0, fontWeight: 'bold' }}>منشئ استمارات وتقييمات المرور الذكي</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#b0bec5', lineHeight: '1.5' }}>
            بصفتك مديراً عاماً أو موظفاً مختصاً بالوزارة، يمكنك صياغة نماذج الفحص والأسئلة الرقابية المحددة، وتعميمها على المفتشين بالميدان ليقوموا بالإجابة عنها بنمط تفاعلي ذكي.
          </p>
        </section>

        {success && <div className="alert success-box" style={{ background: '#eaf8f3', color: '#16725a', padding: '16px', borderRadius: '12px', fontWeight: 'bold', border: '1px solid #c7ebd8', boxShadow: '0 2px 8px rgba(22, 114, 90, 0.05)' }}>{success}</div>}
        {error && <div className="alert error-box" style={{ background: '#fff1f1', color: '#a02f2f', padding: '16px', borderRadius: '12px', border: '1px solid #f5c2c2', fontWeight: 'bold' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
          
          {/* Design Section Form */}
          <form onSubmit={handleSaveChecklist} style={{ background: 'white', padding: '28px', borderRadius: '16px', border: '1px solid var(--line)', boxShadow: 'var(--shadow)', display: 'grid', gap: '20px' }}>
            <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#102027', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '2px solid #eef6f6', paddingBottom: '12px' }}>
              <FileText size={22} style={{ color: 'var(--brand)' }} />
              تصميم وتعميم استمارة فحص تخصصية جديدة
            </h3>

            {/* Checklist Core Info */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', background: '#f8fbfb', padding: '18px', borderRadius: '12px', border: '1px solid #cfdcde' }}>
              
              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#42555d', fontWeight: 'bold' }}>
                اسم استمارة المرور التفتيشية *
                <input
                  onChange={(event) => setChecklistName(event.target.value)}
                  placeholder="مثال: استمارة تدقيق جودة وحفظ الطعوم والأمصال"
                  required
                  style={{
                    background: 'white',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '42px',
                    padding: '0 12px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  type="text"
                  value={checklistName}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#42555d', fontWeight: 'bold' }}>
                الإدارة أو القسم المالك للاستمارة (ثابتة للنموذج) *
                <input
                  list="dept-units"
                  onChange={(event) => setDeptName(event.target.value)}
                  placeholder="اختر أو اكتب الإدارة (مثال: إدارة الصيدلة)"
                  required
                  style={{
                    background: 'white',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '42px',
                    padding: '0 12px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  type="text"
                  value={deptName}
                />
              </label>

              <label style={{ display: 'grid', gap: '6px', fontSize: '13.5px', color: '#42555d', fontWeight: 'bold' }}>
                نوع المرور / تصنيف الاستمارة *
                <select
                  onChange={(event) => setChecklistType(event.target.value)}
                  style={{
                    background: 'white',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    minHeight: '42px',
                    padding: '0 12px',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                  value={checklistType}
                >
                  <option value="دوري">مرور دوري اعتيادي</option>
                  <option value="مفاجئ">مرور رقابي مفاجئ</option>
                  <option value="استثنائي">مرور خاص/استثنائي</option>
                  <option value="توجيهي">مرور توجيهي وإرشادي</option>
                </select>
              </label>

            </div>

            {/* Questions Builder */}
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '14px', color: '#102027', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={18} style={{ color: 'var(--brand)' }} />
                  صياغة الأسئلة وبنود التقييم التفاعلية ({items.length} بند رقابي)
                </strong>
                
                <button
                  onClick={handleAddItem}
                  style={{
                    background: '#eef6f6',
                    color: 'var(--brand)',
                    border: '1px solid #cfdcde',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s'
                  }}
                  type="button"
                >
                  <Plus size={16} />
                  إضافة بند تقييمي جديد
                </button>
              </div>

              {/* Items Card List */}
              <div style={{ display: 'grid', gap: '16px' }}>
                {items.map((item, index) => (
                  <div key={item.id} style={{ display: 'grid', gap: '12px', background: '#f8fbfb', border: '1px solid #cfdcde', padding: '18px', borderRadius: '12px', position: 'relative', boxShadow: '0 2px 6px rgba(0,0,0,0.01)' }}>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--brand)', background: '#eef6f6', padding: '4px 10px', borderRadius: '6px' }}>
                        البند الرقابي #{index + 1}
                      </span>
                      <button
                        onClick={() => handleRemoveItem(index)}
                        style={{
                          background: 'transparent',
                          color: '#a02f2f',
                          border: 0,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                        type="button"
                        title="حذف هذا البند"
                      >
                        <Trash2 size={16} />
                        حذف البند
                      </button>
                    </div>

                    {/* Question Text */}
                    <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#42555d', fontWeight: 'bold' }}>
                      نص السؤال التفتيشي / بند التقييم *
                      <input
                        onChange={(event) => handleItemChange(index, 'text', event.target.value)}
                        placeholder="اكتب السؤال بوضوح، مثل: هل يتم تدوين درجات الحرارة لثلاجة حفظ الأدوية مرتين يومياً؟"
                        required
                        style={{
                          background: 'white',
                          border: '1px solid #cfdcde',
                          borderRadius: '8px',
                          minHeight: '40px',
                          padding: '0 12px',
                          fontSize: '13.5px'
                        }}
                        type="text"
                        value={item.text}
                      />
                    </label>

                    {/* Question Type Selection */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      
                      <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#42555d', fontWeight: 'bold' }}>
                        نوع إجابة المفتش (شكل الحقل) *
                        <select
                          onChange={(event) => handleItemChange(index, 'answer_type', event.target.value)}
                          style={{
                            background: 'white',
                            border: '1px solid #cfdcde',
                            borderRadius: '8px',
                            minHeight: '40px',
                            padding: '0 8px',
                            fontSize: '13px'
                          }}
                          value={item.answer_type}
                        >
                          <option value="yes_no">نعم / لا / لا ينطبق (تفاعلي ذكي)</option>
                          <option value="dropdown">منيو خيارات منسدلة (محدد مسبقاً)</option>
                          <option value="checkbox">شيك ليست (مربعات اختيار متعددة)</option>
                          <option value="text_short">كتابة قصيرة (نص قصير)</option>
                          <option value="text_long">كتابة طويلة (ملاحظات تفصيلية)</option>
                          <option value="rating_5">تقييم رقمي (من 1 إلى 5)</option>
                          <option value="rating_10">تقييم رقمي (من 1 إلى 10)</option>
                          <option value="rating_stars">تقييم بالنجوم (Star Rating)</option>
                        </select>
                      </label>

                      {/* Options input (only for dropdown or checkbox checklist) */}
                      {(item.answer_type === 'dropdown' || item.answer_type === 'checkbox') && (
                        <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#42555d', fontWeight: 'bold' }}>
                          الخيارات المتاحة (مفصولة بفاصلة) *
                          <input
                            onChange={(event) => handleItemChange(index, 'options', event.target.value)}
                            placeholder="مثال: مطابق تماماً, مطابق جزئياً, غير مطابق"
                            required
                            style={{
                              background: 'white',
                              border: '1px solid #cfdcde',
                              borderRadius: '8px',
                              minHeight: '40px',
                              padding: '0 12px',
                              fontSize: '13px'
                            }}
                            type="text"
                            value={item.options || ''}
                          />
                        </label>
                      )}

                      <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#42555d' }}>
                        أولوية المخالفة (في حالة عدم الالتزام)
                        <select
                          onChange={(event) => handleItemChange(index, 'violation_priority', event.target.value)}
                          style={{
                            background: 'white',
                            border: '1px solid #cfdcde',
                            borderRadius: '8px',
                            minHeight: '40px',
                            padding: '0 8px',
                            fontSize: '13px'
                          }}
                          value={item.violation_priority}
                        >
                          <option value="low">بسيطة (مهلة تصحيح 30 يوم)</option>
                          <option value="medium">متوسطة (مهلة تصحيح 7 أيام)</option>
                          <option value="high">عالية (مهلة تصحيح 72 ساعة)</option>
                          <option value="critical">حرجة فورية (مهلة تصحيح 24 ساعة)</option>
                        </select>
                      </label>

                      <label style={{ display: 'grid', gap: '4px', fontSize: '13px', color: '#42555d' }}>
                        الإدارة المختصة بالتصحيح والتوجيه
                        <input
                          list="dept-units"
                          onChange={(event) => handleItemChange(index, 'correction_dept', event.target.value)}
                          placeholder="مثال: إدارة مكافحة العدوى"
                          style={{
                            background: 'white',
                            border: '1px solid #cfdcde',
                            borderRadius: '8px',
                            minHeight: '40px',
                            padding: '0 12px',
                            fontSize: '13px'
                          }}
                          type="text"
                          value={item.correction_dept}
                        />
                      </label>

                    </div>

                  </div>
                ))}
              </div>
            </div>

            {/* Datalists */}
            <datalist id="dept-units">
              {defaultCorrectionUnits.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>

            {/* Submit Button */}
            <button
              style={{
                background: 'var(--brand)',
                color: 'white',
                border: 0,
                borderRadius: '10px',
                minHeight: '48px',
                padding: '0 32px',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: '14.5px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: '0 4px 12px rgba(16, 122, 102, 0.15)',
                transition: 'all 0.2s',
                marginTop: '10px'
              }}
              type="submit"
            >
              <Save size={20} />
              حفظ الاستمارة وتعميمها على المفتشين
            </button>
          </form>

          {/* List of Custom Checklists */}
          <section style={{ background: '#f8fbfb', padding: '24px', borderRadius: '16px', border: '1px solid #cfdcde' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.15rem', color: '#102027', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Check size={20} style={{ color: '#16725a' }} />
              النماذج المعتمدة المتاحة بالمنظومة ({checklists.length} استمارة نشطة)
            </h3>
            
            <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
              {checklists.map((sec) => (
                <div key={sec.id} style={{ background: 'white', border: '1px solid #cfdcde', padding: '18px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'space-between', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#16725a', background: '#eaf8f3', padding: '2px 8px', borderRadius: '20px' }}>
                        {sec.checklist_type || 'دوري'}
                      </span>
                      <button
                        onClick={() => handleDeleteChecklist(sec.id)}
                        style={{
                          background: 'transparent',
                          color: '#a02f2f',
                          border: 0,
                          cursor: 'pointer',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                        title="حذف الاستمارة"
                      >
                        <Trash2 size={14} />
                        إلغاء النموذج
                      </button>
                    </div>
                    <strong style={{ fontSize: '14.5px', color: '#102027', display: 'block', marginBottom: '4px' }}>{sec.name}</strong>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>
                      الإدارة: **{sec.dept_name || 'إدارة عامة'}**
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>
                      عدد البنود والأسئلة المشمولة: **{sec.items.length} أسئلة**
                    </span>
                  </div>

                  <div style={{ borderTop: '1px solid var(--line)', paddingTop: '10px', marginTop: '6px' }}>
                    <details style={{ cursor: 'pointer' }}>
                      <summary style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--brand)' }}>استعراض أسئلة النموذج ونوع الحقل...</summary>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px', background: '#f8fbfb', padding: '10px', borderRadius: '6px' }}>
                        {sec.items.map((item, idx) => {
                          let typeText = 'أزرار (ملتزم/غير ملتزم)'
                          if (item.answer_type === 'dropdown') typeText = `منيو منسدلة [${item.options}]`
                          if (item.answer_type === 'checkbox') typeText = `شيك ليست [${item.options}]`
                          if (item.answer_type === 'text_short') typeText = 'كتابة قصيرة'
                          if (item.answer_type === 'text_long') typeText = 'كتابة تفصيلية'
                          if (item.answer_type === 'rating_5') typeText = 'تقييم رقمي (1-5)'
                          if (item.answer_type === 'rating_10') typeText = 'تقييم رقمي (1-10)'
                          if (item.answer_type === 'rating_stars') typeText = 'تقييم بالنجوم'
                          
                          return (
                            <div key={item.id} style={{ fontSize: '11.5px', borderBottom: idx < sec.items.length - 1 ? '1px dashed #e0e0e0' : 'none', paddingBottom: '6px', color: '#37474f' }}>
                              <strong>س{idx+1}: {item.text}</strong>
                              <span style={{ display: 'block', fontSize: '10.5px', color: '#78909c', marginTop: '2px' }}>
                                شكل الإجابة: {typeText} | توجيه: {item.correction_dept} ({item.violation_priority === 'critical' ? 'حرجة' : item.violation_priority === 'high' ? 'عالية' : item.violation_priority === 'medium' ? 'متوسطة' : 'بسيطة'})
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  </div>
                </div>
              ))}

              {checklists.length === 0 && (
                <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: '13.5px' }}>
                  لا توجد استمارات مخصصة منشأة بعد. قم بصياغة استمارتك الأولى وتعميمها من النموذج أعلاه.
                </div>
              )}
            </div>
          </section>

        </div>
      </div>
    </DashboardShell>
  )
}
