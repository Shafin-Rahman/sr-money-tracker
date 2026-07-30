class Router {
  constructor() {
    this.routes = {};
    this.currentPage = null;

    window.addEventListener('hashchange', () => this.handleRoute());
  }

  register(path, handler) {
    this.routes[path] = handler;
  }

  navigate(path) {
    window.location.hash = path;
  }

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    const basePath = hash.split('/')[0];
    const handler = this.routes[basePath];

    if (handler) {
      this.currentPage = basePath;
      handler(hash);
      this.updateActiveNav(basePath);
      this.updatePageTitle(basePath);
    }
  }

  updateActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach((el) => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  }

  updatePageTitle(page) {
    const titles = {
      dashboard: 'Dashboard',
      accounts: 'Accounts',
      transactions: 'Transactions',
      categories: 'Categories',
      loans: 'Loans',
      budgets: 'Budgets',
      reports: 'Reports',
      savings: 'Savings Goals',
      recurring: 'Recurring Bills',
      settings: 'Settings',
    };
    document.getElementById('pageTitle').textContent = titles[page] || page;
  }

  init() {
    this.handleRoute();
  }
}

export const router = new Router();
