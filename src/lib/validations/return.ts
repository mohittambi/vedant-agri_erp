import { z } from "zod"

const returnItem = z.object({
  productId: z.string().uuid("Select a product"),
  quantity: z.coerce.number().positive("Qty > 0"),
  rate: z.coerce.number().min(0),
})

export const salesReturnSchema = z.object({
  customerId: z.string().uuid().optional().or(z.literal("")),
  locationId: z.string().uuid("Select a location"),
  returnDate: z.string().min(1, "Date is required"),
  reason: z.string().max(300).optional().or(z.literal("")),
  items: z.array(returnItem).min(1, "Add at least one item"),
})

export const purchaseReturnSchema = z.object({
  supplierId: z.string().uuid("Select a supplier"),
  locationId: z.string().uuid("Select a location"),
  returnDate: z.string().min(1, "Date is required"),
  reason: z.string().max(300).optional().or(z.literal("")),
  items: z.array(returnItem).min(1, "Add at least one item"),
})

export type SalesReturnInput = z.infer<typeof salesReturnSchema>
export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>
