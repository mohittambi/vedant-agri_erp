import type { Metadata } from "next"
import { MasterPage } from "@/components/master/master-page"

export const metadata: Metadata = { title: "Locations" }

export default function LocationsPage() {
  return <MasterPage model="location" />
}
