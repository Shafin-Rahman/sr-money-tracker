import { $, $$, formatCurrency, formatDate, randomColor } from '../utils.js';
import { api } from '../api.js';
import { openModal, closeModal, signalRefresh } from '../app.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:600">All Accounts</h2>
      <button class="btn btn-primary" id="addAccountBtn"><i class="fas fa-plus"></i> Add Account</button>
    </div>
    <div id="accountsList"><div class="empty-state"><i class="fas fa-wallet"></i><h3>Loading accounts...</h3></div></div>
  `;

  document.getElementById('addAccountBtn').addEventListener('click', () => showAccountForm());

  await loadAccounts();
}

async function loadAccounts() {
  try {
    const accounts = await api.getAccounts();
    const list = document.getElementById('accountsList');

    if (accounts.length === 0) {
      list.innerHTML = `<div class="empty-state"><i class="fas fa-wallet"></i><h3>No accounts yet</h3><p>Create your first account to start tracking</p><button class="btn btn-primary" style="margin-top:16px" onclick="showAccountForm()"><i class="fas fa-plus"></i> Create Account</button></div>`;
      return;
    }

    list.innerHTML = `<div class="stats-grid">${accounts.map((a) => `
      <div class="stats-card" style="cursor:pointer" data-id="${a.id}">
        <div class="card-icon" style="background:${a.color}22;color:${a.color}"><i class="fas fa-${a.icon || 'wallet'}"></i></div>
        <div class="stats-info">
          <div class="stats-label">${a.name}</div>
          <div class="stats-value">${formatCurrency(a.current_balance)}</div>
          <div class="stats-sub">Opened: ${formatDate(a.created_at)}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn-icon btn-ghost edit-account" data-id="${a.id}" title="Edit"><i class="fas fa-edit"></i></button>
          <button class="btn-icon btn-ghost delete-account" data-id="${a.id}" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('')}</div>`;

    list.querySelectorAll('.edit-account').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showAccountForm(btn.dataset.id);
      });
    });

    list.querySelectorAll('.delete-account').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('Are you sure you want to delete this account?')) {
          try {
            await api.deleteAccount(btn.dataset.id);
            signalRefresh();
            showToast('Account deleted successfully', 'success');
            await loadAccounts();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });

  } catch (err) {
    document.getElementById('accountsList').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>Error loading accounts</h3><p>${err.message}</p></div>`;
  }
}

async function showAccountForm(id = null) {
  let account = { name: '', type: 'custom', icon: 'wallet', color: '#6366f1', openingBalance: 0, notes: '' };

  if (id) {
    try {
      account = await api.getAccount(id);
    } catch (err) {
      showToast(err.message, 'error');
      return;
    }
  }

  const icons = ['wallet', 'money-bill', 'credit-card', 'piggy-bank', 'bank', 'building', 'sack-dollar', 'coins', 'mobile-screen', 'hand-holding-dollar', 'landmark', 'gem', 'gold', 'chart-line', 'circle-dollar'];

  openModal({
    title: id ? 'Edit Account' : 'New Account',
    body: `
      <div class="form-group">
        <label class="form-label">Account Name</label>
        <input class="form-input" id="accName" value="${account.name}" placeholder="e.g. Cash, Bank, bKash" />
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Opening Balance</label>
          <input class="form-input" id="accBalance" type="number" value="${account.opening_balance}" step="0.01" />
        </div>
        <div class="form-group">
          <label class="form-label">Color</label>
          <div class="color-picker" id="accColorPicker">
            ${['#6366f1','#22c55e','#ef4444','#f59e0b','#3b82f6','#ec4899','#8b5cf6','#14b8a6','#f97316','#06b6d4'].map((c) =>
              `<div class="color-swatch ${c === account.color ? 'active' : ''}" style="background:${c}" data-color="${c}"></div>`
            ).join('')}
          </div>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Icon</label>
        <div class="icon-picker" id="accIconPicker">
          ${icons.map((i) =>
            `<div class="icon-option ${i === account.icon ? 'active' : ''}" data-icon="${i}"><i class="fas fa-${i}"></i></div>`
          ).join('')}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <textarea class="form-textarea" id="accNotes">${account.notes || ''}</textarea>
      </div>
    `,
    footer: `
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="saveAccountBtn">${id ? 'Update' : 'Create'}</button>
    `,
  });

  let selectedColor = account.color;
  let selectedIcon = account.icon;

  document.querySelectorAll('#accColorPicker .color-swatch').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#accColorPicker .color-swatch').forEach((s) => s.classList.remove('active'));
      el.classList.add('active');
      selectedColor = el.dataset.color;
    });
  });

  document.querySelectorAll('#accIconPicker .icon-option').forEach((el) => {
    el.addEventListener('click', () => {
      document.querySelectorAll('#accIconPicker .icon-option').forEach((s) => s.classList.remove('active'));
      el.classList.add('active');
      selectedIcon = el.dataset.icon;
    });
  });

  document.getElementById('saveAccountBtn').addEventListener('click', async () => {
    const data = {
      name: document.getElementById('accName').value.trim(),
      openingBalance: parseFloat(document.getElementById('accBalance').value) || 0,
      color: selectedColor,
      icon: selectedIcon,
      notes: document.getElementById('accNotes').value.trim() || null,
    };

    if (!data.name) {
      showToast('Account name is required', 'error');
      return;
    }

    try {
      if (id) {
        await api.updateAccount(id, data);
        showToast('Account updated successfully', 'success');
      } else {
        await api.createAccount(data);
        showToast('Account created successfully', 'success');
      }
      signalRefresh();
      closeModal();
      await loadAccounts();
    } catch (err) {
      showToast(err.message, 'error');
    }
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

window.showAccountForm = showAccountForm;
