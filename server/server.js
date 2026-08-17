import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';
import translateRoute from './routes/translate.js';
import previewRoute from './routes/preview.js';
import authRoute from './routes/auth.js';
import publishRoute from './routes/publish.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8000;

app.use(bodyParser.json({ limit: '5mb' }));

// Healthcheck for Toolforge Kubernetes ingress
app.get('/healthz', (req, res) => res.status(200).send('OK'));

// Session middleware for OAuth
app.use(session({
  secret: process.env.SESSION_SECRET || 'source-translation-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
}));

app.use(express.static(path.join(__dirname, '../dist')));

app.use('/translate', translateRoute);
app.use('/preview', previewRoute);
app.use('/auth', authRoute);
app.use('/publish', publishRoute);

// Fallback for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on 0.0.0.0:${PORT}`));

