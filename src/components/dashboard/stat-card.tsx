import { Icon } from "@/components/layout/icon"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "default",
}: {
  label: string
  value: string
  icon: string
  hint?: string
  tone?: "default" | "warning" | "danger" | "success"
}) {
  const toneClasses = {
    default: "bg-primary/10 text-primary",
    warning: "bg-amber-500/10 text-amber-600",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-emerald-500/10 text-emerald-600",
  }[tone]

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={cn("flex size-11 items-center justify-center rounded-lg", toneClasses)}>
          <Icon name={icon} className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
