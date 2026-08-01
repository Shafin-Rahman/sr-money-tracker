import { $, formatCurrency, formatDate, today, currentMonth, getMonthName } from '../utils.js';
import { api } from '../api.js';
import { t } from '../i18n.js';

export async function render() {
  const container = document.getElementById('pageContent');
  container.innerHTML = `
    <div class="stats-grid" id="dashboardStats">
      <div class="stats-card"><div class="card-icon" style="background:var(--primary-light);color:var(--primary)"><i class="fas fa-wallet"></i></div><div class="stats-info"><div class="stats-label">${t('total_balance')}</div><div class="stats-value" id="totalBalance">---</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--success-light);color:var(--success)"><i class="fas fa-arrow-down"></i></div><div class="stats-info"><div class="stats-label">${t('todays_income')}</div><div class="stats-value" id="todayIncome">---</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--danger-light);color:var(--danger)"><i class="fas fa-arrow-up"></i></div><div class="stats-info"><div class="stats-label">${t('todays_expense')}</div><div class="stats-value" id="todayExpense">---</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:var(--info-light);color:var(--info)"><i class="fas fa-chart-line"></i></div><div class="stats-info"><div class="stats-label">${t('monthly_savings')}</div><div class="stats-value" id="monthlySavings">---</div></div></div>
    </div>

    <div class="stats-grid" id="dashboardStats2">
      <div class="stats-card"><div class="card-icon" style="background:var(--warning-light);color:var(--warning)"><i class="fas fa-calendar"></i></div><div class="stats-info"><div class="stats-label">${t('monthly_income')}</div><div class="stats-value" id="monthlyIncome">---</div><div class="stats-sub" id="monthlyIncomeLabel"></div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:#fef2f2;color:#ef4444"><i class="fas fa-calendar-alt"></i></div><div class="stats-info"><div class="stats-label">${t('monthly_expense')}</div><div class="stats-value" id="monthlyExpense">---</div><div class="stats-sub" id="monthlyExpenseLabel"></div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:#f0fdf4;color:#22c55e"><i class="fas fa-coins"></i></div><div class="stats-info"><div class="stats-label">${t('net_worth')}</div><div class="stats-value" id="netWorth">---</div></div></div>
      <div class="stats-card"><div class="card-icon" style="background:#fefce8;color:#eab308"><i class="fas fa-hand-holding-usd"></i></div><div class="stats-info"><div class="stats-label">${t('pending_loans')}</div><div class="stats-value" id="pendingLoans">---</div></div></div>
    </div>

    <div class="widget-grid">
      <div class="widget">
        <div class="widget-header"><h3 class="widget-title">${t('recent_transactions')}</h3><a href="#transactions" class="btn btn-ghost btn-sm">${t('view_all')}</a></div>
        <div id="recentTransactions"><div class="empty-state"><i class="fas fa-exchange-alt"></i><h3>${t('no_transactions_yet')}</h3></div></div>
      </div>
      <div class="widget">
        <div class="widget-header"><h3 class="widget-title">${t('account_balances')}</h3></div>
        <div id="accountBalances"><div class="empty-state"><i class="fas fa-wallet"></i><h3>${t('no_accounts')}</h3></div></div>
      </div>
    </div>

    <div class="widget">
      <div class="widget-header"><h3 class="widget-title">${t('monthly_overview')}</h3></div>
      <div class="chart-container" id="monthlyChart" style="height:250px">
        <canvas id="monthlyChartCanvas"></canvas>
      </div>
    </div>
  `;

  try {
    const data = await api.getDashboardSummary();
    const currency = 'BDT';

    document.getElementById('totalBalance').textContent = formatCurrency(data.totalBalance, currency);
    document.getElementById('todayIncome').textContent = formatCurrency(data.todayIncome, currency);
    document.getElementById('todayExpense').textContent = formatCurrency(data.todayExpense, currency);
    document.getElementById('monthlySavings').textContent = formatCurrency(data.monthlySavings, currency);
    document.getElementById('monthlyIncome').textContent = formatCurrency(data.monthlyIncome, currency);
    document.getElementById('monthlyExpense').textContent = formatCurrency(data.monthlyExpense, currency);
    document.getElementById('netWorth').textContent = formatCurrency(data.netWorth, currency);
    document.getElementById('pendingLoans').textContent = formatCurrency(data.pendingLoans, currency);

    const monthName = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    document.getElementById('monthlyIncomeLabel').textContent = t('income_for', monthName);
    document.getElementById('monthlyExpenseLabel').textContent = t('expense_for', monthName);

    // Recent transactions
    const txnContainer = document.getElementById('recentTransactions');
    if (data.recentTransactions && data.recentTransactions.length > 0) {
      txnContainer.innerHTML = `<div class="table-container"><table><thead><tr>
        <th>${t('date')}</th><th>${t('description')}</th><th>${t('category')}</th><th>${t('account')}</th><th style="text-align:right">${t('amount')}</th>
      </tr></thead><tbody>${data.recentTransactions.slice(0, 8).map((txn) => `
        <tr>
          <td>${formatDate(txn.date)}</td>
          <td><div class="table-cell-icon">
            <div class="cell-icon" style="background:${txn.category_color || '#6366f1'}22;color:${txn.category_color || '#6366f1'}">
              <i class="fas fa-${txn.category_icon || 'circle'}"></i>
            </div>
            <div class="cell-info">
              <div class="cell-name">${txn.description || t('no_description')}</div>
              <div class="cell-sub">${typeLabel(txn.type)}</div>
            </div>
          </div></td>
          <td>${txn.category_name || '-'}</td>
          <td>${txn.account_name || '-'}</td>
          <td class="table-amount ${txn.type}">${txn.type === 'income' ? '+' : '-'}${formatCurrency(txn.amount)}</td>
        </tr>
      `).join('')}</tbody></table></div>`;
    }

    // Account balances
    const accContainer = document.getElementById('accountBalances');
    if (data.accountBalances && data.accountBalances.length > 0) {
      accContainer.innerHTML = data.accountBalances.map((a) => `
        <div class="account-balance-item" style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="card-icon" style="width:36px;height:36px;font-size:14px;background:${a.color}22;color:${a.color}"><i class="fas fa-${a.icon || 'wallet'}"></i></div>
            <div><div style="font-weight:500;font-size:14px">${a.name}</div><div style="font-size:12px;color:var(--text-tertiary)">${a.type || ''}</div></div>
          </div>
          <div style="font-weight:600;font-size:16px">${formatCurrency(a.current_balance)}</div>
        </div>
      `).join('');
    }

    // Monthly chart
    renderMonthlyChart();

  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function renderMonthlyChart() {
  try {
    const monthlyData = await api.getMonthlyStats();

    const canvas = document.getElementById('monthlyChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const container = canvas.parentElement;
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = canvas.width - padding.left - padding.right;
    const chartHeight = canvas.height - padding.top - padding.bottom;

    const maxValue = Math.max(...monthlyData.map((d) => Math.max(d.income, d.expense, 1)));
    const yScale = (val) => chartHeight - (val / maxValue) * chartHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(canvas.width - padding.right, y);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(formatCurrency((maxValue / 4) * (4 - i)), padding.left - 8, y + 4);
    }

    // Bars
    const barWidth = chartWidth / monthlyData.length / 2.5;
    monthlyData.forEach((d, i) => {
      const x = padding.left + (chartWidth / monthlyData.length) * i + (chartWidth / monthlyData.length - barWidth * 2) / 2;

      // Income bar
      const incomeHeight = chartHeight - yScale(d.income);
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.roundRect(x, yScale(d.income), barWidth, incomeHeight, [4, 4, 0, 0]);
      ctx.fill();

      // Expense bar
      const expenseHeight = chartHeight - yScale(d.expense);
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.roundRect(x + barWidth + 4, yScale(d.expense), barWidth, expenseHeight, [4, 4, 0, 0]);
      ctx.fill();

      // Month label
      ctx.fillStyle = textColor;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(d.monthName, x + barWidth + 2, canvas.height - padding.bottom + 18);
    });

    // Legend
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(canvas.width - 150, 10, 12, 12);
    ctx.fillStyle = textColor;
    ctx.textAlign = 'left';
    ctx.fillText(t('income'), canvas.width - 132, 22);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(canvas.width - 80, 10, 12, 12);
    ctx.fillStyle = textColor;
    ctx.fillText(t('expense'), canvas.width - 62, 22);

  } catch (err) {
    console.error('Chart render error:', err);
  }
}

function typeLabel(type) {
  const map = {
    income: t('type_income'),
    expense: t('type_expense'),
    transfer: t('type_transfer'),
    loan_received: t('type_loan_received'),
    loan_given: t('type_loan_given'),
    adjustment: 'Adjustment',
  };
  return map[type] || type;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
