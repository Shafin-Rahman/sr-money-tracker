import { Router } from 'express';
import * as controller from '../controllers/dashboard.js';

const router = Router();

router.get('/summary', controller.getSummary);
router.get('/monthly', controller.getMonthlyStats);

export default router;
