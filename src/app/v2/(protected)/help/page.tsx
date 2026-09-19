import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  HelpCircle,
  Network,
  ShieldCheck,
  Wrench,
  Banknote,
  FileText,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import {
  V2_CORRECTION_WORKFLOW_STEPS,
  V2_TERMINOLOGY,
} from '@/config/terminology'
import { getV2AccessState, hasV2Permission } from '@/server/authorization'
import type { V2AuthorizationSnapshot } from '@/server/authorization/types'

type SearchParams = Promise<{
  from?: string
}>

type GuideCard = {
  title: string
  description: string
  href?: string
  steps: string[]
  icon: typeof HelpCircle
}

const PAGE_GUIDES = [
  {
    prefix: '/v2/users',
    title: 'المستخدمون',
    description:
      'إضافة الحسابات وتحديد الجهة ونوع العمل وإدارة أدوار المستخدمين داخل نطاقك فقط.',
  },
  {
    prefix: '/v2/facilities',
    title: 'المنشآت الصحية',
    description:
      'إدارة المنشآت الواقعة داخل نطاقك، مع سجل تعديل وإيقاف وإعادة تفعيل موثق.',
  },
  {
    prefix: '/v2/organizations',
    title: 'الهيكل التنظيمي',
    description:
      'عرض الهيكل وإدارة الجهات الفرعية عند وجود صلاحية وموافقة الجهة الأعلى.',
  },
  {
    prefix: '/v2/violations',
    title: V2_TERMINOLOGY.findingsModule,
    description:
      'متابعة دورة الملاحظة من الرصد والتوجيه حتى التصحيح والتحقق والتصعيد والإغلاق.',
  },
  {
    prefix: '/v2/missions',
    title: 'المأموريات الميدانية',
    description:
      'إعداد التكليفات واعتمادها وتنفيذ المرور الميداني وتوثيق النتائج والملاحظات حسب صلاحية الحساب.',
  },
  {
    prefix: '/v2/checklists',
    title: 'استماراتي ونماذج المرور',
    description:
      'مكتبتك الشخصية من الاستمارات التي أنشأتها أو حفظتها من النماذج المشتركة، بينما يتم اختيار استمارة المأمورية في مرحلة الإصدار.',
  },
  {
    prefix: '/v2/finance',
    title: 'الاستحقاقات المالية',
    description:
      'إعداد ومراجعة واعتماد وصرف بدلات ومكافآت المأموريات المنفذة حسب الدور المالي.',
  },
  {
    prefix: '/v2/reports',
    title: 'التقارير',
    description:
      'ملخصات تشغيلية ومالية تظهر فقط حسب صلاحيات التقرير الممنوحة للحساب.',
  },
] as const

function hasAnyPermission(
  access: V2AuthorizationSnapshot,
  keys: string[]
): boolean {
  return keys.some((key) => hasV2Permission(access, key))
}

export default async function V2HelpPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const state = await getV2AccessState()

  if (state.status !== 'authorized') {
    redirect('/v2/access-denied')
  }

  const params = await searchParams
  const from = params.from || ''
  const { access } = state
  const roleCodes = new Set(access.roles.map((role) => role.roleCode))

  const isInformationCenter = roleCodes.has('information_center')
  const isFieldInspector = roleCodes.has('field_inspector')
  const canCorrect = hasV2Permission(access, 'violations.correct')
  const canVerifyOrClose = hasAnyPermission(access, [
    'violations.verify',
    'violations.close',
    'violations.assign',
  ])
  const canManageUsers = hasAnyPermission(access, [
    'users.create',
    'users.edit',
    'users.assign_role',
    'users.reset_password',
  ])
  const canManageFacilities = hasAnyPermission(access, [
    'facilities.create',
    'facilities.edit',
    'facilities.deactivate',
  ])
  const canManageOrganizations = hasAnyPermission(access, [
    'organizations.create',
    'organizations.edit',
    'organizations.manage_capabilities',
  ])
  const canWorkMissions = hasAnyPermission(access, [
    'missions.execute',
    'mission_results.record',
    'mission_results.edit',
  ])
  const canPrepareMissions = hasAnyPermission(access, [
    'missions.prepare',
    'missions.propose_team',
  ])
  const canFinance = hasV2Permission(access, 'finance.view')
  const canMissionReports = hasV2Permission(access, 'reports.missions_view')
  const canFinanceReports = hasV2Permission(access, 'reports.finance_view')

  const guides: GuideCard[] = []

  if (isInformationCenter || canManageUsers || canManageFacilities) {
    guides.push({
      title: 'دعم المنظومة داخل نطاقك',
      description:
        'دليل مسؤول الدعم المحلي لإدارة الحسابات والمنشآت والخدمات التقنية دون تجاوز النطاق التنظيمي.',
      href: '/v2/users',
      icon: Wrench,
      steps: [
        'أنشئ الحساب داخل الجهة الصحيحة وحدد نوع العمل قبل إنشاء الحساب.',
        'أعد تعيين كلمة المرور أو ساعد المستخدم عند تعذر الدخول وفق الصلاحيات الممنوحة.',
        'أضف أو عدل المنشآت التابعة لنطاقك فقط، ولا تعتبر الإيقاف حذفًا للسجل.',
        'استخدم الهيكل التنظيمي لإنشاء جهات فرعية فقط عندما تسمح الجهة الأعلى بذلك.',
      ],
    })
  }

  if (canPrepareMissions) {
    guides.push({
      title: 'سكرتارية وإعداد تكليف المأموريات',
      description:
        'إعداد بيانات التكليف والفريق المقترح والموعد ثم إرسال الدفعة للاعتماد دون امتلاك صلاحية التنفيذ أو الاعتماد.',
      href: '/v2/missions/new',
      icon: FileText,
      steps: [
        'ابدأ بمصدر المنشآت: مستهدف محدد، مشروع/مبادرة، أو اختيار حر حسب المحافظة والإدارة الصحية.',
        'راجع مؤشر التردد بجوار كل منشأة لتعرف ما تم المرور عليه وما يحتاج تغطية أكبر.',
        'اختر الفريق والموعد، ثم اختر استمارة المرور من «استماراتي» أو النماذج المتاحة واكتب الغرض.',
        'راجع الدفعة قبل الإرسال؛ لا يصل تكليف للفريق إلا بعد الاعتماد عندما يكون مطلوبًا.',
      ],
    })
  }

  if (isFieldInspector || canWorkMissions) {
    guides.push({
      title: 'العمل الميداني ورصد الملاحظات',
      description:
        'ما يحتاجه المفتش أو عضو فريق المرور أثناء تنفيذ المأمورية وتوثيق ما تم رصده.',
      href: '/v2/missions',
      icon: ClipboardList,
      steps: [
        'ابدأ من المأمورية المكلف بها وتحقق من المنشأة ونطاق الزيارة.',
        'سجل النتيجة على عنصر التقييم المناسب وأرفق التوثيق عند الحاجة.',
        'إذا وجدت مشكلة قابلة للتصحيح، سجلها كملاحظة وحدد التصنيف والخطورة والمهلة.',
        'لا تغلق الملاحظة بنفسك بعد إرسالها لجهة التصحيح؛ انتظر دورة التحقق المعتمدة.',
      ],
    })
  }

  if (canCorrect) {
    guides.push({
      title: 'استلام الملاحظات وتنفيذ التصحيح',
      description:
        'دليل مستخدمي جهات التصحيح مثل مركز المعلومات ومكافحة العدوى والصيدلة والصيانة وغيرها.',
      href: '/v2/violations',
      icon: CheckCircle2,
      steps: [
        'راجع الوارد الموجه إلى جهتك وتحقق من المهلة والأولوية والمنشأة.',
        'ابدأ المعالجة وسجل ما تم اتخاذه بدل الاكتفاء بتغيير الحالة.',
        'أرفق دليل التصحيح عند الحاجة، مثل صورة أو مستند أو وصف فني واضح.',
        'بعد التنفيذ تصبح الملاحظة بانتظار التحقق، ولا تعتبر مغلقة بمجرد إعلان الجهة أنها صححتها.',
      ],
    })
  }

  if (canVerifyOrClose) {
    guides.push({
      title: 'التحقق والمتابعة والتصعيد',
      description:
        'دليل الجهات الرقابية والقيادات التي تتابع جودة التصحيح والملاحظات المتأخرة.',
      href: '/v2/violations',
      icon: ShieldCheck,
      steps: [
        'راجع الملاحظات داخل نطاقك حتى لو كانت مسؤولية التصحيح على جهة أدنى.',
        'تحقق من دليل التصحيح قبل الاعتماد، وأعد الملاحظة إذا كان التنفيذ غير كافٍ.',
        'عند تجاوز المهلة يصعد النظام المتابعة للمستوى الأعلى مع بقاء المسؤولية الأصلية واضحة.',
        'لا تحذف الملاحظة الرقابية؛ استخدم الاستبعاد الموثق فقط عند وجود سبب وصلاحية.',
      ],
    })
  }

  if (canFinance) {
    guides.push({
      title: 'الاستحقاقات المالية للمأموريات',
      description:
        'دليل الشئون المالية لمراجعة المأموريات المنفذة وإعداد البدلات والمكافآت ثم الاعتماد والصرف حسب الدور.',
      href: '/v2/finance',
      icon: Banknote,
      steps: [
        'تظهر الاستحقاقات تلقائيًا بعد اكتمال المأمورية لكل عضو من أعضاء الفريق.',
        'مسؤول الإعداد يراجع الأيام وليالي المبيت والقيمة الثابتة وبدل اليوم والمكافآت والتسويات.',
        'المعتمد المالي يراجع التسوية المعدة ويعتمدها أو يعيدها بسبب موثق.',
        'لا يسجل الصرف إلا بعد الاعتماد المالي ومع إدخال مرجع أو رقم مستند الصرف.',
      ],
    })
  }

  if (canMissionReports || canFinanceReports) {
    guides.push({
      title: 'التقارير حسب الصلاحيات',
      description:
        'يعرض مركز التقارير الجزء التشغيلي أو المالي أو كليهما حسب نوع العمل الممنوح للحساب.',
      href: '/v2/reports',
      icon: FileText,
      steps: [
        'سكرتارية المأموريات ترى ملخصات وتقارير المأموريات داخل نطاقها.',
        'المستخدم المالي يرى ملخصات الاستحقاقات المعتمدة والمصروفة وحالات المراجعة.',
        'لا تظهر البيانات الخارجة عن النطاق التنظيمي الممنوح للحساب.',
      ],
    })
  }

  if (canManageOrganizations) {
    guides.push({
      title: 'إدارة الهيكل التنظيمي',
      description:
        'إنشاء الجهات الفرعية وتنظيم تبعيتها دون كسر شجرة الصلاحيات.',
      href: '/v2/organizations',
      icon: Network,
      steps: [
        'اختر الجهة الأم الصحيحة قبل إنشاء أي جهة جديدة.',
        'يجب أن تكون الجهة الأم قد فعّلت السماح بإنشاء جهات فرعية.',
        'لا تستخدم الهيكل لإضافة منشأة صحية؛ المنشآت لها شاشة مستقلة.',
        'الإيقاف أو الأرشفة يجب أن يظل ظاهرًا في السجل ولا يعامل كحذف.',
      ],
    })
  }

  const contextualGuide = PAGE_GUIDES.find(
    (guide) => from && from.startsWith(guide.prefix)
  )

  return (
    <V2PageContainer>
      <PageHeader
        title="مركز المساعدة والتدريب"
        description="مرجع عملي داخل المنظومة يتغير حسب دورك وصلاحياتك، ويشرح المصطلحات ودورة العمل بدون الحاجة إلى دليل منفصل."
        badge={
          <span className="inline-flex rounded-full border border-teal-100 bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-800">
            دليل V2
          </span>
        }
      />

      {contextualGuide && (
        <section className="mb-5 rounded-2xl border border-teal-200 bg-teal-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-teal-700 shadow-sm">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-teal-700">
                شرح الصفحة التي جئت منها
              </p>
              <h2 className="mt-1 text-sm font-extrabold text-slate-900">
                {contextualGuide.title}
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-600">
                {contextualGuide.description}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-400">أدوارك الحالية</p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {access.roles.length.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            يعرض المركز فقط ما يرتبط بصلاحيات حسابك.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-400">أدلة متاحة لك</p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {guides.length.toLocaleString('en-US')}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            تتغير تلقائيًا إذا تغير نوع عملك أو صلاحياتك.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-bold text-slate-400">دورة التصحيح</p>
          <p className="mt-1 text-lg font-black text-slate-900">
            {V2_CORRECTION_WORKFLOW_STEPS.length.toLocaleString('en-US')} مراحل
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            من الرصد حتى التحقق والإغلاق أو التصعيد.
          </p>
        </div>
      </section>

      <section className="mb-7">
        <div className="mb-3">
          <h2 className="text-base font-black text-slate-900">
            دليلك حسب صلاحياتك
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            لا تظهر هنا وظائف لا تخص حسابك، حتى يظل التدريب مختصرًا وواضحًا.
          </p>
        </div>

        {guides.length > 0 ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {guides.map((guide) => {
              const Icon = guide.icon
              return (
                <article
                  key={guide.title}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {guide.title}
                      </h3>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">
                        {guide.description}
                      </p>
                    </div>
                  </div>

                  <ol className="mt-4 space-y-2">
                    {guide.steps.map((step, index) => (
                      <li
                        key={step}
                        className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-black text-teal-700 shadow-sm">
                          {index + 1}
                        </span>
                        <span className="text-[11px] leading-5 text-slate-600">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {guide.href && (
                    <div className="mt-4">
                      <Link
                        href={guide.href}
                        className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-[11px] font-bold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-800"
                      >
                        فتح القسم
                      </Link>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <HelpCircle className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm font-bold text-slate-700">
              لا توجد أدلة تشغيلية إضافية لهذا الحساب حاليًا
            </p>
            <p className="mt-1 text-xs text-slate-400">
              يظل قاموس المصطلحات ودورة التصحيح متاحين لك دائمًا.
            </p>
          </div>
        )}
      </section>

      <section className="mb-7">
        <div className="mb-3">
          <h2 className="text-base font-black text-slate-900">
            دورة {V2_TERMINOLOGY.finding} والتصحيح
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            هذه هي الدورة المرجعية التي سنستخدمها في التدريب وفي تصميم شاشة الملاحظات.
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {V2_CORRECTION_WORKFLOW_STEPS.map((step, index) => (
            <div
              key={step.key}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
                {index + 1}
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-base font-black text-slate-900">
            قاموس المصطلحات المعتمد
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            نستخدم نفس الكلمات في الواجهة والتدريب حتى لا يتعلم المستخدم أكثر من مسمى لنفس المعنى.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {[
            ['الملاحظات والتصحيح', 'الوحدة التي تجمع الرصد والتوجيه والمعالجة والتحقق والتصعيد.'],
            ['ملاحظة', 'أي مشكلة أو قصور أو خلل يحتاج متابعة، وليس بالضرورة مخالفة عقابية.'],
            ['الجهة المسؤولة عن التصحيح', 'الإدارة أو القسم أو الوحدة التنظيمية المكلفة بمعالجة الملاحظة.'],
            ['تم تنفيذ التصحيح', 'الجهة المسؤولة سجلت ما نفذته، لكن الملاحظة لم تعتمد بعد.'],
            ['تم التحقق من التصحيح', 'جهة مخولة راجعت التنفيذ وقبلته.'],
            ['تصعيد المتابعة', 'رفع المتابعة للمستوى الأعلى عند التأخر مع بقاء المسؤولية الأصلية واضحة.'],
            ['استبعاد الملاحظة', 'إلغاء موثق بسبب وصلاحية محددة دون حذف الأثر الرقابي.'],
            ['نوع العمل داخل المنظومة', 'الدور الذي يحدد وظيفة المستخدم وصلاحياته، وقد يختلف عن مسماه الوظيفي الرسمي.'],
          ].map(([term, explanation], index) => (
            <div
              key={term}
              className={`grid gap-1 px-4 py-3 sm:grid-cols-[190px_1fr] sm:gap-5 ${
                index > 0 ? 'border-t border-slate-100' : ''
              }`}
            >
              <strong className="text-xs text-slate-800">{term}</strong>
              <span className="text-[11px] leading-5 text-slate-500">
                {explanation}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 className="text-xs font-extrabold text-amber-900">
              هذا المركز سيكبر مع المنظومة
            </h2>
            <p className="mt-1 text-[11px] leading-5 text-amber-800">
              المرحلة الحالية تثبت اللغة ودليل الأدوار. عند اكتمال كل شاشة سنضيف لها شرحًا مصورًا وخطوات تفاعلية قصيرة، ويمكن لاحقًا إضافة Onboarding لأول تسجيل دخول.
            </p>
          </div>
        </div>
      </section>
    </V2PageContainer>
  )
}
