import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/page-header"
import { FirmsClient } from "./firms-client"
import type { FirmRow } from "./firm-form"

export const metadata: Metadata = { title: "Firms" }

export default async function FirmsPage() {
  const user = await requireAuth()
  // Firms are global tenancy objects — Super Admin only.
  if (!user.isSuperAdmin) redirect("/dashboard")

  const firms = await prisma.firm.findMany({ orderBy: { createdAt: "desc" } })

  const rows: FirmRow[] = firms.map((f) => ({
    id: f.id,
    name: f.name,
    legalName: f.legalName,
    gstin: f.gstin,
    pan: f.pan,
    stateCode: f.stateCode,
    state: f.state,
    address: f.address,
    city: f.city,
    pincode: f.pincode,
    phone: f.phone,
    email: f.email,
    isActive: f.isActive,
  }))

  return (
    <>
      <PageHeader
        title="Firms"
        description="Manage the businesses (tenants) in your ERP. Each firm's data is fully isolated."
      />
      <FirmsClient firms={rows} />
    </>
  )
}
