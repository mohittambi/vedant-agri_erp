import { type NextRequest } from "next/server"
import ExcelJS from "exceljs"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"
import { UNITS } from "@/lib/india"

function cell(row: ExcelJS.Row, col: number): string {
  const v = row.getCell(col).value
  if (v === null || v === undefined) return ""
  if (typeof v === "object" && "text" in v) return String((v as { text: string }).text)
  return String(v)
}

export async function POST(req: NextRequest) {
  const { user, firmId } = await requirePermission("product:create")

  const formData = await req.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) return Response.json({ ok: false, error: "No file uploaded" }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const wb = new ExcelJS.Workbook()
  // exceljs's bundled Buffer type conflicts with Node's generic Buffer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(arrayBuffer as any)
  const ws = wb.worksheets[0]
  if (!ws) return Response.json({ ok: false, error: "Empty workbook" }, { status: 400 })

  let created = 0, updated = 0, skipped = 0
  const errors: string[] = []

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const sku = cell(row, 1).trim()
    const name = cell(row, 2).trim()
    if (!sku || !name) { skipped++; continue }

    const unitRaw = cell(row, 4).trim().toUpperCase()
    const unit = (UNITS as readonly string[]).includes(unitRaw) ? unitRaw : "PCS"
    const cash = Number(cell(row, 5)) || 0
    const credit = Number(cell(row, 6)) || 0
    const mrp = Number(cell(row, 7)) || 0
    const reorder = Number(cell(row, 8)) || 0

    if (cash > 0 && credit > 0 && cash >= credit) {
      errors.push(`Row ${r} (${sku}): cash rate must be < credit rate`)
      skipped++
      continue
    }

    const data = {
      name, hsnCode: cell(row, 3).trim() || null, unit,
      cashRate: cash, creditRate: credit, mrp, reorderLevel: reorder,
    }

    try {
      const existing = await prisma.product.findUnique({ where: { firmId_sku: { firmId, sku } } })
      if (existing) {
        await prisma.product.update({ where: { id: existing.id }, data })
        updated++
      } else {
        await prisma.product.create({ data: { ...data, firmId, sku } })
        created++
      }
    } catch {
      errors.push(`Row ${r} (${sku}): failed to save`)
      skipped++
    }
  }

  await logAudit({ firmId, userId: user.id, action: "IMPORT", entity: "Product", newData: { created, updated, skipped } })

  return Response.json({ ok: true, created, updated, skipped, errors: errors.slice(0, 10) })
}
