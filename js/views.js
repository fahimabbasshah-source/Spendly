import * as store from './storage.js';
import { fmtMoney, fmtDateShort, fmtMonthLabel, fmtMonthLong, relativeDay, symbolFor } from './format.js';

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

// ---------- HOME ----------
export function renderHome() {
  const totals = store.getTotalsByCurrency();
  const accounts = store.listAccounts();
  const { from, to } = store.monthRange(0);
  const { from: pfrom, to: pto } = store.monthRange(1);
  const txs = store.listTransactions();
  const thisMonthExp = txs.filter(t => t.type === 'expense' && t.date >= from && t.date <= to).reduce((s, t) => s + t.amount, 0);
  const lastMonthExp = txs.filter(t => t.type === 'expense' && t.date >= pfrom && t.date <= pto).reduce((s, t) => s + t.amount, 0);
  const thisMonthInc = txs.filter(t => t.type === 'income' && t.date >= from && t.date <= to).reduce((s, t) => s + t.amount, 0);
  const pct = lastMonthExp > 0 ? Math.round(((thisMonthExp - lastMonthExp) / lastMonthExp) * 100) : null;
  const primaryCur = accounts[0]?.currency || 'PKR';

  const balanceCards = Object.keys(totals).length
    ? Object.entries(totals).map(([cur, t]) => `
      <div class="balance-card ${cur.toLowerCase()}">
        <div class="label">${cur} &middot; Net worth</div>
        <div class="amount">${fmtMoney(t.net, cur)}</div>
        <div class="meta">
          <div><b>${fmtMoney(t.assets, cur)}</b>Assets</div>
          <div><b>${fmtMoney(t.debt, cur)}</b>Owed</div>
        </div>
      </div>`).join('')
    : `<div class="card empty-state"><div class="e-ico">🏦</div><div class="e-title">Add your first account</div><div class="e-sub">Bank, cash, credit card or crypto wallet.</div></div>`;

  const chips = accounts.length ? accounts.map(a => `
    <div class="acc-chip" data-action="open-statement" data-id="${a.id}">
      <div class="ico">${store.ACCOUNT_TYPES[a.type].icon}</div>
      <div class="name">${esc(a.name)}</div>
      <div class="bal">${fmtMoney(store.getAccountBalance(a.id), a.currency)}</div>
    </div>`).join('') : '';

  const recent = txs.slice(0, 8);
  const recentHtml = recent.length ? recent.map(t => txRow(t)).join('') :
    `<div class="empty-state"><div class="e-ico">🧾</div><div class="e-title">No transactions yet</div><div class="e-sub">Tap + to add your first spend.</div></div>`;

  return `
    <div class="balance-stack">${balanceCards}</div>
    <div class="stat-row">
      <div class="stat-chip"><div class="t">Spent this month</div><div class="v neg">${fmtMoney(thisMonthExp, primaryCur)}</div></div>
      <div class="stat-chip"><div class="t">Income this month</div><div class="v pos">${fmtMoney(thisMonthInc, primaryCur)}</div></div>
      <div class="stat-chip"><div class="t">vs last month</div><div class="v ${pct == null ? '' : pct > 0 ? 'neg' : 'pos'}">${pct == null ? '—' : (pct > 0 ? '+' : '') + pct + '%'}</div></div>
    </div>
    ${accounts.length ? `<div class="section-title">Accounts</div><div class="hscroll">${chips}</div>` : ''}
    <div class="section-title">Recent</div>
    <div class="list">${recentHtml}</div>
  `;
}

function txRow(t) {
  const acc = store.getAccount(t.accountId);
  const toAcc = t.toAccountId ? store.getAccount(t.toAccountId) : null;
  let icon = '🔹', title = '', cls = 'neu', sign = '';
  if (t.type === 'expense') {
    const c = store.getCategory(t.categoryId);
    icon = c?.icon || '🔹'; title = c?.name || 'Expense'; cls = 'exp'; sign = '-';
  } else if (t.type === 'income') {
    const c = store.getCategory(t.categoryId);
    icon = c?.icon || '💰'; title = c?.name || 'Income'; cls = 'inc'; sign = '+';
  } else if (t.type === 'transfer') {
    icon = '🔁'; title = `${acc?.name || '?'} → ${toAcc?.name || '?'}`; cls = 'neu'; sign = '';
  } else if (t.type === 'adjustment') {
    icon = '🛠️'; title = 'Balance adjustment'; cls = t.categoryId === 'adj_down' ? 'exp' : 'inc'; sign = t.categoryId === 'adj_down' ? '-' : '+';
  }
  const sub = `${acc?.name || ''}${t.note ? ' · ' + esc(t.note) : ''} · ${fmtDateShort(t.date)}`;
  return `
    <div class="row" data-action="open-tx" data-id="${t.id}">
      <div class="row-ico">${icon}</div>
      <div class="row-main">
        <div class="row-title">${esc(title)}</div>
        <div class="row-sub">${sub}</div>
      </div>
      <div class="row-amt ${cls}">${sign}${fmtMoney(t.amount, acc?.currency || 'PKR')}</div>
    </div>`;
}

// ---------- ACCOUNTS ----------
export function renderAccounts() {
  const accounts = store.listAccounts();
  if (!accounts.length) {
    return `<div class="card empty-state"><div class="e-ico">💳</div><div class="e-title">No accounts yet</div><div class="e-sub">Add a bank account, credit card, cash or crypto wallet to get started.</div></div>
    <div style="height:14px"></div><button class="btn" data-action="add-account">+ Add Account</button>`;
  }
  const groups = { bank: [], credit_card: [], cash: [], crypto: [] };
  for (const a of accounts) groups[a.type].push(a);
  const order = ['bank', 'credit_card', 'cash', 'crypto'];
  const labels = { bank: 'Bank Accounts', credit_card: 'Credit Card', cash: 'Cash', crypto: 'Crypto Wallets' };
  let html = '';
  for (const key of order) {
    if (!groups[key].length) continue;
    html += `<div class="group-label">${labels[key]}</div><div class="list">`;
    html += groups[key].map(a => {
      const bal = store.getAccountBalance(a.id);
      const isCredit = a.type === 'credit_card';
      const avail = isCredit && a.creditLimit != null ? a.creditLimit - bal : null;
      return `
        <div class="row" data-action="open-statement" data-id="${a.id}">
          <div class="row-ico">${store.ACCOUNT_TYPES[a.type].icon}</div>
          <div class="row-main">
            <div class="row-title">${esc(a.name)}</div>
            <div class="row-sub">${isCredit ? (avail != null ? `Available ${fmtMoney(avail, a.currency)}` : 'Outstanding') : a.currency}</div>
          </div>
          <div class="row-caret">
            <div class="row-amt neu">${fmtMoney(bal, a.currency)}</div>
            <div class="row-chevron">›</div>
          </div>
        </div>`;
    }).join('');
    html += `</div>`;
  }
  html += `<div style="height:16px"></div><button class="btn secondary" data-action="add-account">+ Add Account</button>`;
  return html;
}

// ---------- STATEMENT ----------
export function renderStatement(accountId, filter = 'all') {
  const acc = store.getAccount(accountId);
  if (!acc) return `<div class="empty-state">Account not found.</div>`;
  const bal = store.getAccountBalance(accountId);
  const isCredit = acc.type === 'credit_card';

  let from, to;
  const now = store.todayStr();
  if (filter === 'month') ({ from, to } = store.monthRange(0));
  else if (filter === 'lastmonth') ({ from, to } = store.monthRange(1));
  else { from = null; to = null; }

  const rows = store.getAccountStatement(accountId, { from, to });
  const totalIn = rows.filter(r => r.delta > 0).reduce((s, r) => s + r.delta, 0);
  const totalOut = rows.filter(r => r.delta < 0).reduce((s, r) => s - r.delta, 0);

  const grouped = [];
  let lastDate = null;
  for (const r of rows) {
    if (r.tx.date !== lastDate) { grouped.push({ date: r.tx.date, items: [] }); lastDate = r.tx.date; }
    grouped[grouped.length - 1].items.push(r);
  }

  const rowsHtml = grouped.length ? grouped.map(g => `
    <div class="day-group">
      <div class="day-head"><span>${relativeDay(g.date, now)}</span></div>
      <div class="list">${g.items.map(r => statementRow(r, acc)).join('')}</div>
    </div>
  `).join('') : `<div class="empty-state"><div class="e-ico">📄</div><div class="e-title">No transactions</div><div class="e-sub">in this period</div></div>`;

  return `
    <div class="stmt-hero">
      <div class="nm">${esc(acc.name)}</div>
      <div class="bal">${fmtMoney(bal, acc.currency)}</div>
      <div class="tag">${isCredit ? 'Outstanding balance' : 'Current balance'}</div>
    </div>
    <div class="stat-row">
      <div class="stat-chip"><div class="t">Money in</div><div class="v pos">${fmtMoney(totalIn, acc.currency)}</div></div>
      <div class="stat-chip"><div class="t">Money out</div><div class="v neg">${fmtMoney(totalOut, acc.currency)}</div></div>
    </div>
    <div class="filter-row">
      <button class="filter-pill ${filter === 'all' ? 'active' : ''}" data-action="stmt-filter" data-filter="all">All time</button>
      <button class="filter-pill ${filter === 'month' ? 'active' : ''}" data-action="stmt-filter" data-filter="month">This month</button>
      <button class="filter-pill ${filter === 'lastmonth' ? 'active' : ''}" data-action="stmt-filter" data-filter="lastmonth">Last month</button>
    </div>
    <div class="btn-row" style="margin-bottom:14px;">
      <button class="btn secondary" data-action="edit-account" data-id="${acc.id}">Edit Account</button>
      <button class="btn secondary" data-action="export-csv" data-id="${acc.id}">Export CSV</button>
    </div>
    ${rowsHtml}
  `;
}

function statementRow(r, acc) {
  const t = r.tx;
  let icon = '🔹', title = '';
  if (t.type === 'expense') { const c = store.getCategory(t.categoryId); icon = c?.icon || '🔹'; title = c?.name || 'Expense'; }
  else if (t.type === 'income') { const c = store.getCategory(t.categoryId); icon = c?.icon || '💰'; title = c?.name || 'Income'; }
  else if (t.type === 'transfer') {
    icon = '🔁';
    title = t.accountId === acc.id ? `To ${store.getAccount(t.toAccountId)?.name || '?'}` : `From ${store.getAccount(t.accountId)?.name || '?'}`;
  } else if (t.type === 'adjustment') { icon = '🛠️'; title = 'Balance adjustment'; }
  const cls = r.delta > 0 ? 'inc' : r.delta < 0 ? 'exp' : 'neu';
  const sign = r.delta > 0 ? '+' : r.delta < 0 ? '-' : '';
  return `
    <div class="row" data-action="open-tx" data-id="${t.id}">
      <div class="row-ico">${icon}</div>
      <div class="row-main">
        <div class="row-title">${esc(title)}${t.note ? ` · ${esc(t.note)}` : ''}</div>
        <div class="row-sub">Balance after: ${fmtMoney(r.runningBalance, acc.currency)}</div>
      </div>
      <div class="row-amt ${cls}">${sign}${fmtMoney(Math.abs(r.delta), acc.currency)}</div>
    </div>`;
}

// ---------- REPORTS ----------
export function renderReports(sub = 'monthly', monthOffset = 0) {
  const tabs = `
    <div class="segmented" style="margin-bottom:16px;">
      <button data-action="reports-tab" data-tab="monthly" class="${sub === 'monthly' ? 'active' : ''}">Monthly</button>
      <button data-action="reports-tab" data-tab="category" class="${sub === 'category' ? 'active' : ''}">By Category</button>
      <button data-action="reports-tab" data-tab="account" class="${sub === 'account' ? 'active' : ''}">By Account</button>
    </div>`;

  if (sub === 'monthly') {
    const data = store.getMonthlyTotals(6);
    const labels = data.map(d => fmtMonthLabel(d.key));
    const totalExp = data.reduce((s, d) => s + d.expense, 0);
    return tabs + `
      <div class="card"><div class="chart-wrap"><canvas id="chart-monthly"></canvas></div></div>
      <div class="section-title">Last 6 months</div>
      <div class="list">${data.slice().reverse().map(d => `
        <div class="row" data-action="reports-month" data-key="${d.key}">
          <div class="row-ico">📅</div>
          <div class="row-main"><div class="row-title">${fmtMonthLong(d.key)}</div><div class="row-sub">Income ${fmtMoney(d.income, primaryCurrency())}</div></div>
          <div class="row-amt exp">${fmtMoney(d.expense, primaryCurrency())}</div>
        </div>`).join('')}</div>
      <div id="chart-data" data-labels='${JSON.stringify(labels)}' data-expense='${JSON.stringify(data.map(d => d.expense))}' data-income='${JSON.stringify(data.map(d => d.income))}'></div>
    `;
  }

  if (sub === 'category') {
    const { from, to } = store.monthRange(monthOffset);
    const cats = store.getCategoryTotals({ from, to, type: 'expense' });
    const total = cats.reduce((s, c) => s + c.total, 0);
    const colors = cats.map(c => c.cat.color);
    return tabs + monthNav(monthOffset) + `
      <div class="card"><div class="chart-wrap sm"><canvas id="chart-cat"></canvas></div>
        <div style="text-align:center;margin-top:-130px;margin-bottom:60px;pointer-events:none;">
          <div style="font-size:12px;color:var(--text-dim);font-weight:700;">TOTAL SPENT</div>
          <div style="font-size:22px;font-weight:800;">${fmtMoney(total, primaryCurrency())}</div>
        </div>
      </div>
      <div class="section-title">Breakdown</div>
      ${cats.length ? cats.map(c => `
        <div class="cat-bar-row">
          <div class="top"><div class="nm"><span>${c.cat.icon}</span>${esc(c.cat.name)}</div><div class="amt">${fmtMoney(c.total, primaryCurrency())} · ${total ? Math.round(c.total / total * 100) : 0}%</div></div>
          <div class="bar-track"><div class="bar-fill" style="width:${total ? (c.total / total * 100) : 0}%;background:${c.cat.color}"></div></div>
        </div>`).join('') : `<div class="empty-state"><div class="e-ico">📊</div><div class="e-title">No spending yet</div></div>`}
      <div id="chart-data" data-labels='${JSON.stringify(cats.map(c => c.cat.name))}' data-values='${JSON.stringify(cats.map(c => c.total))}' data-colors='${JSON.stringify(colors)}'></div>
    `;
  }

  // account
  const { from, to } = store.monthRange(monthOffset);
  const accs = store.getAccountTotals({ from, to, type: 'expense' });
  const colors = ['#3C7CFC', '#2FB866', '#FF9F43', '#9B6BFF', '#FF4D4F', '#2EA5A5', '#D45BC9', '#F5C518'];
  return tabs + monthNav(monthOffset) + `
    <div class="card"><div class="chart-wrap"><canvas id="chart-acc"></canvas></div></div>
    <div class="section-title">Spend by account</div>
    <div class="list">${accs.length ? accs.map(a => `
      <div class="row" data-action="open-statement" data-id="${a.acc.id}">
        <div class="row-ico">${store.ACCOUNT_TYPES[a.acc.type].icon}</div>
        <div class="row-main"><div class="row-title">${esc(a.acc.name)}</div><div class="row-sub">${a.acc.currency}</div></div>
        <div class="row-amt exp">${fmtMoney(a.total, a.acc.currency)}</div>
      </div>`).join('') : `<div class="empty-state"><div class="e-ico">📊</div><div class="e-title">No spending yet</div></div>`}</div>
    <div id="chart-data" data-labels='${JSON.stringify(accs.map(a => a.acc.name))}' data-values='${JSON.stringify(accs.map(a => a.total))}' data-colors='${JSON.stringify(accs.map((_, i) => colors[i % colors.length]))}'></div>
  `;
}

function monthNav(offset) {
  const { from } = store.monthRange(offset);
  return `<div class="filter-row">
    <button class="filter-pill" data-action="reports-month-nav" data-dir="-1">‹ Prev</button>
    <button class="filter-pill active">${fmtMonthLong(from.slice(0, 7))}</button>
    <button class="filter-pill" data-action="reports-month-nav" data-dir="1" ${offset === 0 ? 'disabled style="opacity:.4"' : ''}>Next ›</button>
  </div>`;
}

function primaryCurrency() {
  return store.listAccounts()[0]?.currency || 'PKR';
}

// ---------- SETTINGS ----------
export function renderSettings() {
  const s = store.getState().settings;
  return `
    <div class="section-title first">Manage</div>
    <div class="list">
      <div class="set-row" data-action="nav-manage-accounts" style="cursor:pointer;">
        <div class="l"><span class="ic">🏦</span>Accounts</div><div class="r">${store.listAccounts().length} ›</div>
      </div>
      <div class="set-row" data-action="nav-manage-categories" style="cursor:pointer;">
        <div class="l"><span class="ic">🏷️</span>Categories</div><div class="r">${store.listCategories().length} ›</div>
      </div>
    </div>

    <div class="section-title">Currency</div>
    <div class="list">
      <div class="set-row">
        <div class="l"><span class="ic">💱</span>Exchange rate (1 USD =)</div>
        <div class="r"><input id="fx-rate" class="input" style="width:90px;padding:7px 10px;text-align:right;" type="number" value="${s.exchangeRate}" /> PKR</div>
      </div>
    </div>

    <div class="section-title">Data</div>
    <div class="list">
      <div class="set-row" data-action="export-backup" style="cursor:pointer;"><div class="l"><span class="ic">⬇️</span>Export backup (JSON)</div><div class="r">›</div></div>
      <div class="set-row" data-action="import-backup" style="cursor:pointer;"><div class="l"><span class="ic">⬆️</span>Restore from backup</div><div class="r">›</div></div>
      <div class="set-row" data-action="reset-all" style="cursor:pointer;"><div class="l"><span class="ic" style="color:var(--red)">🗑️</span><span style="color:var(--red)">Erase all data</span></div><div class="r"></div></div>
    </div>

    <div class="section-title">About</div>
    <div class="list">
      <div class="set-row"><div class="l"><span class="ic">📱</span>Spendly</div><div class="r">v1.0</div></div>
      <div class="set-row"><div class="l"><span class="ic">🔒</span>Storage</div><div class="r">On this device only</div></div>
    </div>
    <input type="file" id="import-file" accept="application/json" class="sr-only" />
  `;
}

// ---------- MANAGE ACCOUNTS ----------
export function renderManageAccounts() {
  const accounts = store.listAccounts({ includeArchived: true });
  return `
    <div class="list">${accounts.length ? accounts.map(a => `
      <div class="row" data-action="edit-account" data-id="${a.id}">
        <div class="row-ico">${store.ACCOUNT_TYPES[a.type].icon}</div>
        <div class="row-main"><div class="row-title">${esc(a.name)}${a.archived ? ' (archived)' : ''}</div><div class="row-sub">${store.ACCOUNT_TYPES[a.type].label} · ${a.currency}</div></div>
        <div class="row-chevron">›</div>
      </div>`).join('') : `<div class="empty-state"><div class="e-ico">🏦</div><div class="e-title">No accounts yet</div></div>`}</div>
    <div style="height:14px"></div>
    <button class="btn" data-action="add-account">+ Add Account</button>
  `;
}

// ---------- MANAGE CATEGORIES ----------
export function renderManageCategories(tab = 'expense') {
  const cats = store.listCategories(tab);
  return `
    <div class="segmented" style="margin-bottom:16px;">
      <button data-action="cat-tab" data-tab="expense" class="${tab === 'expense' ? 'active' : ''}">Expense</button>
      <button data-action="cat-tab" data-tab="income" class="${tab === 'income' ? 'active' : ''}">Income</button>
    </div>
    <div class="list">${cats.map(c => `
      <div class="row" data-action="edit-category" data-id="${c.id}">
        <div class="row-ico">${c.icon}</div>
        <div class="row-main"><div class="row-title">${esc(c.name)}</div></div>
        <div class="row-chevron">›</div>
      </div>`).join('')}</div>
    <div style="height:14px"></div>
    <button class="btn secondary" data-action="add-category" data-tab="${tab}">+ Add Category</button>
  `;
}

export { esc };
