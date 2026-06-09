/**
 * GST Engine
 * ---------------------------------------------------------------------------
 * Pure, dependency-free GST computation used by purchase, sales and returns.
 *
 * Rules implemented:
 *  - INTRA_STATE  : supplier/customer state == firm state  -> CGST + SGST
 *                   (each = gstRate / 2)
 *  - INTER_STATE  : different state                        -> IGST (= gstRate)
 *  - EXEMPT       : no tax
 *  - Line tax is computed on the post-discount taxable value.
 *  - All money rounded to 2 decimals (banker-free, half-up via Math.round).
 */

export type GstTreatment = "INTRA_STATE" | "INTER_STATE" | "EXEMPT"

export function resolveGstTreatment(
  firmStateCode: string | null | undefined,
  partyStateCode: string | null | undefined,
  isExempt = false
): GstTreatment {
  if (isExempt) return "EXEMPT"
  if (!firmStateCode || !partyStateCode) return "INTRA_STATE"
  return firmStateCode.trim() === partyStateCode.trim()
    ? "INTRA_STATE"
    : "INTER_STATE"
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export type GstLineInput = {
  quantity: number
  rate: number
  /** percentage discount on the line (0-100) */
  discountPct?: number
  /** flat discount amount on the line (applied after % discount) */
  discountAmount?: number
  /** total GST rate for the product (e.g. 18 means 18%) */
  gstRate: number
  cessRate?: number
}

export type GstLineResult = {
  grossAmount: number
  discountAmount: number
  taxableAmount: number
  gstRate: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  cessAmount: number
  totalTax: number
  total: number
}

export function computeLine(
  line: GstLineInput,
  treatment: GstTreatment
): GstLineResult {
  const gross = round2(line.quantity * line.rate)
  const pctDiscount = round2((gross * (line.discountPct ?? 0)) / 100)
  const discount = round2(pctDiscount + (line.discountAmount ?? 0))
  const taxable = round2(Math.max(0, gross - discount))

  let cgst = 0
  let sgst = 0
  let igst = 0
  const cess = round2((taxable * (line.cessRate ?? 0)) / 100)

  if (treatment === "INTRA_STATE") {
    cgst = round2((taxable * line.gstRate) / 200) // half
    sgst = cgst
  } else if (treatment === "INTER_STATE") {
    igst = round2((taxable * line.gstRate) / 100)
  }

  const totalTax = round2(cgst + sgst + igst + cess)

  return {
    grossAmount: gross,
    discountAmount: discount,
    taxableAmount: taxable,
    gstRate: line.gstRate,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    cessAmount: cess,
    totalTax,
    total: round2(taxable + totalTax),
  }
}

export type GstDocResult = {
  treatment: GstTreatment
  subtotal: number
  discountAmount: number
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  cessAmount: number
  totalTax: number
  roundOff: number
  grandTotal: number
  lines: GstLineResult[]
}

/** Aggregate many lines into document-level GST totals with round-off. */
export function computeDocument(
  lines: GstLineInput[],
  treatment: GstTreatment
): GstDocResult {
  const computed = lines.map((l) => computeLine(l, treatment))

  const sum = (sel: (r: GstLineResult) => number) =>
    round2(computed.reduce((acc, r) => acc + sel(r), 0))

  const subtotal = sum((r) => r.grossAmount)
  const discountAmount = sum((r) => r.discountAmount)
  const taxableAmount = sum((r) => r.taxableAmount)
  const cgstAmount = sum((r) => r.cgstAmount)
  const sgstAmount = sum((r) => r.sgstAmount)
  const igstAmount = sum((r) => r.igstAmount)
  const cessAmount = sum((r) => r.cessAmount)
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount + cessAmount)

  const preRound = round2(taxableAmount + totalTax)
  const grandTotal = Math.round(preRound)
  const roundOff = round2(grandTotal - preRound)

  return {
    treatment,
    subtotal,
    discountAmount,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    cessAmount,
    totalTax,
    roundOff,
    grandTotal,
    lines: computed,
  }
}

/** Split a single total GST rate into its CGST/SGST/IGST components for display. */
export function splitRate(gstRate: number, treatment: GstTreatment) {
  if (treatment === "INTER_STATE") return { cgst: 0, sgst: 0, igst: gstRate }
  if (treatment === "EXEMPT") return { cgst: 0, sgst: 0, igst: 0 }
  return { cgst: gstRate / 2, sgst: gstRate / 2, igst: 0 }
}
