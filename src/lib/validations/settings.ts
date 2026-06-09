import { z } from "zod"

export const settingsSchema = z.object({
  invoicePrefix: z.string().min(1).max(10),
  purchasePrefix: z.string().min(1).max(10),
  voucherPrefix: z.string().min(1).max(10),
  financialYear: z.string().max(12).optional().or(z.literal("")),
  expiryAlertDays: z.coerce.number().int().min(1).max(365),
  lowStockEnabled: z.boolean(),
  invoiceTerms: z.string().max(1000).optional().or(z.literal("")),
})

export type SettingsInput = z.infer<typeof settingsSchema>
