import type { Request, Response } from "express";

import { registerSchema } from "./auth.validation.js";
import { registerUser } from "./auth.service.js";

export async function register(
    req: Request,
    res: Response
) {
    const input = registerSchema.parse(req.body);

    const user = await registerUser(input);

    return res.status(201).json({
        success: true,
        message: "User registered successfully",
        data: user,
    });
}