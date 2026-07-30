export function $(selector, context = document) {
  return context.querySelector(selector);
}

export function $$(selector, context = document) {
  return [...context.querySelectorAll(selector)];
}

export function formatCurrency(amount, currency = 'BDT') {
  return new Intl.NumberFormat('en-BD', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr, format = 'DD/MM/YYYY') {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (format === 'MM/DD/YYYY') return `${month}/${day}/${year}`;
  if (format === 'YYYY-MM-DD') return `${year}-${month}-${day}`;
  return `${day}/${month}/${year}`;
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function currentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str, len = 50) {
  if (!str || str.length <= len) return str || '';
  return str.slice(0, len) + '...';
}

export function randomColor() {
  const colors = ['#6366f1', '#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4'];
  return colors[Math.floor(Math.random() * colors.length)];
}

export function getMonthName(monthNum) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[parseInt(monthNum) - 1] || '';
}

export function getTransactionTypeIcon(type) {
  const icons = {
    income: 'arrow-down',
    expense: 'arrow-up',
    transfer: 'exchange-alt',
    loan_received: 'hand-holding-usd',
    loan_given: 'hand-holding-usd',
    adjustment: 'sliders-h',
  };
  return icons[type] || 'circle';
}

export function getTransactionTypeColor(type) {
  const colors = {
    income: '#22c55e',
    expense: '#ef4444',
    transfer: '#3b82f6',
    loan_received: '#f59e0b',
    loan_given: '#8b5cf6',
  };
  return colors[type] || '#94a3b8';
}
