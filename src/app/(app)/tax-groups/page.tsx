import type { Metadata } from "next"
import { MasterPage } from "@/components/master/master-page"

export const metadata: Metadata = { title: "Tax Groups" }

export default function TaxGroupsPage() {
  return <MasterPage model="taxGroup" />
}
