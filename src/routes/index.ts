import { Router } from 'express';
import { API_V1 } from '../constants/paths';
import { v1Router } from './v1';

export const apiRouter = Router();
apiRouter.use(API_V1, v1Router);