import { z } from "zod"

export const firmSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  legalName: z.string().max(160).optional().or(z.literal("")),
  gstin: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GSTIN format"
    )
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Invalid PAN format")
    .optional()
    .or(z.literal("")),
  stateCode: z.string().length(2, "Select a state").optional().or(z.literal("")),
  state: z.string().optional().or(z.literal("")),
  address: z.string().max(300).optional().or(z.literal("")),
  city: z.string().max(80).optional().or(z.literal("")),
  pincode: z
    .string()
    .regex(/^[1-9][0-9]{5}$/, "Invalid pincode")
    .optional()
    .or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  isActive: z.boolean(),
})

export type FirmInput = z.infer<typeof firmSchema>
