import { type NextRequest } from "next/server"
import ExcelJS from "exceljs"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { toNumber } from "@/lib/format"
import type { Permission } from "@/lib/constants"

type Entity = "products" | "customers" | "suppliers" | "stock"

const RESOURCE: Record<Entity, string> = {
  products: "product", customers: "customer", suppliers: "supplier", stock: "inventory",
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ entity: string }> }
) {
  const { entity } = await ctx.params
  if (!(entity in RESOURCE)) return new Response("Unknown export", { status: 404 })
  const e = entity as Entity
  const { firmId } = await requirePermission(`${RESOURCE[e]}:view` as Permission)

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(entity)

  if (e === "products") {
    ws.columns = [
      { header: "SKU", key: "sku", width: 16 },
      { header: "Name", key: "name", width: 32 },
      { header: "HSN", key: "hsn", width: 12 },
      { header: "Unit", key: "unit", width: 8 },
      { header: "Cash Rate", key: "cash", width: 12 },
      { header: "Credit Rate", key: "credit", width: 12 },
      { header: "MRP", key: "mrp", width: 12 },
      { header: "Reorder", key: "reorder", width: 10 },
    ]
    const rows = await prisma.product.findMany({ where: { firmId }, orderBy: { name: "asc" } })
    rows.forEach((p) => ws.addRow({
      sku: p.sku, name: p.name, hsn: p.hsnCode ?? "", unit: p.unit,
      cash: toNumber(p.cashRate), credit: toNumber(p.creditRate), mrp: toNumber(p.mrp), reorder: toNumber(p.reorderLevel),
    }))
  } else if (e === "customers" || e === "suppliers") {
    ws.columns = [
      { header: "Name", key: "name", width: 30 },
      { header: "Phone", key: "phone", width: 16 },
      { header: "GSTIN", key: "gstin", width: 18 },
      { header: "State", key: "state", width: 18 },
      { header: "Balance", key: "balance", width: 14 },
    ]
    const rows = e === "customers"
      ? await prisma.customer.findMany({ where: { firmId }, orderBy: { name: "asc" } })
      : await prisma.supplier.findMany({ where: { firmId }, orderBy: { name: "asc" } })
    rows.forEach((r) => ws.addRow({ name: r.name, phone: r.phone ?? "", gstin: r.gstin ?? "", state: r.state ?? "", balance: toNumber(r.balance) }))
  } else {
    // stock
    ws.columns = [
      { header: "Product", key: "product", width: 32 },
      { header: "Batch", key: "batch", width: 18 },
      { header: "Location", key: "location", width: 18 },
      { header: "Expiry", key: "expiry", width: 14 },
      { header: "Quantity", key: "qty", width: 12 },
    ]
    const batches = await prisma.inventoryBatch.findMany({
      where: { firmId, quantity: { gt: 0 } },
      include: { product: { select: { name: true } }, location: { select: { name: true } } },
      orderBy: { receivedAt: "asc" },
    })
    batches.forEach((b) => ws.addRow({
      product: b.product.name, batch: b.batchNumber, location: b.location.name,
      expiry: b.expiryDate ? b.expiryDate.toISOString().slice(0, 10) : "", qty: toNumber(b.quantity),
    }))
  }

  ws.getRow(1).font = { bold: true }
  const buffer = await wb.xlsx.writeBuffer()
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${entity}-export.xlsx"`,
    },
  })
}
