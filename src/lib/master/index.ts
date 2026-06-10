import { z } from "zod"

/**
 * Generic master-data engine.
 * Each "simple" master (firm-scoped, flat fields) is described once here and
 * rendered by <MasterCrud> + handled by the generic server actions. This keeps
 * CRUD DRY without sacrificing per-field validation.
 */

export type FieldType = "text" | "number" | "textarea" | "switch" | "select"

export type FieldDef = {
  name: string
  label: string
  type: FieldType
  placeholder?: string
  options?: { value: string; label: string }[]
  colSpan?: 1 | 2
  step?: string
  uppercase?: boolean
  /** Shows a required (*) indicator on the label. */
  required?: boolean
}

export type ColumnRender = "text" | "bool" | "percent" | "number"
export type ColumnDef = { key: string; label: string; render?: ColumnRender }

export type MasterModel = "category" | "manufacturer" | "taxGroup" | "location"

export type MasterConfig = {
  title: string
  description: string
  route: string
  resource: string
  model: MasterModel
  schema: z.ZodType
  fields: FieldDef[]
  columns: ColumnDef[]
  searchPlaceholder: string
  defaults: Record<string, unknown>
}

const optStr = z.string().max(200).optional().or(z.literal(""))

export const MASTER_CONFIGS: Record<MasterModel, MasterConfig> = {
  category: {
    title: "Categories",
    description: "Product categories for grouping and reporting.",
    route: "/categories",
    resource: "category",
    model: "category",
    schema: z.object({
      name: z.string().min(1, "Name is required").max(120),
      isActive: z.boolean(),
    }),
    fields: [
      { name: "name", label: "Category name", type: "text", colSpan: 2, placeholder: "Fertilizers", required: true },
      { name: "isActive", label: "Active", type: "switch" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "isActive", label: "Status", render: "bool" },
    ],
    searchPlaceholder: "Search categories...",
    defaults: { name: "", isActive: true },
  },

  manufacturer: {
    title: "Manufacturers",
    description: "Companies that manufacture the products you stock.",
    route: "/manufacturers",
    resource: "manufacturer",
    model: "manufacturer",
    schema: z.object({
      name: z.string().min(1, "Name is required").max(120),
      code: optStr,
      gstin: optStr,
      contact: optStr,
      isActive: z.boolean(),
    }),
    fields: [
      { name: "name", label: "Manufacturer name", type: "text", colSpan: 2, placeholder: "Bayer CropScience", required: true },
      { name: "code", label: "Code", type: "text" },
      { name: "gstin", label: "GSTIN", type: "text", uppercase: true },
      { name: "contact", label: "Contact", type: "text", colSpan: 2 },
      { name: "isActive", label: "Active", type: "switch" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "gstin", label: "GSTIN" },
      { key: "isActive", label: "Status", render: "bool" },
    ],
    searchPlaceholder: "Search manufacturers...",
    defaults: { name: "", code: "", gstin: "", contact: "", isActive: true },
  },

  taxGroup: {
    title: "Tax Groups",
    description: "GST rate slabs applied to products (split into CGST/SGST or IGST automatically).",
    route: "/tax-groups",
    resource: "tax_group",
    model: "taxGroup",
    schema: z.object({
      name: z.string().min(1, "Name is required").max(80),
      gstRate: z.coerce.number().min(0, "Min 0").max(100, "Max 100"),
      cessRate: z.coerce.number().min(0).max(100),
      isActive: z.boolean(),
    }),
    fields: [
      { name: "name", label: "Name", type: "text", colSpan: 2, placeholder: "GST 18%", required: true },
      { name: "gstRate", label: "GST rate (%)", type: "number", step: "0.01", required: true },
      { name: "cessRate", label: "Cess rate (%)", type: "number", step: "0.01" },
      { name: "isActive", label: "Active", type: "switch" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "gstRate", label: "GST %", render: "percent" },
      { key: "cessRate", label: "Cess %", render: "percent" },
      { key: "isActive", label: "Status", render: "bool" },
    ],
    searchPlaceholder: "Search tax groups...",
    defaults: { name: "", gstRate: 0, cessRate: 0, isActive: true },
  },

  location: {
    title: "Locations",
    description: "Warehouses / stores where stock is held (multi-location inventory).",
    route: "/locations",
    resource: "location",
    model: "location",
    schema: z.object({
      name: z.string().min(1, "Name is required").max(120),
      code: z.string().min(1, "Code is required").max(20),
      type: z.enum(["WAREHOUSE", "STORE", "GODOWN"]),
      address: optStr,
      isActive: z.boolean(),
    }),
    fields: [
      { name: "name", label: "Location name", type: "text", colSpan: 2, placeholder: "Main Store", required: true },
      { name: "code", label: "Code", type: "text", uppercase: true, placeholder: "MAIN", required: true },
      {
        name: "type",
        label: "Type",
        type: "select",
        required: true,
        options: [
          { value: "WAREHOUSE", label: "Warehouse" },
          { value: "STORE", label: "Store" },
          { value: "GODOWN", label: "Godown" },
        ],
      },
      { name: "address", label: "Address", type: "textarea", colSpan: 2 },
      { name: "isActive", label: "Active", type: "switch" },
    ],
    columns: [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
      { key: "type", label: "Type" },
      { key: "isActive", label: "Status", render: "bool" },
    ],
    searchPlaceholder: "Search locations...",
    defaults: { name: "", code: "", type: "WAREHOUSE", address: "", isActive: true },
  },
}
