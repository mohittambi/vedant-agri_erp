"use client"

import * as React from "react"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { Loader2, MoreHorizontal, Pencil, Plus, Power, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import {
  saveMasterItem,
  toggleMasterItem,
  deleteMasterItem,
} from "@/lib/actions/master-actions"
import { MASTER_CONFIGS, type MasterModel, type FieldDef } from "@/lib/master"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { formatNumber } from "@/lib/format"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type MasterRow = Record<string, unknown> & { id: string; isActive?: boolean }
export type MasterPerms = { create: boolean; update: boolean; delete: boolean }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = any

function FieldRenderer({ field, def }: { field: AnyForm; def: FieldDef }) {
  if (def.type === "switch") {
    return (
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={!!field.value}
          onCheckedChange={(v) => field.onChange(Boolean(v))}
        />
        {def.label}
      </label>
    )
  }
  if (def.type === "textarea") {
    return <Textarea {...field} value={field.value ?? ""} placeholder={def.placeholder} />
  }
  if (def.type === "select") {
    return (
      <Select value={field.value ?? ""} onValueChange={field.onChange}>
        <SelectTrigger><SelectValue placeholder={`Select ${def.label.toLowerCase()}`} /></SelectTrigger>
        <SelectContent>
          {def.options?.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      {...field}
      value={field.value ?? ""}
      type={def.type === "number" ? "number" : "text"}
      step={def.step}
      placeholder={def.placeholder}
      className={def.uppercase ? "uppercase" : undefined}
    />
  )
}

function MasterFormDialog({
  model,
  open,
  onOpenChange,
  row,
}: {
  model: MasterModel
  open: boolean
  onOpenChange: (v: boolean) => void
  row: MasterRow | null
}) {
  const config = MASTER_CONFIGS[model]
  const editing = Boolean(row)
  const form = useForm<AnyForm>({
    resolver: zodResolver(config.schema as AnyForm),
    defaultValues: config.defaults,
  })

  React.useEffect(() => {
    if (open) {
      const init: Record<string, unknown> = { ...config.defaults }
      if (row) for (const f of config.fields) init[f.name] = row[f.name] ?? config.defaults[f.name]
      form.reset(init)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row])

  async function onSubmit(values: AnyForm) {
    const res = await saveMasterItem(model, row?.id ?? null, values)
    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [k, msgs] of Object.entries(res.fieldErrors)) {
          form.setError(k as never, { message: msgs?.[0] })
        }
      }
      toast.error(res.error ?? "Please fix the errors and try again.")
      return
    }
    toast.success(editing ? `${config.title.replace(/s$/, "")} updated` : "Created")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "New"} {config.title.replace(/s$/, "").toLowerCase()}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            {config.fields.map((def) => (
              <FormField
                key={def.name}
                control={form.control}
                name={def.name}
                render={({ field }) => (
                  <FormItem className={def.colSpan === 2 ? "sm:col-span-2" : undefined}>
                    {def.type !== "switch" && (
                      <FormLabel>
                        {def.label}
                        {def.required && <span className="ml-0.5 text-destructive">*</span>}
                      </FormLabel>
                    )}
                    <FormControl>
                      <FieldRenderer field={field} def={def} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export function MasterCrud({
  model,
  rows,
  perms,
}: {
  model: MasterModel
  rows: MasterRow[]
  perms: MasterPerms
}) {
  const config = MASTER_CONFIGS[model]
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MasterRow | null>(null)
  const [toDelete, setToDelete] = React.useState<MasterRow | null>(null)
  const [pending, startTransition] = useTransition()

  const columns: ColumnDef<MasterRow>[] = [
    ...config.columns.map((col) => ({
      accessorKey: col.key,
      header: ({ column }: { column: import("@tanstack/react-table").Column<MasterRow, unknown> }) => (
        <SortableHeader column={column} title={col.label} />
      ),
      cell: ({ row }: { row: import("@tanstack/react-table").Row<MasterRow> }) => {
        const v = row.original[col.key]
        if (col.render === "bool")
          return v ? (
            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Active</Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
          )
        if (col.render === "percent") return `${formatNumber(v as number, 2)}%`
        if (col.render === "number") return formatNumber(v as number, 2)
        return (v as string) ?? "—"
      },
    })),
  ]

  if (perms.update || perms.delete) {
    columns.push({
      id: "actions",
      cell: ({ row }) => {
        const item = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" disabled={pending}>
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {perms.update && (
                <DropdownMenuItem onSelect={() => { setEditing(item); setOpen(true) }}>
                  <Pencil className="size-4" /> Edit
                </DropdownMenuItem>
              )}
              {perms.update && "isActive" in item && (
                <DropdownMenuItem
                  onSelect={() =>
                    startTransition(async () => {
                      const res = await toggleMasterItem(model, item.id, !item.isActive)
                      res.ok ? toast.success("Updated") : toast.error(res.error ?? "Failed")
                    })
                  }
                >
                  <Power className="size-4" /> {item.isActive ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
              )}
              {perms.delete && (
                <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(item)}>
                  <Trash2 className="size-4" /> Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder={config.searchPlaceholder}
        toolbar={
          perms.create ? (
            <Button onClick={() => { setEditing(null); setOpen(true) }}>
              <Plus className="size-4" /> New
            </Button>
          ) : null
        }
      />
      <MasterFormDialog model={model} open={open} onOpenChange={setOpen} row={editing} />
      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                startTransition(async () => {
                  if (!toDelete) return
                  const res = await deleteMasterItem(model, toDelete.id)
                  res.ok ? toast.success("Deleted") : toast.error(res.error ?? "Failed")
                  setToDelete(null)
                })
              }
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
