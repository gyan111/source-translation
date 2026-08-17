import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import translateRoute from './routes/translate.js';
import previewRoute from './routes/preview.js';
import authRoute from './routes/auth.js';
import publishRoute from './routes/publish.js';

// Auto-load .env file if present
if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  } catch (e) {
    console.warn('Could not load .env file:', e.message);
  }
}

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

// Direct /callback route alias for OAuth redirects configured with /callback
app.get('/callback', (req, res) => {
  const query = new URLSearchParams(req.query).toString();
  res.redirect(`/auth/callback${query ? '?' + query : ''}`);
});

// Fallback for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`Server listening on 0.0.0.0:${PORT}`));


