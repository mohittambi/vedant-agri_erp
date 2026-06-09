"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"

export type BatchRow = {
  id: string
  product: string
  sku: string
  location: string
  batchNumber: string
  expiryDate: string | null
  daysToExpiry: number | null
  quantity: number
  purchaseRate: number
  value: number
}

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-muted-foreground">—</span>
  if (days < 0) return <Badge variant="secondary" className="bg-destructive/10 text-destructive">Expired</Badge>
  if (days <= 30) return <Badge variant="secondary" className="bg-destructive/10 text-destructive">{days}d</Badge>
  if (days <= 90) return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">{days}d</Badge>
  return <Badge variant="outline" className="text-muted-foreground">{days}d</Badge>
}

export function BatchTable({ rows, showExpiry = true }: { rows: BatchRow[]; showExpiry?: boolean }) {
  const columns: ColumnDef<BatchRow>[] = [
    {
      accessorKey: "product",
      header: ({ column }) => <SortableHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.product}</div>
          <div className="text-xs text-muted-foreground">{row.original.sku} · {row.original.location}</div>
        </div>
      ),
    },
    { accessorKey: "batchNumber", header: "Batch" },
    { accessorKey: "expiryDate", header: "Expiry", cell: ({ row }) => formatDate(row.original.expiryDate) },
    ...(showExpiry ? [{
      id: "days",
      header: "Status",
      cell: ({ row }: { row: import("@tanstack/react-table").Row<BatchRow> }) => <ExpiryBadge days={row.original.daysToExpiry} />,
    } as ColumnDef<BatchRow>] : []),
    {
      accessorKey: "quantity",
      header: ({ column }) => <SortableHeader column={column} title="Qty" />,
      cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.quantity, 2)}</span>,
    },
    { accessorKey: "purchaseRate", header: "Rate", cell: ({ row }) => formatCurrency(row.original.purchaseRate) },
    { accessorKey: "value", header: "Value", cell: ({ row }) => <span className="tabular-nums font-medium">{formatCurrency(row.original.value)}</span> },
  ]
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search batches..." pageSize={15} />
}
