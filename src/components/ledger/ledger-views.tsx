"use client"

import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate } from "@/lib/format"

export type PartyBalanceRow = { id: string; name: string; phone: string | null; balance: number }

export function PartyBalanceList({ rows, basePath }: { rows: PartyBalanceRow[]; basePath: string }) {
  const columns: ColumnDef<PartyBalanceRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <Link href={`${basePath}/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.name}
        </Link>
      ),
    },
    { accessorKey: "phone", header: "Phone", cell: ({ row }) => row.original.phone ?? "—" },
    {
      accessorKey: "balance",
      header: ({ column }) => <SortableHeader column={column} title="Balance" />,
      cell: ({ row }) => <span className="tabular-nums font-medium">{formatCurrency(row.original.balance)}</span>,
    },
  ]
  return <DataTable columns={columns} data={rows} searchPlaceholder="Search..." pageSize={15} />
}

export type LedgerEntry = {
  id: string; date: string; particulars: string; debit: number; credit: number; balance: number
}

export function LedgerEntriesTable({ entries }: { entries: LedgerEntry[] }) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Particulars</TableHead>
            <TableHead className="text-right">Debit</TableHead>
            <TableHead className="text-right">Credit</TableHead>
            <TableHead className="text-right">Balance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.length === 0 ? (
            <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No entries yet.</TableCell></TableRow>
          ) : (
            entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.date)}</TableCell>
                <TableCell>{e.particulars}</TableCell>
                <TableCell className="text-right tabular-nums">{e.debit ? formatCurrency(e.debit) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{e.credit ? formatCurrency(e.credit) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{formatCurrency(e.balance)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
