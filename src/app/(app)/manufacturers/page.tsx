import type { Metadata } from "next"
import { MasterPage } from "@/components/master/master-page"

export const metadata: Metadata = { title: "Manufacturers" }

export default function ManufacturersPage() {
  return <MasterPage model="manufacturer" />
}
