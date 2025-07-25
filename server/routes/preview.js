import express from 'express';
import { preview } from '../../src/controllers/translationController.js';

const router = express.Router();

router.post('/', preview);

export default router;
