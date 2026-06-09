"use client"

import { useTransition } from "react"
import { Building2, Check, ChevronsUpDown } from "lucide-react"
import { switchFirmAction } from "@/lib/actions/session-actions"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { SessionFirm } from "@/lib/auth"

export function FirmSwitcher({
  firms,
  activeFirmId,
}: {
  firms: SessionFirm[]
  activeFirmId: string | null
}) {
  const [pending, startTransition] = useTransition()
  const active = firms.find((f) => f.id === activeFirmId)

  if (firms.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">No firm assigned</span>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={pending || firms.length === 1}
          className="gap-2"
        >
          <Building2 className="size-4" />
          <span className="max-w-[12rem] truncate">
            {active?.name ?? "Select firm"}
          </span>
          {firms.length > 1 && <ChevronsUpDown className="size-3.5 opacity-60" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch firm</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {firms.map((firm) => (
          <DropdownMenuItem
            key={firm.id}
            onSelect={() =>
              startTransition(() => {
                void switchFirmAction(firm.id)
              })
            }
          >
            <Check
              className={cn(
                "size-4",
                firm.id === activeFirmId ? "opacity-100" : "opacity-0"
              )}
            />
            <span className="truncate">{firm.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
