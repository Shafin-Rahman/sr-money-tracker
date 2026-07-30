import { Router } from 'express';
import * as controller from '../controllers/reports.js';

const router = Router();

router.get('/', controller.getReport);

export default router;
