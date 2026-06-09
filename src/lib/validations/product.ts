import { z } from "zod"
import { UNITS } from "@/lib/india"

const optId = z.string().uuid().optional().or(z.literal(""))

export const productSchema = z
  .object({
    sku: z.string().min(1, "SKU is required").max(60),
    name: z.string().min(2, "Name is required").max(160),
    hsnCode: z.string().max(12).optional().or(z.literal("")),
    unit: z.enum(UNITS),
    categoryId: optId,
    manufacturerId: optId,
    taxGroupId: optId,
    cashRate: z.coerce.number().min(0),
    creditRate: z.coerce.number().min(0),
    mrp: z.coerce.number().min(0),
    purchaseRate: z.coerce.number().min(0),
    reorderLevel: z.coerce.number().min(0),
    isBatchTracked: z.boolean(),
    isActive: z.boolean(),
  })
  .refine(
    (d) => !(d.cashRate > 0 && d.creditRate > 0) || d.cashRate < d.creditRate,
    {
      message: "Cash rate must be strictly less than credit rate",
      path: ["cashRate"],
    }
  )

export type ProductInput = z.infer<typeof productSchema>
