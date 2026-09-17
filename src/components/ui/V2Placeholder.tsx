'use client'

import Link from 'next/link'
import { Button, Chip } from '@heroui/react'
import { PageHeader } from '@/components/ui/PageHeader'
import { V2PageContainer } from '@/components/ui/V2PageContainer'
import { V2_NAVIGATION_ITEMS } from '@/config/navigation'

interface V2PlaceholderProps {
  title: string
  moduleId: string
  description?: string
}

export function V2Placeholder({ title, moduleId, description }: V2PlaceholderProps) {
  const currentNav = V2_NAVIGATION_ITEMS.find((item) => item.id === moduleId)

  return (
    <V2PageContainer>
      <PageHeader
        title={title}
        description={description || currentNav?.description}
        badge={
          <Chip
            size="sm"
            variant="soft"
            color="success"
            className="text-xs font-medium"
          >
            V2 Shell Mode
          </Chip>
        }
        breadcrumbs={[
          { label: 'الرئيسية', href: '/v2/dashboard' },
          { label: title },
        ]}
      />

      {/* Clean Placeholder Information Card */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-teal-50 text-teal-800 border border-teal-200">
              مساحة الوحدة في V2
            </span>
            <span className="text-xs text-slate-400 font-mono">Module ID: {moduleId}</span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800">
            هذه مساحة وحدة {title} في V2
          </h2>

          <p className="text-sm text-slate-600 leading-relaxed">
            تعمل هذه الصفحة حالياً داخل الهيكل البصري التفاعلي الجديد (App Shell) كصفحة مؤقتة (Placeholder). سيتم بناء وظائف الوحدة وإجراءات العمل تدريجياً في المراحل القادمة دون أي ربط وهمي أو بيانات تجريبية.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link href="/v2/dashboard">
              <Button size="sm" variant="outline" className="text-slate-600 hover:text-slate-900">
                العودة للوحة V2
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button size="sm" variant="ghost" className="text-slate-500 hover:text-slate-700 text-xs">
                الانتقال للنظام الحالي (V1)
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </V2PageContainer>
  )
}
