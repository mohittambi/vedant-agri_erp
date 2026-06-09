"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Download, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function ProductImportExport({ canImport }: { canImport: boolean }) {
  const router = useRouter()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [busy, setBusy] = React.useState(false)

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/products/import", { method: "POST", body: fd })
      const json = await res.json()
      if (!json.ok) {
        toast.error(json.error ?? "Import failed")
      } else {
        toast.success(`Imported: ${json.created} new, ${json.updated} updated, ${json.skipped} skipped`)
        if (json.errors?.length) toast.warning(json.errors[0])
        router.refresh()
      }
    } catch {
      toast.error("Import failed")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" asChild>
        <a href="/api/export/products"><Download className="size-4" /> Export</a>
      </Button>
      {canImport && (
        <>
          <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={onFile} />
          <Button variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import
          </Button>
        </>
      )}
    </div>
  )
}
