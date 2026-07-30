# SR Money Tracker

A production-quality Personal Finance Manager. Track every taka you own — completely offline-first, 100% free, no cloud dependency.

## Features

### Core
- **Dashboard** — Real-time financial overview with charts
- **Accounts** — Unlimited custom accounts (Cash, Bank, bKash, Nagad, etc.)
- **Transactions** — Income, Expense, Transfer, Loan Received/Given
- **Categories** — Unlimited categories & subcategories with custom icons/colors
- **Loans** — Track money lent & borrowed with payment history
- **Budgets** — Monthly/weekly/daily budgets with progress tracking
- **Savings Goals** — Set targets, track progress, add funds
- **Recurring Bills** — Daily/weekly/monthly/yearly bill tracking
- **Reports** — Daily, Monthly, Yearly, Custom date range with CSV/JSON export
- **Search** — Global search across all transactions, accounts, people

### Security
- **PIN Lock** — 4-6 digit PIN protection with auto-lock

### Customization
- Everything is user-configurable
- Custom icons, colors, emoji for all items
- Custom fields for transactions
- No hardcoded categories or accounts
- Multiple themes (Light, Dark, System)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | SQLite (via better-sqlite3) |
| ORM | Drizzle ORM |
| Charts | Canvas API (native) |
| Icons | Font Awesome 6 |

## Project Structure

```
sr-money-tracker/
├── frontend/                  # Static frontend (GitHub Pages ready)
│   ├── index.html
│   ├── css/
│   │   ├── style.css
│   │   └── components/        # sidebar, cards, forms, tables, modal, dark-mode
│   ├── js/
│   │   ├── app.js             # Main app entry, routing, theme
│   │   ├── api.js             # API client
│   │   ├── router.js          # Hash-based SPA router
│   │   ├── utils.js           # Utility functions
│   │   └── pages/             # Page components
│   │       ├── dashboard.js
│   │       ├── accounts.js
│   │       ├── transactions.js
│   │       ├── categories.js
│   │       ├── loans.js
│   │       ├── budgets.js
│   │       ├── savings.js
│   │       ├── recurring.js
│   │       ├── reports.js
│   │       └── settings.js
│   └── assets/
├── backend/                   # Express API server
│   ├── src/
│   │   ├── index.js           # Server entry, routes, DB init
│   │   ├── config.js
│   │   ├── db/
│   │   │   ├── index.js       # SQLite connection
│   │   │   └── schema.js      # Drizzle ORM schema
│   │   ├── routes/            # Express route definitions
│   │   ├── controllers/       # Route handlers
│   │   ├── middleware/        # Error handler, validation
│   │   └── utils/
│   ├── data/                  # SQLite database (auto-created)
│   ├── drizzle/               # Drizzle migrations
│   ├── package.json
│   └── .env
├── package.json               # Root workspace
└── README.md
```

## Installation

### Prerequisites
- Node.js 18+ 
- npm

### Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd sr-money-tracker

# 2. Install backend dependencies
cd backend
npm install

# 3. Start the backend server
npm run dev
```

The server will:
1. Create SQLite database automatically at `backend/data/money-tracker.db`
2. Create all required tables
3. Seed default data (Cash, Bank, bKash accounts + Income/Expense categories)
4. Start on `http://localhost:3001`

### Start Frontend

Open a **second terminal**:

```bash
cd frontend
npx serve .
```

Or use VS Code Live Server on `frontend/index.html`.

Open `http://localhost:3000` (or the port serve gives you).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard/summary` | Dashboard overview |
| GET | `/api/dashboard/monthly` | Monthly income/expense stats |
| GET | `/api/accounts` | List accounts |
| POST | `/api/accounts` | Create account |
| PUT | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |
| POST | `/api/categories/merge` | Merge categories |
| GET | `/api/transactions` | List transactions (with filters) |
| POST | `/api/transactions` | Create transaction |
| PUT | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |
| POST | `/api/transactions/:id/duplicate` | Duplicate transaction |
| GET | `/api/loans` | List loans |
| POST | `/api/loans` | Create loan |
| POST | `/api/loans/:id/payments` | Add loan payment |
| GET | `/api/budgets` | List budgets |
| POST | `/api/budgets` | Create budget |
| GET | `/api/savings` | List savings goals |
| POST | `/api/savings` | Create savings goal |
| POST | `/api/savings/:id/funds` | Add funds to goal |
| GET | `/api/recurring` | List recurring bills |
| POST | `/api/recurring` | Create recurring bill |
| GET | `/api/reports` | Generate report (query params) |
| GET | `/api/search?q=` | Global search |
| GET | `/api/export/csv` | Export transactions CSV |
| GET | `/api/export/json` | Export all data as JSON |
| GET | `/api/backup/export` | Full backup (JSON) |
| POST | `/api/backup/import` | Restore from backup |
| GET | `/api/pin-lock/status` | PIN lock status |
| POST | `/api/pin-lock/setup` | Set PIN |
| POST | `/api/pin-lock/verify` | Verify PIN |
| DELETE | `/api/pin-lock/disable` | Disable PIN |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` or `Alt+N` | New Transaction |
| `Ctrl+K` | Focus search |
| `Esc` | Close modal |

## Database

SQLite database stored locally at `backend/data/money-tracker.db`.

### Tables
- `users` — User profile & preferences
- `accounts` — Financial accounts (Cash, Bank, bKash, etc.)
- `categories` — Income/expense categories & subcategories
- `tags` — Transaction tags
- `transactions` — All financial transactions
- `transaction_tags` — Many-to-many transaction/tag relationship
- `loans` — Money lent & borrowed
- `loan_payments` — Loan payment history
- `budgets` — Budget limits by category
- `savings_goals` — Savings targets with progress
- `recurring_bills` — Recurring payments and bills
- `custom_fields` — User-defined custom fields
- `transaction_custom_fields` — Custom field values per transaction
- `settings` — Application settings
- `app_lock` — PIN lock configuration

## Deployment

### Frontend (GitHub Pages)
```bash
cd frontend
# Push to GitHub, enable GitHub Pages from root
```

### Backend (Render)
1. Create a new Web Service on Render
2. Set build command: `cd backend && npm install`
3. Set start command: `cd backend && npm start`
4. Add environment variable: `PORT=3001`

### Database
SQLite runs locally with the backend. No external database needed.

## Security
- All data stored locally in SQLite
- Optional PIN lock with SHA-256 hashing
- No external API calls
- No data leaves your machine

## License
MIT
