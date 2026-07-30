import { $, $$, formatCurrency, formatDate, today } from '../utils.js';
import { api } from '../api.js';
import { openModal, closeModal } from '../app.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:600">Recurring Bills</h2>
      <button class="btn btn-primary" id="addBillBtn"><i class="fas fa-plus"></i> New Bill</button>
    </div>
    <div class="stats-grid" id="billSummary"></div>
    <div id="billsList"><div class="empty-state"><i class="fas fa-calendar-repeat"></i><h3>Loading bills...</h3></div></div>
  `;

  document.getElementById('addBillBtn').addEventListener('click', showBillForm);
  await loadBills();
}

async function loadBills() {
  try {
    const bills = await api.getRecurringBills();
    const totalMonthly = bills.reduce((s, b) => {
      if (b.interval === 'monthly') return s + b.amount;
      if (b.interval === 'weekly') return s + b.amount * 4.33;
      if (b.interval === 'yearly') return s + b.amount / 12;
      if (b.interval === 'daily') return s + b.amount * 30;
      return s;
    }, 0);
    const upcoming = bills.filter((b) => b.is_active).length;

    document.getElementById('billSummary').innerHTML = `
      <div class="stats-card"><div class="card-icon" style="background:var(--danger-light);color:var(--danger)"><i class="fas fa-calendar-alt"></i></div><div class="stats-info"><div class="stats-label">Monthly Total</div><div class="stats-value">${formatCurrency(totalMonthly)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--info-light);color:var(--info)"><i class="fas fa-clock"></i></div><div class="stats-info"><div class="stats-label">Active Bills</div><div class="stats-value">${upcoming}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--warning-light);color:var(--warning)"><i class="fas fa-repeat"></i></div><div class="stats-info"><div class="stats-label">Total Bills</div><div class="stats-value">${bills.length}</div></div></div>
    `;

    const list = document.getElementById('billsList');
    if (bills.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-repeat"></i><h3>No recurring bills</h3><p>Add a recurring bill to track regular payments</p></div>`;
      return;
    }

    list.innerHTML = `<div class="table-container"><table><thead><tr>
      <th>Name</th><th>Amount</th><th>Interval</th><th>Next Due</th><th>Category</th><th>Account</th><th>Status</th><th></th>
    </tr></thead><tbody>${bills.map((b) => {
      const isOverdue = b.next_date && b.next_date < today();
      return `<tr>
        <td><div class="table-cell-icon"><div class="cell-info"><div class="cell-name">${b.name}</div></div></div></td>
        <td class="table-amount expense">${formatCurrency(b.amount)}</td>
        <td><span class="badge badge-info">${b.interval}</span></td>
        <td style="color:${isOverdue ? 'var(--danger)' : 'inherit'};font-weight:${isOverdue ? '600' : '400'}">${formatDate(b.next_date)}${isOverdue ? ' (Overdue!)' : ''}</td>
        <td>${b.category_name || '-'}</td>
        <td>${b.account_name || '-'}</td>
        <td><span class="badge ${b.is_active ? 'badge-success' : 'badge-warning'}">${b.is_active ? 'Active' : 'Paused'}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn-icon btn-ghost edit-bill" data-id="${b.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-ghost delete-bill" data-id="${b.id}" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody></table></div>`;

    list.querySelectorAll('.edit-bill').forEach((btn) => btn.addEventListener('click', () => showBillForm(btn.dataset.id)));
    list.querySelectorAll('.delete-bill').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this recurring bill?')) {
          try { await api.deleteRecurringBill(btn.dataset.id); showToast('Bill deleted', 'success'); await loadBills(); }
          catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

  } catch (err) {
    document.getElementById('billsList').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`;
  }
}

async function showBillForm(id = null) {
  let bill = { name: '', amount: 0, categoryId: '', accountId: '', interval: 'monthly', dayOfMonth: 1, startDate: today(), endDate: '', notes: '' };
  if (id) {
    try { bill = await api.getRecurringBill(id); } catch (err) { showToast(err.message, 'error'); return; }
  }

  const [accounts, { categories }] = await Promise.all([api.getAccounts(), api.getCategories()]);

  openModal({
    title: id ? 'Edit Bill' : 'New Recurring Bill',
    body: `
      <div class="form-group">
        <label class="form-label">Bill Name</label>
        <input class="form-input" id="billName" value="${bill.name}" placeholder="e.g. House Rent, Netflix" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input class="form-input" id="billAmount" type="number" value="${bill.amount}" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Interval</label>
          <select class="form-select" id="billInterval">
            <option value="daily" ${bill.interval === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${bill.interval === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="monthly" ${bill.interval === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="yearly" ${bill.interval === 'yearly' ? 'selected' : ''}>Yearly</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Day of Month</label>
          <input class="form-input" id="billDay" type="number" value="${bill.day_of_month || 1}" min="1" max="31" />
        </div>
        <div class="form-group">
          <label class="form-label">Category</label>
          <select class="form-select" id="billCategory">
            <option value="">None</option>
            ${categories.filter((c) => c.type === 'expense' && !c.parent_id).map((c) => `
              <optgroup label="${c.name}">
                ${categories.filter((sc) => sc.parent_id === c.id).map((sc) =>
                  `<option value="${sc.id}" ${sc.id === bill.categoryId ? 'selected' : ''}>${sc.name}</option>`
                ).join('')}
              </optgroup>
            `).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Account</label>
          <select class="form-select" id="billAccount">
            <option value="">None</option>
            ${accounts.map((a) => `<option value="${a.id}" ${a.id === bill.accountId ? 'selected' : ''}>${a.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Start Date</label>
          <input class="form-input" id="billStart" type="date" value="${bill.start_date || today()}" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">End Date (optional)</label>
        <input class="form-input" id="billEnd" type="date" value="${bill.end_date || ''}" />
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="billNotes">${bill.notes || ''}</textarea>
      </div>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="saveBillBtn">${id ? 'Update' : 'Create'}</button>`,
  });

  document.getElementById('saveBillBtn').addEventListener('click', async () => {
    const data = {
      name: document.getElementById('billName').value.trim(),
      amount: parseFloat(document.getElementById('billAmount').value),
      interval: document.getElementById('billInterval').value,
      dayOfMonth: parseInt(document.getElementById('billDay').value) || 1,
      categoryId: document.getElementById('billCategory').value || null,
      accountId: document.getElementById('billAccount').value || null,
      startDate: document.getElementById('billStart').value,
      endDate: document.getElementById('billEnd').value || null,
      notes: document.getElementById('billNotes').value.trim() || null,
    };
    if (!data.name) { showToast('Bill name is required', 'error'); return; }
    if (!data.amount || data.amount <= 0) { showToast('Amount must be positive', 'error'); return; }

    try {
      if (id) { await api.updateRecurringBill(id, data); showToast('Bill updated', 'success'); }
      else { await api.createRecurringBill(data); showToast('Bill created', 'success'); }
      closeModal(); await loadBills();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function showToast(m, t = 'info') {
  const c = document.getElementById('toastContainer');
  const toast = document.createElement('div'); toast.className = `toast toast-${t}`; toast.textContent = m;
  c.appendChild(toast); setTimeout(() => toast.remove(), 3000);
}
