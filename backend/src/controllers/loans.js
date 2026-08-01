import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';

export async function list(req, res) {
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

  const loans = await all(query, ...params);

  for (const loan of loans) {
    const payments = await all('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC', loan.id);
    loan.payments = payments;
    loan.paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    loan.remainingAmount = loan.amount - loan.paidAmount;
    if (loan.remainingAmount <= 0 && loan.status === 'active') {
      await run('UPDATE loans SET status = ?, remaining_amount = 0, updated_at = ? WHERE id = ?', 'paid', now(), loan.id);
      loan.status = 'paid';
    }
  }

  res.json(loans);
}

export async function getById(req, res) {
  const loan = await get('SELECT * FROM loans WHERE id = ?', req.params.id);

  if (!loan) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  loan.payments = await all('SELECT * FROM loan_payments WHERE loan_id = ? ORDER BY date DESC', req.params.id);
  res.json(loan);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { type, personName, personPhone, personAddress, amount, accountId, dueDate, notes } = req.body;

  await run(`INSERT INTO loans (id, type, person_name, person_phone, person_address, amount, paid_amount, remaining_amount, account_id, due_date, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active', ?, ?, ?)`,
    id, type, personName, personPhone || null, personAddress || null,
    amount, amount, accountId || null, dueDate || null, notes || null, timestamp, timestamp
  );

  const loan = await get('SELECT * FROM loans WHERE id = ?', id);
  res.status(201).json(loan);
}

export async function update(req, res) {
  const timestamp = now();

  const existing = await get('SELECT * FROM loans WHERE id = ?', req.params.id);
  if (!existing) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  const { personName, personPhone, personAddress, amount, dueDate, status, notes } = req.body;

  await run(`UPDATE loans SET
    person_name = COALESCE(?, person_name),
    person_phone = COALESCE(?, person_phone),
    person_address = COALESCE(?, person_address),
    amount = COALESCE(?, amount),
    due_date = COALESCE(?, due_date),
    status = COALESCE(?, status),
    notes = COALESCE(?, notes),
    updated_at = ?
    WHERE id = ?`,
    personName || null, personPhone || null, personAddress || null,
    amount || null, dueDate || null, status || null, notes || null,
    timestamp, req.params.id
  );

  const totalPaid = await get('SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loan_id = ?', req.params.id);
  const loanAmount = amount || existing.amount;
  await run('UPDATE loans SET remaining_amount = ? WHERE id = ?', loanAmount - totalPaid.total, req.params.id);

  const loan = await get('SELECT * FROM loans WHERE id = ?', req.params.id);
  res.json(loan);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM loans WHERE id = ?', req.params.id);

  if (!existing) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  await run('DELETE FROM loan_payments WHERE loan_id = ?', req.params.id);
  await run('DELETE FROM loans WHERE id = ?', req.params.id);

  res.json({ message: 'Loan deleted successfully' });
}

export async function addPayment(req, res) {
  const id = generateId();
  const timestamp = now();

  const loan = await get('SELECT * FROM loans WHERE id = ?', req.params.id);
  if (!loan) {
    return res.status(404).json({ error: 'Loan not found' });
  }

  const { amount, date, notes } = req.body;

  if (amount <= 0) {
    return res.status(400).json({ error: 'Payment amount must be positive' });
  }

  await run(`INSERT INTO loan_payments (id, loan_id, amount, date, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`, id, req.params.id, amount, date, notes || null, timestamp);

  const totalPaid = await get('SELECT COALESCE(SUM(amount), 0) as total FROM loan_payments WHERE loan_id = ?', req.params.id);
  const remaining = loan.amount - totalPaid.total;

  const newStatus = remaining <= 0 ? 'paid' : 'active';
  await run('UPDATE loans SET paid_amount = ?, remaining_amount = ?, status = ?, updated_at = ? WHERE id = ?', totalPaid.total, remaining, newStatus, timestamp, req.params.id);

  if (loan.type === 'lent' && loan.account_id) {
    const account = await get('SELECT * FROM accounts WHERE id = ?', loan.account_id);
    if (account) {
      await run('UPDATE accounts SET current_balance = current_balance + ?, updated_at = ? WHERE id = ?', amount, timestamp, loan.account_id);
    }
  }

  if (loan.type === 'borrowed' && loan.account_id) {
    const account = await get('SELECT * FROM accounts WHERE id = ?', loan.account_id);
    if (account) {
      await run('UPDATE accounts SET current_balance = current_balance - ?, updated_at = ? WHERE id = ?', amount, timestamp, loan.account_id);
    }
  }

  const payment = await get('SELECT * FROM loan_payments WHERE id = ?', id);
  res.status(201).json(payment);
}
