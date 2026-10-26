import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";

import { ApiError } from "../utils/ApiError.js";

export function errorMiddleware(
    error: unknown,
    req: Request,
    res: Response,
    next: NextFunction
) {
    // Custom application errors
    if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
            success: false,
            message: error.message,
            errorCode: error.errorCode,
        });
    }

    // Zod validation errors
    if (error instanceof ZodError) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errorCode: "VALIDATION_ERROR",
            errors: error.issues.map((issue) => ({
                field: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    // Prisma unique constraint
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
    ) {
        return res.status(409).json({
            success: false,
            message: "A record with this value already exists",
            errorCode: "DUPLICATE_RESOURCE",
        });
    }

    // Prisma record not found
    if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
    ) {
        return res.status(404).json({
            success: false,
            message: "Requested resource was not found",
            errorCode: "RESOURCE_NOT_FOUND",
        });
    }

    // Unknown/unexpected error
    console.error("Unhandled error:", error);

    return res.status(500).json({
        success: false,
        message: "Internal server error",
        errorCode: "INTERNAL_SERVER_ERROR",
    });
}