import { Router } from 'express';
import * as controller from '../controllers/search.js';

const router = Router();

router.get('/', controller.search);

export default router;
