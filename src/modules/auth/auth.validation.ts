import { z } from "zod";

export const registerSchema = z.object({
    firstName: z
        .string()
        .trim()
        .min(2, "First name must be at least 2 characters")
        .max(50, "First name must not exceed 50 characters"),

    lastName: z
        .string()
        .trim()
        .min(2, "Last name must be at least 2 characters")
        .max(50, "Last name must not exceed 50 characters"),

    email: z
        .string()
        .trim()
        .email("Invalid email address")
        .max(254, "Email must not exceed 254 characters")
        .toLowerCase(),

    phone: z
        .string()
        .trim()
        .regex(/^[0-9]{10}$/, "Phone number must be exactly 10 digits")
        .optional(),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(128, "Password must not exceed 128 characters")
        .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
        .regex(/[a-z]/, "Password must contain at least one lowercase letter")
        .regex(/[0-9]/, "Password must contain at least one number")
        .regex(
            /[^A-Za-z0-9]/,
            "Password must contain at least one special character"
        ),
});