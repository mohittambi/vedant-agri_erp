import "server-only"
import { headers } from "next/headers"
import { prisma } from "@/lib/prisma"
import type { AuditAction, Prisma } from "@prisma/client"

type AuditParams = {
  firmId?: string | null
  userId?: string | null
  action: AuditAction
  entity: string
  entityId?: string | null
  oldData?: unknown
  newData?: unknown
}

/**
 * Write an immutable audit record. Best-effort: never throws into the caller
 * (a failed audit write must not roll back a successful business operation).
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    let ip: string | undefined
    let ua: string | undefined
    try {
      const h = await headers()
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        undefined
      ua = h.get("user-agent") ?? undefined
    } catch {
      // headers() unavailable outside a request scope — ignore.
    }

    await prisma.auditLog.create({
      data: {
        firmId: params.firmId ?? null,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldData: (params.oldData ?? undefined) as Prisma.InputJsonValue | undefined,
        newData: (params.newData ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: ip,
        userAgent: ua,
      },
    })
  } catch (err) {
    console.error("[audit] failed to write log:", err)
  }
}
