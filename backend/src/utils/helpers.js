export function now() {
  return new Date().toISOString();
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function generateId() {
  return crypto.randomUUID();
}

export function calculateBalance(transactions) {
  return transactions.reduce((acc, t) => {
    if (t.type === 'income' || t.type === 'loan_received') return acc + t.amount;
    if (t.type === 'expense' || t.type === 'loan_given') return acc - t.amount;
    if (t.type === 'transfer') return acc;
    return acc;
  }, 0);
}

export function paginate(page = 1, limit = 50) {
  const offset = (page - 1) * limit;
  return { offset, limit };
}

export function dateRange(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date(0);
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}
