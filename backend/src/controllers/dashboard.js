import { getSqlite } from '../db/index.js';
import { today } from '../utils/helpers.js';

export function getSummary(req, res) {
  const db = getSqlite();
  const currentDate = today();
  const currentMonth = currentDate.substring(0, 7);

  const totalBalance = db.prepare('SELECT COALESCE(SUM(current_balance), 0) as total FROM accounts WHERE is_archived = 0').get();

  const todayIncome = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date = ? AND is_removed = 0").get(currentDate);
  const todayExpense = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date = ? AND is_removed = 0").get(currentDate);

  const monthlyIncome = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'income' AND date LIKE ? AND is_removed = 0").get(`${currentMonth}%`);
  const monthlyExpense = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE type = 'expense' AND date LIKE ? AND is_removed = 0").get(`${currentMonth}%`);

  const activeLoans = db.prepare("SELECT COALESCE(SUM(remaining_amount), 0) as lent FROM loans WHERE type = 'lent' AND status = 'active'").get();
  const borrowedLoans = db.prepare("SELECT COALESCE(SUM(remaining_amount), 0) as borrowed FROM loans WHERE type = 'borrowed' AND status = 'active'").get();

  const recentTransactions = db.prepare(`SELECT t.*, a.name as account_name, a.color as account_color,
    c.name as category_name, c.icon as category_icon, c.color as category_color
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.is_removed = 0
    ORDER BY t.date DESC, t.created_at DESC LIMIT 10`).all();

  const upcomingBills = db.prepare("SELECT * FROM recurring_bills WHERE is_active = 1 AND next_date >= ? ORDER BY next_date ASC LIMIT 5").get(currentDate);

  const accountBalances = db.prepare("SELECT id, name, type, icon, color, current_balance FROM accounts WHERE is_archived = 0 ORDER BY sort_order ASC").all();

  res.json({
    totalBalance: totalBalance.total,
    todayIncome: todayIncome.total,
    todayExpense: todayExpense.total,
    todayBalance: todayIncome.total - todayExpense.total,
    monthlyIncome: monthlyIncome.total,
    monthlyExpense: monthlyExpense.total,
    monthlySavings: monthlyIncome.total - monthlyExpense.total,
    netWorth: totalBalance.total - (borrowedLoans.borrowed || 0),
    pendingLoans: activeLoans.lent || 0,
    pendingBorrowed: borrowedLoans.borrowed || 0,
    recentTransactions,
    accountBalances,
    upcomingBills: upcomingBills || [],
    date: currentDate,
  });
}

export function getMonthlyStats(req, res) {
  const db = getSqlite();
  const year = req.query.year || new Date().getFullYear();

  const monthlyData = db.prepare(`
    SELECT
      substr(date, 6, 2) as month,
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense
    FROM transactions
    WHERE date LIKE ? AND is_removed = 0
    GROUP BY substr(date, 6, 2)
    ORDER BY month ASC
  `).all(`${year}-%`);

  const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const result = months.map((m) => {
    const found = monthlyData.find((d) => d.month === m);
    return {
      month: m,
      monthName: new Date(`${year}-${m}-01`).toLocaleString('default', { month: 'short' }),
      income: found ? found.income : 0,
      expense: found ? found.expense : 0,
    };
  });

  res.json(result);
}
