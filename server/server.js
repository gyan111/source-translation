import express from 'express';
import bodyParser from 'body-parser';
import translateRoute from './routes/translate.js';
import previewRoute from './routes/preview.js';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5173;

app.use(bodyParser.json());
app.use(express.static('dist'));

app.use('/translate', translateRoute);
app.use('/preview', previewRoute);

app.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));
