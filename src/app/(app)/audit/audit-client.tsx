"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/format"

export type AuditRow = {
  id: string; date: string; user: string; action: string; entity: string; entityId: string | null
}

const TONE: Record<string, string> = {
  CREATE: "bg-emerald-500/10 text-emerald-600",
  UPDATE: "bg-blue-500/10 text-blue-600",
  DELETE: "bg-destructive/10 text-destructive",
  LOGIN: "bg-muted text-muted-foreground",
  IMPORT: "bg-amber-500/10 text-amber-600",
}

export function AuditClient({ rows }: { rows: AuditRow[] }) {
  const columns: ColumnDef<AuditRow>[] = [
    { accessorKey: "date", header: ({ column }) => <SortableHeader column={column} title="When" />, cell: ({ row }) => formatDateTime(row.original.date) },
    { accessorKey: "user", header: "User" },
    { accessorKey: "action", header: "Action", cell: ({ row }) => <Badge variant="secondary" className={TONE[row.original.action] ?? ""}>{row.original.action}</Badge> },
    { accessorKey: "entity", header: "Entity" },
    { accessorKey: "entityId", header: "Record", cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.entityId?.slice(0, 8) ?? "—"}</span> },
  ]
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search audit log..." pageSize={20} />
}
