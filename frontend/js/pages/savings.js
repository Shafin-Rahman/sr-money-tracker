import { $, $$, formatCurrency, formatDate, today } from '../utils.js';
import { api } from '../api.js';
import { openModal, closeModal, signalRefresh } from '../app.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:600">Savings Goals</h2>
      <button class="btn btn-primary" id="addGoalBtn"><i class="fas fa-plus"></i> New Goal</button>
    </div>
    <div class="stats-grid" id="savingsSummary"></div>
    <div id="goalsList"><div class="empty-state"><i class="fas fa-piggy-bank"></i><h3>Loading goals...</h3></div></div>
  `;

  document.getElementById('addGoalBtn').addEventListener('click', () => showGoalForm());
  await loadGoals();
}

async function loadGoals() {
  try {
    const goals = await api.getSavingsGoals();
    const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
    const totalSaved = goals.reduce((s, g) => s + g.currentAmount, 0);

    document.getElementById('savingsSummary').innerHTML = `
      <div class="stats-card"><div class="card-icon" style="background:var(--primary-light);color:var(--primary)"><i class="fas fa-bullseye"></i></div><div class="stats-info"><div class="stats-label">Total Target</div><div class="stats-value">${formatCurrency(totalTarget)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--success-light);color:var(--success)"><i class="fas fa-piggy-bank"></i></div><div class="stats-info"><div class="stats-label">Total Saved</div><div class="stats-value">${formatCurrency(totalSaved)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--info-light);color:var(--info)"><i class="fas fa-chart-line"></i></div><div class="stats-info"><div class="stats-label">Progress</div><div class="stats-value">${totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--warning-light);color:var(--warning)"><i class="fas fa-flag-checkered"></i></div><div class="stats-info"><div class="stats-label">Goals</div><div class="stats-value">${goals.length}</div></div></div>
    `;

    const list = document.getElementById('goalsList');
    if (goals.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-piggy-bank"></i><h3>No savings goals yet</h3><p>Set a goal to start saving</p></div>`;
      return;
    }

    list.innerHTML = `<div class="stats-grid">${goals.map((g) => {
      const pct = g.progress || 0;
      const deadlineStr = g.deadline ? `Deadline: ${formatDate(g.deadline)}` : 'No deadline';

      return `<div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:12px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="card-icon" style="width:40px;height:40px;background:${g.color}22;color:${g.color}"><i class="fas fa-${g.icon || 'piggy-bank'}"></i></div>
            <div><div style="font-weight:600;font-size:16px">${g.name}</div><div style="font-size:12px;color:var(--text-tertiary)">${deadlineStr}</div></div>
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn-icon btn-ghost add-funds" data-id="${g.id}" title="Add Funds"><i class="fas fa-coins"></i></button>
            <button class="btn-icon btn-ghost edit-goal" data-id="${g.id}" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn-icon btn-ghost delete-goal" data-id="${g.id}" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:8px">
          <span>Saved: <strong>${formatCurrency(g.currentAmount)}</strong></span>
          <span>Target: <strong>${formatCurrency(g.targetAmount)}</strong></span>
        </div>
        <div style="height:10px;background:var(--bg-tertiary);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${Math.min(pct, 100)}%;background:${g.color};border-radius:5px;transition:width 0.5s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:13px">
          <span style="color:var(--text-secondary)">${pct}% complete</span>
          <span style="color:${g.remaining > 0 ? 'var(--danger)' : 'var(--success)'}">${g.remaining > 0 ? formatCurrency(g.remaining) + ' remaining' : 'Complete!'}</span>
        </div>
      </div>`;
    }).join('')}</div>`;

    list.querySelectorAll('.edit-goal').forEach((btn) => btn.addEventListener('click', () => showGoalForm(btn.dataset.id)));
    list.querySelectorAll('.add-funds').forEach((btn) => btn.addEventListener('click', () => showAddFundsForm(btn.dataset.id)));
    list.querySelectorAll('.delete-goal').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('Delete this savings goal?')) {
          try { await api.deleteSavingsGoal(btn.dataset.id); signalRefresh(); showToast('Goal deleted', 'success'); await loadGoals(); }
          catch (err) { showToast(err.message, 'error'); }
        }
      });
    });

  } catch (err) {
    document.getElementById('goalsList').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`;
  }
}

async function showGoalForm(id = null) {
  let goal = { name: '', targetAmount: 0, currentAmount: 0, accountId: '', deadline: '', icon: 'piggy-bank', color: '#6366f1', notes: '' };
  if (id) {
    try { goal = await api.getSavingsGoal(id); } catch (err) { showToast(err.message, 'error'); return; }
  }

  const accounts = await api.getAccounts();

  const icons = ['piggy-bank', 'gem', 'landmark', 'car', 'home', 'plane', 'graduation-cap', 'heart', 'gift', 'sack-dollar', 'coins', 'fire', 'star', 'rocket', 'umbrella'];

  openModal({
    title: id ? 'Edit Goal' : 'New Savings Goal',
    body: `
      <div class="form-group">
        <label class="form-label">Goal Name</label>
        <input class="form-input" id="goalName" value="${goal.name}" placeholder="e.g. Emergency Fund, New Laptop" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Target Amount</label>
          <input class="form-input" id="goalTarget" type="number" value="${goal.targetAmount}" step="0.01" min="0" />
        </div>
        <div class="form-group">
          <label class="form-label">Current Amount</label>
          <input class="form-input" id="goalCurrent" type="number" value="${goal.currentAmount}" step="0.01" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Link Account (optional)</label>
        <select class="form-select" id="goalAccount">
          <option value="">None</option>
          ${accounts.map((a) => `<option value="${a.id}" ${a.id === goal.accountId ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Deadline (optional)</label>
          <input class="form-input" id="goalDeadline" type="date" value="${goal.deadline || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-picker" id="goalColorPicker">
            ${['#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#14b8a6','#f97316','#06b6d4'].map((c) =>
              `<div class="color-swatch ${c === goal.color ? 'active' : ''}" style="background:${c}" data-color="${c}"></div>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div class="icon-picker" id="goalIconPicker">
          ${icons.map((i) => `<div class="icon-option ${i === goal.icon ? 'active' : ''}" data-icon="${i}"><i class="fas fa-${i}"></i></div>`).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-textarea" id="goalNotes">${goal.notes || ''}</textarea>
      </div>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-primary" id="saveGoalBtn">${id ? 'Update' : 'Create'}</button>`,
  });

  let selColor = goal.color, selIcon = goal.icon;
  document.querySelectorAll('#goalColorPicker .color-swatch').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#goalColorPicker .color-swatch').forEach((s) => s.classList.remove('active'));
      el.classList.add('active'); selColor = el.dataset.color;
    });
  });
  document.querySelectorAll('#goalIconPicker .icon-option').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#goalIconPicker .icon-option').forEach((s) => s.classList.remove('active'));
      el.classList.add('active'); selIcon = el.dataset.icon;
    });
  });

  document.getElementById('saveGoalBtn').addEventListener('click', async () => {
    const data = {
      name: document.getElementById('goalName').value.trim(),
      targetAmount: parseFloat(document.getElementById('goalTarget').value),
      currentAmount: parseFloat(document.getElementById('goalCurrent').value) || 0,
      accountId: document.getElementById('goalAccount').value || null,
      deadline: document.getElementById('goalDeadline').value || null,
      icon: selIcon, color: selColor,
      notes: document.getElementById('goalNotes').value.trim() || null,
    };
    if (!data.name) { showToast('Goal name is required', 'error'); return; }
    if (!data.targetAmount || data.targetAmount <= 0) { showToast('Target amount must be positive', 'error'); return; }

    try {
      if (id) { await api.updateSavingsGoal(id, data); showToast('Goal updated', 'success'); }
      else { await api.createSavingsGoal(data); showToast('Goal created', 'success'); }
      signalRefresh(); closeModal(); await loadGoals();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function showAddFundsForm(goalId) {
  const goal = await api.getSavingsGoal(goalId);

  openModal({
    title: `Add Funds - ${goal.name}`,
    body: `
      <div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <span>Current:</span><span>${formatCurrency(goal.currentAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <span>Target:</span><span>${formatCurrency(goal.targetAmount)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:14px">
          <span>Remaining:</span><span style="color:var(--danger)">${formatCurrency(goal.remaining)}</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Amount to Add</label>
        <input class="form-input" id="fundsAmount" type="number" step="0.01" min="0" placeholder="Amount" />
      </div>
      <p style="font-size:12px;color:var(--text-tertiary)">Funds will be deducted from the linked account (if set).</p>
    `,
    footer: `<button class="btn btn-secondary" onclick="closeModal()">Cancel</button><button class="btn btn-success" id="addFundsBtn">Add Funds</button>`,
  });

  document.getElementById('addFundsBtn').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('fundsAmount').value);
    if (!amount || amount <= 0) { showToast('Enter a valid amount', 'error'); return; }
    try {
      await api.addSavingsFunds(goalId, { amount });
      signalRefresh();
      showToast('Funds added!', 'success');
      closeModal(); await loadGoals();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

function showToast(m, t = 'info') {
  const c = document.getElementById('toastContainer');
  const toast = document.createElement('div'); toast.className = `toast toast-${t}`; toast.textContent = m;
  c.appendChild(toast); setTimeout(() => toast.remove(), 3000);
}
