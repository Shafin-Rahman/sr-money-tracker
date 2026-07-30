import { $, $$, formatCurrency, formatDate, formatTime, today, currentTime, currentMonth } from '../utils.js';
import { api } from '../api.js';
import { openModal, closeModal, signalRefresh } from '../app.js';

let currentFilter = { page: 1, limit: 50 };

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm filter-btn active" data-type="">All</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-type="income">Income</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-type="expense">Expense</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-type="transfer">Transfer</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-type="loan_received">Loan In</button>
        <button class="btn btn-secondary btn-sm filter-btn" data-type="loan_given">Loan Out</button>
      </div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="txnStartDate" type="date" style="width:160px" />
        <input class="form-input" id="txnEndDate" type="date" style="width:160px" />
        <button class="btn btn-primary" id="addTxnBtn"><i class="fas fa-plus"></i> Add Transaction</button>
      </div>
    </div>
    <div id="transactionsList"><div class="empty-state"><i class="fas fa-exchange-alt"></i><h3>Loading transactions...</h3></div></div>
    <div id="txnPagination" style="display:flex;justify-content:center;gap:8px;margin-top:16px"></div>
  `;

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter.type = btn.dataset.type || undefined;
      currentFilter.page = 1;
      loadTransactions();
    });
  });

  document.getElementById('txnStartDate').addEventListener('change', () => {
    currentFilter.startDate = document.getElementById('txnStartDate').value || undefined;
    currentFilter.page = 1;
    loadTransactions();
  });

  document.getElementById('txnEndDate').addEventListener('change', () => {
    currentFilter.endDate = document.getElementById('txnEndDate').value || undefined;
    currentFilter.page = 1;
    loadTransactions();
  });

  document.getElementById('addTxnBtn').addEventListener('click', () => showTransactionForm());

  await loadTransactions();
}

async function loadTransactions() {
  try {
    const params = { ...currentFilter };
    Object.keys(params).forEach((k) => { if (!params[k]) delete params[k]; });

    const data = await api.getTransactions(params);
    const list = document.getElementById('transactionsList');

    if (data.transactions.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-exchange-alt"></i><h3>No transactions found</h3></div>`;
      document.getElementById('txnPagination').innerHTML = '';
      return;
    }

    list.innerHTML = `<div class="table-container"><table><thead><tr>
      <th>Date</th><th>Type</th><th>Description</th><th>Category</th><th>Account</th><th style="text-align:right">Amount</th><th></th>
    </tr></thead><tbody>${data.transactions.map((t) => `
      <tr>
        <td>${formatDate(t.date)}${t.time ? '<br><span style="font-size:11px;color:var(--text-tertiary)">' + formatTime(t.time) + '</span>' : ''}</td>
        <td><span class="badge ${t.type === 'income' ? 'badge-success' : t.type === 'expense' ? 'badge-danger' : 'badge-info'}">${t.type.replace('_', ' ')}</span></td>
        <td><div class="table-cell-icon">
          <div class="cell-icon" style="background:${t.category_color || '#6366f1'}22;color:${t.category_color || '#6366f1'}">
            <i class="fas fa-${t.category_icon || 'circle'}"></i>
          </div>
          <div class="cell-info">
            <div class="cell-name">${t.description || 'No description'}</div>
            ${t.person_name ? '<div class="cell-sub">' + t.person_name + '</div>' : ''}
          </div>
        </div></td>
        <td>${t.category_name || '-'}</td>
        <td>${t.account_name || '-'}${t.to_account_name ? ' → ' + t.to_account_name : ''}</td>
        <td class="table-amount ${t.type === 'income' || t.type === 'loan_received' ? 'income' : 'expense'}">
          ${t.type === 'income' || t.type === 'loan_received' ? '+' : '-'}${formatCurrency(t.amount)}
        </td>
        <td>
          <div class="table-actions">
            <button class="btn-icon btn-ghost edit-txn" data-id="${t.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-ghost duplicate-txn" data-id="${t.id}" title="Duplicate"><i class="fas fa-copy"></i></button>
            <button class="btn-icon btn-ghost delete-txn" data-id="${t.id}" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('')}</tbody></table></div>`;

    // Pagination
    const totalPages = Math.ceil(data.total / data.limit);
    const pagination = document.getElementById('txnPagination');
    if (totalPages > 1) {
      pagination.innerHTML = Array.from({ length: totalPages }, (_, i) => `
        <button class="btn btn-${i + 1 === data.page ? 'primary' : 'secondary'} btn-sm page-btn" data-page="${i + 1}">${i + 1}</button>
      `).join('');
      pagination.querySelectorAll('.page-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          currentFilter.page = parseInt(btn.dataset.page);
          loadTransactions();
        });
      });
    }

    // Event handlers
    list.querySelectorAll('.edit-txn').forEach((btn) => {
      btn.addEventListener('click', () => showTransactionForm(btn.dataset.id));
    });
    list.querySelectorAll('.duplicate-txn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.duplicateTransaction(btn.dataset.id);
          signalRefresh();
          showToast('Transaction duplicated', 'success');
          await loadTransactions();
        } catch (err) { showToast(err.message, 'error'); }
      });
    });
    list.querySelectorAll('.delete-txn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Remove this transaction?')) {
          try {
            await api.deleteTransaction(btn.dataset.id);
            signalRefresh();
            showToast('Transaction removed', 'success');
            await loadTransactions();
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

  } catch (err) {
    document.getElementById('transactionsList').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`;
  }
}

async function showTransactionForm(id = null) {
  let txn = { type: 'expense', amount: 0, accountId: '', categoryId: '', description: '', date: today(), time: currentTime(), notes: '', tags: [] };

  if (id) {
    try {
      txn = await api.getTransaction(id);
    } catch (err) { showToast(err.message, 'error'); return; }
  }

  const [accounts, categories] = await Promise.all([
    api.getAccounts(),
    api.getCategories({ include_archived: 'true' }),
  ]);

  const typeOptions = ['income', 'expense', 'transfer', 'loan_received', 'loan_given'];

  openModal({
    title: id ? 'Edit Transaction' : 'New Transaction',
    body: `
      <div class="form-group">
        <label class="form-label">Type</label>
        <select class="form-select" id="txnType">
          ${typeOptions.map((t) => `<option value="${t}" ${t === txn.type ? 'selected' : ''}>${t.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase())}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input class="form-input" id="txnAmount" type="number" value="${txn.amount}" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" id="txnDate" type="date" value="${txn.date}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Time</label>
          <input class="form-input" id="txnTime" type="time" value="${txn.time || currentTime()}" />
        </div>
        <div class="form-group">
          <label class="form-label">Account</label>
          <select class="form-select" id="txnAccount">
            <option value="">Select account</option>
            ${accounts.map((a) => `<option value="${a.id}" ${a.id === txn.accountId ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group" id="toAccountGroup" style="display:${txn.type === 'transfer' ? 'block' : 'none'}">
        <label class="form-label">To Account</label>
        <select class="form-select" id="txnToAccount">
          <option value="">Select account</option>
          ${accounts.map((a) => `<option value="${a.id}" ${a.id === txn.toAccountId ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="categoryGroup" style="display:${txn.type === 'transfer' ? 'none' : 'block'}">
        <label class="form-label">Category</label>
        <select class="form-select" id="txnCategory">
          <option value="">Select category</option>
          ${categories.categories.filter((c) => !c.parent_id).map((c) => `
            <optgroup label="${c.name}">
              ${categories.categories.filter((sc) => sc.parent_id === c.id).map((sc) =>
                `<option value="${sc.id}" ${sc.id === txn.categoryId || (c.id === txn.categoryId) ? 'selected' : ''}>${sc.name}</option>`
              ).join('')}
              <option value="${c.id}" ${c.id === txn.categoryId ? 'selected' : ''}>${c.name} (General)</option>
            </optgroup>
          `).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" id="txnDescription" value="${txn.description || ''}" placeholder="What was this for?" />
      </div>
      <div class="form-group">
        <label class="form-label">Person (for loans/payments)</label>
        <input class="form-input" id="txnPerson" value="${txn.person_name || ''}" placeholder="Person name" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="txnNotes">${txn.notes || ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveTxnBtn">${id ? 'Update' : 'Create'}</button>
    `,
  });

  document.getElementById('txnType').addEventListener('change', () => {
    const type = document.getElementById('txnType').value;
    document.getElementById('toAccountGroup').style.display = type === 'transfer' ? 'block' : 'none';
    document.getElementById('categoryGroup').style.display = type === 'transfer' ? 'none' : 'block';
  });

  document.getElementById('saveTxnBtn').addEventListener('click', async () => {
    const data = {
      type: document.getElementById('txnType').value,
      amount: parseFloat(document.getElementById('txnAmount').value),
      accountId: document.getElementById('txnAccount').value,
      toAccountId: document.getElementById('txnToAccount').value || null,
      categoryId: document.getElementById('txnCategory').value || null,
      description: document.getElementById('txnDescription').value.trim() || null,
      personName: document.getElementById('txnPerson').value.trim() || null,
      notes: document.getElementById('txnNotes').value.trim() || null,
      date: document.getElementById('txnDate').value,
      time: document.getElementById('txnTime').value || null,
    };

    if (!data.amount || data.amount <= 0) { showToast('Amount must be positive', 'error'); return; }
    if (!data.accountId) { showToast('Please select an account', 'error'); return; }

    try {
      if (id) {
        await api.updateTransaction(id, data);
        showToast('Transaction updated', 'success');
      } else {
        await api.createTransaction(data);
        showToast('Transaction created', 'success');
      }
      signalRefresh();
      closeModal();
      await loadTransactions();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

window.showTransactionForm = showTransactionForm;
