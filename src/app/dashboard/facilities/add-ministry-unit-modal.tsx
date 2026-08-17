'use client'

import React, { useState } from 'react'
import {
  Building2,
  Activity,
  Compass,
  Database,
  CheckCircle2,
  Warehouse,
  Server,
  Plus,
  Trash2,
  X,
  ShieldCheck,
  Building
} from 'lucide-react'
import { MinistrySector, MinistryUnit } from '@/lib/real-facilities'

type AddMinistryUnitModalProps = {
  isOpen: boolean
  onClose: () => void
  activeSector: MinistrySector
  centralUnits: MinistryUnit[]
  onAddUnit: (newUnit: MinistryUnit) => Promise<void> | void
}

export function AddMinistryUnitModal({
  isOpen,
  onClose,
  activeSector,
  centralUnits,
  onAddUnit
}: AddMinistryUnitModalProps) {
  const [parentId, setParentId] = useState(centralUnits[0]?.id || '')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [director, setDirector] = useState('')
  const [iconName, setIconName] = useState('Building2')
  const [colorTheme, setColorTheme] = useState('teal')
  const [tasks, setTasks] = useState<string[]>(['متابعة الخطط التشغيلية وتطبيق معايير الجودة الفنية'])
  const [newTaskInput, setNewTaskInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleAddTask = () => {
    if (!newTaskInput.trim()) return
    setTasks([...tasks, newTaskInput.trim()])
    setNewTaskInput('')
  }

  const handleRemoveTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index))
  }

  const getGradientAndColor = (theme: string) => {
    switch (theme) {
      case 'teal':
        return {
          color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
          badgeColor: '#00897b'
        }
      case 'gold':
        return {
          color: 'linear-gradient(135deg, #d4af37 0%, #aa7c11 100%)',
          badgeColor: '#d4af37'
        }
      case 'blue':
        return {
          color: 'linear-gradient(135deg, #1e88e5 0%, #0d47a1 100%)',
          badgeColor: '#1e88e5'
        }
      case 'purple':
        return {
          color: 'linear-gradient(135deg, #8e24aa 0%, #5e35b1 100%)',
          badgeColor: '#8e24aa'
        }
      case 'orange':
        return {
          color: 'linear-gradient(135deg, #fb8c00 0%, #ef6c00 100%)',
          badgeColor: '#fb8c00'
        }
      case 'red':
        return {
          color: 'linear-gradient(135deg, #e53935 0%, #b71c1c 100%)',
          badgeColor: '#e53935'
        }
      default:
        return {
          color: 'linear-gradient(135deg, #00897b 0%, #004d40 100%)',
          badgeColor: '#00897b'
        }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('يرجى كتابة اسم الإدارة العامة بشكل صحيح')
      return
    }

    if (!parentId) {
      setError('يرجى تحديد الإدارة المركزية التابعة لها')
      return
    }

    setSaving(true)
    try {
      const themeColors = getGradientAndColor(colorTheme)
      const unitId = `custom-gen-${Date.now()}`

      const newUnit: MinistryUnit = {
        id: unitId,
        sectorId: activeSector.id,
        name: name.trim(),
        level: 'المستوى الثاني: الإدارات العامة (بدرجة مدير عام)',
        type: 'إدارة عامة تخصصية',
        icon: iconName,
        parent: parentId,
        color: themeColors.color,
        badgeColor: themeColors.badgeColor,
        description: description.trim() || `إدارة عامة تخصصية تابعة لـ ${centralUnits.find(u => u.id === parentId)?.name || 'القطاع'}.`,
        coreTasks: tasks.length > 0 ? tasks : ['متابعة الخطط التشغيلية وتطبيق معايير الجودة الفنية'],
        director: director.trim(),
        staffCount: 0,
        levelIndex: 2,
        isCustom: true
      }

      await onAddUnit(newUnit)
      onClose()
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حفظ الإدارة الجديدة')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(16, 32, 39, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
          border: '1px solid #cfdcde',
          direction: 'rtl'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #eef2f3',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fbfb'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--brand)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Building2 size={20} />
            </div>
            <div>
              <strong style={{ fontSize: '15px', color: '#102027', display: 'block' }}>
                إضافة إدارة عامة جديدة ➕
              </strong>
              <small style={{ color: '#546e7a', fontSize: '11px' }}>
                {activeSector.name}
              </small>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#eef2f3',
              border: 0,
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#546e7a'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'grid', gap: '16px' }}>
          {error && (
            <div
              style={{
                background: '#ffebee',
                color: '#c62828',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                border: '1px solid #ffcdd2'
              }}
            >
              {error}
            </div>
          )}

          {/* Parent Central Admin Select */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#37474f', display: 'block', marginBottom: '6px' }}>
              الإدارة المركزية التابعة لها <span style={{ color: '#e53935' }}>*</span>
            </label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                fontSize: '13px',
                outline: 'none',
                background: 'white',
                fontWeight: 'bold',
                color: '#102027'
              }}
            >
              {centralUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Name Field */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#37474f', display: 'block', marginBottom: '6px' }}>
              اسم الإدارة العامة <span style={{ color: '#e53935' }}>*</span>
            </label>
            <input
              type="text"
              placeholder="مثال: الإدارة العامة لصحة وتنمية الأسرة والمبادرات..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          {/* Description Field */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#37474f', display: 'block', marginBottom: '6px' }}>
              الغرض والمسئوليات العامة للوظيفة
            </label>
            <textarea
              rows={3}
              placeholder="اكتب وصفاً موجزاً لاختصاصات ودور الإدارة العامة..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                fontSize: '12.5px',
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Director / Leader Name */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#37474f', display: 'block', marginBottom: '6px' }}>
              المدير العام المسئول (اختياري)
            </label>
            <input
              type="text"
              placeholder="اسم السيد المدير العام..."
              value={director}
              onChange={(e) => setDirector(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #cfdcde',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          {/* Icon & Theme Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#37474f', display: 'block', marginBottom: '6px' }}>
                الأيقونة
              </label>
              <select
                value={iconName}
                onChange={(e) => setIconName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cfdcde',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              >
                <option value="Building2">مبنى إداري (Building2)</option>
                <option value="Activity">نشاط وصحة (Activity)</option>
                <option value="Compass">بوصلة وتخطيط (Compass)</option>
                <option value="CheckCircle2">حوكمة وتدقيق (CheckCircle)</option>
                <option value="Database">بيانات ومعلومات (Database)</option>
                <option value="Server">منظومات وخدمات (Server)</option>
                <option value="Warehouse">مخازن وتجهيزات (Warehouse)</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#37474f', display: 'block', marginBottom: '6px' }}>
                سمة الألوان
              </label>
              <select
                value={colorTheme}
                onChange={(e) => setColorTheme(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cfdcde',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              >
                <option value="teal">زمردي رعاية صحية (Teal)</option>
                <option value="blue">أزرق وزاري رسمي (Blue)</option>
                <option value="gold">ذهبي قيادي (Gold)</option>
                <option value="purple">بنفسجي تخصصي (Purple)</option>
                <option value="orange">برتقالي طوارئ وميداني (Orange)</option>
                <option value="red">أحمر دماء وبلازما (Red)</option>
              </select>
            </div>
          </div>

          {/* Core Tasks Bullet List */}
          <div>
            <label style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#37474f', display: 'block', marginBottom: '6px' }}>
              المهام والاختصاصات الحوكمة الفنية
            </label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="أضف مهمة أو اختصاص جديد..."
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddTask()
                  }
                }}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cfdcde',
                  fontSize: '12.5px',
                  outline: 'none'
                }}
              />
              <button
                type="button"
                onClick={handleAddTask}
                style={{
                  background: 'var(--brand)',
                  color: 'white',
                  border: 0,
                  borderRadius: '8px',
                  padding: '0 14px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Plus size={14} /> إضافة
              </button>
            </div>

            <div style={{ display: 'grid', gap: '6px', maxHeight: '140px', overflowY: 'auto' }}>
              {tasks.map((task, idx) => (
                <div
                  key={idx}
                  style={{
                    background: '#f8fbfb',
                    border: '1px solid #eef2f3',
                    borderRadius: '6px',
                    padding: '6px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: '#37474f'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={12} style={{ color: 'var(--brand)' }} />
                    <span>{task}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveTask(idx)}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: '#e53935',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              borderTop: '1px solid #eef2f3',
              paddingTop: '16px',
              marginTop: '8px'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#eef2f3',
                color: '#546e7a',
                border: 0,
                borderRadius: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                background: 'var(--brand)',
                color: 'white',
                border: 0,
                borderRadius: '8px',
                padding: '9px 24px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ShieldCheck size={16} />
              {saving ? 'جارٍ الحفظ...' : 'حفظ الإدارة العامة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
