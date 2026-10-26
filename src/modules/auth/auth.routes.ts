import { Router } from "express";

import { register } from "./auth.controller.js";
import { asyncHandler } from "../../utils/asyncHandler.js";


const router = Router();

router.post("/register", asyncHandler(register));

export default router;