import express from 'express';
import bodyParser from 'body-parser';
import session from 'express-session';
import translateRoute from './routes/translate.js';
import previewRoute from './routes/preview.js';
import authRoute from './routes/auth.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;

app.use(bodyParser.json());

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

app.use(express.static('dist'));

app.use('/translate', translateRoute);
app.use('/preview', previewRoute);
app.use('/auth', authRoute);

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
