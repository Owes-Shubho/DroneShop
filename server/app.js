import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import accountRoutes from './routes/account.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import categoryRoutes from './routes/categories.js';
import adminRoutes from './routes/admin.js';
import uploadRoutes, { uploadDir } from './routes/upload.js';
import seoRoutes from './routes/seo.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();
const inTest = process.env.NODE_ENV === 'test';

app.disable('x-powered-by');
// Uploaded images are loaded by the client origin, so allow cross-origin embedding of those files.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json({ limit: '100kb' }));

const limiter = (limit, windowMs = 15 * 60 * 1000) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => inTest,
    message: { message: 'Too many requests, please try again later.' },
  });

app.use('/api', limiter(600));
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot', '/api/auth/reset'], limiter(20));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/uploads', express.static(uploadDir));
app.use(seoRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
