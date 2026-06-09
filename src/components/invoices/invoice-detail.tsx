import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { formatCurrency, formatDate, formatNumber } from "@/lib/format"

export type InvoiceViewItem = {
  name: string
  hsn: string | null
  batch: string | null
  qty: number
  free?: number
  rate: number
  discount: number
  taxable: number
  gstRate: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export type InvoiceView = {
  title: string
  number: string
  date: string
  dueDate?: string | null
  status: string
  mode?: string | null
  treatment: string
  firm: { name: string; gstin: string | null; address: string | null; state: string | null }
  party: { label: string; name: string; gstin: string | null; address: string | null; state: string | null }
  items: InvoiceViewItem[]
  totals: { taxable: number; cgst: number; sgst: number; igst: number; cess: number; roundOff: number; grandTotal: number }
}

export function InvoiceDetail({ view }: { view: InvoiceView }) {
  const intra = view.treatment === "INTRA_STATE"
  return (
    <Card>
      <CardContent className="space-y-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{view.firm.name}</h2>
            {view.firm.gstin && <p className="text-sm text-muted-foreground">GSTIN: {view.firm.gstin}</p>}
            {view.firm.address && <p className="text-sm text-muted-foreground">{view.firm.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium uppercase text-muted-foreground">{view.title}</p>
            <p className="text-xl font-semibold">{view.number}</p>
            <p className="text-sm text-muted-foreground">Date: {formatDate(view.date)}</p>
            <Badge variant="secondary" className="mt-1">{view.status.replace("_", " ")}</Badge>
          </div>
        </div>

        <div className="rounded-md border p-3 text-sm">
          <p className="text-xs uppercase text-muted-foreground">{view.party.label}</p>
          <p className="font-medium">{view.party.name}</p>
          {view.party.gstin && <p className="text-muted-foreground">GSTIN: {view.party.gstin}</p>}
          {view.party.state && <p className="text-muted-foreground">{view.party.state}</p>}
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Taxable</TableHead>
                <TableHead className="text-right">GST%</TableHead>
                {intra ? (
                  <>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                  </>
                ) : (
                  <TableHead className="text-right">IGST</TableHead>
                )}
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {view.items.map((it, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{it.name}</div>
                    {it.hsn && <div className="text-xs text-muted-foreground">HSN {it.hsn}</div>}
                  </TableCell>
                  <TableCell>{it.batch ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.qty, 2)}{it.free ? ` (+${formatNumber(it.free, 0)})` : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(it.rate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(it.taxable)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(it.gstRate, 2)}%</TableCell>
                  {intra ? (
                    <>
                      <TableCell className="text-right tabular-nums">{formatCurrency(it.cgst)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(it.sgst)}</TableCell>
                    </>
                  ) : (
                    <TableCell className="text-right tabular-nums">{formatCurrency(it.igst)}</TableCell>
                  )}
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(it.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <Row label="Taxable" value={formatCurrency(view.totals.taxable)} />
            {intra ? (
              <>
                <Row label="CGST" value={formatCurrency(view.totals.cgst)} />
                <Row label="SGST" value={formatCurrency(view.totals.sgst)} />
              </>
            ) : (
              <Row label="IGST" value={formatCurrency(view.totals.igst)} />
            )}
            {view.totals.cess > 0 && <Row label="Cess" value={formatCurrency(view.totals.cess)} />}
            <Row label="Round off" value={formatCurrency(view.totals.roundOff)} />
            <div className="border-t" />
            <Row label="Grand total" value={formatCurrency(view.totals.grandTotal)} bold />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  )
}
