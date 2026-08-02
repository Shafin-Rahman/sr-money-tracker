import { get, all, run } from '../db/index.js';
import { now, generateId } from '../utils/helpers.js';
import { recomputeAccountBalance } from '../utils/balances.js';

export async function list(req, res) {
  const goals = await all('SELECT * FROM savings_goals WHERE is_active = 1 ORDER BY created_at DESC');

  goals.forEach((g) => {
    g.progress = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
    g.remaining = Math.max(0, g.target_amount - g.current_amount);
  });

  res.json(goals);
}

export async function getById(req, res) {
  const goal = await get('SELECT * FROM savings_goals WHERE id = ?', req.params.id);
  if (!goal) return res.status(404).json({ error: 'Savings goal not found' });

  goal.progress = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0;
  goal.remaining = Math.max(0, goal.target_amount - goal.current_amount);
  res.json(goal);
}

export async function create(req, res) {
  const id = generateId();
  const timestamp = now();

  const { name, targetAmount, currentAmount, accountId, deadline, icon, color, notes } = req.body;

  await run(`INSERT INTO savings_goals (id, name, target_amount, current_amount, account_id, deadline, icon, color, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, name, targetAmount, currentAmount || 0, accountId || null,
    deadline || null, icon || 'piggy-bank', color || '#6366f1', notes || null, timestamp, timestamp
  );

  if (accountId) {
    await recomputeAccountBalance(accountId);
  }

  const goal = await get('SELECT * FROM savings_goals WHERE id = ?', id);
  res.status(201).json(goal);
}

export async function update(req, res) {
  const timestamp = now();
  const existing = await get('SELECT * FROM savings_goals WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });

  const { name, targetAmount, currentAmount, accountId, deadline, icon, color, notes, isActive } = req.body;

  await run(`UPDATE savings_goals SET
    name = COALESCE(?, name), target_amount = COALESCE(?, target_amount),
    current_amount = COALESCE(?, current_amount), account_id = ?,
    deadline = COALESCE(?, deadline), icon = COALESCE(?, icon),
    color = COALESCE(?, color), notes = COALESCE(?, notes),
    is_active = COALESCE(?, is_active), updated_at = ? WHERE id = ?`,
    name || null, targetAmount || null, currentAmount || null,
    accountId !== undefined ? accountId : existing.account_id,
    deadline || null, icon || null, color || null, notes !== undefined ? notes : existing.notes,
    isActive !== undefined ? (isActive ? 1 : 0) : null, timestamp, req.params.id
  );

  if (existing.account_id) await recomputeAccountBalance(existing.account_id);
  if (accountId !== undefined && accountId !== existing.account_id) await recomputeAccountBalance(accountId);

  const goal = await get('SELECT * FROM savings_goals WHERE id = ?', req.params.id);
  res.json(goal);
}

export async function remove(req, res) {
  const existing = await get('SELECT * FROM savings_goals WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });
  await run('DELETE FROM savings_goals WHERE id = ?', req.params.id);
  if (existing.account_id) await recomputeAccountBalance(existing.account_id);
  res.json({ message: 'Savings goal deleted' });
}

export async function addFunds(req, res) {
  const timestamp = now();
  const existing = await get('SELECT * FROM savings_goals WHERE id = ?', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Savings goal not found' });

  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

  const newAmount = existing.current_amount + amount;
  await run('UPDATE savings_goals SET current_amount = ?, updated_at = ? WHERE id = ?', newAmount, timestamp, req.params.id);

  if (existing.account_id) {
    await recomputeAccountBalance(existing.account_id);
  }

  res.json({ message: 'Funds added', currentAmount: newAmount });
}
