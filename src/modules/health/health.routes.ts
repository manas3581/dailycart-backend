import { Router } from 'express';
import { HEALTH_ROUTE } from '../../constants/paths';
import { getHealth } from './health.controller';

export const healthRouter = Router();
healthRouter.get(HEALTH_ROUTE, getHealth);