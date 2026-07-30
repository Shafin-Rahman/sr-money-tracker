import { Router } from 'express';
import * as controller from '../controllers/transactions.js';

const router = Router();

router.get('/', controller.list);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/duplicate', controller.duplicate);

export default router;
