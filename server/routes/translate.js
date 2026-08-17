import express from 'express';
import { translate, translateTemplate, services, rateLimiter } from '../../src/controllers/translationController.js';

const router = express.Router();

router.use(rateLimiter);

router.post('/', translate);
router.post('/template', translateTemplate);
router.get('/services', services);

export default router;
