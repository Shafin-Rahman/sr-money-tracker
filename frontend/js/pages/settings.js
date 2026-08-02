import { $, $$ } from '../utils.js';
import { api } from '../api.js';
import { t, loadLang, translatePage } from '../i18n.js';

export async function render() {
  const container = document.getElementById('pageContent');

  let settings = {};
  try {
    settings = await api.getSettings();
  } catch (err) {
    console.error('Failed to load settings:', err);
  }

  const currentLang = localStorage.getItem('language') || 'en';

  container.innerHTML = `
    <h2 data-i18n="settings" style="font-size:18px;font-weight:600;margin-bottom:20px">Settings</h2>

    <div class="card" style="margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px" data-i18n="appearance">Appearance</h3>
      <div class="form-group">
        <label class="form-label" data-i18n="theme">Theme</label>
        <select class="form-select" id="settingTheme" style="max-width:200px">
          <option value="system" ${settings.theme === 'system' ? 'selected' : ''} data-i18n="system">System</option>
          <option value="light" ${settings.theme === 'light' ? 'selected' : ''} data-i18n="light">Light</option>
          <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''} data-i18n="dark">Dark</option>
        </select>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px" data-i18n="language">Language</h3>
      <div class="form-group">
        <label class="form-label" data-i18n="language">Language</label>
        <select class="form-select" id="settingLanguage" style="max-width:200px">
          <option value="en" ${currentLang === 'en' ? 'selected' : ''} data-i18n="english">English</option>
          <option value="bn" ${currentLang === 'bn' ? 'selected' : ''} data-i18n="bengali">বাংলা</option>
        </select>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px" data-i18n="currency_format">Currency & Format</h3>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" data-i18n="default_currency">Default Currency</label>
          <input class="form-input" id="settingCurrency" value="${settings.currency || 'BDT'}" style="max-width:200px" placeholder="BDT" />
        </div>
        <div class="form-group">
          <label class="form-label" data-i18n="date_format">Date Format</label>
          <select class="form-select" id="settingDateFormat" style="max-width:200px">
            <option value="DD/MM/YYYY" ${settings.date_format === 'DD/MM/YYYY' ? 'selected' : ''}>DD/MM/YYYY</option>
            <option value="MM/DD/YYYY" ${settings.date_format === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
            <option value="YYYY-MM-DD" ${settings.date_format === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
          </select>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px" data-i18n="data_management">Data Management</h3>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <button class="btn btn-secondary" id="exportDataBtn"><i class="fas fa-download"></i> <span data-i18n="export_all_data">Export All Data (JSON)</span></button>
        <button class="btn btn-secondary" id="importDataBtn"><i class="fas fa-upload"></i> <span data-i18n="import_data_label">Import Data (JSON)</span></button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:16px;font-weight:600;margin-bottom:16px;color:var(--danger)" data-i18n="danger_zone">Danger Zone</h3>
      <p style="font-size:14px;color:var(--text-secondary);margin-bottom:12px" data-i18n="reset_warning">This will permanently delete all your data. This action cannot be undone.</p>
      <button class="btn btn-danger" id="resetDataBtn"><i class="fas fa-trash"></i> <span data-i18n="reset_all_data">Reset All Data</span></button>
    </div>
  `;

  translatePage(container);

  document.getElementById('settingTheme').addEventListener('change', async (e) => {
    const theme = e.target.value;
    document.documentElement.setAttribute('data-theme', theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : theme);
    try {
      await api.updateSetting('theme', theme);
      showToast(t('theme_updated'), 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('settingLanguage').addEventListener('change', async (e) => {
    const lang = e.target.value;
    await loadLang(lang);
    showToast(t('language') + ' updated', 'success');
  });

  document.getElementById('settingCurrency').addEventListener('change', async (e) => {
    try {
      await api.updateSetting('currency', e.target.value.trim().toUpperCase());
      showToast(t('currency_updated'), 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('settingDateFormat').addEventListener('change', async (e) => {
    try {
      await api.updateSetting('date_format', e.target.value);
      showToast(t('date_format_updated'), 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('exportDataBtn').addEventListener('click', async () => {
    try {
      const data = await api.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `money-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(t('data_exported'), 'success');
    } catch (err) { showToast(err.message, 'error'); }
  });

  document.getElementById('importDataBtn').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version) { showToast(t('invalid_format'), 'error'); return; }
        if (confirm(t('import_confirm'))) {
          await api.importData(data);
          showToast(t('data_imported'), 'success');
          setTimeout(() => window.location.reload(), 1500);
        }
      } catch (err) { showToast(t('import_failed', err.message), 'error'); }
    };
    input.click();
  });

  document.getElementById('resetDataBtn').addEventListener('click', async () => {
    if (!confirm(t('reset_confirm_1'))) return;
    if (!confirm(t('reset_confirm_2'))) return;

    try {
      const ts = new Date().toISOString();
      const emptyData = {
        version: '1.0',
        exportedAt: ts,
        accounts: [],
        categories: [],
        transactions: [],
        tags: [],
        transaction_tags: [],
        loans: [],
        loan_payments: [],
        settings: [
          { id: crypto.randomUUID(), key: 'theme', value: 'system', created_at: ts, updated_at: ts },
          { id: crypto.randomUUID(), key: 'currency', value: 'BDT', created_at: ts, updated_at: ts },
          { id: crypto.randomUUID(), key: 'date_format', value: 'DD/MM/YYYY', created_at: ts, updated_at: ts },
        ],
        budgets: [],
        recurring_bills: [],
        savings_goals: [],
        custom_fields: [],
        transaction_custom_fields: [],
        users: [],
        app_lock: [],
      };
      await api.importData(emptyData);
      showToast(t('all_data_reset'), 'success');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      showToast(t('reset_failed', err.message), 'error');
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
