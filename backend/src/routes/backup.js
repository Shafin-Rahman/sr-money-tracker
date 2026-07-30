import { Router } from 'express';
import * as controller from '../controllers/backup.js';

const router = Router();

router.get('/export', controller.exportData);
router.post('/import', controller.importData);

export default router;
