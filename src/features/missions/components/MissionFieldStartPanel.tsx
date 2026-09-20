'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, MapPin, PlayCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Props = {
  missionId: string
  facilityName: string
  started: boolean
  returnHref: string
}

type Coordinates = { latitude: number; longitude: number }

const REASON_OPTIONS = [
  ['facility_closed', 'المنشأة مغلقة'],
  ['access_blocked', 'تعذر الوصول إلى المنشأة'],
  ['reception_refused', 'رفض استقبال فريق المرور'],
  ['wrong_address', 'المنشأة غير موجودة بالعنوان'],
  ['facility_changed', 'تغيرت جهة أو تبعية المنشأة'],
  ['team_emergency', 'ظرف طارئ للفريق'],
  ['other', 'سبب آخر'],
] as const

function readPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      () => reject(new Error('يجب السماح بالوصول إلى الموقع لتسجيل نتيجة المنشأة.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  })
}

export function MissionFieldStartPanel({
  missionId,
  facilityName,
  started,
  returnHref,
}: Props) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [reasonCode, setReasonCode] = useState('')
  const [showUnable, setShowUnable] = useState(false)
  const [busy, setBusy] = useState<'start' | 'not_performed' | null>(null)
  const [error, setError] = useState('')

  async function submit(action: 'start' | 'not_performed') {
    setError('')
    if (action === 'not_performed' && reason.trim().length < 5) {
      setError('اكتب سببًا واضحًا لعدم تنفيذ المرور على المنشأة.')
      return
    }
    if (action === 'not_performed' && !reasonCode) {
      setError('اختر سبب تعذر المرور على المنشأة.')
      return
    }

    setBusy(action)
    try {
      const coordinates = await readPosition()
      const response = await fetch(`/api/v2/missions/${missionId}/field-outcome`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason_code: reasonCode || undefined,
          reason: reason.trim(),
          ...coordinates,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'تعذر تسجيل حالة المنشأة.')

      if (action === 'not_performed') {
        router.push(returnHref)
      } else {
        router.refresh()
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل حالة المنشأة.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="rounded-2xl border border-teal-200 bg-teal-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-teal-950">
            {started ? 'المرور جارٍ على المنشأة' : 'تأكيد بدء المرور'}
          </h2>
          <p className="mt-1 text-[10px] leading-5 text-teal-800">
            {facilityName} · يسجل النظام الموقع والتاريخ والوقت عند بدء المرور وعند تسجيل النتيجة.
          </p>
        </div>
        {!started && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void submit('start')}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 text-[10px] font-black text-white disabled:opacity-60"
          >
            {busy === 'start' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            بدء المرور وتسجيل الموقع
          </button>
        )}
      </div>

      <div className="mt-3 border-t border-teal-200 pt-3">
        <button
          type="button"
          onClick={() => setShowUnable((value) => !value)}
          className="inline-flex items-center gap-1.5 text-[10px] font-black text-rose-700"
        >
          <AlertTriangle className="h-4 w-4" />
          لم يتم المرور على المنشأة
        </button>
        {showUnable && (
          <div className="mt-3 grid gap-2 rounded-xl border border-rose-200 bg-white p-3">
            <label className="text-[10px] font-black text-slate-700" htmlFor="non-execution-reason">
              سبب عدم التنفيذ (إلزامي)
            </label>
            <select
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-rose-400"
            >
              <option value="">اختر السبب</option>
              {REASON_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <textarea
              id="non-execution-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="مثال: المنشأة مغلقة، تعذر الوصول، رفض الاستقبال..."
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-rose-400"
            />
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void submit('not_performed')}
              className="inline-flex h-9 w-fit items-center gap-2 rounded-xl bg-rose-700 px-4 text-[10px] font-black text-white disabled:opacity-60"
            >
              {busy === 'not_performed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              تسجيل عدم التنفيذ بالموقع والوقت
            </button>
          </div>
        )}
        {error && <p className="mt-2 text-[10px] font-bold text-rose-700">{error}</p>}
      </div>
    </section>
  )
}
