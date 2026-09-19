import {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Building2,
  Network,
  Users,
  Target,
  CheckSquare,
  Settings,
  MoreHorizontal,
  Bell,
  User,
  Menu,
  ChevronRight,
  ChevronLeft,
  LogOut,
  X,
  ShieldAlert,
  HelpCircle,
  WalletCards,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  ClipboardList,
  AlertTriangle,
  Building2,
  Network,
  Users,
  Target,
  CheckSquare,
  Settings,
  MoreHorizontal,
  Bell,
  User,
  Menu,
  ChevronRight,
  ChevronLeft,
  LogOut,
  X,
  ShieldAlert,
  HelpCircle,
  WalletCards,
  BarChart3,
}

interface NavIconProps {
  name: string
  className?: string
  size?: number
}

export function NavIcon({ name, className = 'w-5 h-5', size }: NavIconProps) {
  const IconComponent = ICON_MAP[name] || HelpCircle
  return <IconComponent className={className} size={size} aria-hidden="true" />
}
