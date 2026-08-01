export const TABLES = [
  { name: 'users', columns: ['id', 'name', 'email', 'currency', 'theme', 'date_format', 'language', 'created_at', 'updated_at'] },
  { name: 'accounts', columns: ['id', 'name', 'type', 'icon', 'color', 'opening_balance', 'current_balance', 'notes', 'is_active', 'is_archived', 'sort_order', 'created_at', 'updated_at'] },
  { name: 'categories', columns: ['id', 'name', 'type', 'parent_id', 'icon', 'color', 'is_active', 'is_archived', 'sort_order', 'created_at', 'updated_at'] },
  { name: 'tags', columns: ['id', 'name', 'color', 'created_at'] },
  { name: 'transactions', columns: ['id', 'type', 'amount', 'account_id', 'to_account_id', 'category_id', 'description', 'person_name', 'person_phone', 'location', 'notes', 'date', 'time', 'is_recurring', 'recurring_interval', 'recurring_next_date', 'is_removed', 'created_at', 'updated_at'] },
  { name: 'transaction_tags', columns: ['id', 'transaction_id', 'tag_id'] },
  { name: 'loans', columns: ['id', 'type', 'person_name', 'person_phone', 'person_address', 'amount', 'paid_amount', 'remaining_amount', 'interest_rate', 'account_id', 'due_date', 'status', 'notes', 'created_at', 'updated_at'] },
  { name: 'loan_payments', columns: ['id', 'loan_id', 'amount', 'date', 'notes', 'created_at'] },
  { name: 'settings', columns: ['id', 'key', 'value', 'created_at', 'updated_at'] },
  { name: 'budgets', columns: ['id', 'category_id', 'amount', 'period', 'start_date', 'end_date', 'is_active', 'created_at', 'updated_at'] },
  { name: 'savings_goals', columns: ['id', 'name', 'target_amount', 'current_amount', 'account_id', 'deadline', 'icon', 'color', 'notes', 'is_active', 'created_at', 'updated_at'] },
  { name: 'recurring_bills', columns: ['id', 'name', 'amount', 'category_id', 'account_id', 'interval', 'day_of_month', 'day_of_week', 'start_date', 'end_date', 'next_date', 'is_active', 'notes', 'created_at', 'updated_at'] },
  { name: 'custom_fields', columns: ['id', 'name', 'type', 'is_required', 'sort_order', 'created_at', 'updated_at'] },
  { name: 'transaction_custom_fields', columns: ['id', 'transaction_id', 'field_id', 'value', 'created_at'] },
  { name: 'app_lock', columns: ['id', 'pin_hash', 'is_enabled', 'auto_lock_minutes', 'last_unlocked_at', 'created_at', 'updated_at'] },
];

export const TABLE_COLUMNS = Object.fromEntries(TABLES.map((t) => [t.name, t.columns]));

export const TABLE_NAMES = TABLES.map((t) => t.name);
