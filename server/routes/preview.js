import express from 'express';
import { preview } from '../controllers/translationController.js';

const router = express.Router();

router.post('/', preview);

export default router;
