import { z } from "zod"

export const salesItemSchema = z.object({
  productId: z.string().uuid("Select a product"),
  quantity: z.coerce.number().positive("Qty > 0"),
  rate: z.coerce.number().min(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
})

export const salesSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal("")),
  locationId: z.string().uuid("Select a location"),
  invoiceDate: z.string().min(1, "Date is required"),
  dueDate: z.string().optional().or(z.literal("")),
  saleType: z.enum(["CASH", "CREDIT"]),
  notes: z.string().max(500).optional().or(z.literal("")),
  items: z.array(salesItemSchema).min(1, "Add at least one item"),
})

export type SalesItemInput = z.infer<typeof salesItemSchema>
export type SalesInput = z.infer<typeof salesSchema>
