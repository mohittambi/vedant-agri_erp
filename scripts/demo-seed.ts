/**
 * Demo data seed — creates ONE fully-populated firm so every module has
 * realistic data (masters, stock/batches, purchases, sales, ledgers, vouchers).
 *
 *   npm run db:demo
 *
 * Re-running wipes the previous demo firm (cascade) and recreates it.
 */
import { config as loadEnv } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { computeDocument, resolveGstTreatment } from "../src/lib/gst"

loadEnv({ path: ".env.local" })
loadEnv({ path: ".env" })

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
const num = (v: unknown) => Number(v ?? 0)
const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); d.setHours(0, 0, 0, 0); return d }
const FIRM_NAME = "Green Agro Inputs (Demo)"

// Running document counters.
const seq = { PUR: 0, INV: 0, VCH: 0, PRT: 0, SRT: 0 }
const docNo = (p: keyof typeof seq) => `${p}-${String(++seq[p]).padStart(5, "0")}`

async function stockBalance(firmId: string, productId: string, locationId: string) {
  const agg = await prisma.inventoryBatch.aggregate({ where: { firmId, productId, locationId }, _sum: { quantity: true } })
  return num(agg._sum.quantity)
}

async function main() {
  console.log("Wiping any previous demo firm...")
  const existing = await prisma.firm.findMany({ where: { name: FIRM_NAME }, select: { id: true } })
  for (const { id: firmId } of existing) {
    // Delete in child-first order — products are RESTRICT-referenced by items.
    await prisma.stockLedger.deleteMany({ where: { firmId } })
    await prisma.salesInvoiceItem.deleteMany({ where: { invoice: { firmId } } })
    await prisma.salesReturnItem.deleteMany({ where: { return: { firmId } } })
    await prisma.purchaseInvoiceItem.deleteMany({ where: { invoice: { firmId } } })
    await prisma.purchaseReturnItem.deleteMany({ where: { return: { firmId } } })
    await prisma.inventoryBatch.deleteMany({ where: { firmId } })
    await prisma.salesReturn.deleteMany({ where: { firmId } })
    await prisma.salesInvoice.deleteMany({ where: { firmId } })
    await prisma.purchaseReturn.deleteMany({ where: { firmId } })
    await prisma.purchaseInvoice.deleteMany({ where: { firmId } })
    await prisma.customerLedger.deleteMany({ where: { firmId } })
    await prisma.supplierLedger.deleteMany({ where: { firmId } })
    await prisma.voucher.deleteMany({ where: { firmId } })
    await prisma.product.deleteMany({ where: { firmId } })
    await prisma.category.deleteMany({ where: { firmId } })
    await prisma.manufacturer.deleteMany({ where: { firmId } })
    await prisma.taxGroup.deleteMany({ where: { firmId } })
    await prisma.customer.deleteMany({ where: { firmId } })
    await prisma.supplier.deleteMany({ where: { firmId } })
    await prisma.location.deleteMany({ where: { firmId } })
    await prisma.userRole.deleteMany({ where: { firmId } })
    await prisma.notification.deleteMany({ where: { firmId } })
    await prisma.auditLog.deleteMany({ where: { firmId } })
    await prisma.setting.deleteMany({ where: { firmId } })
    await prisma.firm.delete({ where: { id: firmId } })
  }

  const superAdmin = await prisma.user.findFirst({ where: { isSuperAdmin: true } })

  console.log("Creating firm...")
  const firm = await prisma.firm.create({
    data: {
      name: FIRM_NAME, legalName: "Green Agro Inputs Pvt Ltd",
      gstin: "27ABCDE1234F1Z5", pan: "ABCDE1234F", stateCode: "27", state: "Maharashtra",
      city: "Pune", address: "Market Yard, Pune", pincode: "411037", phone: "9876543210", email: "sales@greenagro.in",
    },
  })
  await prisma.setting.create({ data: { firmId: firm.id } })
  if (superAdmin) await prisma.user.update({ where: { id: superAdmin.id }, data: { defaultFirmId: firm.id } })

  // --- Locations ---
  const mainStore = await prisma.location.create({ data: { firmId: firm.id, name: "Main Store", code: "MAIN", type: "STORE", isDefault: true } })
  await prisma.location.create({ data: { firmId: firm.id, name: "Godown", code: "GDWN", type: "GODOWN" } })

  // --- Tax groups ---
  const tg = {
    g0: await prisma.taxGroup.create({ data: { firmId: firm.id, name: "GST 0%", gstRate: 0 } }),
    g5: await prisma.taxGroup.create({ data: { firmId: firm.id, name: "GST 5%", gstRate: 5 } }),
    g12: await prisma.taxGroup.create({ data: { firmId: firm.id, name: "GST 12%", gstRate: 12 } }),
    g18: await prisma.taxGroup.create({ data: { firmId: firm.id, name: "GST 18%", gstRate: 18 } }),
  }

  // --- Categories & manufacturers ---
  const cat = {
    fert: await prisma.category.create({ data: { firmId: firm.id, name: "Fertilizers" } }),
    pest: await prisma.category.create({ data: { firmId: firm.id, name: "Pesticides" } }),
    seed: await prisma.category.create({ data: { firmId: firm.id, name: "Seeds" } }),
    tools: await prisma.category.create({ data: { firmId: firm.id, name: "Tools" } }),
  }
  const mfg = {
    iffco: await prisma.manufacturer.create({ data: { firmId: firm.id, name: "IFFCO", code: "IFFCO" } }),
    coro: await prisma.manufacturer.create({ data: { firmId: firm.id, name: "Coromandel", code: "CORO" } }),
    upl: await prisma.manufacturer.create({ data: { firmId: firm.id, name: "UPL", code: "UPL" } }),
    bayer: await prisma.manufacturer.create({ data: { firmId: firm.id, name: "Bayer CropScience", code: "BAYER" } }),
  }

  // --- Products (cash < credit enforced) ---
  console.log("Creating products...")
  const P = [
    { sku: "UREA-50", name: "Urea 50kg", cat: cat.fert, mfg: mfg.iffco, tax: tg.g5, unit: "BAG", hsn: "31021000", pr: 260, cash: 280, credit: 300, mrp: 320 },
    { sku: "DAP-50", name: "DAP 50kg", cat: cat.fert, mfg: mfg.coro, tax: tg.g5, unit: "BAG", hsn: "31053000", pr: 1200, cash: 1300, credit: 1400, mrp: 1450 },
    { sku: "MOP-50", name: "MOP Potash 50kg", cat: cat.fert, mfg: mfg.iffco, tax: tg.g5, unit: "BAG", hsn: "31042000", pr: 900, cash: 980, credit: 1050, mrp: 1100 },
    { sku: "GLYPH-1L", name: "Glyphosate 1L", cat: cat.pest, mfg: mfg.upl, tax: tg.g18, unit: "BTL", hsn: "38089390", pr: 350, cash: 420, credit: 460, mrp: 500 },
    { sku: "IMID-250", name: "Imidacloprid 250ml", cat: cat.pest, mfg: mfg.bayer, tax: tg.g18, unit: "BTL", hsn: "38089199", pr: 180, cash: 220, credit: 245, mrp: 270 },
    { sku: "MANCO-1K", name: "Mancozeb 1kg", cat: cat.pest, mfg: mfg.upl, tax: tg.g18, unit: "PKT", hsn: "38082400", pr: 240, cash: 290, credit: 320, mrp: 350 },
    { sku: "BTC-COTTON", name: "Bt Cotton Seed 450g", cat: cat.seed, mfg: mfg.bayer, tax: tg.g5, unit: "PKT", hsn: "12099110", pr: 730, cash: 767, credit: 800, mrp: 853 },
    { sku: "WHEAT-SEED", name: "Wheat Seed 40kg", cat: cat.seed, mfg: mfg.iffco, tax: tg.g0, unit: "BAG", hsn: "10019910", pr: 1100, cash: 1180, credit: 1250, mrp: 1300 },
    { sku: "SPRAYER-16L", name: "Knapsack Sprayer 16L", cat: cat.tools, mfg: mfg.bayer, tax: tg.g12, unit: "PCS", hsn: "84248200", pr: 950, cash: 1100, credit: 1200, mrp: 1350 },
    { sku: "MICRO-1K", name: "Micronutrient Mix 1kg", cat: cat.fert, mfg: mfg.coro, tax: tg.g12, unit: "PKT", hsn: "31051000", pr: 160, cash: 195, credit: 215, mrp: 240 },
  ]
  const products = []
  for (const p of P) {
    products.push(await prisma.product.create({
      data: {
        firmId: firm.id, sku: p.sku, name: p.name, hsnCode: p.hsn, unit: p.unit,
        categoryId: p.cat.id, manufacturerId: p.mfg.id, taxGroupId: p.tax.id,
        purchaseRate: p.pr, cashRate: p.cash, creditRate: p.credit, mrp: p.mrp, reorderLevel: 10,
        // carry tax rate for convenience
      },
    }))
  }
  const prodBySku = new Map(products.map((p) => [p.sku, p]))
  const gstOf = new Map<string, number>()
  for (const p of P) gstOf.set(p.sku, num(p.tax.gstRate))

  // --- Suppliers (mix of intra/inter state) ---
  console.log("Creating suppliers & customers...")
  const sup = {
    coro: await prisma.supplier.create({ data: { firmId: firm.id, name: "Coromandel Intl", phone: "9000000001", gstin: "27COROM1234F1Z2", stateCode: "27", state: "Maharashtra" } }),
    iffco: await prisma.supplier.create({ data: { firmId: firm.id, name: "IFFCO Depot", phone: "9000000002", gstin: "09IFFCO1234F1Z3", stateCode: "09", state: "Uttar Pradesh" } }),
    upl: await prisma.supplier.create({ data: { firmId: firm.id, name: "UPL Ltd", phone: "9000000003", gstin: "24UPLXX1234F1Z4", stateCode: "24", state: "Gujarat" } }),
  }
  const cust = {
    ramesh: await prisma.customer.create({ data: { firmId: firm.id, name: "Ramesh Farms", phone: "9111100001", stateCode: "27", state: "Maharashtra", creditLimit: 50000 } }),
    patil: await prisma.customer.create({ data: { firmId: firm.id, name: "Patil Agro Center", phone: "9111100002", gstin: "27PATIL1234F1Z9", stateCode: "27", state: "Maharashtra", creditLimit: 100000 } }),
    krishna: await prisma.customer.create({ data: { firmId: firm.id, name: "Krishna Traders", phone: "9111100003", stateCode: "27", state: "Maharashtra", creditLimit: 75000 } }),
    sharma: await prisma.customer.create({ data: { firmId: firm.id, name: "Sharma Krishi Kendra", phone: "9111100004", gstin: "09SHARM1234F1Z1", stateCode: "09", state: "Uttar Pradesh", creditLimit: 60000 } }),
    walkin: await prisma.customer.create({ data: { firmId: firm.id, name: "Suresh (Farmer)", phone: "9111100005", stateCode: "27", state: "Maharashtra" } }),
  }

  // ---------------- Purchase posting ----------------
  type PItem = { sku: string; qty: number; rate: number; batch: string; expiry: Date | null }
  async function postPurchase(supplier: { id: string; stateCode: string | null }, items: PItem[], date: Date, mode: "CASH" | "CREDIT") {
    const treatment = resolveGstTreatment(firm.stateCode, supplier.stateCode)
    const doc = computeDocument(items.map((it) => ({ quantity: it.qty, rate: it.rate, gstRate: gstOf.get(it.sku) ?? 0 })), treatment)
    const number = docNo("PUR")
    const inv = await prisma.purchaseInvoice.create({
      data: {
        firmId: firm.id, supplierId: supplier.id, locationId: mainStore.id, invoiceNumber: number,
        invoiceDate: date, status: mode === "CASH" ? "PAID" : "CONFIRMED", paymentMode: mode, gstTreatment: treatment,
        subtotal: doc.subtotal, discountAmount: doc.discountAmount, taxableAmount: doc.taxableAmount,
        cgstAmount: doc.cgstAmount, sgstAmount: doc.sgstAmount, igstAmount: doc.igstAmount,
        roundOff: doc.roundOff, grandTotal: doc.grandTotal, paidAmount: mode === "CASH" ? doc.grandTotal : 0,
        createdById: superAdmin?.id,
      },
    })
    for (let i = 0; i < items.length; i++) {
      const it = items[i], line = doc.lines[i], product = prodBySku.get(it.sku)!
      await prisma.purchaseInvoiceItem.create({
        data: {
          invoiceId: inv.id, productId: product.id, batchNumber: it.batch, expiryDate: it.expiry,
          quantity: it.qty, rate: it.rate, taxableAmount: line.taxableAmount, gstRate: line.gstRate,
          cgstAmount: line.cgstAmount, sgstAmount: line.sgstAmount, igstAmount: line.igstAmount, total: line.total,
        },
      })
      const batch = await prisma.inventoryBatch.create({
        data: { firmId: firm.id, productId: product.id, locationId: mainStore.id, batchNumber: it.batch, expiryDate: it.expiry, quantity: it.qty, purchaseRate: it.rate, mrp: num(product.mrp), supplierId: supplier.id, receivedAt: date },
      })
      await prisma.stockLedger.create({
        data: { firmId: firm.id, productId: product.id, locationId: mainStore.id, batchId: batch.id, txnType: "PURCHASE", referenceType: "PURCHASE_INVOICE", referenceId: inv.id, quantityIn: it.qty, balance: await stockBalance(firm.id, product.id, mainStore.id), rate: it.rate, createdById: superAdmin?.id },
      })
    }
    const supRow = await prisma.supplier.findUnique({ where: { id: supplier.id } })
    let bal = num(supRow!.balance) + doc.grandTotal
    await prisma.supplierLedger.create({ data: { firmId: firm.id, supplierId: supplier.id, entryDate: date, referenceType: "PURCHASE_INVOICE", referenceId: inv.id, particulars: `Purchase ${number}`, entryType: "CREDIT", credit: doc.grandTotal, balance: bal } })
    if (mode === "CASH") { bal -= doc.grandTotal; await prisma.supplierLedger.create({ data: { firmId: firm.id, supplierId: supplier.id, entryDate: date, referenceType: "PURCHASE_INVOICE", referenceId: inv.id, particulars: `Payment (cash) ${number}`, entryType: "DEBIT", debit: doc.grandTotal, balance: bal } }) }
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: bal } })
  }

  // ---------------- Sale posting (FIFO) ----------------
  type SItem = { sku: string; qty: number; rate: number }
  async function postSale(customer: { id: string; stateCode: string | null }, items: SItem[], date: Date, type: "CASH" | "CREDIT") {
    const treatment = resolveGstTreatment(firm.stateCode, customer.stateCode)
    const doc = computeDocument(items.map((it) => ({ quantity: it.qty, rate: it.rate, gstRate: gstOf.get(it.sku) ?? 0 })), treatment)
    const number = docNo("INV")
    const inv = await prisma.salesInvoice.create({
      data: {
        firmId: firm.id, customerId: customer.id, locationId: mainStore.id, invoiceNumber: number,
        invoiceDate: date, status: type === "CASH" ? "PAID" : "CONFIRMED", saleType: type, gstTreatment: treatment,
        subtotal: doc.subtotal, taxableAmount: doc.taxableAmount, cgstAmount: doc.cgstAmount, sgstAmount: doc.sgstAmount,
        igstAmount: doc.igstAmount, roundOff: doc.roundOff, grandTotal: doc.grandTotal, paidAmount: type === "CASH" ? doc.grandTotal : 0,
        createdById: superAdmin?.id,
      },
    })
    for (let i = 0; i < items.length; i++) {
      const it = items[i], line = doc.lines[i], product = prodBySku.get(it.sku)!
      const batches = await prisma.inventoryBatch.findMany({ where: { firmId: firm.id, productId: product.id, locationId: mainStore.id, quantity: { gt: 0 }, OR: [{ expiryDate: null }, { expiryDate: { gte: day(0) } }] }, orderBy: { receivedAt: "asc" } })
      let remaining = it.qty
      const used: string[] = []
      const firstBatch = batches[0]?.id ?? null
      for (const b of batches) {
        if (remaining <= 0) break
        const take = Math.min(remaining, num(b.quantity))
        await prisma.inventoryBatch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } })
        used.push(b.batchNumber)
        remaining -= take
        await prisma.stockLedger.create({ data: { firmId: firm.id, productId: product.id, locationId: mainStore.id, batchId: b.id, txnType: "SALE", referenceType: "SALES_INVOICE", referenceId: inv.id, quantityOut: take, balance: await stockBalance(firm.id, product.id, mainStore.id), rate: it.rate, createdById: superAdmin?.id } })
      }
      await prisma.salesInvoiceItem.create({
        data: {
          invoiceId: inv.id, productId: product.id, batchId: firstBatch, batchNumber: used.join(", "),
          quantity: it.qty, rate: it.rate, taxableAmount: line.taxableAmount, gstRate: line.gstRate,
          cgstAmount: line.cgstAmount, sgstAmount: line.sgstAmount, igstAmount: line.igstAmount, total: line.total,
        },
      })
    }
    const cRow = await prisma.customer.findUnique({ where: { id: customer.id } })
    let bal = num(cRow!.balance) + doc.grandTotal
    await prisma.customerLedger.create({ data: { firmId: firm.id, customerId: customer.id, entryDate: date, referenceType: "SALES_INVOICE", referenceId: inv.id, particulars: `Sale ${number}`, entryType: "DEBIT", debit: doc.grandTotal, balance: bal } })
    if (type === "CASH") { bal -= doc.grandTotal; await prisma.customerLedger.create({ data: { firmId: firm.id, customerId: customer.id, entryDate: date, referenceType: "SALES_INVOICE", referenceId: inv.id, particulars: `Receipt (cash) ${number}`, entryType: "CREDIT", credit: doc.grandTotal, balance: bal } }) }
    await prisma.customer.update({ where: { id: customer.id }, data: { balance: bal } })
  }

  // --- Purchases (build stock + batches with varied expiry) ---
  console.log("Posting purchases...")
  await postPurchase(sup.iffco, [
    { sku: "UREA-50", qty: 200, rate: 260, batch: "UREA-B1", expiry: day(540) },
    { sku: "MOP-50", qty: 80, rate: 900, batch: "MOP-B1", expiry: day(400) },
    { sku: "WHEAT-SEED", qty: 50, rate: 1100, batch: "WHT-B1", expiry: day(60) },
  ], day(-40), "CREDIT")
  await postPurchase(sup.coro, [
    { sku: "DAP-50", qty: 120, rate: 1200, batch: "DAP-B1", expiry: day(500) },
    { sku: "MICRO-1K", qty: 100, rate: 160, batch: "MIC-B1", expiry: day(20) }, // near expiry
  ], day(-35), "CREDIT")
  await postPurchase(sup.upl, [
    { sku: "GLYPH-1L", qty: 60, rate: 350, batch: "GLY-B1", expiry: day(300) },
    { sku: "MANCO-1K", qty: 90, rate: 240, batch: "MAN-B1", expiry: day(-5) }, // expired (cannot be sold)
    { sku: "IMID-250", qty: 70, rate: 180, batch: "IMI-B1", expiry: day(220) },
  ], day(-30), "CASH")
  await postPurchase(sup.coro, [
    { sku: "BTC-COTTON", qty: 150, rate: 730, batch: "BTC-B1", expiry: day(150) },
    { sku: "SPRAYER-16L", qty: 40, rate: 950, batch: "SPR-B1", expiry: null },
  ], day(-22), "CREDIT")

  // --- Sales (consume FIFO, mix cash/credit, intra & inter state) ---
  console.log("Posting sales...")
  await postSale(cust.patil, [{ sku: "UREA-50", qty: 40, rate: 300 }, { sku: "DAP-50", qty: 20, rate: 1400 }], day(-18), "CREDIT")
  await postSale(cust.ramesh, [{ sku: "GLYPH-1L", qty: 10, rate: 420 }, { sku: "IMID-250", qty: 8, rate: 220 }], day(-15), "CASH")
  await postSale(cust.krishna, [{ sku: "DAP-50", qty: 30, rate: 1400 }, { sku: "MOP-50", qty: 15, rate: 1050 }], day(-12), "CREDIT")
  await postSale(cust.sharma, [{ sku: "BTC-COTTON", qty: 25, rate: 800 }], day(-9), "CREDIT") // inter-state IGST
  await postSale(cust.walkin, [{ sku: "UREA-50", qty: 12, rate: 280 }, { sku: "SPRAYER-16L", qty: 2, rate: 1100 }], day(-5), "CASH")
  await postSale(cust.patil, [{ sku: "WHEAT-SEED", qty: 10, rate: 1250 }, { sku: "MICRO-1K", qty: 20, rate: 215 }], day(-2), "CREDIT")

  // --- Vouchers (receipts / payments reduce balances) ---
  console.log("Posting vouchers...")
  async function receipt(customer: { id: string }, amount: number, date: Date, mode = "UPI") {
    const number = docNo("VCH")
    const v = await prisma.voucher.create({ data: { firmId: firm.id, voucherType: "RECEIPT", voucherNumber: number, voucherDate: date, partyType: "CUSTOMER", partyId: customer.id, amount, mode, createdById: superAdmin?.id } })
    const c = await prisma.customer.findUnique({ where: { id: customer.id } })
    const bal = num(c!.balance) - amount
    await prisma.customerLedger.create({ data: { firmId: firm.id, customerId: customer.id, entryDate: date, referenceType: "VOUCHER", referenceId: v.id, particulars: `Receipt ${number} (${mode})`, entryType: "CREDIT", credit: amount, balance: bal } })
    await prisma.customer.update({ where: { id: customer.id }, data: { balance: bal } })
  }
  async function payment(supplier: { id: string }, amount: number, date: Date, mode = "BANK") {
    const number = docNo("VCH")
    const v = await prisma.voucher.create({ data: { firmId: firm.id, voucherType: "PAYMENT", voucherNumber: number, voucherDate: date, partyType: "SUPPLIER", partyId: supplier.id, amount, mode, createdById: superAdmin?.id } })
    const s = await prisma.supplier.findUnique({ where: { id: supplier.id } })
    const bal = num(s!.balance) - amount
    await prisma.supplierLedger.create({ data: { firmId: firm.id, supplierId: supplier.id, entryDate: date, referenceType: "VOUCHER", referenceId: v.id, particulars: `Payment ${number} (${mode})`, entryType: "DEBIT", debit: amount, balance: bal } })
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: bal } })
  }
  await receipt(cust.patil, 15000, day(-7))
  await receipt(cust.krishna, 20000, day(-3))
  await payment(sup.iffco, 30000, day(-10))
  await payment(sup.coro, 50000, day(-4))

  // ---------------- Purchase return (stock out, payable reduced) ----------------
  console.log("Posting returns...")
  async function postPurchaseReturn(supplier: { id: string; stateCode: string | null }, items: SItem[], date: Date) {
    const treatment = resolveGstTreatment(firm.stateCode, supplier.stateCode)
    const doc = computeDocument(items.map((it) => ({ quantity: it.qty, rate: it.rate, gstRate: gstOf.get(it.sku) ?? 0 })), treatment)
    const number = docNo("PRT")
    const ret = await prisma.purchaseReturn.create({
      data: { firmId: firm.id, supplierId: supplier.id, returnNumber: number, returnDate: date, gstTreatment: treatment, taxableAmount: doc.taxableAmount, cgstAmount: doc.cgstAmount, sgstAmount: doc.sgstAmount, igstAmount: doc.igstAmount, grandTotal: doc.grandTotal, reason: "Damaged in transit", createdById: superAdmin?.id },
    })
    for (let i = 0; i < items.length; i++) {
      const it = items[i], line = doc.lines[i], product = prodBySku.get(it.sku)!
      await prisma.purchaseReturnItem.create({ data: { returnId: ret.id, productId: product.id, quantity: it.qty, rate: it.rate, taxableAmount: line.taxableAmount, gstRate: line.gstRate, cgstAmount: line.cgstAmount, sgstAmount: line.sgstAmount, igstAmount: line.igstAmount, total: line.total } })
      let remaining = it.qty
      const batches = await prisma.inventoryBatch.findMany({ where: { firmId: firm.id, productId: product.id, locationId: mainStore.id, quantity: { gt: 0 } }, orderBy: { receivedAt: "asc" } })
      for (const b of batches) {
        if (remaining <= 0) break
        const take = Math.min(remaining, num(b.quantity))
        await prisma.inventoryBatch.update({ where: { id: b.id }, data: { quantity: { decrement: take } } })
        remaining -= take
        await prisma.stockLedger.create({ data: { firmId: firm.id, productId: product.id, locationId: mainStore.id, batchId: b.id, txnType: "PURCHASE_RETURN", referenceType: "PURCHASE_RETURN", referenceId: ret.id, quantityOut: take, balance: await stockBalance(firm.id, product.id, mainStore.id), rate: it.rate, createdById: superAdmin?.id } })
      }
    }
    const s = await prisma.supplier.findUnique({ where: { id: supplier.id } })
    const bal = num(s!.balance) - doc.grandTotal
    await prisma.supplierLedger.create({ data: { firmId: firm.id, supplierId: supplier.id, entryDate: date, referenceType: "PURCHASE_RETURN", referenceId: ret.id, particulars: `Purchase return ${number}`, entryType: "DEBIT", debit: doc.grandTotal, balance: bal } })
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: bal } })
  }

  // ---------------- Sales return (stock back, customer credited) ----------------
  async function postSalesReturn(customer: { id: string; stateCode: string | null }, items: SItem[], date: Date) {
    const treatment = resolveGstTreatment(firm.stateCode, customer.stateCode)
    const doc = computeDocument(items.map((it) => ({ quantity: it.qty, rate: it.rate, gstRate: gstOf.get(it.sku) ?? 0 })), treatment)
    const number = docNo("SRT")
    const ret = await prisma.salesReturn.create({
      data: { firmId: firm.id, customerId: customer.id, returnNumber: number, returnDate: date, gstTreatment: treatment, taxableAmount: doc.taxableAmount, cgstAmount: doc.cgstAmount, sgstAmount: doc.sgstAmount, igstAmount: doc.igstAmount, grandTotal: doc.grandTotal, reason: "Customer returned unused stock", createdById: superAdmin?.id },
    })
    for (let i = 0; i < items.length; i++) {
      const it = items[i], line = doc.lines[i], product = prodBySku.get(it.sku)!
      await prisma.salesReturnItem.create({ data: { returnId: ret.id, productId: product.id, quantity: it.qty, rate: it.rate, taxableAmount: line.taxableAmount, gstRate: line.gstRate, cgstAmount: line.cgstAmount, sgstAmount: line.sgstAmount, igstAmount: line.igstAmount, total: line.total } })
      const batchNumber = `RET-${number}`
      const batch = await prisma.inventoryBatch.create({ data: { firmId: firm.id, productId: product.id, locationId: mainStore.id, batchNumber, quantity: it.qty, purchaseRate: it.rate, receivedAt: date } })
      await prisma.stockLedger.create({ data: { firmId: firm.id, productId: product.id, locationId: mainStore.id, batchId: batch.id, txnType: "SALE_RETURN", referenceType: "SALES_RETURN", referenceId: ret.id, quantityIn: it.qty, balance: await stockBalance(firm.id, product.id, mainStore.id), rate: it.rate, createdById: superAdmin?.id } })
    }
    const c = await prisma.customer.findUnique({ where: { id: customer.id } })
    const bal = num(c!.balance) - doc.grandTotal
    await prisma.customerLedger.create({ data: { firmId: firm.id, customerId: customer.id, entryDate: date, referenceType: "SALES_RETURN", referenceId: ret.id, particulars: `Sales return ${number}`, entryType: "CREDIT", credit: doc.grandTotal, balance: bal } })
    await prisma.customer.update({ where: { id: customer.id }, data: { balance: bal } })
  }

  await postPurchaseReturn(sup.coro, [{ sku: "DAP-50", qty: 10, rate: 1200 }], day(-8))
  await postSalesReturn(cust.patil, [{ sku: "UREA-50", qty: 5, rate: 300 }], day(-1))

  // --- Demo staff users + role assignments (populates users / user_roles) ---
  console.log("Creating staff users...")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (url && key && !url.includes("YOUR-")) {
    const { createClient } = await import("@supabase/supabase-js")
    const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const staff = [
      { email: "sales@greenagro.in", name: "Sunil Sales", role: "SALES_USER" },
      { email: "accounts@greenagro.in", name: "Anita Accounts", role: "ACCOUNTS_USER" },
      { email: "store@greenagro.in", name: "Imran Inventory", role: "INVENTORY_USER" },
    ]
    for (const st of staff) {
      const role = await prisma.role.findFirst({ where: { firmId: null, key: st.role } })
      if (!role) continue
      let userId: string | undefined
      const created = await admin.auth.admin.createUser({ email: st.email, password: "Demo@1234", email_confirm: true, user_metadata: { full_name: st.name } })
      userId = created.data?.user?.id
      if (!userId) {
        const list = await admin.auth.admin.listUsers()
        userId = list.data?.users.find((u) => u.email === st.email)?.id
      }
      if (!userId) continue
      await prisma.user.upsert({ where: { id: userId }, update: { fullName: st.name, isActive: true, defaultFirmId: firm.id }, create: { id: userId, email: st.email, fullName: st.name, defaultFirmId: firm.id } })
      await prisma.userRole.upsert({ where: { userId_firmId_roleId: { userId, firmId: firm.id, roleId: role.id } }, update: {}, create: { userId, firmId: firm.id, roleId: role.id } })
    }
  } else {
    console.log("  (skipped staff users — no real Supabase credentials)")
  }

  // --- Audit logs (populate audit_logs) ---
  await prisma.auditLog.createMany({
    data: [
      { firmId: firm.id, userId: superAdmin?.id ?? null, action: "CREATE", entity: "Firm", entityId: firm.id, newData: { name: FIRM_NAME } },
      { firmId: firm.id, userId: superAdmin?.id ?? null, action: "IMPORT", entity: "Product", newData: { count: products.length } },
      { firmId: firm.id, userId: superAdmin?.id ?? null, action: "CREATE", entity: "PurchaseInvoice", newData: { count: 4 } },
      { firmId: firm.id, userId: superAdmin?.id ?? null, action: "CREATE", entity: "SalesInvoice", newData: { count: 6 } },
      { firmId: firm.id, userId: superAdmin?.id ?? null, action: "UPDATE", entity: "Settings", entityId: firm.id, newData: { expiryAlertDays: 90 } },
    ],
  })

  // --- Notifications (expiry + low stock demo) ---
  await prisma.notification.createMany({
    data: [
      { firmId: firm.id, type: "EXPIRY", title: "Batch expiring soon", message: "Micronutrient Mix (MIC-B1) expires in 20 days." },
      { firmId: firm.id, type: "EXPIRY", title: "Expired stock", message: "Mancozeb 1kg (MAN-B1) has expired and cannot be sold." },
      { firmId: firm.id, type: "LOW_STOCK", title: "Low stock alert", message: "Some products are at or below reorder level." },
    ],
  })

  console.log(`\n✅ Demo firm ready: "${FIRM_NAME}"`)
  console.log("   Open the app, switch to this firm (top bar), and explore every module.")
}

main().catch((e) => { console.error("❌ Demo seed failed:", e); process.exit(1) }).finally(() => prisma.$disconnect())
