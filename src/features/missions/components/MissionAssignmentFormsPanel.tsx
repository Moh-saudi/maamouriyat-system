'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  UnlockKeyhole,
  X,
} from 'lucide-react'

type Row = {
  missionId: string
  serialNumber: string
  facilityName: string
  governorate: string | null
  healthAdmin: string | null
  organizationName: string
  currentTemplateId: string | null
  currentTemplateName: string
  currentTemplateVersion: string | null
  answerCount: number
  teamTemplateChangeAllowed: boolean
  canManage: boolean
  canChange: boolean
  canExecute: boolean
  completed: boolean
}

type TemplateOption = {
  id: string
  name: string
  version: string | null
  description: string | null
  is_current?: boolean
}

type Props = {
  batchId: string
  initialRows: Row[]
}

export function MissionAssignmentFormsPanel({
  batchId,
  initialRows,
}: Props) {
  const [rows, setRows] = useState(initialRows)
  const [busyMissionId, setBusyMissionId] = useState<string | null>(null)
  const [editingMissionId, setEditingMissionId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [pendingTemplateId, setPendingTemplateId] = useState('')
  const [reason, setReason] = useState('')
  const [modalLoading, setModalLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const editingRow = useMemo(
    () => rows.find((row) => row.missionId === editingMissionId) ?? null,
    [editingMissionId, rows]
  )

  async function loadTemplateChoices(missionId: string) {
    setModalLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        '/api/v2/missions/' + missionId + '/checklist',
        {
          cache: 'no-store',
          credentials: 'same-origin',
        }
      )
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(
          payload.error || 'تعذر تحميل الاستمارات المتاحة.'
        )
      }

      const nextTemplates = (payload.templates ?? []) as TemplateOption[]
      setTemplates(nextTemplates)
      setPendingTemplateId(
        String(
          payload.current_template_id ||
            nextTemplates[0]?.id ||
            ''
        )
      )
      setEditingMissionId(missionId)
      setReason('')
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'تعذر تحميل الاستمارات المتاحة.'
      )
    } finally {
      setModalLoading(false)
    }
  }

  async function toggleTeamChange(row: Row) {
    if (!row.canManage || row.completed) return

    setBusyMissionId(row.missionId)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        '/api/v2/missions/' + row.missionId + '/checklist',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'set_team_change_allowed',
            allowed: !row.teamTemplateChangeAllowed,
          }),
        }
      )

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(
          payload.error || 'تعذر تحديث صلاحية تغيير الاستمارة.'
        )
      }

      const nextAllowed = !row.teamTemplateChangeAllowed

      setRows((current) =>
        current.map((item) =>
          item.missionId === row.missionId
            ? {
                ...item,
                teamTemplateChangeAllowed: nextAllowed,
                canChange:
                  item.canManage ||
                  (item.canExecute && nextAllowed),
              }
            : item
        )
      )

      setSuccess(
        row.teamTemplateChangeAllowed
          ? 'تم إغلاق تغيير الاستمارة على أعضاء الفريق.'
          : 'تم السماح لأعضاء الفريق بتغيير الاستمارة لهذه المأمورية.'
      )
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : 'تعذر تحديث صلاحية تغيير الاستمارة.'
      )
    } finally {
      setBusyMissionId(null)
    }
  }

  async function changeTemplate() {
    if (!editingMissionId || !pendingTemplateId || !reason.trim()) {
      setError('اختر الاستمارة الجديدة واكتب سبب التغيير.')
      return
    }

    setModalLoading(true)
    setError('')
    setSuccess('')

    try {
      const response = await fetch(
        '/api/v2/missions/' +
          editingMissionId +
          '/checklist',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'change_template',
            template_id: pendingTemplateId,
            reason: reason.trim(),
          }),
        }
      )

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(
          payload.error || 'تعذر تغيير الاستمارة.'
        )
      }

      const selected = templates.find(
        (template) => template.id === pendingTemplateId
      )

      setRows((current) =>
        current.map((row) =>
          row.missionId === editingMissionId
            ? {
                ...row,
                currentTemplateId: pendingTemplateId,
                currentTemplateName:
                  selected?.name || row.currentTemplateName,
                currentTemplateVersion:
                  selected?.version ?? null,
                answerCount: 0,
              }
            : row
        )
      )

      const archived = Number(payload.archived_answer_count || 0)
      setSuccess(
        archived > 0
          ? 'تم تغيير الاستمارة وحفظ ' +
              archived.toLocaleString('en-US') +
              ' إجابة داخل السجل المؤرشف.'
          : 'تم تغيير الاستمارة وتسجيل سبب التغيير.'
      )
      setEditingMissionId(null)
      setReason('')
    } catch (changeError) {
      setError(
        changeError instanceof Error
          ? changeError.message
          : 'تعذر تغيير الاستمارة.'
      )
    } finally {
      setModalLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-800">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-rose-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[10px] font-bold text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      <div className="grid gap-3">
        {rows.map((row, index) => (
          <article
            key={row.missionId}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-[10px] font-black text-slate-500">
                {(index + 1).toLocaleString('en-US')}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <h2 className="text-[12px] font-black text-slate-900">
                    {row.facilityName}
                  </h2>
                  <span className="font-mono text-[8px] font-black text-teal-700">
                    {row.serialNumber}
                  </span>
                  {row.completed && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700">
                      منفذة
                    </span>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[8px] font-bold">
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">
                    المحافظة: {row.governorate || '—'}
                  </span>
                  <span className="rounded-full bg-teal-50 px-2 py-1 text-teal-700">
                    الإدارة: {row.healthAdmin || '—'}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                    التبعية: {row.organizationName}
                  </span>
                </div>

                <div className="mt-3 rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-[8px] font-bold text-violet-500">
                        الاستمارة النشطة
                      </p>
                      <p className="mt-1 text-[11px] font-black text-violet-950">
                        {row.currentTemplateName}
                      </p>
                      <p className="mt-1 text-[8px] text-violet-600">
                        {row.currentTemplateVersion
                          ? 'إصدار ' + row.currentTemplateVersion + ' · '
                          : ''}
                        {row.answerCount.toLocaleString('en-US')} إجابة محفوظة
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={
                          'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[8px] font-black ' +
                          (row.teamTemplateChangeAllowed
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600')
                        }
                      >
                        {row.teamTemplateChangeAllowed ? (
                          <UnlockKeyhole className="h-3 w-3" />
                        ) : (
                          <LockKeyhole className="h-3 w-3" />
                        )}
                        {row.teamTemplateChangeAllowed
                          ? 'الفريق يستطيع التغيير'
                          : 'التغيير مغلق على الفريق'}
                      </span>

                      {row.canManage && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-1 text-[8px] font-black text-teal-800">
                          <ShieldCheck className="h-3 w-3" />
                          إدارة الاستمارة
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                {row.canExecute && !row.completed && (
                  <Link
                    href={
                      '/v2/missions/' +
                      row.missionId +
                      '/execute?returnTo=' +
                      encodeURIComponent(
                        '/v2/missions/assignments/' +
                          batchId +
                          '/execute'
                      )
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-teal-700 px-2.5 text-[9px] font-black text-white hover:bg-teal-800"
                  >
                    <ClipboardCheck className="h-3.5 w-3.5" />
                    فتح الاستمارة
                  </Link>
                )}

                {!row.completed && row.canChange && (
                  <button
                    type="button"
                    disabled={modalLoading}
                    onClick={() =>
                      void loadTemplateChoices(row.missionId)
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 text-[9px] font-bold text-violet-700 hover:bg-violet-50"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    تغيير الاستمارة
                  </button>
                )}

                {!row.completed && row.canManage && (
                  <button
                    type="button"
                    disabled={busyMissionId === row.missionId}
                    onClick={() => void toggleTeamChange(row)}
                    className={
                      'inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-[9px] font-bold ' +
                      (row.teamTemplateChangeAllowed
                        ? 'border-rose-200 bg-white text-rose-700 hover:bg-rose-50'
                        : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50')
                    }
                  >
                    {busyMissionId === row.missionId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : row.teamTemplateChangeAllowed ? (
                      <LockKeyhole className="h-3.5 w-3.5" />
                    ) : (
                      <UnlockKeyhole className="h-3.5 w-3.5" />
                    )}
                    {row.teamTemplateChangeAllowed
                      ? 'إغلاق التغيير'
                      : 'فتح التغيير للفريق'}
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-xs font-bold text-slate-500">
            لا توجد استمارات مأموريات متاحة في نطاقك داخل هذا التكليف.
          </p>
        </div>
      )}

      {editingMissionId && editingRow && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  تغيير استمارة {editingRow.facilityName}
                </h3>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">
                  الاستمارة الحالية وإجاباتها لن تُحذف. عند التغيير تُحفظ
                  كجلسة مؤرشفة ويبدأ نموذج جديد.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingMissionId(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editingRow.answerCount > 0 && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] leading-5 text-amber-800">
                توجد {editingRow.answerCount.toLocaleString('en-US')} إجابة
                في الاستمارة الحالية. ستظل محفوظة في سجل المأمورية بعد
                الاستبدال.
              </div>
            )}

            <label className="mt-4 grid gap-1.5 text-[10px] font-bold text-slate-600">
              الاستمارة الجديدة
              <select
                value={pendingTemplateId}
                onChange={(event) =>
                  setPendingTemplateId(event.target.value)
                }
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-teal-500"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.version
                      ? ' — إصدار ' + template.version
                      : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 grid gap-1.5 text-[10px] font-bold text-slate-600">
              سبب التغيير *
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder="مثال: الاستمارة المختارة في التكليف لا تتوافق مع نوع المنشأة."
                className="rounded-xl border border-slate-200 p-3 text-xs leading-5 outline-none focus:border-teal-500"
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingMissionId(null)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-slate-600"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={
                  modalLoading ||
                  !pendingTemplateId ||
                  pendingTemplateId === editingRow.currentTemplateId ||
                  !reason.trim()
                }
                onClick={() => void changeTemplate()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-[10px] font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {modalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                اعتماد الاستمارة الجديدة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
