"use client"

import * as React from "react"
import { useTransition } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { Loader2, MoreHorizontal, Pencil, Plus, Power } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { saveParty, toggleParty, type PartyKind } from "@/lib/actions/party-actions"
import { customerSchema, supplierSchema, type PartyInput } from "@/lib/validations/party"
import { INDIAN_STATES } from "@/lib/india"
import { formatCurrency } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type PartyRow = {
  id: string
  name: string
  phone: string | null
  email: string | null
  gstin: string | null
  city: string | null
  state: string | null
  stateCode: string | null
  openingBalance: number
  balance: number
  creditLimit?: number
  isActive: boolean
}
export type Perms = { create: boolean; update: boolean }
const NONE = "__none__"

function PartyForm({
  kind, open, onOpenChange, row,
}: {
  kind: PartyKind
  open: boolean
  onOpenChange: (v: boolean) => void
  row: PartyRow | null
}) {
  const editing = Boolean(row)
  const isCustomer = kind === "customer"
  const schema = isCustomer ? customerSchema : supplierSchema
  const defaults: PartyInput = {
    name: "", phone: "", email: "", gstin: "", address: "", city: "",
    stateCode: "", openingBalance: 0, creditLimit: 0, isActive: true,
  }
  const form = useForm<PartyInput>({
    resolver: zodResolver(schema) as unknown as Resolver<PartyInput>,
    defaultValues: defaults,
  })

  React.useEffect(() => {
    if (open) {
      form.reset(
        row
          ? {
              name: row.name, phone: row.phone ?? "", email: row.email ?? "",
              gstin: row.gstin ?? "", address: "", city: row.city ?? "",
              stateCode: row.stateCode ?? "", openingBalance: row.openingBalance,
              creditLimit: row.creditLimit ?? 0, isActive: row.isActive,
            }
          : defaults
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, row])

  async function onSubmit(values: PartyInput) {
    const res = await saveParty(kind, row?.id ?? null, values)
    if (!res.ok) {
      if (res.fieldErrors)
        for (const [k, m] of Object.entries(res.fieldErrors)) form.setError(k as keyof PartyInput, { message: m?.[0] })
      toast.error(res.error ?? "Please fix the errors.")
      return
    }
    toast.success(editing ? "Updated" : "Created")
    onOpenChange(false)
  }

  const text = (name: keyof PartyInput, label: string, span?: boolean, upper?: boolean) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem className={span ? "sm:col-span-2" : undefined}>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input {...field} value={(field.value as string) ?? ""} className={upper ? "uppercase" : undefined} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit" : "New"} {kind}</DialogTitle>
          <DialogDescription>State determines CGST/SGST vs IGST on invoices.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            {text("name", "Name *", true)}
            {text("phone", "Phone")}
            {text("email", "Email")}
            {text("gstin", "GSTIN", false, true)}
            <FormField control={form.control} name="stateCode" render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value={NONE}>— None —</SelectItem>
                    {INDIAN_STATES.map((s) => <SelectItem key={s.code} value={s.code}>{s.code} — {s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {text("city", "City")}
            {text("address", "Address", true)}
            <FormField control={form.control} name="openingBalance" render={({ field }) => (
              <FormItem><FormLabel>Opening balance</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={field.value as number} /></FormControl><FormMessage /></FormItem>
            )} />
            {isCustomer && (
              <FormField control={form.control} name="creditLimit" render={({ field }) => (
                <FormItem><FormLabel>Credit limit</FormLabel><FormControl><Input type="number" step="0.01" {...field} value={(field.value as number) ?? 0} /></FormControl><FormMessage /></FormItem>
              )} />
            )}
            <FormField control={form.control} name="isActive" render={({ field }) => (
              <FormItem className="sm:col-span-2"><label className="flex items-center gap-2 text-sm"><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} /> Active</label></FormItem>
            )} />
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

export function PartyCrud({
  kind, rows, perms,
}: {
  kind: PartyKind
  rows: PartyRow[]
  perms: Perms
}) {
  const isCustomer = kind === "customer"
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<PartyRow | null>(null)
  const [pending, startTransition] = useTransition()

  const columns: ColumnDef<PartyRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          {row.original.phone && <div className="text-xs text-muted-foreground">{row.original.phone}</div>}
        </div>
      ),
    },
    { accessorKey: "gstin", header: "GSTIN", cell: ({ row }) => row.original.gstin ?? "—" },
    { id: "place", header: "Place", cell: ({ row }) => [row.original.city, row.original.state].filter(Boolean).join(", ") || "—" },
    {
      accessorKey: "balance",
      header: ({ column }) => <SortableHeader column={column} title="Balance" />,
      cell: ({ row }) => <span className="tabular-nums">{formatCurrency(row.original.balance)}</span>,
    },
    {
      accessorKey: "isActive", header: "Status",
      cell: ({ row }) => row.original.isActive
        ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Active</Badge>
        : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>,
    },
  ]

  if (perms.update) {
    columns.push({
      id: "actions",
      cell: ({ row }) => {
        const p = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" disabled={pending}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => { setEditing(p); setOpen(true) }}><Pencil className="size-4" /> Edit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => startTransition(async () => {
                const res = await toggleParty(kind, p.id, !p.isActive)
                res.ok ? toast.success("Updated") : toast.error(res.error ?? "Failed")
              })}><Power className="size-4" /> {p.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
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
        searchPlaceholder={`Search ${kind}s...`}
        toolbar={perms.create ? <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="size-4" /> New {isCustomer ? "customer" : "supplier"}</Button> : null}
      />
      <PartyForm kind={kind} open={open} onOpenChange={setOpen} row={editing} />
    </>
  )
}
