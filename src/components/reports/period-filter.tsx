"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function PeriodFilter({ month }: { month: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set("month", value)
    else next.delete("month")
    router.push(`${pathname}?${next.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="month" className="text-sm text-muted-foreground">Period</Label>
      <Input
        id="month"
        type="month"
        value={month}
        onChange={(e) => onChange(e.target.value)}
        className="w-40"
      />
    </div>
  )
}
