import { z } from "zod"

export const voucherSchema = z
  .object({
    voucherType: z.enum(["PAYMENT", "RECEIPT", "JOURNAL", "CONTRA"]),
    voucherDate: z.string().min(1, "Date is required"),
    partyType: z.enum(["CUSTOMER", "SUPPLIER"]).optional().or(z.literal("")),
    partyId: z.string().uuid().optional().or(z.literal("")),
    amount: z.coerce.number().positive("Amount must be > 0"),
    mode: z.enum(["CASH", "BANK", "UPI", "CHEQUE"]),
    referenceNo: z.string().max(60).optional().or(z.literal("")),
    narration: z.string().max(300).optional().or(z.literal("")),
  })
  .refine(
    (d) => !(d.voucherType === "RECEIPT" || d.voucherType === "PAYMENT") || (d.partyId && d.partyId.length > 0),
    { message: "Select a party for payment/receipt", path: ["partyId"] }
  )

export type VoucherInput = z.infer<typeof voucherSchema>
