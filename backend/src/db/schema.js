import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default('Default User'),
  email: text('email'),
  currency: text('currency').notNull().default('BDT'),
  theme: text('theme').notNull().default('system'),
  dateFormat: text('date_format').notNull().default('DD/MM/YYYY'),
  language: text('language').notNull().default('bn'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('custom'),
  icon: text('icon').notNull().default('wallet'),
  color: text('color').notNull().default('#6366f1'),
  openingBalance: real('opening_balance').notNull().default(0),
  currentBalance: real('current_balance').notNull().default(0),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  parentId: text('parent_id'),
  icon: text('icon').notNull().default('circle'),
  color: text('color').notNull().default('#6366f1'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_categories_type').on(table.type),
  index('idx_categories_parent').on(table.parentId),
]);

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6366f1'),
  createdAt: text('created_at').notNull(),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  amount: real('amount').notNull(),
  accountId: text('account_id').notNull().references(() => accounts.id),
  toAccountId: text('to_account_id').references(() => accounts.id),
  categoryId: text('category_id').references(() => categories.id),
  description: text('description'),
  personName: text('person_name'),
  personPhone: text('person_phone'),
  location: text('location'),
  notes: text('notes'),
  date: text('date').notNull(),
  time: text('time'),
  isRecurring: integer('is_recurring', { mode: 'boolean' }).notNull().default(false),
  recurringInterval: text('recurring_interval'),
  recurringNextDate: text('recurring_next_date'),
  isRemoved: integer('is_removed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_transactions_date').on(table.date),
  index('idx_transactions_type').on(table.type),
  index('idx_transactions_account').on(table.accountId),
  index('idx_transactions_category').on(table.categoryId),
]);

export const transactionTags = sqliteTable('transaction_tags', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id),
  tagId: text('tag_id').notNull().references(() => tags.id),
}, (table) => [
  index('idx_txn_tags_transaction').on(table.transactionId),
  index('idx_txn_tags_tag').on(table.tagId),
]);

export const loans = sqliteTable('loans', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  personName: text('person_name').notNull(),
  personPhone: text('person_phone'),
  personAddress: text('person_address'),
  amount: real('amount').notNull(),
  paidAmount: real('paid_amount').notNull().default(0),
  remainingAmount: real('remaining_amount').notNull(),
  interestRate: real('interest_rate').default(0),
  accountId: text('account_id').references(() => accounts.id),
  dueDate: text('due_date'),
  status: text('status').notNull().default('active'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('idx_loans_status').on(table.status),
  index('idx_loans_person').on(table.personName),
]);

export const loanPayments = sqliteTable('loan_payments', {
  id: text('id').primaryKey(),
  loanId: text('loan_id').notNull().references(() => loans.id),
  amount: real('amount').notNull(),
  date: text('date').notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const budgets = sqliteTable('budgets', {
  id: text('id').primaryKey(),
  categoryId: text('category_id').references(() => categories.id),
  amount: real('amount').notNull(),
  period: text('period').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const savingsGoals = sqliteTable('savings_goals', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  targetAmount: real('target_amount').notNull(),
  currentAmount: real('current_amount').notNull().default(0),
  accountId: text('account_id').references(() => accounts.id),
  deadline: text('deadline'),
  icon: text('icon').notNull().default('piggy-bank'),
  color: text('color').notNull().default('#6366f1'),
  notes: text('notes'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const customFields = sqliteTable('custom_fields', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull().default('text'),
  isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const transactionCustomFields = sqliteTable('transaction_custom_fields', {
  id: text('id').primaryKey(),
  transactionId: text('transaction_id').notNull().references(() => transactions.id),
  fieldId: text('field_id').notNull().references(() => customFields.id),
  value: text('value').notNull(),
  createdAt: text('created_at').notNull(),
});

export const appLock = sqliteTable('app_lock', {
  id: text('id').primaryKey(),
  pinHash: text('pin_hash'),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(false),
  autoLockMinutes: integer('auto_lock_minutes').notNull().default(5),
  lastUnlockedAt: text('last_unlocked_at'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const recurringBills = sqliteTable('recurring_bills', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  accountId: text('account_id').references(() => accounts.id),
  interval: text('interval').notNull(),
  dayOfMonth: integer('day_of_month'),
  dayOfWeek: integer('day_of_week'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  nextDate: text('next_date').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
