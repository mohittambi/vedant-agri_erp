/**
 * Central RBAC + application constants.
 * These are the source of truth used to seed the `roles` / `permissions` /
 * `role_permissions` tables (see prisma/seed.ts).
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------
export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  FIRM_ADMIN: "FIRM_ADMIN",
  SALES_USER: "SALES_USER",
  PURCHASE_USER: "PURCHASE_USER",
  ACCOUNTS_USER: "ACCOUNTS_USER",
  INVENTORY_USER: "INVENTORY_USER",
  VIEW_ONLY: "VIEW_ONLY",
} as const

export type RoleKey = keyof typeof ROLES

export const ROLE_LABELS: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  FIRM_ADMIN: "Firm Admin",
  SALES_USER: "Sales User",
  PURCHASE_USER: "Purchase User",
  ACCOUNTS_USER: "Accounts User",
  INVENTORY_USER: "Inventory User",
  VIEW_ONLY: "View Only",
}

// ---------------------------------------------------------------------------
// Permissions — `<resource>:<action>`
// ---------------------------------------------------------------------------
export const ACTIONS = ["view", "create", "update", "delete", "approve"] as const
export type Action = (typeof ACTIONS)[number]

export const RESOURCES = [
  "dashboard",
  "firm",
  "user",
  "role",
  "location",
  "product",
  "category",
  "manufacturer",
  "tax_group",
  "inventory",
  "batch",
  "purchase",
  "purchase_return",
  "sales",
  "sales_return",
  "customer",
  "supplier",
  "ledger",
  "voucher",
  "gst",
  "report",
  "analytics",
  "audit",
  "notification",
  "settings",
] as const
export type Resource = (typeof RESOURCES)[number]

export type Permission = `${Resource}:${Action}`

export function buildPermission(resource: Resource, action: Action): Permission {
  return `${resource}:${action}`
}

/** Every possible permission key. */
export const ALL_PERMISSIONS: Permission[] = RESOURCES.flatMap((r) =>
  ACTIONS.map((a) => buildPermission(r, a))
)

const VIEW_ALL: Permission[] = RESOURCES.map((r) => buildPermission(r, "view"))
const FULL = (rs: Resource[]): Permission[] =>
  rs.flatMap((r) => ACTIONS.map((a) => buildPermission(r, a)))

/**
 * Default permission matrix per role. SUPER_ADMIN is handled specially in
 * code (implicit all-access across all firms) but is also seeded with all
 * permissions for completeness.
 */
export const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  FIRM_ADMIN: ALL_PERMISSIONS.filter((p) => !p.startsWith("firm:")),
  SALES_USER: [
    ...VIEW_ALL,
    ...FULL(["sales", "sales_return", "customer"]),
    "inventory:view",
    "product:view",
    "ledger:view",
  ],
  PURCHASE_USER: [
    ...VIEW_ALL,
    ...FULL(["purchase", "purchase_return", "supplier"]),
    "inventory:view",
    "product:view",
    "ledger:view",
  ],
  ACCOUNTS_USER: [
    ...VIEW_ALL,
    ...FULL(["voucher", "ledger", "gst"]),
    "report:view",
    "report:create",
    "customer:view",
    "supplier:view",
  ],
  INVENTORY_USER: [
    ...VIEW_ALL,
    ...FULL(["inventory", "batch", "product", "category", "manufacturer"]),
  ],
  VIEW_ONLY: VIEW_ALL,
}

// ---------------------------------------------------------------------------
// Navigation (sidebar)
// ---------------------------------------------------------------------------
export type NavItem = {
  title: string
  href: string
  icon: string // lucide icon name
  permission?: Permission
  superAdminOnly?: boolean
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: "LayoutDashboard", permission: "dashboard:view" },
      { title: "Analytics", href: "/analytics", icon: "ChartLine", permission: "analytics:view" },
    ],
  },
  {
    label: "Masters",
    items: [
      { title: "Products", href: "/products", icon: "Package", permission: "product:view" },
      { title: "Categories", href: "/categories", icon: "FolderTree", permission: "category:view" },
      { title: "Manufacturers", href: "/manufacturers", icon: "Factory", permission: "manufacturer:view" },
      { title: "Tax Groups", href: "/tax-groups", icon: "Percent", permission: "tax_group:view" },
      { title: "Locations", href: "/locations", icon: "MapPin", permission: "location:view" },
    ],
  },
  {
    label: "Inventory",
    items: [
      { title: "Stock", href: "/inventory", icon: "Boxes", permission: "inventory:view" },
      { title: "Batches", href: "/batches", icon: "Layers", permission: "batch:view" },
      { title: "Expiry Tracking", href: "/expiry", icon: "CalendarClock", permission: "batch:view" },
    ],
  },
  {
    label: "Purchase",
    items: [
      { title: "Purchases", href: "/purchases", icon: "ShoppingCart", permission: "purchase:view" },
      { title: "Purchase Returns", href: "/purchase-returns", icon: "Undo2", permission: "purchase_return:view" },
      { title: "Suppliers", href: "/suppliers", icon: "Truck", permission: "supplier:view" },
    ],
  },
  {
    label: "Sales",
    items: [
      { title: "Sales", href: "/sales", icon: "Receipt", permission: "sales:view" },
      { title: "Sales Returns", href: "/sales-returns", icon: "RotateCcw", permission: "sales_return:view" },
      { title: "Customers", href: "/customers", icon: "Users", permission: "customer:view" },
    ],
  },
  {
    label: "Accounts",
    items: [
      { title: "Vouchers", href: "/vouchers", icon: "BookText", permission: "voucher:view" },
      { title: "Customer Ledger", href: "/ledgers/customers", icon: "BookUser", permission: "ledger:view" },
      { title: "Supplier Ledger", href: "/ledgers/suppliers", icon: "BookUser", permission: "ledger:view" },
      { title: "GST Reports", href: "/reports/gst", icon: "FileSpreadsheet", permission: "gst:view" },
      { title: "Profit & Loss", href: "/reports/pnl", icon: "TrendingUp", permission: "report:view" },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Firms", href: "/firms", icon: "Building2", permission: "firm:view", superAdminOnly: true },
      { title: "Users", href: "/users", icon: "UserCog", permission: "user:view" },
      { title: "Roles", href: "/roles", icon: "ShieldCheck", permission: "role:view" },
      { title: "Audit Trail", href: "/audit", icon: "ScrollText", permission: "audit:view" },
      { title: "Notifications", href: "/notifications", icon: "Bell", permission: "notification:view" },
      { title: "Settings", href: "/settings", icon: "Settings", permission: "settings:view" },
    ],
  },
]
