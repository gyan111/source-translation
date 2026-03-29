import express from 'express';
import { translate } from '../../src/controllers/translationController.js';

const router = express.Router();

router.post('/', translate);

export default router;
