import express from 'express';
import cors from 'cors';
import config from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ensureDatabase } from './db/init.js';
import accountsRouter from './routes/accounts.js';
import categoriesRouter from './routes/categories.js';
import transactionsRouter from './routes/transactions.js';
import loansRouter from './routes/loans.js';
import tagsRouter from './routes/tags.js';
import dashboardRouter from './routes/dashboard.js';
import reportsRouter from './routes/reports.js';
import settingsRouter from './routes/settings.js';
import budgetsRouter from './routes/budgets.js';
import searchRouter from './routes/search.js';
import backupRouter from './routes/backup.js';
import savingsRouter from './routes/savings.js';
import recurringRouter from './routes/recurring.js';
import customFieldsRouter from './routes/customFields.js';
import exportRouter from './routes/export.js';
import pinLockRouter from './routes/pinLock.js';
import { push as syncPush } from './controllers/sync.js';

const app = express();

app.use(cors(config.cors));
app.use(express.json());

app.use('/api/accounts', accountsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/loans', loansRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/search', searchRouter);
app.use('/api/backup', backupRouter);
app.use('/api/savings', savingsRouter);
app.use('/api/recurring', recurringRouter);
app.use('/api/custom-fields', customFieldsRouter);
app.use('/api/export', exportRouter);
app.use('/api/pin-lock', pinLockRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/sync/push', syncPush);

app.use(errorHandler);

ensureDatabase().catch((err) => {
  console.error('Database initialization failed:', err);
});

export default app;
export { ensureDatabase };
