import { $, $$, formatCurrency, formatDate, today } from '../utils.js';
import { api } from '../api.js';
import { openModal, closeModal } from '../app.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm loan-filter active" data-type="">All Loans</button>
        <button class="btn btn-secondary btn-sm loan-filter" data-type="lent">Money Lent</button>
        <button class="btn btn-secondary btn-sm loan-filter" data-type="borrowed">Money Borrowed</button>
      </div>
      <button class="btn btn-primary" id="addLoanBtn"><i class="fas fa-plus"></i> New Loan</button>
    </div>
    <div class="stats-grid" id="loanStats"></div>
    <div id="loansList"><div class="empty-state"><i class="fas fa-hand-holding-usd"></i><h3>Loading loans...</h3></div></div>
  `;

  let currentType = '';

  document.querySelectorAll('.loan-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.loan-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      loadLoans(currentType);
    });
  });

  document.getElementById('addLoanBtn').addEventListener('click', showLoanForm);

  await loadLoans();
}

async function loadLoans(type = '') {
  try {
    const params = {};
    if (type) params.type = type;
    const loans = await api.getLoans(params);

    const totalLent = loans.filter((l) => l.type === 'lent').reduce((s, l) => s + l.remainingAmount, 0);
    const totalBorrowed = loans.filter((l) => l.type === 'borrowed').reduce((s, l) => s + l.remainingAmount, 0);
    const totalLentPaid = loans.filter((l) => l.type === 'lent').reduce((s, l) => s + l.paidAmount, 0);

    document.getElementById('loanStats').innerHTML = `
      <div class="stats-card"><div class="card-icon" style="background:var(--success-light);color:var(--success)"><i class="fas fa-hand-holding-usd"></i></div><div class="stats-info"><div class="stats-label">Total Lent</div><div class="stats-value">${formatCurrency(totalLent)}</div><div class="stats-sub">Received: ${formatCurrency(totalLentPaid)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--danger-light);color:var(--danger)"><i class="fas fa-hand-holding-usd"></i></div><div class="stats-info"><div class="stats-label">Total Borrowed</div><div class="stats-value">${formatCurrency(totalBorrowed)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--info-light);color:var(--info)"><i class="fas fa-users"></i></div><div class="stats-info"><div class="stats-label">Active Loans</div><div class="stats-value">${loans.filter((l) => l.status === 'active').length}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--warning-light);color:var(--warning)"><i class="fas fa-check-circle"></i></div><div class="stats-info"><div class="stats-label">Settled Loans</div><div class="stats-value">${loans.filter((l) => l.status === 'paid').length}</div></div></div>
    `;

    const list = document.getElementById('loansList');

    if (loans.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-hand-holding-usd"></i><h3>No loans found</h3></div>`;
      return;
    }

    list.innerHTML = `<div class="table-container"><table><thead><tr>
      <th>Person</th><th>Type</th><th>Amount</th><th>Paid</th><th>Remaining</th><th>Status</th><th>Due Date</th><th></th>
    </tr></thead><tbody>${loans.map((l) => `
      <tr>
        <td><div class="table-cell-icon"><div class="cell-info"><div class="cell-name">${l.person_name}</div>${l.person_phone ? '<div class="cell-sub">' + l.person_phone + '</div>' : ''}</div></div></td>
        <td><span class="badge ${l.type === 'lent' ? 'badge-warning' : 'badge-info'}">${l.type === 'lent' ? 'Lent' : 'Borrowed'}</span></td>
        <td class="table-amount">${formatCurrency(l.amount)}</td>
        <td class="table-amount">${formatCurrency(l.paidAmount)}</td>
        <td class="table-amount expense">${formatCurrency(l.remainingAmount)}</td>
        <td><span class="badge ${l.status === 'active' ? 'badge-warning' : 'badge-success'}">${l.status}</span></td>
        <td>${l.due_date ? formatDate(l.due_date) : '-'}</td>
        <td>
          <div class="table-actions">
            <button class="btn-icon btn-ghost pay-loan" data-id="${l.id}" title="Add Payment"><i class="fas fa-money-bill"></i></button>
            <button class="btn-icon btn-ghost edit-loan" data-id="${l.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-ghost delete-loan" data-id="${l.id}" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('')}</tbody></table></div>`;

    list.querySelectorAll('.edit-loan').forEach((btn) => {
      btn.addEventListener('click', () => showLoanForm(btn.dataset.id));
    });
    list.querySelectorAll('.pay-loan').forEach((btn) => {
      btn.addEventListener('click', () => showPaymentForm(btn.dataset.id));
    });
    list.querySelectorAll('.delete-loan').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this loan and all payments?')) {
          try {
            await api.deleteLoan(btn.dataset.id);
            showToast('Loan deleted', 'success');
            await loadLoans(currentType);
          } catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

  } catch (err) {
    document.getElementById('loansList').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`;
  }
}

async function showLoanForm(id = null) {
  let loan = { type: 'lent', personName: '', personPhone: '', amount: 0, notes: '', dueDate: '' };

  if (id) {
    try { loan = await api.getLoan(id); } catch (err) { showToast(err.message, 'error'); return; }
  }

  openModal({
    title: id ? 'Edit Loan' : 'New Loan',
    body: `
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="form-select" id="loanType">
            <option value="lent" ${loan.type === 'lent' ? 'selected' : ''}>I Lent Money</option>
            <option value="borrowed" ${loan.type === 'borrowed' ? 'selected' : ''}>I Borrowed Money</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input class="form-input" id="loanAmount" type="number" value="${loan.amount}" step="0.01" min="0" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Person Name</label>
          <input class="form-input" id="loanPerson" value="${loan.person_name}" placeholder="Full name" />
        </div>
        <div class="form-group">
          <label class="form-label">Phone (optional)</label>
          <input class="form-input" id="loanPhone" value="${loan.person_phone || ''}" placeholder="Phone number" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Due Date (optional)</label>
        <input class="form-input" id="loanDueDate" type="date" value="${loan.due_date || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="loanNotes">${loan.notes || ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveLoanBtn">${id ? 'Update' : 'Create'}</button>
    `,
  });

  document.getElementById('saveLoanBtn').addEventListener('click', async () => {
    const data = {
      type: document.getElementById('loanType').value,
      amount: parseFloat(document.getElementById('loanAmount').value),
      personName: document.getElementById('loanPerson').value.trim(),
      personPhone: document.getElementById('loanPhone').value.trim() || null,
      dueDate: document.getElementById('loanDueDate').value || null,
      notes: document.getElementById('loanNotes').value.trim() || null,
    };

    if (!data.personName) { showToast('Person name is required', 'error'); return; }
    if (!data.amount || data.amount <= 0) { showToast('Amount must be positive', 'error'); return; }

    try {
      if (id) {
        await api.updateLoan(id, data);
        showToast('Loan updated', 'success');
      } else {
        await api.createLoan(data);
        showToast('Loan created', 'success');
      }
      closeModal();
      await loadLoans();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function showPaymentForm(loanId) {
  const loan = await api.getLoan(loanId);

  openModal({
    title: `Add Payment - ${loan.person_name}`,
    body: `
      <div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm)">
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <span>Total Amount:</span><span style="font-weight:600">${formatCurrency(loan.amount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:4px">
          <span>Remaining:</span><span style="font-weight:600;color:var(--danger)">${formatCurrency(loan.remainingAmount)}</span>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Payment Amount</label>
          <input class="form-input" id="paymentAmount" type="number" step="0.01" min="0" max="${loan.remainingAmount}" placeholder="Amount" />
        </div>
        <div class="form-group">
          <label class="form-label">Date</label>
          <input class="form-input" id="paymentDate" type="date" value="${today()}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="paymentNotes" placeholder="Payment notes"></textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-success" id="savePaymentBtn">Add Payment</button>
    `,
  });

  document.getElementById('savePaymentBtn').addEventListener('click', async () => {
    const data = {
      amount: parseFloat(document.getElementById('paymentAmount').value),
      date: document.getElementById('paymentDate').value,
      notes: document.getElementById('paymentNotes').value.trim() || null,
    };

    if (!data.amount || data.amount <= 0) { showToast('Enter a valid amount', 'error'); return; }

    try {
      await api.addLoanPayment(loanId, data);
      showToast('Payment added', 'success');
      closeModal();
      await loadLoans();
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
