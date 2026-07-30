import { $, $$, formatCurrency, formatDate, today } from '../utils.js';
import { api } from '../api.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
      <h2 style="font-size:18px;font-weight:600">Reports</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" id="exportJsonBtn"><i class="fas fa-download"></i> Export JSON</button>
        <button class="btn btn-secondary btn-sm" id="importBtn"><i class="fas fa-upload"></i> Import</button>
      </div>
    </div>
    <div class="card" style="margin-bottom:20px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end">
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Start Date</label>
          <input class="form-input" id="reportStart" type="date" value="${new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]}" style="width:180px" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">End Date</label>
          <input class="form-input" id="reportEnd" type="date" value="${today()}" style="width:180px" />
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Group By</label>
          <select class="form-select" id="reportGroup" style="width:150px">
            <option value="category">Category</option>
            <option value="daily">Daily</option>
            <option value="account">Account</option>
            <option value="tag">Tag</option>
          </select>
        </div>
        <button class="btn btn-primary" id="generateReportBtn"><i class="fas fa-search"></i> Generate</button>
      </div>
    </div>
    <div id="reportSummary" class="stats-grid"></div>
    <div id="reportContent"><div class="empty-state"><i class="fas fa-file-alt"></i><h3>Select date range and generate report</h3></div></div>
  `;

  document.getElementById('generateReportBtn').addEventListener('click', generateReport);
  document.getElementById('exportJsonBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', importData);

  await generateReport();
}

async function generateReport() {
  const startDate = document.getElementById('reportStart').value;
  const endDate = document.getElementById('reportEnd').value;
  const groupBy = document.getElementById('reportGroup').value;

  try {
    const data = await api.getReports({ startDate, endDate, groupBy });
    const report = data.report;
    const summary = data.summary;

    document.getElementById('reportSummary').innerHTML = `
      <div class="stats-card"><div class="card-icon" style="background:var(--success-light);color:var(--success)"><i class="fas fa-arrow-down"></i></div><div class="stats-info"><div class="stats-label">Total Income</div><div class="stats-value">${formatCurrency(summary.total_income)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--danger-light);color:var(--danger)"><i class="fas fa-arrow-up"></i></div><div class="stats-info"><div class="stats-label">Total Expense</div><div class="stats-value">${formatCurrency(summary.total_expense)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--info-light);color:var(--info)"><i class="fas fa-exchange-alt"></i></div><div class="stats-info"><div class="stats-label">Net Flow</div><div class="stats-value" style="color:${summary.total_income - summary.total_expense >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(summary.total_income - summary.total_expense)}</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--warning-light);color:var(--warning)"><i class="fas fa-list"></i></div><div class="stats-info"><div class="stats-label">Transactions</div><div class="stats-value">${summary.total_transactions}</div></div></div>
    `;

    const content = document.getElementById('reportContent');

    if (!report || report.length === 0) {
      content.innerHTML = `<div class="empty-state"><i class="fas fa-file-alt"></i><h3>No data for this period</h3></div>`;
      return;
    }

    if (groupBy === 'daily') {
      content.innerHTML = `<div class="table-container"><table><thead><tr>
        <th>Date</th><th style="text-align:right">Income</th><th style="text-align:right">Expense</th><th style="text-align:right">Net</th><th>Transactions</th>
      </tr></thead><tbody>${report.map((r) => `
        <tr>
          <td>${formatDate(r.date)}</td>
          <td class="table-amount income">${formatCurrency(r.income)}</td>
          <td class="table-amount expense">${formatCurrency(r.expense)}</td>
          <td class="table-amount" style="color:${r.income - r.expense >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(r.income - r.expense)}</td>
          <td>${r.transaction_count}</td>
        </tr>
      `).join('')}</tbody></table></div>`;
    } else {
      content.innerHTML = `<div class="table-container"><table><thead><tr>
        <th>${groupBy === 'category' ? 'Category' : groupBy === 'account' ? 'Account' : 'Tag'}</th>
        <th>Type</th><th style="text-align:right">Amount</th><th style="text-align:right">Transactions</th>
      </tr></thead><tbody>${report.map((r) => `
        <tr>
          <td><div class="table-cell-icon">
            <div class="cell-icon" style="background:${(r.category_color || r.account_color || r.tag_color || '#6366f1')}22;color:${r.category_color || r.account_color || r.tag_color || '#6366f1'}">
              <i class="fas fa-${r.category_icon || r.account_icon || 'circle'}"></i>
            </div>
            <div class="cell-name">${r.category_name || r.account_name || r.tag_name || 'Unknown'}</div>
          </div></td>
          <td><span class="badge ${r.type === 'income' ? 'badge-success' : 'badge-danger'}">${r.type || '-'}</span></td>
          <td class="table-amount ${r.type === 'income' ? 'income' : 'expense'}">${formatCurrency(r.total_amount)}</td>
          <td style="text-align:right">${r.transaction_count}</td>
        </tr>
      `).join('')}</tbody></table></div>`;
    }

  } catch (err) {
    document.getElementById('reportContent').innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-circle"></i><h3>${err.message}</h3></div>`;
  }
}

async function exportData() {
  try {
    const data = await api.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `money-tracker-backup-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.version) {
        showToast('Invalid backup file format', 'error');
        return;
      }

      if (confirm('This will replace ALL your current data. Are you sure?')) {
        await api.importData(data);
        showToast('Data imported successfully. Refreshing...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      showToast('Failed to import: ' + err.message, 'error');
    }
  };
  input.click();
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
