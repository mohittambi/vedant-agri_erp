import { Sprout } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Sprout className="size-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Agri Input ERP</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to manage inventory, billing &amp; accounts
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
