"use client"

import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { settingsSchema, type SettingsInput } from "@/lib/validations/settings"
import { updateSettings } from "@/lib/actions/settings-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SettingsForm({ defaults, canEdit }: { defaults: SettingsInput; canEdit: boolean }) {
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsInput>,
    defaultValues: defaults,
  })

  async function onSubmit(values: SettingsInput) {
    const res = await updateSettings(values)
    if (!res.ok) { toast.error(res.error ?? "Failed to save"); return }
    toast.success("Settings saved")
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Document numbering</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-1.5"><Label>Sales prefix</Label><Input {...form.register("invoicePrefix")} className="uppercase" disabled={!canEdit} /></div>
          <div className="grid gap-1.5"><Label>Purchase prefix</Label><Input {...form.register("purchasePrefix")} className="uppercase" disabled={!canEdit} /></div>
          <div className="grid gap-1.5"><Label>Voucher prefix</Label><Input {...form.register("voucherPrefix")} className="uppercase" disabled={!canEdit} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Alerts & period</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5"><Label>Financial year</Label><Input {...form.register("financialYear")} placeholder="2026-27" disabled={!canEdit} /></div>
          <div className="grid gap-1.5"><Label>Expiry alert (days before)</Label><Input type="number" {...form.register("expiryAlertDays")} disabled={!canEdit} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={form.watch("lowStockEnabled")} onCheckedChange={(v) => form.setValue("lowStockEnabled", !!v)} disabled={!canEdit} />
            Enable low-stock alerts
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Invoice terms</CardTitle></CardHeader>
        <CardContent>
          <Textarea {...form.register("invoiceTerms")} rows={4} placeholder="Terms & conditions printed on invoices..." disabled={!canEdit} />
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex justify-end">
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Save settings
          </Button>
        </div>
      )}
    </form>
  )
}
