"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  salesReturnSchema, purchaseReturnSchema,
  type SalesReturnInput, type PurchaseReturnInput,
} from "@/lib/validations/return"
import { createSalesReturn, createPurchaseReturn } from "@/lib/actions/return-actions"
import { computeDocument, resolveGstTreatment } from "@/lib/gst"
import { formatCurrency } from "@/lib/format"
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

export type ProductOpt = { id: string; name: string; sku: string; gstRate: number; cessRate: number; rate: number }
export type PartyOpt = { id: string; name: string; stateCode: string | null }
export type LocationOpt = { id: string; name: string }

type FormShape = SalesReturnInput & PurchaseReturnInput

export function ReturnForm({
  kind, firmStateCode, parties, locations, products, defaultLocationId,
}: {
  kind: "sales" | "purchase"
  firmStateCode: string | null
  parties: PartyOpt[]
  locations: LocationOpt[]
  products: ProductOpt[]
  defaultLocationId?: string
}) {
  const router = useRouter()
  const isSales = kind === "sales"
  const today = new Date().toISOString().slice(0, 10)
  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const schema = isSales ? salesReturnSchema : purchaseReturnSchema

  const form = useForm<FormShape>({
    resolver: zodResolver(schema) as unknown as Resolver<FormShape>,
    defaultValues: {
      customerId: "", supplierId: "", locationId: defaultLocationId ?? "",
      returnDate: today, reason: "", items: [{ productId: "", quantity: 1, rate: 0 }],
    } as FormShape,
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })
  const partyField = isSales ? "customerId" : "supplierId"
  // useWatch (not form.watch) reliably re-renders on every nested field-array
  // edit, including edits to an earlier row after a new row was appended.
  const watchItems = useWatch({ control: form.control, name: "items" })
  const watchParty = form.watch(partyField as "customerId")

  const treatment = React.useMemo(() => {
    const p = parties.find((x) => x.id === watchParty)
    return resolveGstTreatment(firmStateCode, p?.stateCode)
  }, [watchParty, parties, firmStateCode])

  const totals = React.useMemo(() => computeDocument(
    (watchItems ?? []).map((it) => {
      const p = productMap.get(it.productId)
      return { quantity: Number(it.quantity) || 0, rate: Number(it.rate) || 0, gstRate: p?.gstRate ?? 0, cessRate: p?.cessRate ?? 0 }
    }), treatment
  ), [watchItems, productMap, treatment])

  function onProductChange(i: number, pid: string) {
    form.setValue(`items.${i}.productId`, pid)
    const p = productMap.get(pid)
    if (p && !form.getValues(`items.${i}.rate`)) form.setValue(`items.${i}.rate`, p.rate)
  }

  async function onSubmit(values: FormShape) {
    const res = isSales
      ? await createSalesReturn(values)
      : await createPurchaseReturn(values)
    if (!res.ok) { toast.error(res.error ?? "Please fix the errors."); return }
    toast.success("Return recorded")
    router.push(isSales ? "/sales-returns" : "/purchase-returns")
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Return details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>{isSales ? "Customer" : "Supplier"} {isSales ? "" : "*"}</Label>
            <Select value={form.watch(partyField as "customerId") || ""} onValueChange={(v) => form.setValue(partyField as "customerId", v)}>
              <SelectTrigger><SelectValue placeholder={isSales ? "Walk-in / Cash" : "Select supplier"} /></SelectTrigger>
              <SelectContent>{parties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Location *</Label>
            <Select value={form.watch("locationId")} onValueChange={(v) => form.setValue("locationId", v)}>
              <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
              <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Return date *</Label>
            <Input type="date" {...form.register("returnDate")} />
          </div>
          <div className="grid gap-1.5 sm:col-span-3">
            <Label>Reason</Label>
            <Input {...form.register("reason")} placeholder="Damaged / expired / wrong item" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1, rate: 0 })}>
            <Plus className="size-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Product</TableHead>
                <TableHead className="w-24">Qty</TableHead>
                <TableHead className="w-28">Rate</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, i) => (
                <TableRow key={field.id}>
                  <TableCell>
                    <Select value={form.watch(`items.${i}.productId`)} onValueChange={(v) => onProductChange(i, v)}>
                      <SelectTrigger className="min-w-44"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input type="number" step="0.001" className="w-24" {...form.register(`items.${i}.quantity`)} /></TableCell>
                  <TableCell><Input type="number" step="0.01" className="w-28" {...form.register(`items.${i}.rate`)} /></TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(totals.lines[i]?.taxableAmount ?? 0)}</TableCell>
                  <TableCell>
                    <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => fields.length > 1 && remove(i)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-4">
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total ({treatment.replace("_", "-").toLowerCase()})</p>
          <p className="text-xl font-semibold tabular-nums">{formatCurrency(totals.grandTotal)}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.push(isSales ? "/sales-returns" : "/purchase-returns")}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save return
        </Button>
      </div>
    </form>
  )
}
