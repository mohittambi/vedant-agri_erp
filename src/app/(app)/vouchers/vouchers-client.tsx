"use client"

import * as React from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { Loader2, Plus } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { voucherSchema, type VoucherInput } from "@/lib/validations/voucher"
import { createVoucher } from "@/lib/actions/voucher-actions"
import { formatCurrency, formatDate } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"

export type Option = { value: string; label: string }
export type VoucherRow = {
  id: string; number: string; date: string; type: string
  party: string; amount: number; mode: string
}

const TYPE_TONE: Record<string, string> = {
  RECEIPT: "bg-emerald-500/10 text-emerald-600",
  PAYMENT: "bg-amber-500/10 text-amber-600",
  JOURNAL: "bg-blue-500/10 text-blue-600",
  CONTRA: "bg-muted text-muted-foreground",
}

function VoucherDialog({
  open, onOpenChange, customers, suppliers,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  customers: Option[]
  suppliers: Option[]
}) {
  const today = new Date().toISOString().slice(0, 10)
  const form = useForm<VoucherInput>({
    resolver: zodResolver(voucherSchema) as unknown as Resolver<VoucherInput>,
    defaultValues: { voucherType: "RECEIPT", voucherDate: today, partyType: "CUSTOMER", partyId: "", amount: 0, mode: "CASH", referenceNo: "", narration: "" },
  })

  const type = form.watch("voucherType")
  const needsParty = type === "RECEIPT" || type === "PAYMENT"
  const partyOptions = type === "RECEIPT" ? customers : suppliers

  React.useEffect(() => {
    form.setValue("partyType", type === "RECEIPT" ? "CUSTOMER" : type === "PAYMENT" ? "SUPPLIER" : "")
    form.setValue("partyId", "")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  async function onSubmit(values: VoucherInput) {
    const res = await createVoucher(values)
    if (!res.ok) {
      if (res.fieldErrors) for (const [k, m] of Object.entries(res.fieldErrors)) form.setError(k as keyof VoucherInput, { message: m?.[0] })
      toast.error(res.error ?? "Please fix the errors.")
      return
    }
    toast.success("Voucher created")
    onOpenChange(false)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New voucher</DialogTitle>
          <DialogDescription>Receipts reduce customer dues; payments reduce supplier dues.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => form.setValue("voucherType", v as VoucherInput["voucherType"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEIPT">Receipt (from customer)</SelectItem>
                <SelectItem value="PAYMENT">Payment (to supplier)</SelectItem>
                <SelectItem value="JOURNAL">Journal</SelectItem>
                <SelectItem value="CONTRA">Contra</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Date</Label>
            <Input type="date" {...form.register("voucherDate")} />
          </div>
          {needsParty && (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>{type === "RECEIPT" ? "Customer" : "Supplier"}</Label>
              <Select value={form.watch("partyId") || ""} onValueChange={(v) => form.setValue("partyId", v)}>
                <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>{partyOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
              {form.formState.errors.partyId && <p className="text-sm text-destructive">{form.formState.errors.partyId.message}</p>}
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Amount</Label>
            <Input type="number" step="0.01" {...form.register("amount")} />
            {form.formState.errors.amount && <p className="text-sm text-destructive">{form.formState.errors.amount.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Mode</Label>
            <Select value={form.watch("mode")} onValueChange={(v) => form.setValue("mode", v as VoucherInput["mode"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="BANK">Bank</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Reference no.</Label>
            <Input {...form.register("referenceNo")} />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Narration</Label>
            <Textarea {...form.register("narration")} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function VouchersClient({
  rows, customers, suppliers, canCreate,
}: {
  rows: VoucherRow[]
  customers: Option[]
  suppliers: Option[]
  canCreate: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const columns: ColumnDef<VoucherRow>[] = [
    { accessorKey: "number", header: ({ column }) => <SortableHeader column={column} title="Number" /> },
    { accessorKey: "date", header: ({ column }) => <SortableHeader column={column} title="Date" />, cell: ({ row }) => formatDate(row.original.date) },
    { accessorKey: "type", header: "Type", cell: ({ row }) => <Badge variant="secondary" className={TYPE_TONE[row.original.type] ?? ""}>{row.original.type}</Badge> },
    { accessorKey: "party", header: "Party" },
    { accessorKey: "mode", header: "Mode" },
    { accessorKey: "amount", header: ({ column }) => <SortableHeader column={column} title="Amount" />, cell: ({ row }) => <span className="tabular-nums font-medium">{formatCurrency(row.original.amount)}</span> },
  ]
  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search vouchers..."
        toolbar={canCreate ? <Button onClick={() => setOpen(true)}><Plus className="size-4" /> New voucher</Button> : null}
      />
      <VoucherDialog open={open} onOpenChange={setOpen} customers={customers} suppliers={suppliers} />
    </>
  )
}
