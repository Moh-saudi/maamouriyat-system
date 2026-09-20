'use client'

import { useState } from 'react'
import { AlertTriangle, Loader2, MapPin, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Props = {
  missionId: string
  facilityName: string
}

const REASON_OPTIONS = [
  ['facility_closed', 'المنشأة مغلقة'],
  ['access_blocked', 'تعذر الوصول إلى المنشأة'],
  ['reception_refused', 'رفض استقبال فريق المرور'],
  ['wrong_address', 'المنشأة غير موجودة بالعنوان'],
  ['facility_changed', 'تغيرت جهة أو تبعية المنشأة'],
  ['team_emergency', 'ظرف طارئ للفريق'],
  ['other', 'سبب آخر'],
] as const

function readPosition() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => reject(new Error('يجب السماح بالوصول إلى الموقع لتسجيل تعذر المرور.')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    )
  })
}

export function MissionUnableVisitButton({ missionId, facilityName }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reasonCode, setReasonCode] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setError('')
    if (!reasonCode) {
      setError('اختر سبب تعذر المرور.')
      return
    }
    if (details.trim().length < 5) {
      setError('اكتب تفاصيل واضحة لا تقل عن 5 أحرف.')
      return
    }

    setBusy(true)
    try {
      const coordinates = await readPosition()
      const response = await fetch(`/api/v2/missions/${missionId}/field-outcome`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'not_performed',
          reason_code: reasonCode,
          reason: details.trim(),
          ...coordinates,
        }),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'تعذر تسجيل النتيجة.')

      setOpen(false)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تسجيل النتيجة.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-[9px] font-black text-rose-700 hover:bg-rose-100"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        تعذر المرور
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-rose-100 bg-white p-4 shadow-2xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-slate-900">تسجيل تعذر المرور</h2>
                <p className="mt-1 text-[10px] text-slate-500">{facilityName}</p>
              </div>
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-[10px] font-black text-slate-700">
                السبب
                <select
                  value={reasonCode}
                  onChange={(event) => setReasonCode(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold outline-none focus:border-rose-400"
                >
                  <option value="">اختر السبب</option>
                  {REASON_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-[10px] font-black text-slate-700">
                التفاصيل الإلزامية
                <textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  rows={3}
                  placeholder="اكتب ما حدث بصورة واضحة..."
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-rose-400"
                />
              </label>

              <div className="rounded-xl bg-amber-50 px-3 py-2 text-[9px] leading-5 text-amber-800">
                سيسجل النظام الموقع الحالي والتاريخ والوقت واسم القائم بالمأمورية. بعد التأكيد تصبح هذه نتيجة نهائية وتحتاج مراجعة إدارية لتصحيحها.
              </div>
              {error && <p className="text-[10px] font-bold text-rose-700">{error}</p>}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={busy} onClick={() => setOpen(false)} className="h-9 rounded-xl border border-slate-200 px-3 text-[10px] font-bold text-slate-600">إلغاء</button>
              <button type="button" disabled={busy} onClick={() => void submit()} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-700 px-4 text-[10px] font-black text-white disabled:opacity-60">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                تأكيد بالموقع والوقت
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
