import {
  LayoutDashboard,
  ChartLine,
  Package,
  FolderTree,
  Factory,
  Percent,
  MapPin,
  Boxes,
  Layers,
  CalendarClock,
  ShoppingCart,
  Undo2,
  Truck,
  Receipt,
  RotateCcw,
  Users,
  BookText,
  BookUser,
  FileSpreadsheet,
  TrendingUp,
  Building2,
  UserCog,
  ShieldCheck,
  ScrollText,
  Bell,
  Settings,
  Circle,
  type LucideIcon,
} from "lucide-react"

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  ChartLine,
  Package,
  FolderTree,
  Factory,
  Percent,
  MapPin,
  Boxes,
  Layers,
  CalendarClock,
  ShoppingCart,
  Undo2,
  Truck,
  Receipt,
  RotateCcw,
  Users,
  BookText,
  BookUser,
  FileSpreadsheet,
  TrendingUp,
  Building2,
  UserCog,
  ShieldCheck,
  ScrollText,
  Bell,
  Settings,
}

export function Icon({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Cmp = ICONS[name] ?? Circle
  return <Cmp className={className} />
}
