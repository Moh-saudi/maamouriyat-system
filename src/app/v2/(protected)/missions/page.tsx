import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Plus,
  Route,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { hasV2Permission } from '@/server/authorization'
import { requireV2PagePermission } from '@/server/authorization/page-guard'

export default async function V2MissionsPage() {
  const { access } = await requireV2PagePermission('missions.view')
  const canCreate =
    hasV2Permission(access, 'missions.create') &&
    hasV2Permission(access, 'missions.assign')

  return (
    <V2PageContainer>
      <PageHeader
        title="المأموريات الميدانية"
        description="من هنا تبدأ دورة المرور: إصدار التكليف، اعتماد المأمورية، التنفيذ الميداني ثم تسجيل النتائج والملاحظات."
        actions={
          canCreate ? (
            <Link
              href="/v2/missions/new"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 text-[11px] font-bold text-white shadow-sm hover:bg-teal-800"
            >
              <Plus className="h-3.5 w-3.5" />
              تكليف مأمورية
            </Link>
          ) : undefined
        }
      />

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">
            <ClipboardList className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-sm font-black text-slate-900">
            تكليف المأموريات
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            اختيار المنشآت ونموذج المرور والفريق والموعد، ثم إصدار دفعة تكليف
            آمنة من السيرفر.
          </p>

          {canCreate ? (
            <Link
              href="/v2/missions/new"
              className="mt-4 inline-flex items-center gap-1 text-[11px] font-extrabold text-teal-800"
            >
              فتح شاشة التكليف
              <ArrowLeft className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <p className="mt-4 text-[10px] font-bold text-slate-400">
              حسابك لا يملك صلاحية إصدار التكليفات.
            </p>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Users className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-sm font-black text-slate-900">
            الاعتماد والمتابعة
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            التكليف الذي يصدر من حساب غير مخول بالاعتماد ينتقل إلى حالة
            «بانتظار الاعتماد» بدل اعتماده تلقائيًا.
          </p>
          <span className="mt-4 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-500">
            المرحلة التالية
          </span>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Route className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-sm font-black text-slate-900">
            التنفيذ والنتائج
          </h2>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            بعد الاعتماد سنبني شاشة التنفيذ V2 وربط الملاحظات مباشرة بجهات
            التصحيح والتصعيد.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            الأساس جاهز
          </span>
        </article>
      </section>

      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xs font-black text-slate-900">
          دورة المأمورية في V2
        </h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {[
            ['1', 'التكليف', 'المنشأة والفريق والموعد'],
            ['2', 'الاعتماد', 'حسب صلاحية الجهة المصدرة'],
            ['3', 'التنفيذ', 'GPS ونموذج المرور والنتائج'],
            ['4', 'الملاحظات', 'توجيه وتصحيح وتحقق وتصعيد'],
          ].map(([number, title, note]) => (
            <div
              key={number}
              className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[9px] font-black text-teal-700 shadow-sm">
                {number}
              </span>
              <p className="mt-2 text-[11px] font-extrabold text-slate-800">
                {title}
              </p>
              <p className="mt-1 text-[9px] leading-4 text-slate-400">
                {note}
              </p>
            </div>
          ))}
        </div>
      </section>
    </V2PageContainer>
  )
}
