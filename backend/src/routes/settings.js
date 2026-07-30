import { Router } from 'express';
import * as controller from '../controllers/settings.js';

const router = Router();

router.get('/', controller.getAll);
router.get('/:key', controller.getByKey);
router.put('/', controller.update);

export default router;
