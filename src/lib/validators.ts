import { z } from "zod"

export const signUpSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
})

export const signInSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
})

export const createGroupSchema = z.object({
  name: z.string().min(2),
})

export const joinGroupSchema = z.object({
  inviteCode: z.string().min(4),
})

export const createGoalSchema = z.object({
  name: z.string().min(2),
  cadenceType: z.enum(["DAILY", "WEEKLY"]),
  weeklyTarget: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(14).optional()
  ),
  notes: z.string().max(280).optional(),
})

export const checkInSchema = z.object({
  goalId: z.string().cuid(),
})

export const updateTimezoneSchema = z.object({
  timezone: z.string().min(3),
})

export const updateReminderSchema = z.object({
  reminderTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  reminderFrequency: z.enum(["DAILY", "WEEKDAYS"]),
})
