import { ReactNode } from 'react'

export type BreadcrumbItem = {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: ReactNode
  badge?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  badge,
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`w-full pb-5 mb-6 border-b border-slate-200/80 ${className}`}>
      {/* Breadcrumbs (if provided) */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-2">
          <ol className="flex items-center gap-1.5 text-xs text-slate-500">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1
              return (
                <li key={crumb.label} className="flex items-center gap-1.5">
                  {crumb.href && !isLast ? (
                    <a
                      href={crumb.href}
                      className="hover:text-teal-700 transition-colors"
                    >
                      {crumb.label}
                    </a>
                  ) : (
                    <span className={isLast ? 'font-semibold text-slate-800' : ''}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <span className="text-slate-300">/</span>}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {/* Main Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-slate-500 leading-relaxed max-w-3xl">
              {description}
            </p>
          )}
        </div>

        {/* Actions slot */}
        {actions && (
          <div className="flex items-center gap-2.5 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
