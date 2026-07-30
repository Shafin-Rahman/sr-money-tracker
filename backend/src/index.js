import express from 'express';
import cors from 'cors';
import config from './config.js';
import { getDatabase, getSqlite } from './db/index.js';
import { errorHandler } from './middleware/errorHandler.js';
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

app.use(errorHandler);

const db = getDatabase();
const sqlite = getSqlite();

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT 'Default User',
    email TEXT,
    currency TEXT NOT NULL DEFAULT 'BDT',
    theme TEXT NOT NULL DEFAULT 'system',
    date_format TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    language TEXT NOT NULL DEFAULT 'bn',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'custom',
    icon TEXT NOT NULL DEFAULT 'wallet',
    color TEXT NOT NULL DEFAULT '#6366f1',
    opening_balance REAL NOT NULL DEFAULT 0,
    current_balance REAL NOT NULL DEFAULT 0,
    notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    parent_id TEXT,
    icon TEXT NOT NULL DEFAULT 'circle',
    color TEXT NOT NULL DEFAULT '#6366f1',
    is_active INTEGER NOT NULL DEFAULT 1,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id),
    to_account_id TEXT REFERENCES accounts(id),
    category_id TEXT REFERENCES categories(id),
    description TEXT,
    person_name TEXT,
    person_phone TEXT,
    location TEXT,
    notes TEXT,
    date TEXT NOT NULL,
    time TEXT,
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurring_interval TEXT,
    recurring_next_date TEXT,
    is_removed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transaction_tags (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions(id),
    tag_id TEXT NOT NULL REFERENCES tags(id)
  );

  CREATE TABLE IF NOT EXISTS loans (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    person_name TEXT NOT NULL,
    person_phone TEXT,
    person_address TEXT,
    amount REAL NOT NULL,
    paid_amount REAL NOT NULL DEFAULT 0,
    remaining_amount REAL NOT NULL,
    interest_rate REAL DEFAULT 0,
    account_id TEXT REFERENCES accounts(id),
    due_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loan_payments (
    id TEXT PRIMARY KEY,
    loan_id TEXT NOT NULL REFERENCES loans(id),
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY,
    category_id TEXT REFERENCES categories(id),
    amount REAL NOT NULL,
    period TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recurring_bills (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id TEXT REFERENCES categories(id),
    account_id TEXT REFERENCES accounts(id),
    interval TEXT NOT NULL,
    day_of_month INTEGER,
    day_of_week INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT,
    next_date TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS savings_goals (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, target_amount REAL NOT NULL,
    current_amount REAL NOT NULL DEFAULT 0, account_id TEXT REFERENCES accounts(id),
    deadline TEXT, icon TEXT NOT NULL DEFAULT 'piggy-bank',
    color TEXT NOT NULL DEFAULT '#6366f1', notes TEXT,
    is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS custom_fields (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'text',
    is_required INTEGER NOT NULL DEFAULT 0, sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transaction_custom_fields (
    id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES transactions(id),
    field_id TEXT NOT NULL REFERENCES custom_fields(id), value TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_lock (
    id TEXT PRIMARY KEY, pin_hash TEXT, is_enabled INTEGER NOT NULL DEFAULT 0,
    auto_lock_minutes INTEGER NOT NULL DEFAULT 5, last_unlocked_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
  CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
  CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
  CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
`);

const existingUser = sqlite.prepare('SELECT id FROM users LIMIT 1').get();
if (!existingUser) {
  const now = new Date().toISOString();
  sqlite.prepare(`INSERT INTO users (id, name, currency, theme, date_format, language, created_at, updated_at)
    VALUES (?, 'Default User', 'BDT', 'system', 'DD/MM/YYYY', 'bn', ?, ?)`).run(crypto.randomUUID(), now, now);

  const defaultAccountId = crypto.randomUUID();
  sqlite.prepare(`INSERT INTO accounts (id, name, type, icon, color, opening_balance, current_balance, sort_order, created_at, updated_at)
    VALUES (?, 'Cash', 'cash', 'wallet', '#22c55e', 0, 0, 1, ?, ?)`).run(defaultAccountId, now, now);
  sqlite.prepare(`INSERT INTO accounts (id, name, type, icon, color, opening_balance, current_balance, sort_order, created_at, updated_at)
    VALUES (?, 'Bank', 'bank', 'bank', '#6366f1', 0, 0, 2, ?, ?)`).run(crypto.randomUUID(), now, now);
  sqlite.prepare(`INSERT INTO accounts (id, name, type, icon, color, opening_balance, current_balance, sort_order, created_at, updated_at)
    VALUES (?, 'bKash', 'mobile_banking', 'smartphone', '#e11d48', 0, 0, 3, ?, ?)`).run(crypto.randomUUID(), now, now);

  const incomeCatId = crypto.randomUUID();
  const expenseCatId = crypto.randomUUID();
  sqlite.prepare(`INSERT INTO categories (id, name, type, icon, color, sort_order, created_at, updated_at)
    VALUES (?, 'Income', 'income', 'trending-up', '#22c55e', 1, ?, ?)`).run(incomeCatId, now, now);
  sqlite.prepare(`INSERT INTO categories (id, name, type, icon, color, sort_order, created_at, updated_at)
    VALUES (?, 'Expense', 'expense', 'trending-down', '#ef4444', 2, ?, ?)`).run(expenseCatId, now, now);

  const subcategories = [
    [incomeCatId, 'Salary', 'briefcase', '#22c55e', 1],
    [incomeCatId, 'Business', 'building', '#16a34a', 2],
    [incomeCatId, 'Freelance', 'laptop', '#15803d', 3],
    [incomeCatId, 'Gift', 'gift', '#86efac', 4],
    [expenseCatId, 'Food & Drinks', 'utensils', '#ef4444', 1],
    [expenseCatId, 'Transport', 'car', '#dc2626', 2],
    [expenseCatId, 'Shopping', 'shopping-bag', '#b91c1c', 3],
    [expenseCatId, 'Bills & Utilities', 'file-text', '#f87171', 4],
    [expenseCatId, 'Healthcare', 'heart', '#fca5a5', 5],
  ];
  for (const [parentId, name, icon, color, order] of subcategories) {
    sqlite.prepare(`INSERT INTO categories (id, name, type, parent_id, icon, color, sort_order, created_at, updated_at)
      VALUES (?, ?, 'subcategory', ?, ?, ?, ?, ?, ?)`).run(crypto.randomUUID(), name, parentId, icon, color, order, now, now);
  }

  sqlite.prepare(`INSERT INTO settings (id, key, value, created_at, updated_at)
    VALUES (?, 'currency', 'BDT', ?, ?)`).run(crypto.randomUUID(), now, now);
  sqlite.prepare(`INSERT INTO settings (id, key, value, created_at, updated_at)
    VALUES (?, 'theme', 'system', ?, ?)`).run(crypto.randomUUID(), now, now);
  sqlite.prepare(`INSERT INTO settings (id, key, value, created_at, updated_at)
    VALUES (?, 'date_format', 'DD/MM/YYYY', ?, ?)`).run(crypto.randomUUID(), now, now);

  console.log('Default data seeded successfully');
}

const server = app.listen(config.port, () => {
  console.log(`Money Tracker API running on http://localhost:${config.port}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${config.port} is already in use.`);
    console.error('Run: taskkill -F -IM node.exe  (Windows)');
    console.error('Or:  kill -9 $(lsof -ti:3001)  (Linux/Mac)');
    process.exit(1);
  }
});
