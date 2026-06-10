"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { salesSchema, type SalesInput } from "@/lib/validations/sales"
import { createSale } from "@/lib/actions/sales-actions"
import { computeDocument, resolveGstTreatment } from "@/lib/gst"
import { formatCurrency, formatNumber } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

export type ProductOpt = {
  id: string; name: string; sku: string; unit: string
  cashRate: number; creditRate: number; gstRate: number; cessRate: number
}
export type CustomerOpt = { id: string; name: string; stateCode: string | null }
export type LocationOpt = { id: string; name: string }
const WALKIN = "__walkin__"

export function SalesForm({
  firmStateCode, customers, locations, products, stock, defaultLocationId,
}: {
  firmStateCode: string | null
  customers: CustomerOpt[]
  locations: LocationOpt[]
  products: ProductOpt[]
  stock: Record<string, Record<string, number>> // productId -> locationId -> qty
  defaultLocationId?: string
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const form = useForm<SalesInput>({
    resolver: zodResolver(salesSchema) as unknown as Resolver<SalesInput>,
    defaultValues: {
      customerId: "", locationId: defaultLocationId ?? "", invoiceDate: today, dueDate: "",
      saleType: "CASH", notes: "", items: [{ productId: "", quantity: 1, rate: 0, discountPct: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })

  // useWatch (not form.watch) reliably re-renders on every nested field-array
  // edit, including edits to an earlier row after a new row was appended.
  const watchItems = useWatch({ control: form.control, name: "items" })
  const watchCustomer = form.watch("customerId")
  const watchSaleType = form.watch("saleType")
  const watchLocation = form.watch("locationId")

  const treatment = React.useMemo(() => {
    const c = customers.find((x) => x.id === watchCustomer)
    return resolveGstTreatment(firmStateCode, c?.stateCode)
  }, [watchCustomer, customers, firmStateCode])

  const totals = React.useMemo(() => {
    const lines = (watchItems ?? []).map((it) => {
      const p = productMap.get(it.productId)
      return {
        quantity: Number(it.quantity) || 0, rate: Number(it.rate) || 0,
        discountPct: Number(it.discountPct) || 0,
        gstRate: p?.gstRate ?? 0, cessRate: p?.cessRate ?? 0,
      }
    })
    return computeDocument(lines, treatment)
  }, [watchItems, productMap, treatment])

  function availableFor(productId: string) {
    return stock[productId]?.[watchLocation] ?? 0
  }

  function onProductChange(index: number, productId: string) {
    form.setValue(`items.${index}.productId`, productId)
    const p = productMap.get(productId)
    if (p) form.setValue(`items.${index}.rate`, watchSaleType === "CASH" ? p.cashRate : p.creditRate)
  }

  // When sale type flips, re-price every line.
  React.useEffect(() => {
    const items = form.getValues("items")
    items.forEach((it, i) => {
      const p = productMap.get(it.productId)
      if (p) form.setValue(`items.${i}.rate`, watchSaleType === "CASH" ? p.cashRate : p.creditRate)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchSaleType])

  async function onSubmit(values: SalesInput) {
    const res = await createSale(values)
    if (!res.ok) {
      toast.error(res.error ?? "Please fix the errors.")
      return
    }
    toast.success("Sale recorded")
    router.push(`/sales/${res.id}`)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Sale details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Customer</Label>
            <Select value={form.watch("customerId") || WALKIN} onValueChange={(v) => form.setValue("customerId", v === WALKIN ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Walk-in / Cash" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={WALKIN}>Walk-in / Cash</SelectItem>
                {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Sale type</Label>
            <Select value={form.watch("saleType")} onValueChange={(v) => form.setValue("saleType", v as "CASH" | "CREDIT")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CASH">Cash</SelectItem><SelectItem value="CREDIT">Credit</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Location *</Label>
            <Select value={form.watch("locationId")} onValueChange={(v) => form.setValue("locationId", v)}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
            {form.formState.errors.locationId && <p className="text-sm text-destructive">{form.formState.errors.locationId.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Invoice date *</Label>
            <Input type="date" {...form.register("invoiceDate")} />
          </div>
          <div className="grid gap-1.5">
            <Label>Due date</Label>
            <Input type="date" {...form.register("dueDate")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">
            Items <span className="ml-2 text-xs font-normal text-muted-foreground">GST: {treatment.replace("_", "-").toLowerCase()} · {watchSaleType.toLowerCase()} rate</span>
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1, rate: 0, discountPct: 0 })}>
            <Plus className="size-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Product</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-28">Rate</TableHead>
                <TableHead className="w-20">Disc%</TableHead>
                <TableHead className="text-right">Disc ₹</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, i) => {
                const line = totals.lines[i]
                const pid = watchItems?.[i]?.productId
                const avail = pid ? availableFor(pid) : 0
                const qty = Number(watchItems?.[i]?.quantity) || 0
                const short = pid && qty > avail
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Select value={form.watch(`items.${i}.productId`)} onValueChange={(v) => onProductChange(i, v)}>
                        <SelectTrigger className="min-w-44"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${short ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {pid ? formatNumber(avail, 2) : "—"}
                    </TableCell>
                    <TableCell><Input type="number" step="0.001" className="w-24" {...form.register(`items.${i}.quantity`)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-28" {...form.register(`items.${i}.rate`)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-20" {...form.register(`items.${i}.discountPct`)} /></TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(line?.discountAmount ?? 0)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(line?.taxableAmount ?? 0)}</TableCell>
                    <TableCell>
                      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => fields.length > 1 && remove(i)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {form.formState.errors.items && <p className="mt-2 text-sm text-destructive">{form.formState.errors.items.message as string}</p>}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Card className="w-full lg:max-w-sm">
          <CardContent className="space-y-1.5 py-4 text-sm">
            <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
            {totals.discountAmount > 0 && <Row label="Discount" value={`− ${formatCurrency(totals.discountAmount)}`} />}
            <Row label="Taxable" value={formatCurrency(totals.taxableAmount)} />
            {treatment === "INTRA_STATE" ? (
              <>
                <Row label="CGST" value={formatCurrency(totals.cgstAmount)} />
                <Row label="SGST" value={formatCurrency(totals.sgstAmount)} />
              </>
            ) : (
              <Row label="IGST" value={formatCurrency(totals.igstAmount)} />
            )}
            {totals.cessAmount > 0 && <Row label="Cess" value={formatCurrency(totals.cessAmount)} />}
            <Row label="Round off" value={formatCurrency(totals.roundOff)} />
            <div className="my-1 border-t" />
            <Row label="Grand total" value={formatCurrency(totals.grandTotal)} bold />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push("/sales")}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save sale
        </Button>
      </div>
    </form>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-base font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  )
}
