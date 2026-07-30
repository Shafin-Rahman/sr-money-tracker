import { getSqlite } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export function list(req, res) {
  const db = getSqlite();
  const { type, status } = req.query;

  let query = 'SELECT * FROM loans WHERE 1=1';
  const params = [];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const loans = db.prepare(query).all(...params);

  loans.forEach((loan) => {
    const payments = db.prepare('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC').all(loan.id);
    loan.payments = payments;
    loan.paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    loan.remainingAmount = loan.amount - loan.paidAmount;
    if (loan.remainingAmount <= 0 && loan.status === 'active') {
      db.prepare('UPDATE loans SET status = ?, remaining_amount = 0, updated_at = ? WHERE id = ?').run('paid', now(), loan.id);
      loan.status = 'paid';
    }
  });

  res.json(loans);
}

export function getById(req, res) {
  const db = getSqlite();
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);

  if (!loan) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  loan.payments = db.prepare('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC').all(req.params.id);
  res.json(loan);
}

export function create(req, res) {
  const db = getSqlite();
  const id = generateId();
  const timestamp = now();

  const { type, personName, personPhone, personAddress, amount, accountId, dueDate, notes } = req.body;

  db.prepare(`INSERT INTO loans (id, type, person_name, person_phone, person_address, amount, paid_amount, remaining_amount, account_id, due_date, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?, ?)`).run(
    id, type, personName, personPhone || null, personAddress || null,
    amount, amount, accountId || null, dueDate || null, notes || null, timestamp, timestamp
  );

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(id);
  res.status(201).json(loan);
}

export function update(req, res) {
  const db = getSqlite();
  const timestamp = now();

  const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  const { personName, personPhone, personAddress, amount, dueDate, status, notes } = req.body;

  db.prepare(`UPDATE loans SET
    person_name = COALESCE(?, person_name),
    person_phone = COALESCE(?, person_phone),
    person_address = COALESCE(?, person_address),
    amount = COALESCE(?, amount),
    due_date = COALESCE(?, due_date),
    status = COALESCE(?, status),
    notes = COALESCE(?, notes),
    updated_at = ?
    WHERE id = ?`).run(
    personName || null, personPhone || null, personAddress || null,
    amount || null, dueDate || null, status || null, notes || null,
    timestamp, req.params.id
  );

  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loan_id = ?').get(req.params.id);
  const loanAmount = amount || existing.amount;
  db.prepare('UPDATE loans SET remaining_amount = ? WHERE id = ?').run(loanAmount - totalPaid.total, req.params.id);

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  res.json(loan);
}

export function remove(req, res) {
  const db = getSqlite();
  const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  db.prepare('DELETE FROM loan_payments WHERE loan_id = ?').run(req.params.id);
  db.prepare('DELETE FROM loans WHERE id = ?').run(req.params.id);

  res.json({ message: 'Loan deleted successfully' });
}

export function addPayment(req, res) {
  const db = getSqlite();
  const id = generateId();
  const timestamp = now();

  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  const { amount, date, notes } = req.body;

  if (amount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be positive' });
  }

  db.prepare(`INSERT INTO loan_payments (id, loan_id, amount, date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`).run(id, req.params.id, amount, date, notes || null, timestamp);

  const totalPaid = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loan_id = ?').get(req.params.id);
  const remaining = loan.amount - totalPaid.total;

  const newStatus = remaining <= 0 ? 'paid' : 'active';
  db.prepare('UPDATE loans SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = ? WHERE id = ?').run(totalPaid.total, remaining, newStatus, timestamp, req.params.id);

  if (loan.type === 'lent' && loan.account_id) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(loan.account_id);
    if (account) {
      db.prepare('UPDATE accounts SET current_balance = current_balance + ?, updated_at = ? WHERE id = ?').run(amount, timestamp, loan.account_id);
    }
  }

  if (loan.type === 'borrowed' && loan.account_id) {
    const account = db.prepare('SELECT * FROM accounts WHERE id = ?').get(loan.account_id);
    if (account) {
      db.prepare('UPDATE accounts SET current_balance = current_balance - ?, updated_at = ? WHERE id = ?').run(amount, timestamp, loan.account_id);
    }
  }

  const payment = db.prepare('SELECT * FROM loan_payments WHERE id = ?').get(id);
  res.status(201).json(payment);
}
