"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { Plus } from "lucide-react"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatDate } from "@/lib/format"

export type InvoiceRow = {
  id: string
  number: string
  date: string
  party: string
  total: number
  status: string
  mode?: string
}

const STATUS_TONE: Record<string, string> = {
  PAID: "bg-emerald-500/10 text-emerald-600",
  CONFIRMED: "bg-blue-500/10 text-blue-600",
  PARTIALLY_PAID: "bg-amber-500/10 text-amber-600",
  DRAFT: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
}

export function InvoiceList({
  rows, basePath, partyLabel, canCreate, newLabel,
}: {
  rows: InvoiceRow[]
  basePath: string
  partyLabel: string
  canCreate: boolean
  newLabel: string
}) {
  const router = useRouter()
  const columns: ColumnDef<InvoiceRow>[] = [
    {
      accessorKey: "number",
      header: ({ column }) => <SortableHeader column={column} title="Number" />,
      cell: ({ row }) => (
        <Link href={`${basePath}/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.number}
        </Link>
      ),
    },
    { accessorKey: "date", header: ({ column }) => <SortableHeader column={column} title="Date" />, cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: "party", header: partyLabel },
    { accessorKey: "mode", header: "Mode", cell: ({ row }) => row.original.mode ?? "—" },
    {
      accessorKey: "total",
      header: ({ column }) => <SortableHeader column={column} title="Total" />,
      cell: ({ row }) => <span className="tabular-nums font-medium">{formatCurrency(row.original.total)}</span>,
    },
    {
      accessorKey: "status", header: "Status",
      cell: ({ row }) => (
        <Badge variant="secondary" className={STATUS_TONE[row.original.status] ?? ""}>
          {row.original.status.replace("_", " ")}
        </Badge>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder={`Search ${partyLabel.toLowerCase()} / number...`}
      toolbar={canCreate ? <Button onClick={() => router.push(`${basePath}/new`)}><Plus className="size-4" /> {newLabel}</Button> : null}
    />
  )
}
