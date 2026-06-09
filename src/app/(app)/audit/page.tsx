import type { Metadata } from "next"
import { requirePermission } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PageHeader } from "@/components/layout/page-header"
import { AuditClient, type AuditRow } from "./audit-client"

export const metadata: Metadata = { title: "Audit Trail" }

export default async function AuditPage() {
  const { firmId } = await requirePermission("audit:view")
  const logs = await prisma.auditLog.findMany({
    where: { firmId },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { fullName: true } } },
    take: 300,
  })
  const rows: AuditRow[] = logs.map((l) => ({
    id: l.id,
    date: l.createdAt.toISOString(),
    user: l.user?.fullName ?? "System",
    action: l.action,
    entity: l.entity,
    entityId: l.entityId,
  }))
  return (
    <>
      <PageHeader title="Audit trail" description="Every create, update and delete across the firm — immutable." />
      <AuditClient rows={rows} />
    </>
  )
}
