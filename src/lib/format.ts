import { Prisma } from "@prisma/client"

type DecimalLike = Prisma.Decimal | number | string | null | undefined

/** Coerce a Prisma.Decimal / string / number to a JS number safely. */
export function toNumber(value: DecimalLike): number {
  if (value === null || value === undefined) return 0
  if (typeof value === "number") return value
  return Number(value.toString())
}

/** Indian Rupee currency formatting (₹1,23,456.78). */
export function formatCurrency(value: DecimalLike): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value))
}

/** Indian number grouping without currency symbol. */
export function formatNumber(value: DecimalLike, fractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(toNumber(value))
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d)
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

/** Days remaining until a date (negative = already past). */
export function daysUntil(value: Date | string): number {
  const d = typeof value === "string" ? new Date(value) : value
  const ms = d.getTime() - Date.now()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
