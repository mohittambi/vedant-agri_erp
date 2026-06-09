import "server-only"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

export type PdfInvoice = {
  title: string
  number: string
  date: string
  status: string
  treatment: string
  firm: { name: string; gstin: string | null; address: string | null; state: string | null; phone: string | null }
  party: { label: string; name: string; gstin: string | null; state: string | null }
  items: {
    name: string; batch: string | null; qty: number; rate: number
    taxable: number; gstRate: number; cgst: number; sgst: number; igst: number; total: number
  }[]
  totals: { taxable: number; cgst: number; sgst: number; igst: number; cess: number; roundOff: number; grandTotal: number }
}

const money = (n: number) =>
  "Rs. " + new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

export async function buildInvoicePdf(inv: PdfInvoice): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595.28, 841.89]) // A4
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const { width, height } = page.getSize()
  const margin = 40
  let y = height - margin
  const dark = rgb(0.1, 0.1, 0.1)
  const grey = rgb(0.45, 0.45, 0.45)

  const text = (s: string, x: number, yy: number, size = 9, f = font, color = dark) =>
    page.drawText(s, { x, y: yy, size, font: f, color })

  // Header
  text(inv.firm.name, margin, y, 16, bold)
  text(inv.title, width - margin - bold.widthOfTextAtSize(inv.title, 14), y, 14, bold)
  y -= 16
  if (inv.firm.gstin) { text(`GSTIN: ${inv.firm.gstin}`, margin, y, 9, font, grey); }
  text(`No: ${inv.number}`, width - margin - font.widthOfTextAtSize(`No: ${inv.number}`, 9), y, 9)
  y -= 12
  if (inv.firm.address) { text(inv.firm.address.slice(0, 70), margin, y, 9, font, grey) }
  const dateStr = `Date: ${new Date(inv.date).toLocaleDateString("en-IN")}`
  text(dateStr, width - margin - font.widthOfTextAtSize(dateStr, 9), y, 9, font, grey)
  y -= 24

  // Party box
  page.drawRectangle({ x: margin, y: y - 44, width: width - margin * 2, height: 44, borderColor: grey, borderWidth: 0.5 })
  text(inv.party.label.toUpperCase(), margin + 8, y - 12, 8, bold, grey)
  text(inv.party.name, margin + 8, y - 26, 11, bold)
  if (inv.party.gstin) text(`GSTIN: ${inv.party.gstin}`, margin + 8, y - 38, 8, font, grey)
  if (inv.party.state) text(inv.party.state, width - margin - 160, y - 26, 9, font, grey)
  y -= 64

  // Table header
  const intra = inv.treatment === "INTRA_STATE"
  const cols = intra
    ? [
        { t: "Item", x: margin + 4 }, { t: "Qty", x: 250 }, { t: "Rate", x: 295 },
        { t: "Taxable", x: 345 }, { t: "CGST", x: 410 }, { t: "SGST", x: 460 }, { t: "Total", x: 510 },
      ]
    : [
        { t: "Item", x: margin + 4 }, { t: "Qty", x: 260 }, { t: "Rate", x: 310 },
        { t: "Taxable", x: 370 }, { t: "IGST", x: 440 }, { t: "Total", x: 505 },
      ]
  page.drawRectangle({ x: margin, y: y - 4, width: width - margin * 2, height: 18, color: rgb(0.95, 0.95, 0.95) })
  for (const c of cols) text(c.t, c.x, y, 8, bold)
  y -= 18

  for (const it of inv.items) {
    if (y < 140) break
    text(it.name.slice(0, 34), margin + 4, y, 8)
    if (intra) {
      text(String(it.qty), 250, y, 8)
      text(money(it.rate).replace("Rs. ", ""), 295, y, 8)
      text(money(it.taxable).replace("Rs. ", ""), 345, y, 8)
      text(money(it.cgst).replace("Rs. ", ""), 410, y, 8)
      text(money(it.sgst).replace("Rs. ", ""), 460, y, 8)
      text(money(it.total).replace("Rs. ", ""), 510, y, 8)
    } else {
      text(String(it.qty), 260, y, 8)
      text(money(it.rate).replace("Rs. ", ""), 310, y, 8)
      text(money(it.taxable).replace("Rs. ", ""), 370, y, 8)
      text(money(it.igst).replace("Rs. ", ""), 440, y, 8)
      text(money(it.total).replace("Rs. ", ""), 505, y, 8)
    }
    y -= 14
  }

  // Totals
  y -= 10
  const tx = width - margin - 200
  const row = (label: string, val: string, f = font) => {
    text(label, tx, y, 9, f, grey)
    text(val, width - margin - font.widthOfTextAtSize(val, 9), y, 9, f)
    y -= 14
  }
  row("Taxable", money(inv.totals.taxable))
  if (intra) { row("CGST", money(inv.totals.cgst)); row("SGST", money(inv.totals.sgst)) }
  else row("IGST", money(inv.totals.igst))
  if (inv.totals.cess > 0) row("Cess", money(inv.totals.cess))
  row("Round off", money(inv.totals.roundOff))
  page.drawLine({ start: { x: tx, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 0.5, color: grey })
  row("Grand Total", money(inv.totals.grandTotal), bold)

  // Footer
  text("This is a computer-generated invoice.", margin, 50, 8, font, grey)

  return await doc.save()
}
