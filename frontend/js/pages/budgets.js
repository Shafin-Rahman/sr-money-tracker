import { $, $$, formatCurrency, formatDate, today, currentMonth } from '../utils.js';
import { api } from '../api.js';
import { openModal, closeModal } from '../app.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:600">Budgets</h2>
      <button class="btn btn-primary" id="addBudgetBtn"><i class="fas fa-plus"></i> New Budget</button>
    </div>
    <div id="budgetsList"><div class="empty-state"><i class="fas fa-chart-line"></i><h3>Loading budgets...</h3></div></div>
  `;

  document.getElementById('addBudgetBtn').addEventListener('click', showBudgetForm);

  await loadBudgets();
}

async function loadBudgets() {
  try {
    const budgets = await api.getBudgets();
    const list = document.getElementById('budgetsList');

    if (budgets.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-chart-line"></i><h3>No budgets set</h3><p>Create a budget to track your spending limits</p></div>`;
      return;
    }

    list.innerHTML = `<div class="stats-grid">${budgets.map((b) => {
      const pct = b.percentage || 0;
      const isOver = pct > 100;
      const isWarning = pct >= 80 && pct <= 100;
      const barColor = isOver ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--success)';

      return `
        <div class="card">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
            <div>
              <div style="font-weight:600;font-size:16px">${b.category_name || 'Overall'}</div>
              <div style="font-size:13px;color:var(--text-secondary)">${b.period}</div>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn-icon btn-ghost edit-budget" data-id="${b.id}"><i class="fas fa-edit"></i></button>
              <button class="btn-icon btn-ghost delete-budget" data-id="${b.id}" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px">
            <span>Spent: <strong>${formatCurrency(b.spent)}</strong></span>
            <span>Budget: <strong>${formatCurrency(b.amount)}</strong></span>
            <span style="color:${barColor}"><strong>${pct}%</strong></span>
          </div>
          <div style="height:8px;background:var(--bg-tertiary);border-radius:4px;overflow:hidden">
            <div style="height:100%;width:${Math.min(pct, 100)}%;background:${barColor};border-radius:4px;transition:width 0.5s ease"></div>
          </div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px">
            <span style="color:${b.remaining < 0 ? 'var(--danger)' : 'var(--text-secondary)'}">Remaining: ${formatCurrency(b.remaining)}</span>
            <span style="color:var(--text-tertiary)">${formatDate(b.startDate)} - ${b.endDate ? formatDate(b.endDate) : 'Ongoing'}</span>
          </div>
        </div>
      `;
    }).join('')}</div>`;

    list.querySelectorAll('.edit-budget').forEach((btn) => {
      btn.addEventListener('click', () => showBudgetForm(btn.dataset.id));
    });
    list.querySelectorAll('.delete-budget').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this budget?')) {
          try { await api.deleteBudget(btn.dataset.id); showToast('Budget deleted', 'success'); await loadBudgets(); }
          catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

  } catch (err) {
    document.getElementById('budgetsList').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`;
  }
}

async function showBudgetForm(id = null) {
  let budget = { categoryId: '', amount: 0, period: 'monthly', startDate: today(), endDate: '' };

  if (id) {
    try { budget = await api.getBudgets().then((b) => b.find((x) => x.id === id)); } catch (err) { showToast(err.message, 'error'); return; }
  }

  const { categories } = await api.getCategories();

  openModal({
    title: id ? 'Edit Budget' : 'New Budget',
    body: `
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-select" id="budgetCategory">
          <option value="">Overall Budget (All Categories)</option>
          ${categories.filter((c) => !c.parent_id && c.type === 'expense').map((c) => `
            <optgroup label="${c.name}">
              ${categories.filter((sc) => sc.parent_id === c.id).map((sc) =>
                `<option value="${sc.id}" ${sc.id === budget.categoryId ? 'selected' : ''}>${sc.name}</option>`
              ).join('')}
            </optgroup>
          `).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Budget Amount</label>
          <input class="form-input" id="budgetAmount" type="number" value="${budget.amount}" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Period</label>
          <select class="form-select" id="budgetPeriod">
            <option value="daily" ${budget.period === 'daily' ? 'selected' : ''}>Daily</option>
            <option value="weekly" ${budget.period === 'weekly' ? 'selected' : ''}>Weekly</option>
            <option value="monthly" ${budget.period === 'monthly' ? 'selected' : ''}>Monthly</option>
            <option value="yearly" ${budget.period === 'yearly' ? 'selected' : ''}>Yearly</option>
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Start Date</label>
        <input class="form-input" id="budgetStart" type="date" value="${budget.start_date || today()}" />
      </div>
      <div class="form-group">
        <label class="form-label">End Date (optional)</label>
        <input class="form-input" id="budgetEnd" type="date" value="${budget.end_date || ''}" />
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveBudgetBtn">${id ? 'Update' : 'Create'}</button>
    `,
  });

  document.getElementById('saveBudgetBtn').addEventListener('click', async () => {
    const data = {
      categoryId: document.getElementById('budgetCategory').value || null,
      amount: parseFloat(document.getElementById('budgetAmount').value),
      period: document.getElementById('budgetPeriod').value,
      startDate: document.getElementById('budgetStart').value,
      endDate: document.getElementById('budgetEnd').value || null,
    };

    if (!data.amount || data.amount <= 0) { showToast('Enter a valid budget amount', 'error'); return; }

    try {
      if (id) { await api.updateBudget(id, data); showToast('Budget updated', 'success'); }
      else { await api.createBudget(data); showToast('Budget created', 'success'); }
      closeModal();
      await loadBudgets();
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
