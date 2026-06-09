"use client"

import type { Column } from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export function SortableHeader<TData, TValue>({
  column,
  title,
}: {
  column: Column<TData, TValue>
  title: string
}) {
  const sort = column.getIsSorted()
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 data-[state=open]:bg-accent"
      onClick={() => column.toggleSorting(sort === "asc")}
    >
      {title}
      {sort === "asc" ? (
        <ArrowUp className="ml-1 size-3.5" />
      ) : sort === "desc" ? (
        <ArrowDown className="ml-1 size-3.5" />
      ) : (
        <ChevronsUpDown className="ml-1 size-3.5 opacity-50" />
      )}
    </Button>
  )
}
