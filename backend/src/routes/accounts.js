import { Router } from 'express';
import * as controller from '../controllers/accounts.js';

const router = Router();

router.get('/', controller.list);
router.get('/balance', controller.getBalance);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

export default router;
