import "server-only"
import type { Prisma } from "@prisma/client"

type Tx = Prisma.TransactionClient

/**
 * Generate the next sequential document number for a firm within a Prisma
 * transaction, e.g. PUR-00042. Relies on a per-firm unique constraint to catch
 * the rare race; callers run inside a transaction so a retry is cheap.
 */
export async function nextDocNumber(
  tx: Tx,
  firmId: string,
  model: "purchaseInvoice" | "salesInvoice" | "purchaseReturn" | "salesReturn" | "voucher",
  prefix: string
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const count = await (tx as any)[model].count({ where: { firmId } })
  const seq = count + 1
  return `${prefix}-${String(seq).padStart(5, "0")}`
}
