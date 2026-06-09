"use client"

import * as React from "react"
import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { Loader2, MoreHorizontal, Plus, Power } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/data-table/data-table"
import { SortableHeader } from "@/components/data-table/column-header"
import { createUser, toggleUserActive } from "@/lib/actions/user-actions"
import { createUserSchema, type CreateUserInput } from "@/lib/validations/user"
import { ROLE_LABELS, ROLES, type RoleKey } from "@/lib/constants"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export type UserRow = { id: string; fullName: string; email: string; roles: string[]; isActive: boolean }

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { fullName: "", email: "", password: "", roleKey: "SALES_USER" },
  })

  async function onSubmit(values: CreateUserInput) {
    const res = await createUser(values)
    if (!res.ok) {
      if (res.fieldErrors) for (const [k, m] of Object.entries(res.fieldErrors)) form.setError(k as keyof CreateUserInput, { message: m?.[0] })
      toast.error(res.error ?? "Failed to create user")
      return
    }
    toast.success("User created")
    onOpenChange(false)
    form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>Creates a login and assigns a role in the current firm.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-1.5"><Label>Full name</Label><Input {...form.register("fullName")} />
            {form.formState.errors.fullName && <p className="text-sm text-destructive">{form.formState.errors.fullName.message}</p>}
          </div>
          <div className="grid gap-1.5"><Label>Email</Label><Input type="email" {...form.register("email")} />
            {form.formState.errors.email && <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>}
          </div>
          <div className="grid gap-1.5"><Label>Temporary password</Label><Input type="text" {...form.register("password")} />
            {form.formState.errors.password && <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>}
          </div>
          <div className="grid gap-1.5">
            <Label>Role</Label>
            <Select value={form.watch("roleKey")} onValueChange={(v) => form.setValue("roleKey", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(ROLES) as RoleKey[]).filter((k) => k !== "SUPER_ADMIN").map((k) => (
                  <SelectItem key={k} value={k}>{ROLE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsersClient({ rows, canCreate, canUpdate }: { rows: UserRow[]; canCreate: boolean; canUpdate: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [pending, startTransition] = useTransition()

  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: "fullName",
      header: ({ column }) => <SortableHeader column={column} title="Name" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.fullName}</div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      ),
    },
    {
      id: "roles", header: "Roles",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((r) => <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>)}
        </div>
      ),
    },
    {
      accessorKey: "isActive", header: "Status",
      cell: ({ row }) => row.original.isActive
        ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">Active</Badge>
        : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>,
    },
  ]

  if (canUpdate) {
    columns.push({
      id: "actions",
      cell: ({ row }) => {
        const u = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="size-8" disabled={pending}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => startTransition(async () => {
                const res = await toggleUserActive(u.id, !u.isActive)
                res.ok ? toast.success("Updated") : toast.error(res.error ?? "Failed")
              })}><Power className="size-4" /> {u.isActive ? "Deactivate" : "Activate"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    })
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search users..."
        toolbar={canCreate ? <Button onClick={() => setOpen(true)}><Plus className="size-4" /> New user</Button> : null}
      />
      <CreateUserDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
