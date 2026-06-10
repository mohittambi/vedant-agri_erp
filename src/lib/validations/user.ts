import { z } from "zod"
import { ROLES } from "@/lib/constants"

export const createUserSchema = z.object({
  fullName: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Min 6 characters"),
  roleKey: z.enum(Object.keys(ROLES) as [string, ...string[]]),
})

export type CreateUserInput = z.infer<typeof createUserSchema>

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  fullName: z.string().min(2, "Name is required").max(120),
  roleKey: z.enum(Object.keys(ROLES) as [string, ...string[]]),
})

export type UpdateUserInput = z.infer<typeof updateUserSchema>

export const setPasswordSchema = z.object({
  userId: z.string().min(1),
  password: z.string().min(6, "Min 6 characters"),
})

export type SetPasswordInput = z.infer<typeof setPasswordSchema>
