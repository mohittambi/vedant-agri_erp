"use client"

import * as React from "react"
import { useTransition } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal, Plus, Pencil, Power } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { FirmFormDialog, type FirmRow } from "./firm-form"
import { toggleFirmActiveAction } from "@/lib/actions/firm-actions"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function RowActions({ firm, onEdit }: { firm: FirmRow; onEdit: (f: FirmRow) => void }) {
  const [pending, startTransition] = useTransition()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onEdit(firm)}>
          <Pencil className="size-4" /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() =>
            startTransition(async () => {
              const res = await toggleFirmActiveAction(firm.id, !firm.isActive)
              if (res.ok) toast.success(firm.isActive ? "Firm deactivated" : "Firm activated")
              else toast.error(res.error ?? "Failed")
            })
          }
        >
          <Power className="size-4" /> {firm.isActive ? "Deactivate" : "Activate"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function FirmsClient({ firms }: { firms: FirmRow[] }) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<FirmRow | null>(null)

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (f: FirmRow) => {
    setEditing(f)
    setOpen(true)
  }

  const columns: ColumnDef<FirmRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} title="Firm" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.legalName && (
            <div className="text-xs text-muted-foreground">{row.original.legalName}</div>
          )}
        </div>
      ),
    },
    { accessorKey: "gstin", header: "GSTIN", cell: ({ row }) => row.original.gstin ?? "—" },
    {
      id: "location",
      header: "Location",
      cell: ({ row }) =>
        [row.original.city, row.original.state].filter(Boolean).join(", ") || "—",
    },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) =>
        row.original.isActive ? (
          <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Active</Badge>
        ) : (
          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
        ),
    },
    {
      id: "actions",
      cell: ({ row }) => <RowActions firm={row.original} onEdit={openEdit} />,
    },
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={firms}
        searchPlaceholder="Search firms..."
        toolbar={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New firm
          </Button>
        }
      />
      <FirmFormDialog open={open} onOpenChange={setOpen} firm={editing} />
    </>
  )
}
