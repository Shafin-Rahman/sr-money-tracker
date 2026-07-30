import { Router } from 'express';
import * as controller from '../controllers/customFields.js';

const router = Router();
router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/transactions/:transactionId', controller.getTransactionValues);
router.post('/transactions/:transactionId', controller.setTransactionValues);

export default router;
