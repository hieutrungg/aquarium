import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import authRoutes from './routes/authRoutes.js';
import tankRoutes from './routes/tankRoutes.js';
import speciesRoutes from './routes/speciesRoutes.js';
import plantRoutes from './routes/plantRoutes.js';
import articleRoutes from './routes/articleRoutes.js';
import diseaseRoutes from './routes/diseaseRoutes.js';
import catalogRoutes from './routes/catalogRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'AquaVerse API' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tanks', tankRoutes);
app.use('/api/species', speciesRoutes);
app.use('/api/plants', plantRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/diseases', diseaseRoutes);
app.use('/api/catalog', catalogRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

export default app;
