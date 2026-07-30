import { $, today, currentTime, debounce } from './utils.js';
import { api } from './api.js';
import { router } from './router.js';
import { initI18n, t, onLangChange, translatePage } from './i18n.js';
import * as dashboard from './pages/dashboard.js';
import * as accounts from './pages/accounts.js';
import * as transactions from './pages/transactions.js';
import * as categories from './pages/categories.js';
import * as loans from './pages/loans.js';
import * as budgets from './pages/budgets.js';
import * as reports from './pages/reports.js';
import * as settings from './pages/settings.js';
import * as savings from './pages/savings.js';
import * as recurring from './pages/recurring.js';

// App State
let currentPage = 'dashboard';

export function signalRefresh() {
  window.dispatchEvent(new CustomEvent('data-changed'));
}

// Modal functions
export function openModal({ title, body, footer, large = false }) {
  const overlay = document.getElementById('modalOverlay');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalFooter = document.getElementById('modalFooter');

  modalTitle.textContent = title;
  modalBody.innerHTML = body;
  modalFooter.innerHTML = footer || '';

  modal.className = `modal${large ? ' modal-lg' : ''}`;
  overlay.classList.add('active');
}

export function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

window.openModal = openModal;
window.closeModal = closeModal;

// Toast
export function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

window.showToast = showToast;

// Theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'system';

  function applyTheme(theme) {
    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      document.getElementById('themeBtn').innerHTML = isDark
        ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    } else {
      document.documentElement.setAttribute('data-theme', theme);
      document.getElementById('themeBtn').innerHTML = theme === 'dark'
        ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
  }

  applyTheme(savedTheme);

  document.getElementById('themeBtn').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const t = localStorage.getItem('theme') || 'system';
    if (t === 'system') applyTheme('system');
  });
}

// Sidebar
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  function toggleSidebar(open) {
    sidebar.classList.toggle('open', open);
    overlay.classList.toggle('active', open);
  }

  document.getElementById('sidebarToggle').addEventListener('click', () => {
    toggleSidebar(!sidebar.classList.contains('open'));
  });

  overlay.addEventListener('click', () => toggleSidebar(false));

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => toggleSidebar(false));
  });
}

// Global Search
function initSearch() {
  const searchInput = document.getElementById('globalSearch');
  const searchResults = document.createElement('div');
  searchResults.className = 'search-results';
  searchResults.style.cssText = `
    position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-primary);
    border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg);
    max-height: 400px; overflow-y: auto; z-index: 100; display: none;
  `;
  searchInput.parentElement.appendChild(searchResults);
  searchInput.parentElement.style.position = 'relative';

  const doSearch = debounce(async (query) => {
    if (query.length < 1) {
      searchResults.style.display = 'none';
      return;
    }

    try {
      const results = await api.search(query);
      let html = '';

      if (results.transactions.length > 0) {
        html += `<div style="padding:8px 12px;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em">Transactions</div>`;
        results.transactions.slice(0, 5).forEach((t) => {
          html += `<a href="#transactions" style="display:flex;align-items:center;gap:8px;padding:8px 12px;text-decoration:none;color:var(--text-primary);font-size:13px;transition:background 0.2s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <span style="color:${t.category_color || '#6366f1'}"><i class="fas fa-${t.category_icon || 'circle'}"></i></span>
            <span>${t.description || 'No description'} - ${t.amount} ${t.account_name ? '(' + t.account_name + ')' : ''}</span>
          </a>`;
        });
      }

      if (results.accounts.length > 0) {
        html += `<div style="padding:8px 12px;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid var(--border)">Accounts</div>`;
        results.accounts.forEach((a) => {
          html += `<a href="#accounts" style="display:flex;align-items:center;gap:8px;padding:8px 12px;text-decoration:none;color:var(--text-primary);font-size:13px" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <span style="color:${a.color}"><i class="fas fa-${a.icon || 'wallet'}"></i></span>
            <span>${a.name}</span>
          </a>`;
        });
      }

      if (results.categories.length > 0) {
        html += `<div style="padding:8px 12px;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid var(--border)">Categories</div>`;
        results.categories.forEach((c) => {
          html += `<a href="#categories" style="display:flex;align-items:center;gap:8px;padding:8px 12px;text-decoration:none;color:var(--text-primary);font-size:13px" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <span style="color:${c.color}"><i class="fas fa-${c.icon || 'circle'}"></i></span>
            <span>${c.name}</span>
          </a>`;
        });
      }

      if (results.loans.length > 0) {
        html += `<div style="padding:8px 12px;font-size:11px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid var(--border)">Loans</div>`;
        results.loans.forEach((l) => {
          html += `<a href="#loans" style="display:flex;align-items:center;gap:8px;padding:8px 12px;text-decoration:none;color:var(--text-primary);font-size:13px" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
            <span><i class="fas fa-hand-holding-usd"></i></span>
            <span>${l.person_name}</span>
          </a>`;
        });
      }

      if (!html) {
        html = `<div style="padding:12px;text-align:center;color:var(--text-tertiary);font-size:13px">No results found</div>`;
      }

      searchResults.innerHTML = html;
      searchResults.style.display = 'block';
    } catch (err) {
      searchResults.style.display = 'none';
    }
  }, 300);

  searchInput.addEventListener('input', (e) => {
    if (!e.target.value.trim()) {
      searchResults.style.display = 'none';
      return;
    }
    doSearch(e.target.value.trim());
  });

  searchInput.addEventListener('blur', () => {
    setTimeout(() => { searchResults.style.display = 'none'; }, 200);
  });
}

// Quick Add Transaction
function initQuickAdd() {
  document.getElementById('quickAddBtn').addEventListener('click', () => {
    window.location.hash = 'transactions';
    setTimeout(() => {
      if (window.showTransactionForm) window.showTransactionForm();
    }, 100);
  });

  document.getElementById('floatingBtn').addEventListener('click', () => {
    window.location.hash = 'transactions';
    setTimeout(() => {
      if (window.showTransactionForm) window.showTransactionForm();
    }, 100);
  });
}

// Keyboard Shortcuts
function initKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+N or Alt+N: New Transaction
    if ((e.ctrlKey || e.altKey) && e.key === 'n') {
      e.preventDefault();
      window.location.hash = 'transactions';
      setTimeout(() => {
        if (window.showTransactionForm) window.showTransactionForm();
      }, 100);
    }

    // Escape: Close modal
    if (e.key === 'Escape') {
      window.closeModal();
    }

    // Ctrl+K: Focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      document.getElementById('globalSearch').focus();
    }
  });
}

// Modal overlay click to close
function initModal() {
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      window.closeModal();
    }
  });

  document.getElementById('modalClose').addEventListener('click', window.closeModal);
}

// Routes
router.register('dashboard', async () => {
  currentPage = 'dashboard';
  await dashboard.render();
});

router.register('accounts', async () => {
  currentPage = 'accounts';
  await accounts.render();
});

router.register('transactions', async () => {
  currentPage = 'transactions';
  await transactions.render();
});

router.register('categories', async () => {
  currentPage = 'categories';
  await categories.render();
});

router.register('loans', async () => {
  currentPage = 'loans';
  await loans.render();
});

router.register('budgets', async () => {
  currentPage = 'budgets';
  await budgets.render();
});

router.register('reports', async () => {
  currentPage = 'reports';
  await reports.render();
});

router.register('settings', async () => {
  currentPage = 'settings';
  await settings.render();
});

router.register('savings', async () => {
  currentPage = 'savings';
  await savings.render();
});

router.register('recurring', async () => {
  currentPage = 'recurring';
  await recurring.render();
});

// Auto-refresh on data change
const _pageRefresh = debounce(async (page) => {
  const handlers = {
    dashboard: () => dashboard.render(),
    accounts: () => accounts.render(),
    transactions: () => transactions.render(),
    categories: () => categories.render(),
    loans: () => loans.render(),
    budgets: () => budgets.render(),
    savings: () => savings.render(),
    recurring: () => recurring.render(),
    reports: () => reports.render(),
    settings: () => settings.render(),
  };
  if (handlers[page]) await handlers[page]();
}, 100);

window.addEventListener('data-changed', () => {
  _pageRefresh(router.currentPage);
});

// Auto-translate page on language change
onLangChange(() => {
  document.title = t('app_name');
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) {
    const page = router.currentPage || 'dashboard';
    const titles = {
      dashboard: t('nav_dashboard'),
      accounts: t('nav_accounts'),
      transactions: t('nav_transactions'),
      categories: t('nav_categories'),
      loans: t('nav_loans'),
      budgets: t('nav_budgets'),
      savings: t('nav_savings'),
      recurring: t('nav_recurring'),
      reports: t('nav_reports'),
      settings: t('nav_settings'),
    };
    titleEl.textContent = titles[page] || page;
  }
  document.querySelectorAll('.nav-item span').forEach((el) => {
    const page = el.closest('.nav-item')?.dataset?.page;
    if (page) el.textContent = t(`nav_${page}`);
  });
  translatePage();
});

// Init
document.addEventListener('DOMContentLoaded', async () => {
  await initI18n();
  initTheme();
  initSidebar();
  initSearch();
  initQuickAdd();
  initKeyboard();
  initModal();
  router.init();
  document.title = t('app_name');

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sr-money-tracker/sw.js').catch(() => {});
  }
});
