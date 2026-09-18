import {
  Briefcase,
  Building2,
  ClipboardCheck,
  MonitorCog,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

interface RoleAvatarProps {
  roleCode?: string | null
  size?: 'sm' | 'md' | 'lg'
}

function resolveAvatarIcon(roleCode?: string | null): LucideIcon {
  const code = (roleCode || '').toLowerCase()

  if (code.includes('tech') || code.includes('information')) {
    return MonitorCog
  }

  if (code.includes('inspector') || code.includes('field')) {
    return ClipboardCheck
  }

  if (code.includes('directorate') || code.includes('health_admin')) {
    return Building2
  }

  if (
    code.includes('manager') ||
    code.includes('superadmin') ||
    code.includes('sector')
  ) {
    return Briefcase
  }

  if (code.includes('admin')) {
    return ShieldCheck
  }

  return UserRound
}

export function RoleAvatar({
  roleCode,
  size = 'md',
}: RoleAvatarProps) {
  const Icon = resolveAvatarIcon(roleCode)

  const sizeClass =
    size === 'sm'
      ? 'h-8 w-8'
      : size === 'lg'
        ? 'h-12 w-12'
        : 'h-9 w-9'

  const iconClass =
    size === 'sm'
      ? 'h-4 w-4'
      : size === 'lg'
        ? 'h-6 w-6'
        : 'h-[18px] w-[18px]'

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-700`}
      aria-hidden="true"
    >
      <Icon className={iconClass} />
    </div>
  )
}
