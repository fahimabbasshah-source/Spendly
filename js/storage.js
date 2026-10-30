// ---------- Storage / data layer ----------
const KEY = 'spendly.v1';

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const CURRENCIES = ['PKR', 'USD'];

export const DEFAULT_CATEGORIES = [
  { id: 'c_food', name: 'Food & Dining', icon: '🍔', type: 'expense', color: '#FF9F43' },
  { id: 'c_groceries', name: 'Groceries', icon: '🛒', type: 'expense', color: '#2FB866' },
  { id: 'c_transport', name: 'Transport', icon: '🚗', type: 'expense', color: '#3C7CFC' },
  { id: 'c_fuel', name: 'Fuel', icon: '⛽', type: 'expense', color: '#E85D4C' },
  { id: 'c_shopping', name: 'Shopping', icon: '🛍️', type: 'expense', color: '#9B6BFF' },
  { id: 'c_bills', name: 'Bills & Utilities', icon: '⚡', type: 'expense', color: '#F5C518' },
  { id: 'c_rent', name: 'Rent', icon: '🏠', type: 'expense', color: '#5C6AC4' },
  { id: 'c_health', name: 'Health', icon: '💊', type: 'expense', color: '#FF4D4F' },
  { id: 'c_entertainment', name: 'Entertainment', icon: '🎬', type: 'expense', color: '#D45BC9' },
  { id: 'c_education', name: 'Education', icon: '📚', type: 'expense', color: '#2EA5A5' },
  { id: 'c_travel', name: 'Travel', icon: '✈️', type: 'expense', color: '#3CA0FC' },
  { id: 'c_mobile', name: 'Mobile & Internet', icon: '📱', type: 'expense', color: '#6B7280' },
  { id: 'c_personal', name: 'Personal Care', icon: '💇', type: 'expense', color: '#FF8BA7' },
  { id: 'c_gifts', name: 'Gifts & Donations', icon: '🎁', type: 'expense', color: '#FF6B6B' },
  { id: 'c_other_exp', name: 'Other', icon: '🔹', type: 'expense', color: '#9CA3AF' },

  { id: 'c_salary', name: 'Salary', icon: '💰', type: 'income', color: '#2FB866' },
  { id: 'c_business', name: 'Business', icon: '💼', type: 'income', color: '#3C7CFC' },
  { id: 'c_freelance', name: 'Freelance', icon: '🧑‍💻', type: 'income', color: '#9B6BFF' },
  { id: 'c_invest', name: 'Investment Returns', icon: '📈', type: 'income', color: '#F5C518' },
  { id: 'c_refund', name: 'Refund', icon: '💵', type: 'income', color: '#2EA5A5' },
  { id: 'c_other_inc', name: 'Other Income', icon: '➕', type: 'income', color: '#9CA3AF' },
];

export const ACCOUNT_TYPES = {
  bank: { label: 'Bank Account', icon: '🏦' },
  credit_card: { label: 'Credit Card', icon: '💳' },
  cash: { label: 'Cash', icon: '💵' },
  crypto: { label: 'Crypto Wallet', icon: '₿' },
};

function seed() {
  return {
    version: 1,
    settings: {
      exchangeRate: 280, // 1 USD = N PKR, user-editable, used only for an approximate combined view
      theme: 'auto',
    },
    accounts: [],
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    transactions: [],
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed = JSON.parse(raw);
    if (!parsed.accounts) return seed();
    return parsed;
  } catch (e) {
    console.error('Failed to load state', e);
    return seed();
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function getState() { return state; }

export function replaceState(newState) {
  state = newState;
  save();
}

// ---------- Accounts ----------
export function addAccount({ name, type, currency, openingBalance, creditLimit, color }) {
  const acc = {
    id: uid(),
    name: name.trim(),
    type,
    currency,
    openingBalance: Number(openingBalance) || 0,
    creditLimit: creditLimit ? Number(creditLimit) : null,
    color: color || '#3C7CFC',
    archived: false,
    createdAt: Date.now(),
  };
  state.accounts.push(acc);
  save();
  return acc;
}

export function updateAccount(id, patch) {
  const acc = state.accounts.find(a => a.id === id);
  if (!acc) return;
  Object.assign(acc, patch);
  save();
}

export function archiveAccount(id) {
  updateAccount(id, { archived: true });
}

export function deleteAccount(id) {
  state.accounts = state.accounts.filter(a => a.id !== id);
  state.transactions = state.transactions.filter(t => t.accountId !== id && t.toAccountId !== id);
  save();
}

export function getAccount(id) {
  return state.accounts.find(a => a.id === id);
}

export function listAccounts({ includeArchived = false } = {}) {
  return state.accounts.filter(a => includeArchived || !a.archived);
}

// ---------- Categories ----------
export function addCategory({ name, icon, type, color }) {
  const cat = { id: uid(), name: name.trim(), icon: icon || '🔹', type, color: color || '#9CA3AF' };
  state.categories.push(cat);
  save();
  return cat;
}
export function updateCategory(id, patch) {
  const c = state.categories.find(c => c.id === id);
  if (!c) return;
  Object.assign(c, patch);
  save();
}
export function deleteCategory(id) {
  state.categories = state.categories.filter(c => c.id !== id);
  save();
}
export function getCategory(id) {
  return state.categories.find(c => c.id === id);
}
export function listCategories(type) {
  return state.categories.filter(c => !type || c.type === type);
}

// ---------- Transactions ----------
// type: 'expense' | 'income' | 'transfer' | 'adjustment'
export function addTransaction({ date, accountId, type, categoryId, amount, note, toAccountId }) {
  const tx = {
    id: uid(),
    date, // ISO date string yyyy-mm-dd
    accountId,
    toAccountId: toAccountId || null,
    type,
    categoryId: categoryId || null,
    amount: Math.abs(Number(amount)) || 0,
    note: (note || '').trim(),
    createdAt: Date.now(),
  };
  state.transactions.push(tx);
  save();
  return tx;
}

export function updateTransaction(id, patch) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) return;
  Object.assign(tx, patch);
  save();
}

export function deleteTransaction(id) {
  state.transactions = state.transactions.filter(t => t.id !== id);
  save();
}

export function getTransaction(id) {
  return state.transactions.find(t => t.id === id);
}

export function listTransactions() {
  return [...state.transactions].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
}

// ---------- Balance math ----------
// "expense-effect" reduces normal accounts, increases credit-card debt.
// "income-effect" increases normal accounts, reduces credit-card debt.
function effect(account, direction, amount) {
  const isCredit = account.type === 'credit_card';
  if (direction === 'expense') return isCredit ? amount : -amount;
  return isCredit ? -amount : amount; // income
}

export function getAccountBalance(accountId) {
  const acc = getAccount(accountId);
  if (!acc) return 0;
  let bal = acc.openingBalance;
  for (const tx of state.transactions) {
    if (tx.type === 'expense' && tx.accountId === accountId) {
      bal += effect(acc, 'expense', tx.amount);
    } else if (tx.type === 'income' && tx.accountId === accountId) {
      bal += effect(acc, 'income', tx.amount);
    } else if (tx.type === 'adjustment' && tx.accountId === accountId) {
      // adjustment amount is signed delta stored as note-free raw change via categoryId='adj_up'/'adj_down'
      bal += tx.categoryId === 'adj_down' ? -tx.amount : tx.amount;
    } else if (tx.type === 'transfer') {
      if (tx.accountId === accountId) bal += effect(acc, 'expense', tx.amount);
      if (tx.toAccountId === accountId) bal += effect(acc, 'income', tx.amount);
    }
  }
  return bal;
}

export function getTotalsByCurrency() {
  const totals = {}; // currency -> { assets, debt, net }
  for (const acc of listAccounts()) {
    const bal = getAccountBalance(acc.id);
    totals[acc.currency] = totals[acc.currency] || { assets: 0, debt: 0, net: 0 };
    if (acc.type === 'credit_card') {
      totals[acc.currency].debt += bal;
    } else {
      totals[acc.currency].assets += bal;
    }
  }
  for (const k of Object.keys(totals)) {
    totals[k].net = totals[k].assets - totals[k].debt;
  }
  return totals;
}

export function getAccountStatement(accountId, { from, to } = {}) {
  const acc = getAccount(accountId);
  const all = state.transactions
    .filter(t => t.accountId === accountId || t.toAccountId === accountId)
    .sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));

  let running = acc.openingBalance;
  const rows = [];
  for (const tx of all) {
    let delta = 0;
    if (tx.type === 'expense' && tx.accountId === accountId) delta = effect(acc, 'expense', tx.amount);
    else if (tx.type === 'income' && tx.accountId === accountId) delta = effect(acc, 'income', tx.amount);
    else if (tx.type === 'adjustment' && tx.accountId === accountId) delta = tx.categoryId === 'adj_down' ? -tx.amount : tx.amount;
    else if (tx.type === 'transfer' && tx.accountId === accountId) delta = effect(acc, 'expense', tx.amount);
    else if (tx.type === 'transfer' && tx.toAccountId === accountId) delta = effect(acc, 'income', tx.amount);
    running += delta;
    rows.push({ tx, delta, runningBalance: running });
  }
  rows.reverse(); // latest first
  if (from) { } // filtering handled by caller via date comparison on tx.date
  return rows.filter(r => (!from || r.tx.date >= from) && (!to || r.tx.date <= to));
}

// ---------- Aggregations ----------
export function monthKey(dateStr) { return dateStr.slice(0, 7); } // yyyy-mm

export function getMonthlyTotals(months = 6) {
  const now = new Date();
  const keys = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const result = keys.map(k => ({ key: k, expense: 0, income: 0 }));
  const map = new Map(result.map(r => [r.key, r]));
  for (const tx of state.transactions) {
    const k = monthKey(tx.date);
    if (!map.has(k)) continue;
    const acc = getAccount(tx.accountId);
    if (!acc) continue;
    if (tx.type === 'expense') map.get(k).expense += tx.amount;
    if (tx.type === 'income') map.get(k).income += tx.amount;
  }
  return result;
}

export function getCategoryTotals({ from, to, type = 'expense' } = {}) {
  const map = new Map();
  for (const tx of state.transactions) {
    if (tx.type !== type) continue;
    if (from && tx.date < from) continue;
    if (to && tx.date > to) continue;
    const cat = getCategory(tx.categoryId) || { id: 'uncat', name: 'Uncategorized', icon: '🔹', color: '#9CA3AF' };
    const cur = map.get(cat.id) || { cat, total: 0 };
    cur.total += tx.amount;
    map.set(cat.id, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function getAccountTotals({ from, to, type = 'expense' } = {}) {
  const map = new Map();
  for (const tx of state.transactions) {
    if (tx.type !== type) continue;
    if (from && tx.date < from) continue;
    if (to && tx.date > to) continue;
    const acc = getAccount(tx.accountId);
    if (!acc) continue;
    const cur = map.get(acc.id) || { acc, total: 0 };
    cur.total += tx.amount;
    map.set(acc.id, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total);
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function monthRange(offset = 0) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const to = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
  return { from, to };
}

// ---------- Backup / restore ----------
export function exportBackup() {
  return JSON.stringify(state, null, 2);
}
export function importBackup(json) {
  const parsed = JSON.parse(json);
  if (!parsed.accounts || !parsed.transactions) throw new Error('Invalid backup file');
  replaceState(parsed);
}
export function resetAll() {
  replaceState(seed());
}
