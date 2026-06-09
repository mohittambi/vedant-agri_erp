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
import { saveProduct, toggleProduct } from "@/lib/actions/product-actions"
import { productSchema, type ProductInput } from "@/lib/validations/product"
import { UNITS } from "@/lib/india"
import { formatCurrency, formatNumber } from "@/lib/format"
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

export type Option = { value: string; label: string }
export type ProductRow = {
  id: string
  sku: string
  name: string
  hsnCode: string | null
  unit: string
  categoryId: string | null
  manufacturerId: string | null
  taxGroupId: string | null
  categoryName: string | null
  manufacturerName: string | null
  cashRate: number
  creditRate: number
  mrp: number
  purchaseRate: number
  reorderLevel: number
  isBatchTracked: boolean
  isActive: boolean
}
export type Perms = { create: boolean; update: boolean }

const NONE = "__none__"

function ProductForm({
  open, onOpenChange, product, categories, manufacturers, taxGroups,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  product: ProductRow | null
  categories: Option[]
  manufacturers: Option[]
  taxGroups: Option[]
}) {
  const editing = Boolean(product)
  const defaults: ProductInput = {
    sku: "", name: "", hsnCode: "", unit: "PCS",
    categoryId: "", manufacturerId: "", taxGroupId: "",
    cashRate: 0, creditRate: 0, mrp: 0, purchaseRate: 0, reorderLevel: 0,
    isBatchTracked: true, isActive: true,
  }
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as unknown as Resolver<ProductInput>,
    defaultValues: defaults,
  })

  React.useEffect(() => {
    if (open) {
      form.reset(
        product
          ? {
              sku: product.sku, name: product.name, hsnCode: product.hsnCode ?? "",
              unit: product.unit as ProductInput["unit"],
              categoryId: product.categoryId ?? "", manufacturerId: product.manufacturerId ?? "",
              taxGroupId: product.taxGroupId ?? "",
              cashRate: product.cashRate, creditRate: product.creditRate, mrp: product.mrp,
              purchaseRate: product.purchaseRate, reorderLevel: product.reorderLevel,
              isBatchTracked: product.isBatchTracked, isActive: product.isActive,
            }
          : defaults
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product])

  async function onSubmit(values: ProductInput) {
    const res = await saveProduct(product?.id ?? null, values)
    if (!res.ok) {
      if (res.fieldErrors)
        for (const [k, m] of Object.entries(res.fieldErrors)) form.setError(k as keyof ProductInput, { message: m?.[0] })
      toast.error(res.error ?? "Please fix the errors.")
      return
    }
    toast.success(editing ? "Product updated" : "Product created")
    onOpenChange(false)
  }

  const selectField = (name: "categoryId" | "manufacturerId" | "taxGroupId", label: string, opts: Option[]) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select
          value={field.value || NONE}
          onValueChange={(v) => field.onChange(v === NONE ? "" : v)}
        >
          <FormControl><SelectTrigger><SelectValue placeholder={`Select ${label.toLowerCase()}`} /></SelectTrigger></FormControl>
          <SelectContent>
            <SelectItem value={NONE}>— None —</SelectItem>
            {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <FormMessage />
      </FormItem>
    )} />
  )

  const numField = (name: keyof ProductInput, label: string) => (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input type="number" step="0.01" {...field} value={field.value as number} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>Cash rate must be strictly less than credit rate.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField control={form.control} name="sku" render={({ field }) => (
              <FormItem><FormLabel>SKU *</FormLabel><FormControl><Input {...field} placeholder="PRD-001" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Name *</FormLabel><FormControl><Input {...field} placeholder="Urea 50kg" /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="hsnCode" render={({ field }) => (
              <FormItem><FormLabel>HSN code</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="unit" render={({ field }) => (
              <FormItem>
                <FormLabel>Unit</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            {selectField("categoryId", "Category", categories)}
            {selectField("manufacturerId", "Manufacturer", manufacturers)}
            {selectField("taxGroupId", "Tax group", taxGroups)}
            {numField("purchaseRate", "Purchase rate")}
            {numField("cashRate", "Cash rate")}
            {numField("creditRate", "Credit rate")}
            {numField("mrp", "MRP")}
            {numField("reorderLevel", "Reorder level")}
            <div className="flex items-center gap-6 sm:col-span-2">
              <FormField control={form.control} name="isBatchTracked" render={({ field }) => (
                <FormItem><label className="flex items-center gap-2 text-sm"><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} /> Batch tracked</label></FormItem>
              )} />
              <FormField control={form.control} name="isActive" render={({ field }) => (
                <FormItem><label className="flex items-center gap-2 text-sm"><Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(!!v)} /> Active</label></FormItem>
              )} />
            </div>
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

export function ProductsClient({
  products, categories, manufacturers, taxGroups, perms,
}: {
  products: ProductRow[]
  categories: Option[]
  manufacturers: Option[]
  taxGroups: Option[]
  perms: Perms
}) {
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<ProductRow | null>(null)
  const [pending, startTransition] = useTransition()

  const columns: ColumnDef<ProductRow>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => <SortableHeader column={column} title="Product" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.sku}{row.original.categoryName ? ` · ${row.original.categoryName}` : ""}</div>
        </div>
      ),
    },
    { accessorKey: "unit", header: "Unit" },
    { accessorKey: "cashRate", header: ({ column }) => <SortableHeader column={column} title="Cash" />, cell: ({ row }) => formatCurrency(row.original.cashRate) },
    { accessorKey: "creditRate", header: ({ column }) => <SortableHeader column={column} title="Credit" />, cell: ({ row }) => formatCurrency(row.original.creditRate) },
    { accessorKey: "mrp", header: "MRP", cell: ({ row }) => formatCurrency(row.original.mrp) },
    { accessorKey: "reorderLevel", header: "Reorder", cell: ({ row }) => formatNumber(row.original.reorderLevel, 0) },
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
                const res = await toggleProduct(p.id, !p.isActive)
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
        data={products}
        searchPlaceholder="Search products..."
        toolbar={perms.create ? <Button onClick={() => { setEditing(null); setOpen(true) }}><Plus className="size-4" /> New product</Button> : null}
      />
      <ProductForm
        open={open} onOpenChange={setOpen} product={editing}
        categories={categories} manufacturers={manufacturers} taxGroups={taxGroups}
      />
    </>
  )
}
