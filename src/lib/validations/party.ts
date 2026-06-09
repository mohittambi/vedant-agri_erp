import { z } from "zod"

const opt = z.string().max(200).optional().or(z.literal(""))

const base = {
  name: z.string().min(2, "Name is required").max(160),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  gstin: opt,
  address: opt,
  city: opt,
  stateCode: z.string().length(2).optional().or(z.literal("")),
  openingBalance: z.coerce.number(),
  isActive: z.boolean(),
}

export const customerSchema = z.object({
  ...base,
  creditLimit: z.coerce.number().min(0),
})

export const supplierSchema = z.object(base)

export type CustomerInput = z.infer<typeof customerSchema>
export type SupplierInput = z.infer<typeof supplierSchema>
export type PartyInput = CustomerInput & { creditLimit?: number }
