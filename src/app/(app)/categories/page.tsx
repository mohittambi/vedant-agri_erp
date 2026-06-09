import type { Metadata } from "next"
import { MasterPage } from "@/components/master/master-page"

export const metadata: Metadata = { title: "Categories" }

export default function CategoriesPage() {
  return <MasterPage model="category" />
}
