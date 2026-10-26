import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";

export function requestIdMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const requestId = randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-ID", requestId);

    next();
}