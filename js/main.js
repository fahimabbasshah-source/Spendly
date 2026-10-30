import * as store from './storage.js';
import * as views from './views.js';
import * as sheets from './sheets.js';
import { renderMonthlyBarChart, renderDonutChart, renderHBarChart } from './charts.js';

const app = document.getElementById('app');

let nav = { tab: 'home', screen: null };
let reportsState = { sub: 'monthly', monthOffset: 0 };
let catsTab = 'expense';

sheets.setOnDone((msg) => { render(); if (msg) sheets.toast(msg); });

function monthOffsetFromKey(key) {
  const now = new Date();
  const [y, m] = key.split('-').map(Number);
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
}

function headerHtml() {
  if (nav.screen) {
    const titles = {
      statement: () => store.getAccount(nav.screen.id)?.name || 'Account',
      'manage-accounts': () => 'Manage Accounts',
      'manage-categories': () => 'Manage Categories',
    };
    return `
      <div class="header">
        <button class="icon-btn" data-action="back">‹</button>
        <h1 style="font-size:19px;">${titles[nav.screen.type]()}</h1>
        <div style="width:38px"></div>
      </div>`;
  }
  const tabTitles = { home: 'Spendly', accounts: 'Accounts', reports: 'Reports', settings: 'Settings' };
  const sub = nav.tab === 'home' ? `<div class="sub">${new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</div>` : '';
  return `
    <div class="header">
      <div><h1>${tabTitles[nav.tab]}</h1>${sub}</div>
    </div>`;
}

function screenInnerHtml() {
  if (nav.screen) {
    if (nav.screen.type === 'statement') return views.renderStatement(nav.screen.id, nav.screen.filter || 'all');
    if (nav.screen.type === 'manage-accounts') return views.renderManageAccounts();
    if (nav.screen.type === 'manage-categories') return views.renderManageCategories(nav.screen.tab || 'expense');
  }
  if (nav.tab === 'home') return views.renderHome();
  if (nav.tab === 'accounts') return views.renderAccounts();
  if (nav.tab === 'reports') return views.renderReports(reportsState.sub, reportsState.monthOffset);
  if (nav.tab === 'settings') return views.renderSettings();
  return '';
}

function tabbarHtml() {
  const tabs = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'accounts', icon: '🏦', label: 'Accounts' },
    { id: 'reports', icon: '📊', label: 'Reports' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];
  return `<div class="tabbar">${tabs.map(t => `
    <button class="tab-btn ${nav.tab === t.id && !nav.screen ? 'active' : ''}" data-action="go-tab" data-tab="${t.id}">
      <span class="ic">${t.icon}</span><span class="lb">${t.label}</span>
    </button>`).join('')}</div>`;
}

function fabHtml() {
  const show = !nav.screen || nav.screen.type === 'statement';
  if (!show) return '';
  return `<button class="fab" data-action="add-tx" aria-label="Add transaction">+</button>`;
}

function render() {
  app.innerHTML = `${headerHtml()}<div class="screen">${screenInnerHtml()}</div>${tabbarHtml()}${fabHtml()}`;
  afterRender();
}

function afterRender() {
  if (!nav.screen && nav.tab === 'reports') {
    const dataEl = document.getElementById('chart-data');
    if (dataEl) {
      if (reportsState.sub === 'monthly') {
        renderMonthlyBarChart('chart-monthly', JSON.parse(dataEl.dataset.labels), JSON.parse(dataEl.dataset.expense), JSON.parse(dataEl.dataset.income));
      } else if (reportsState.sub === 'category') {
        renderDonutChart('chart-cat', JSON.parse(dataEl.dataset.labels), JSON.parse(dataEl.dataset.values), JSON.parse(dataEl.dataset.colors));
      } else {
        renderHBarChart('chart-acc', JSON.parse(dataEl.dataset.labels), JSON.parse(dataEl.dataset.values), JSON.parse(dataEl.dataset.colors));
      }
    }
  }
}

function downloadFile(filename, content, mime = 'application/json') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportAccountCsv(accountId) {
  const acc = store.getAccount(accountId);
  const rows = store.getAccountStatement(accountId).slice().reverse();
  let csv = 'Date,Description,Category,Amount,Balance\n';
  for (const r of rows) {
    const t = r.tx;
    let desc = t.type;
    let cat = '';
    if (t.type === 'expense' || t.type === 'income') cat = store.getCategory(t.categoryId)?.name || '';
    if (t.type === 'transfer') desc = t.accountId === accountId ? `Transfer to ${store.getAccount(t.toAccountId)?.name}` : `Transfer from ${store.getAccount(t.accountId)?.name}`;
    if (t.note) desc += ` - ${t.note}`;
    csv += `${t.date},"${desc.replace(/"/g, '')}",${cat},${r.delta.toFixed(2)},${r.runningBalance.toFixed(2)}\n`;
  }
  downloadFile(`${acc.name.replace(/\s+/g, '_')}_statement.csv`, csv, 'text/csv');
}

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;

  if (action === 'go-tab') { nav = { tab: el.dataset.tab, screen: null }; render(); return; }
  if (action === 'back') { nav.screen = null; render(); return; }
  if (action === 'add-tx') { sheets.openTransactionSheet(); return; }
  if (action === 'open-tx') { sheets.openTransactionSheet(el.dataset.id); return; }
  if (action === 'open-statement') { nav.screen = { type: 'statement', id: el.dataset.id, filter: 'all' }; render(); return; }
  if (action === 'stmt-filter') { nav.screen.filter = el.dataset.filter; render(); return; }
  if (action === 'edit-account') { sheets.openAccountSheet(el.dataset.id); return; }
  if (action === 'add-account') { sheets.openAccountSheet(); return; }
  if (action === 'export-csv') { exportAccountCsv(el.dataset.id); return; }
  if (action === 'nav-manage-accounts') { nav.screen = { type: 'manage-accounts' }; render(); return; }
  if (action === 'nav-manage-categories') { nav.screen = { type: 'manage-categories', tab: catsTab }; render(); return; }
  if (action === 'cat-tab') { catsTab = el.dataset.tab; nav.screen.tab = catsTab; render(); return; }
  if (action === 'add-category') { sheets.openCategorySheet(null, el.dataset.tab || catsTab); return; }
  if (action === 'edit-category') { sheets.openCategorySheet(el.dataset.id); return; }
  if (action === 'reports-tab') { reportsState.sub = el.dataset.tab; reportsState.monthOffset = 0; render(); return; }
  if (action === 'reports-month') { reportsState.sub = 'category'; reportsState.monthOffset = monthOffsetFromKey(el.dataset.key); render(); return; }
  if (action === 'reports-month-nav') {
    const dir = Number(el.dataset.dir);
    reportsState.monthOffset = Math.max(0, reportsState.monthOffset - dir);
    render(); return;
  }
  if (action === 'export-backup') {
    downloadFile(`spendly_backup_${store.todayStr()}.json`, store.exportBackup());
    sheets.toast('Backup downloaded'); return;
  }
  if (action === 'import-backup') { document.getElementById('import-file').click(); return; }
  if (action === 'reset-all') {
    if (confirm('Erase ALL accounts, categories and transactions? This cannot be undone.')) {
      store.resetAll(); render(); sheets.toast('All data erased');
    }
    return;
  }
});

app.addEventListener('change', (e) => {
  if (e.target.id === 'fx-rate') {
    const v = parseFloat(e.target.value) || 0;
    store.getState().settings.exchangeRate = v;
    store.replaceState(store.getState());
    sheets.toast('Exchange rate saved');
  }
  if (e.target.id === 'import-file') {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        store.importBackup(reader.result);
        render();
        sheets.toast('Backup restored');
      } catch (err) {
        sheets.toast('Invalid backup file');
      }
    };
    reader.readAsText(file);
  }
});

render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
