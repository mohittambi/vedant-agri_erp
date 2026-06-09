"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { purchaseSchema, type PurchaseInput } from "@/lib/validations/purchase"
import { createPurchase } from "@/lib/actions/purchase-actions"
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

export type ProductOpt = {
  id: string; name: string; sku: string; unit: string
  purchaseRate: number; gstRate: number; cessRate: number
}
export type SupplierOpt = { id: string; name: string; stateCode: string | null }
export type LocationOpt = { id: string; name: string }

export function PurchaseForm({
  firmStateCode, suppliers, locations, products, defaultLocationId,
}: {
  firmStateCode: string | null
  suppliers: SupplierOpt[]
  locations: LocationOpt[]
  products: ProductOpt[]
  defaultLocationId?: string
}) {
  const router = useRouter()
  const today = new Date().toISOString().slice(0, 10)
  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const form = useForm<PurchaseInput>({
    resolver: zodResolver(purchaseSchema) as unknown as Resolver<PurchaseInput>,
    defaultValues: {
      supplierId: "", locationId: defaultLocationId ?? "", invoiceDate: today,
      supplierInvNo: "", dueDate: "", paymentMode: "CREDIT", notes: "",
      items: [{ productId: "", batchNumber: "", mfgDate: "", expiryDate: "", quantity: 1, freeQuantity: 0, rate: 0, mrp: 0, discountPct: 0 }],
    },
  })
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })

  const watchItems = form.watch("items")
  const watchSupplier = form.watch("supplierId")

  const treatment = React.useMemo(() => {
    const sup = suppliers.find((s) => s.id === watchSupplier)
    return resolveGstTreatment(firmStateCode, sup?.stateCode)
  }, [watchSupplier, suppliers, firmStateCode])

  const totals = React.useMemo(() => {
    const lines = (watchItems ?? []).map((it) => {
      const p = productMap.get(it.productId)
      return {
        quantity: Number(it.quantity) || 0,
        rate: Number(it.rate) || 0,
        discountPct: Number(it.discountPct) || 0,
        gstRate: p?.gstRate ?? 0,
        cessRate: p?.cessRate ?? 0,
      }
    })
    return computeDocument(lines, treatment)
  }, [watchItems, productMap, treatment])

  function onProductChange(index: number, productId: string) {
    form.setValue(`items.${index}.productId`, productId)
    const p = productMap.get(productId)
    if (p) {
      if (!form.getValues(`items.${index}.rate`)) form.setValue(`items.${index}.rate`, p.purchaseRate)
    }
  }

  async function onSubmit(values: PurchaseInput) {
    const res = await createPurchase(values)
    if (!res.ok) {
      toast.error(res.error ?? "Please fix the errors.")
      return
    }
    toast.success("Purchase recorded")
    router.push(`/purchases/${res.id}`)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Purchase details</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="grid gap-1.5">
            <Label>Supplier *</Label>
            <Select value={form.watch("supplierId")} onValueChange={(v) => form.setValue("supplierId", v)}>
              <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
              <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            {form.formState.errors.supplierId && <p className="text-sm text-destructive">{form.formState.errors.supplierId.message}</p>}
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
            <Label>Payment mode</Label>
            <Select value={form.watch("paymentMode")} onValueChange={(v) => form.setValue("paymentMode", v as "CASH" | "CREDIT")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="CREDIT">Credit</SelectItem><SelectItem value="CASH">Cash</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Invoice date *</Label>
            <Input type="date" {...form.register("invoiceDate")} />
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier invoice no.</Label>
            <Input {...form.register("supplierInvNo")} />
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
            Items <span className="ml-2 text-xs font-normal text-muted-foreground">GST: {treatment.replace("_", "-").toLowerCase()}</span>
          </CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", batchNumber: "", mfgDate: "", expiryDate: "", quantity: 1, freeQuantity: 0, rate: 0, mrp: 0, discountPct: 0 })}>
            <Plus className="size-4" /> Add row
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Product</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="w-20">Qty</TableHead>
                <TableHead className="w-20">Free</TableHead>
                <TableHead className="w-24">Rate</TableHead>
                <TableHead className="w-20">Disc%</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fields.map((field, i) => {
                const line = totals.lines[i]
                return (
                  <TableRow key={field.id}>
                    <TableCell>
                      <Select value={form.watch(`items.${i}.productId`)} onValueChange={(v) => onProductChange(i, v)}>
                        <SelectTrigger className="min-w-44"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Input className="w-28" {...form.register(`items.${i}.batchNumber`)} /></TableCell>
                    <TableCell><Input type="date" className="w-36" {...form.register(`items.${i}.expiryDate`)} /></TableCell>
                    <TableCell><Input type="number" step="0.001" className="w-20" {...form.register(`items.${i}.quantity`)} /></TableCell>
                    <TableCell><Input type="number" step="0.001" className="w-20" {...form.register(`items.${i}.freeQuantity`)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-24" {...form.register(`items.${i}.rate`)} /></TableCell>
                    <TableCell><Input type="number" step="0.01" className="w-20" {...form.register(`items.${i}.discountPct`)} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(line?.total ?? 0)}</TableCell>
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

      <div className="flex flex-col gap-4 lg:flex-row lg:justify-end">
        <Card className="w-full lg:max-w-sm">
          <CardContent className="space-y-1.5 py-4 text-sm">
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
        <Button type="button" variant="outline" onClick={() => router.push("/purchases")}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Save purchase
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
