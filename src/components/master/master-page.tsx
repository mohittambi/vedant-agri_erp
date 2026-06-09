import { prisma } from "@/lib/prisma"
import { requirePermission, userHasPermission } from "@/lib/auth"
import { MASTER_CONFIGS, type MasterModel } from "@/lib/master"
import { PageHeader } from "@/components/layout/page-header"
import { MasterCrud, type MasterRow } from "@/components/master/master-crud"
import type { Permission } from "@/lib/constants"

/**
 * Server-rendered page for any "simple" master. Handles authorization,
 * firm-scoped fetch and permission flags, then delegates UI to <MasterCrud>.
 */
export async function MasterPage({ model }: { model: MasterModel }) {
  const config = MASTER_CONFIGS[model]
  const { user, firmId } = await requirePermission(`${config.resource}:view` as Permission)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const records = await (prisma as any)[model].findMany({
    where: { firmId },
    orderBy: { name: "asc" },
  })

  // Serialize (Decimal → string, Date → ISO) so it crosses to the client safely.
  const rows = JSON.parse(JSON.stringify(records)) as MasterRow[]

  const perms = {
    create: userHasPermission(user, `${config.resource}:create` as Permission),
    update: userHasPermission(user, `${config.resource}:update` as Permission),
    delete: userHasPermission(user, `${config.resource}:delete` as Permission),
  }

  return (
    <>
      <PageHeader title={config.title} description={config.description} />
      <MasterCrud model={model} rows={rows} perms={perms} />
    </>
  )
}
