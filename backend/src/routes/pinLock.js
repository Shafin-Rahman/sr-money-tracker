import { Router } from 'express';
import * as controller from '../controllers/pinLock.js';

const router = Router();
router.get('/status', controller.getStatus);
router.post('/setup', controller.setupPin);
router.put('/update', controller.updatePin);
router.post('/verify', controller.verifyPin);
router.post('/disable', controller.disablePin);
router.put('/auto-lock', controller.updateAutoLock);

export default router;
