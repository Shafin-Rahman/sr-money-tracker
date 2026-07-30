import { Router } from 'express';
import * as controller from '../controllers/export.js';

const router = Router();
router.get('/csv', controller.exportCSV);
router.get('/csv/accounts', controller.exportAccountsCSV);
router.get('/json', controller.exportJSON);

export default router;
