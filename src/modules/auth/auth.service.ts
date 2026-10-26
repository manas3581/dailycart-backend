import argon2 from "argon2";

import { prisma } from "../../config/database.js";
import type { RegisterInput } from "./auth.types.js";
import { ApiError } from "../../utils/ApiError.js";

export async function registerUser(input: RegisterInput) {
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: input.email },
                ...(input.phone ? [{ phone: input.phone }] : []),
            ],
        },
    });

    if (existingUser) {
        throw new ApiError(
            409,
            "User with this email or phone already exists",
            "USER_ALREADY_EXISTS"
        );
    }

    const passwordHash = await argon2.hash(input.password);

    const user = await prisma.user.create({
        data: {
            firstName: input.firstName,
            lastName: input.lastName,
            email: input.email,
            phone: input.phone,
            passwordHash,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
        },
    });

    return user;
}