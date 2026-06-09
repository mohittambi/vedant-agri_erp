import { z } from "zod"

export const purchaseItemSchema = z.object({
  productId: z.string().uuid("Select a product"),
  batchNumber: z.string().max(60).optional().or(z.literal("")),
  mfgDate: z.string().optional().or(z.literal("")),
  expiryDate: z.string().optional().or(z.literal("")),
  quantity: z.coerce.number().positive("Qty > 0"),
  freeQuantity: z.coerce.number().min(0).default(0),
  rate: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0).default(0),
  discountPct: z.coerce.number().min(0).max(100).default(0),
})

export const purchaseSchema = z.object({
  supplierId: z.string().uuid("Select a supplier"),
  locationId: z.string().uuid("Select a location"),
  invoiceDate: z.string().min(1, "Date is required"),
  supplierInvNo: z.string().max(60).optional().or(z.literal("")),
  dueDate: z.string().optional().or(z.literal("")),
  paymentMode: z.enum(["CASH", "CREDIT"]),
  notes: z.string().max(500).optional().or(z.literal("")),
  items: z.array(purchaseItemSchema).min(1, "Add at least one item"),
})

export type PurchaseItemInput = z.infer<typeof purchaseItemSchema>
export type PurchaseInput = z.infer<typeof purchaseSchema>
