import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';
import fs from 'fs';
import path from 'path';
import config from '../config.js';

export function exportData(req, res) {
  const db = getSqlite();

  const data = {
    version: '1.0',
    exportedAt: now(),
    accounts: db.prepare('SELECT * FROM accounts').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    transactions: db.prepare('SELECT * FROM transactions').all(),
    tags: db.prepare('SELECT * FROM tags').all(),
    transactionTags: db.prepare('SELECT * FROM transaction_tags').all(),
    loans: db.prepare('SELECT * FROM loans').all(),
    loanPayments: db.prepare('SELECT * FROM loan_payments').all(),
    settings: db.prepare('SELECT * FROM settings').all(),
    budgets: db.prepare('SELECT * FROM budgets').all(),
    recurringBills: db.prepare('SELECT * FROM recurring_bills').all(),
    users: db.prepare('SELECT * FROM users').all(),
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="money-tracker-backup-${now().split('T')[0]}.json"`);
  res.json(data);
}

export function importData(req, res) {
  const db = getSqlite();
  const data = req.body;

  if (!data || !data.version) {
    return res.status(400).json({ error: 'Invalid backup file format' });
  }

  const transaction = db.transaction(() => {
    if (data.accounts) {
      db.prepare('DELETE FROM accounts').run();
      const insert = db.prepare(`INSERT INTO accounts (id, name, type, icon, color, opening_balance, current_balance, notes, is_active, is_archived, sort_order, created_at, updated_at)
        VALUES (@id, @name, @type, @icon, @color, @opening_balance, @current_balance, @notes, @is_active, @is_archived, @sort_order, @created_at, @updated_at)`);
      data.accounts.forEach((a) => insert.run(a));
    }

    if (data.categories) {
      db.prepare('DELETE FROM categories').run();
      const insert = db.prepare(`INSERT INTO categories (id, name, type, parent_id, icon, color, is_active, is_archived, sort_order, created_at, updated_at)
        VALUES (@id, @name, @type, @parent_id, @icon, @color, @is_active, @is_archived, @sort_order, @created_at, @updated_at)`);
      data.categories.forEach((c) => insert.run(c));
    }

    if (data.transactions) {
      db.prepare('DELETE FROM transactions').run();
      const insert = db.prepare(`INSERT INTO transactions (id, type, amount, account_id, to_account_id, category_id, description, person_name, person_phone, location, notes, date, time, is_recurring, recurring_interval, recurring_next_date, is_removed, created_at, updated_at)
        VALUES (@id, @type, @amount, @account_id, @to_account_id, @category_id, @description, @person_name, @person_phone, @location, @notes, @date, @time, @is_recurring, @recurring_interval, @recurring_next_date, @is_removed, @created_at, @updated_at)`);
      data.transactions.forEach((t) => insert.run(t));
    }

    if (data.tags) {
      db.prepare('DELETE FROM tags').run();
      const insert = db.prepare('INSERT INTO tags (id, name, color, created_at) VALUES (@id, @name, @color, @created_at)');
      data.tags.forEach((t) => insert.run(t));
    }

    if (data.loans) {
      db.prepare('DELETE FROM loans').run();
      const insert = db.prepare(`INSERT INTO loans (id, type, person_name, person_phone, person_address, amount, paid_amount, remaining_amount, interest_rate, account_id, due_date, status, notes, created_at, updated_at)
        VALUES (@id, @type, @person_name, @person_phone, @person_address, @amount, @paid_amount, @remaining_amount, @interest_rate, @account_id, @due_date, @status, @notes, @created_at, @updated_at)`);
      data.loans.forEach((l) => insert.run(l));
    }

    if (data.settings) {
      db.prepare('DELETE FROM settings').run();
      const insert = db.prepare('INSERT INTO settings (id, key, value, created_at, updated_at) VALUES (@id, @key, @value, @created_at, @updated_at)');
      data.settings.forEach((s) => insert.run(s));
    }

    if (data.budgets) {
      db.prepare('DELETE FROM budgets').run();
      const insert = db.prepare(`INSERT INTO budgets (id, category_id, amount, period, start_date, end_date, is_active, created_at, updated_at)
        VALUES (@id, @category_id, @amount, @period, @start_date, @end_date, @is_active, @created_at, @updated_at)`);
      data.budgets.forEach((b) => insert.run(b));
    }
  });

  try {
    transaction();
    res.json({ message: 'Data imported successfully', importedAt: now() });
  } catch (err) {
    res.status(500).json({ error: 'Import failed', message: err.message });
  }
}
