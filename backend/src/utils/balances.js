import { get, all, run } from '../db/index.js';

// Canonical account balance — must stay in sync with the frontend
// `recomputeBalances()` in frontend/js/offlineCompute.js:
//   opening_balance
//   + income          (money in)
//   - expense         (money out)
//   - transfer out / + transfer in
//   + loan_received / - loan_given transactions
//   + active borrowed remaining / - active lent remaining   (loan principal + repayments)
//   - savings_goals.current_amount                           (money reserved for goals)
export async function recomputeAccountBalance(accountId) {
  const account = await get('SELECT * FROM accounts WHERE id = ?', accountId);
  if (!account) return null;

  const txns = await all(
    `SELECT type, amount, account_id, to_account_id FROM transactions
     WHERE (account_id = ? OR to_account_id = ?) AND is_removed = 0`,
    accountId, accountId
  );

  const loans = await all(
    `SELECT type, remaining_amount FROM loans WHERE account_id = ? AND status = 'active'`,
    accountId
  );

  const goals = await all(
    `SELECT current_amount FROM savings_goals WHERE account_id = ? AND is_active = 1`,
    accountId
  );

  let balance = account.opening_balance || 0;

  for (const t of txns) {
    if (t.type === 'income') {
      if (t.account_id === accountId) balance += t.amount;
    } else if (t.type === 'expense') {
      if (t.account_id === accountId) balance -= t.amount;
    } else if (t.type === 'transfer') {
      if (t.account_id === accountId) balance -= t.amount;
      if (t.to_account_id === accountId) balance += t.amount;
    } else if (t.type === 'loan_received') {
      if (t.account_id === accountId) balance += t.amount;
    } else if (t.type === 'loan_given') {
      if (t.account_id === accountId) balance -= t.amount;
    }
  }

  for (const loan of loans) {
    if (loan.type === 'lent') balance -= loan.remaining_amount || 0;
    if (loan.type === 'borrowed') balance += loan.remaining_amount || 0;
  }

  for (const goal of goals) {
    balance -= goal.current_amount || 0;
  }

  balance = Math.round(balance * 100) / 100;
  await run('UPDATE accounts SET current_balance = ?, updated_at = ? WHERE id = ?',
    balance, new Date().toISOString(), accountId);

  return balance;
}

export async function recomputeAllBalances() {
  const accounts = await all('SELECT id FROM accounts');
  for (const a of accounts) {
    await recomputeAccountBalance(a.id);
  }
}
