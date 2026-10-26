import express from "express";
import cors from "cors";
import helmet from "helmet";
import { API_BASE } from "./constants/paths";
import { apiRouter } from "./routes";
import { requestIdMiddleware } from "./middlewares/requestId.middleware";
import { pinoHttp } from "pino-http";
import { logger } from "./config/logger";
import { errorMiddleware } from "./middlewares/error.middleware";

export const app = express();

// Request ID
app.use(requestIdMiddleware);

// HTTP logger
app.use(
    pinoHttp({
        logger,
    })
);

// Security
app.use(helmet());
app.use(cors());

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use(API_BASE, apiRouter);

// Central error handler - MUST BE LAST
app.use(errorMiddleware);