"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatNumber } from "@/lib/format"

export type StockRow = {
  key: string
  product: string
  sku: string
  unit: string
  location: string
  quantity: number
  reorderLevel: number
  value: number
}

export function StockTable({ rows }: { rows: StockRow[] }) {
  const columns: ColumnDef<StockRow>[] = [
    {
      accessorKey: "product",
      header: ({ column }) => <SortableHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.product}</div>
          <div className="text-xs text-muted-foreground">{row.original.sku}</div>
        </div>
      ),
    },
    { accessorKey: "location", header: "Location" },
    {
      accessorKey: "quantity",
      header: ({ column }) => <SortableHeader column={column} title="In stock" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.quantity, 2)} {row.original.unit}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const { quantity, reorderLevel } = row.original
        if (quantity <= 0) return <Badge variant="secondary" className="bg-destructive/10 text-destructive">Out of stock</Badge>
        if (reorderLevel > 0 && quantity <= reorderLevel) return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Low</Badge>
        return <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">OK</Badge>
      },
    },
    { accessorKey: "value", header: "Stock value", cell: ({ row }) => <span className="tabular-nums font-medium">{formatCurrency(row.original.value)}</span> },
  ]
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search stock..." pageSize={15} />
}
