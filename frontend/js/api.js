import { API_BASE } from './config.js';

async function request(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      throw new Error('Cannot connect to server. Please make sure the backend is running.');
    }
    throw err;
  }
}

export const api = {
  // Dashboard
  getDashboardSummary() {
    return request('/dashboard/summary');
  },
  getMonthlyStats(year) {
    return request(`/dashboard/monthly?year=${year || new Date().getFullYear()}`);
  },

  // Accounts
  getAccounts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/accounts${query ? '?' + query : ''}`);
  },
  getAccount(id) {
    return request(`/accounts/${id}`);
  },
  createAccount(data) {
    return request('/accounts', { method: 'POST', body: data });
  },
  updateAccount(id, data) {
    return request(`/accounts/${id}`, { method: 'PUT', body: data });
  },
  deleteAccount(id) {
    return request(`/accounts/${id}`, { method: 'DELETE' });
  },
  getAccountBalance() {
    return request('/accounts/balance');
  },

  // Categories
  getCategories(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/categories${query ? '?' + query : ''}`);
  },
  getCategory(id) {
    return request(`/categories/${id}`);
  },
  createCategory(data) {
    return request('/categories', { method: 'POST', body: data });
  },
  updateCategory(id, data) {
    return request(`/categories/${id}`, { method: 'PUT', body: data });
  },
  deleteCategory(id) {
    return request(`/categories/${id}`, { method: 'DELETE' });
  },
  mergeCategories(data) {
    return request('/categories/merge', { method: 'POST', body: data });
  },

  // Transactions
  getTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/transactions${query ? '?' + query : ''}`);
  },
  getTransaction(id) {
    return request(`/transactions/${id}`);
  },
  createTransaction(data) {
    return request('/transactions', { method: 'POST', body: data });
  },
  updateTransaction(id, data) {
    return request(`/transactions/${id}`, { method: 'PUT', body: data });
  },
  deleteTransaction(id) {
    return request(`/transactions/${id}`, { method: 'DELETE' });
  },
  duplicateTransaction(id) {
    return request(`/transactions/${id}/duplicate`, { method: 'POST' });
  },

  // Loans
  getLoans(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/loans${query ? '?' + query : ''}`);
  },
  getLoan(id) {
    return request(`/loans/${id}`);
  },
  createLoan(data) {
    return request('/loans', { method: 'POST', body: data });
  },
  updateLoan(id, data) {
    return request(`/loans/${id}`, { method: 'PUT', body: data });
  },
  deleteLoan(id) {
    return request(`/loans/${id}`, { method: 'DELETE' });
  },
  addLoanPayment(id, data) {
    return request(`/loans/${id}/payments`, { method: 'POST', body: data });
  },

  // Tags
  getTags() {
    return request('/tags');
  },
  createTag(data) {
    return request('/tags', { method: 'POST', body: data });
  },
  updateTag(id, data) {
    return request(`/tags/${id}`, { method: 'PUT', body: data });
  },
  deleteTag(id) {
    return request(`/tags/${id}`, { method: 'DELETE' });
  },

  // Budgets
  getBudgets(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/budgets${query ? '?' + query : ''}`);
  },
  createBudget(data) {
    return request('/budgets', { method: 'POST', body: data });
  },
  updateBudget(id, data) {
    return request(`/budgets/${id}`, { method: 'PUT', body: data });
  },
  deleteBudget(id) {
    return request(`/budgets/${id}`, { method: 'DELETE' });
  },

  // Reports
  getReports(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/reports${query ? '?' + query : ''}`);
  },

  // Settings
  getSettings() {
    return request('/settings');
  },
  updateSetting(key, value) {
    return request('/settings', { method: 'PUT', body: { key, value } });
  },

  // Search
  search(query) {
    return request(`/search?q=${encodeURIComponent(query)}`);
  },

  // Savings Goals
  getSavingsGoals() {
    return request('/savings');
  },
  getSavingsGoal(id) {
    return request(`/savings/${id}`);
  },
  createSavingsGoal(data) {
    return request('/savings', { method: 'POST', body: data });
  },
  updateSavingsGoal(id, data) {
    return request(`/savings/${id}`, { method: 'PUT', body: data });
  },
  deleteSavingsGoal(id) {
    return request(`/savings/${id}`, { method: 'DELETE' });
  },
  addSavingsFunds(id, data) {
    return request(`/savings/${id}/funds`, { method: 'POST', body: data });
  },

  // Recurring Bills
  getRecurringBills() {
    return request('/recurring');
  },
  getRecurringBill(id) {
    return request(`/recurring/${id}`);
  },
  createRecurringBill(data) {
    return request('/recurring', { method: 'POST', body: data });
  },
  updateRecurringBill(id, data) {
    return request(`/recurring/${id}`, { method: 'PUT', body: data });
  },
  deleteRecurringBill(id) {
    return request(`/recurring/${id}`, { method: 'DELETE' });
  },

  // Custom Fields
  getCustomFields() {
    return request('/custom-fields');
  },
  createCustomField(data) {
    return request('/custom-fields', { method: 'POST', body: data });
  },
  updateCustomField(id, data) {
    return request(`/custom-fields/${id}`, { method: 'PUT', body: data });
  },
  deleteCustomField(id) {
    return request(`/custom-fields/${id}`, { method: 'DELETE' });
  },
  getTransactionCustomFields(transactionId) {
    return request(`/custom-fields/transactions/${transactionId}`);
  },
  setTransactionCustomFields(transactionId, data) {
    return request(`/custom-fields/transactions/${transactionId}`, { method: 'POST', body: data });
  },

  // Export
  exportTransactionsCSV(params = {}) {
    const query = new URLSearchParams(params).toString();
    return request(`/export/csv${query ? '?' + query : ''}`);
  },
  exportAccountsCSV() {
    return request('/export/csv/accounts');
  },
  exportJSON() {
    return request('/export/json');
  },

  // PIN Lock
  getPinStatus() {
    return request('/pin-lock/status');
  },
  setupPin(pin) {
    return request('/pin-lock/setup', { method: 'POST', body: { pin } });
  },
  updatePin(oldPin, newPin) {
    return request('/pin-lock/update', { method: 'PUT', body: { oldPin, newPin } });
  },
  verifyPin(pin) {
    return request('/pin-lock/verify', { method: 'POST', body: { pin } });
  },
  disablePin(pin) {
    return request('/pin-lock/disable', { method: 'POST', body: { pin } });
  },
  updateAutoLock(minutes) {
    return request('/pin-lock/auto-lock', { method: 'PUT', body: { minutes } });
  },

  // Backup
  exportData() {
    return request('/backup/export');
  },
  importData(data) {
    return request('/backup/import', { method: 'POST', body: data });
  },
};
