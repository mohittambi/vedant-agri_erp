"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { firmSchema, type FirmInput } from "@/lib/validations/firm"
import { createFirmAction, updateFirmAction } from "@/lib/actions/firm-actions"
import { INDIAN_STATES } from "@/lib/india"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export type FirmRow = {
  id: string
  name: string
  legalName: string | null
  gstin: string | null
  pan: string | null
  stateCode: string | null
  state: string | null
  address: string | null
  city: string | null
  pincode: string | null
  phone: string | null
  email: string | null
  isActive: boolean
}

export function FirmFormDialog({
  open,
  onOpenChange,
  firm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  firm?: FirmRow | null
}) {
  const editing = Boolean(firm)
  const form = useForm<FirmInput>({
    resolver: zodResolver(firmSchema),
    defaultValues: {
      name: firm?.name ?? "",
      legalName: firm?.legalName ?? "",
      gstin: firm?.gstin ?? "",
      pan: firm?.pan ?? "",
      stateCode: firm?.stateCode ?? "",
      state: firm?.state ?? "",
      address: firm?.address ?? "",
      city: firm?.city ?? "",
      pincode: firm?.pincode ?? "",
      phone: firm?.phone ?? "",
      email: firm?.email ?? "",
      isActive: firm?.isActive ?? true,
    },
  })

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: firm?.name ?? "",
        legalName: firm?.legalName ?? "",
        gstin: firm?.gstin ?? "",
        pan: firm?.pan ?? "",
        stateCode: firm?.stateCode ?? "",
        state: firm?.state ?? "",
        address: firm?.address ?? "",
        city: firm?.city ?? "",
        pincode: firm?.pincode ?? "",
        phone: firm?.phone ?? "",
        email: firm?.email ?? "",
        isActive: firm?.isActive ?? true,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, firm])

  async function onSubmit(values: FirmInput) {
    const res = editing
      ? await updateFirmAction(firm!.id, values)
      : await createFirmAction(values)

    if (!res.ok) {
      if (res.fieldErrors) {
        for (const [key, msgs] of Object.entries(res.fieldErrors)) {
          form.setError(key as keyof FirmInput, { message: msgs?.[0] })
        }
      }
      toast.error(res.error ?? "Please fix the errors and try again.")
      return
    }
    toast.success(editing ? "Firm updated" : "Firm created")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit firm" : "New firm"}</DialogTitle>
          <DialogDescription>
            A firm is an isolated tenant — its data is never shared with other firms.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Firm name *</FormLabel>
                  <FormControl><Input {...field} placeholder="Green Agro Inputs" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="legalName"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Legal name</FormLabel>
                  <FormControl><Input {...field} placeholder="Green Agro Inputs Pvt Ltd" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gstin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GSTIN</FormLabel>
                  <FormControl><Input {...field} placeholder="27ABCDE1234F1Z5" className="uppercase" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>PAN</FormLabel>
                  <FormControl><Input {...field} placeholder="ABCDE1234F" className="uppercase" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="stateCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INDIAN_STATES.map((s) => (
                        <SelectItem key={s.code} value={s.code}>
                          {s.code} — {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="pincode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} type="email" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Create firm"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
