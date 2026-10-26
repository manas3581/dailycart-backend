import type { Request, Response } from 'express';

export function getHealth(_req: Request, res: Response) {
    res.status(200).json({
        status: 'ok',
        service: 'dailycart-api',
        version: 'v1',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
}