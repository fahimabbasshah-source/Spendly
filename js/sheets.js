import * as store from './storage.js';
import { symbolFor } from './format.js';

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

let onDone = null; // callback invoked after a sheet successfully saves/changes data

export function setOnDone(fn) { onDone = fn; }

function finish(toastMsg) {
  closeSheet();
  if (onDone) onDone(toastMsg);
}

export function toast(msg) {
  const t = document.getElementById('tpl-toast').content.firstElementChild.cloneNode(true);
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// ---------- generic sheet shell ----------
let activeBackdrop = null, activeSheet = null;

function openSheetShell(titleHtml, bodyHtml, { full = false } = {}) {
  closeSheet();
  const backdrop = document.createElement('div');
  backdrop.className = 'sheet-backdrop';
  const sheet = document.createElement('div');
  sheet.className = 'sheet' + (full ? ' full' : '');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-head"><h2>${titleHtml}</h2><button class="sheet-close" data-close>Close</button></div>
    <div class="sheet-body">${bodyHtml}</div>
  `;
  document.body.appendChild(backdrop);
  document.body.appendChild(sheet);
  backdrop.addEventListener('click', closeSheet);
  sheet.querySelector('[data-close]').addEventListener('click', closeSheet);
  requestAnimationFrame(() => { backdrop.classList.add('show'); sheet.classList.add('show'); });
  activeBackdrop = backdrop; activeSheet = sheet;
  return sheet;
}

export function closeSheet() {
  if (!activeSheet) return;
  activeBackdrop.classList.remove('show');
  activeSheet.classList.remove('show');
  const b = activeBackdrop, s = activeSheet;
  setTimeout(() => { b.remove(); s.remove(); }, 260);
  activeBackdrop = null; activeSheet = null;
}

// ---------- ADD / EDIT TRANSACTION ----------
export function openTransactionSheet(editId = null) {
  const editTx = editId ? store.getTransaction(editId) : null;
  const accounts = store.listAccounts();
  if (!accounts.length) { toast('Add an account first'); return; }

  let type = editTx?.type || 'expense';
  let accountId = editTx?.accountId || accounts[0].id;
  let toAccountId = editTx?.toAccountId || (accounts[1]?.id ?? accounts[0].id);
  let categoryId = editTx?.categoryId || null;
  let adjDir = editTx?.categoryId === 'adj_down' ? 'down' : 'up';

  const sheet = openSheetShell(editTx ? 'Edit Transaction' : 'Add Transaction', `
    <div class="segmented" id="tx-type">
      ${['expense','income','transfer','adjustment'].map(t => `<button data-t="${t}" class="${t===type?'active':''}">${label(t)}</button>`).join('')}
    </div>

    <div class="amount-pad">
      <span class="cur-sym" id="amt-sym">${symbolFor(accounts.find(a=>a.id===accountId)?.currency || 'PKR')}</span>
      <input id="amt-input" type="text" inputmode="decimal" placeholder="0" value="${editTx ? editTx.amount : ''}" />
    </div>

    <div class="field" id="field-account"><label id="account-label">Account</label><div class="chip-grid" id="account-chips"></div></div>
    <div class="field" id="field-to-account" style="display:none"><label>To Account</label><div class="chip-grid" id="to-account-chips"></div></div>
    <div class="field" id="field-adj" style="display:none">
      <label>Adjustment</label>
      <div class="segmented" id="adj-dir">
        <button data-d="up" class="${adjDir==='up'?'active':''}">Balance went up</button>
        <button data-d="down" class="${adjDir==='down'?'active':''}">Balance went down</button>
      </div>
    </div>
    <div class="field" id="field-category"><label>Category</label><div class="chip-grid" id="category-chips"></div></div>
    <div class="field"><label>Date</label><input id="tx-date" class="input" type="date" value="${editTx?.date || store.todayStr()}" /></div>
    <div class="field"><label>Note (optional)</label><input id="tx-note" class="input" type="text" placeholder="e.g. Lunch with friends" value="${editTx ? esc(editTx.note) : ''}" /></div>

    <div class="btn-row">
      ${editTx ? `<button class="btn danger" id="tx-delete">Delete</button>` : ''}
      <button class="btn" id="tx-save">${editTx ? 'Save Changes' : 'Save'}</button>
    </div>
  `, { full: true });

  function label(t) { return { expense: 'Expense', income: 'Income', transfer: 'Transfer', adjustment: 'Adjust' }[t]; }

  function renderAccountChips(containerId, selectedId, exclude) {
    const el = sheet.querySelector('#' + containerId);
    el.innerHTML = accounts.filter(a => a.id !== exclude).map(a => `
      <div class="pick-chip ${a.id === selectedId ? 'active' : ''}" data-id="${a.id}">
        <span class="ic">${store.ACCOUNT_TYPES[a.type].icon}</span>${esc(a.name)}
      </div>`).join('');
    el.querySelectorAll('.pick-chip').forEach(chip => chip.addEventListener('click', () => {
      if (containerId === 'account-chips') { accountId = chip.dataset.id; }
      else { toAccountId = chip.dataset.id; }
      renderAccountChips('account-chips', accountId, type === 'transfer' ? toAccountId : null);
      if (type === 'transfer') renderAccountChips('to-account-chips', toAccountId, accountId);
      updateAmountSymbol();
    }));
  }

  function renderCategoryChips() {
    const catType = type === 'income' ? 'income' : 'expense';
    const cats = store.listCategories(catType);
    if (!categoryId || !cats.find(c => c.id === categoryId)) categoryId = cats[0]?.id || null;
    const el = sheet.querySelector('#category-chips');
    el.innerHTML = cats.map(c => `
      <div class="pick-chip ${c.id === categoryId ? 'active' : ''}" data-id="${c.id}">
        <span class="ic">${c.icon}</span>${esc(c.name)}
      </div>`).join('');
    el.querySelectorAll('.pick-chip').forEach(chip => chip.addEventListener('click', () => {
      categoryId = chip.dataset.id;
      renderCategoryChips();
    }));
  }

  function updateAmountSymbol() {
    const acc = accounts.find(a => a.id === accountId);
    sheet.querySelector('#amt-sym').textContent = symbolFor(acc?.currency || 'PKR');
  }

  function applyTypeVisibility() {
    sheet.querySelector('#account-label').textContent = type === 'transfer' ? 'From Account' : 'Account';
    sheet.querySelector('#field-to-account').style.display = type === 'transfer' ? '' : 'none';
    sheet.querySelector('#field-category').style.display = (type === 'expense' || type === 'income') ? '' : 'none';
    sheet.querySelector('#field-adj').style.display = type === 'adjustment' ? '' : 'none';
  }

  renderAccountChips('account-chips', accountId, type === 'transfer' ? toAccountId : null);
  renderAccountChips('to-account-chips', toAccountId, accountId);
  renderCategoryChips();
  applyTypeVisibility();

  sheet.querySelectorAll('#tx-type button').forEach(btn => btn.addEventListener('click', () => {
    type = btn.dataset.t;
    sheet.querySelectorAll('#tx-type button').forEach(b => b.classList.toggle('active', b === btn));
    applyTypeVisibility();
    if (type === 'expense' || type === 'income') renderCategoryChips();
    renderAccountChips('account-chips', accountId, type === 'transfer' ? toAccountId : null);
    if (type === 'transfer') renderAccountChips('to-account-chips', toAccountId, accountId);
  }));

  sheet.querySelectorAll('#adj-dir button').forEach(btn => btn.addEventListener('click', () => {
    adjDir = btn.dataset.d;
    sheet.querySelectorAll('#adj-dir button').forEach(b => b.classList.toggle('active', b === btn));
  }));

  if (editTx) {
    sheet.querySelector('#tx-delete').addEventListener('click', () => {
      if (confirm('Delete this transaction?')) { store.deleteTransaction(editId); finish('Transaction deleted'); }
    });
  }

  sheet.querySelector('#tx-save').addEventListener('click', () => {
    const amount = parseFloat(sheet.querySelector('#amt-input').value);
    const date = sheet.querySelector('#tx-date').value || store.todayStr();
    const note = sheet.querySelector('#tx-note').value;
    if (!amount || amount <= 0) { toast('Enter a valid amount'); return; }
    if (type === 'transfer' && accountId === toAccountId) { toast('Choose two different accounts'); return; }

    const payload = {
      date, type, amount, note,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      categoryId: type === 'adjustment' ? (adjDir === 'down' ? 'adj_down' : 'adj_up') : (type === 'transfer' ? null : categoryId),
    };
    if (editTx) store.updateTransaction(editId, payload); else store.addTransaction(payload);
    finish(editTx ? 'Transaction updated' : 'Transaction added');
  });
}

// ---------- ADD / EDIT ACCOUNT ----------
export function openAccountSheet(editId = null) {
  const acc = editId ? store.getAccount(editId) : null;
  let type = acc?.type || 'bank';
  let currency = acc?.currency || 'PKR';

  const sheet = openSheetShell(acc ? 'Edit Account' : 'Add Account', `
    <div class="field"><label>Account Type</label>
      <div class="chip-grid" id="acc-type-chips">
        ${Object.entries(store.ACCOUNT_TYPES).map(([k, v]) => `<div class="pick-chip ${k===type?'active':''}" data-id="${k}"><span class="ic">${v.icon}</span>${v.label}</div>`).join('')}
      </div>
    </div>
    <div class="field"><label>Name</label><input id="acc-name" class="input" type="text" placeholder="e.g. Meezan Bank" value="${acc ? esc(acc.name) : ''}" /></div>
    <div class="field"><label>Currency</label>
      <div class="segmented" id="acc-currency">
        ${store.CURRENCIES.map(c => `<button data-c="${c}" class="${c===currency?'active':''}">${c}</button>`).join('')}
      </div>
    </div>
    <div class="field"><label id="bal-label">${type==='credit_card' ? 'Current Outstanding' : 'Opening Balance'}</label>
      <input id="acc-balance" class="input" type="text" inputmode="decimal" placeholder="0" value="${acc ? acc.openingBalance : ''}" /></div>
    <div class="field" id="field-limit" style="${type==='credit_card' ? '' : 'display:none'}"><label>Credit Limit (optional)</label>
      <input id="acc-limit" class="input" type="text" inputmode="decimal" placeholder="0" value="${acc?.creditLimit ?? ''}" /></div>

    <div class="btn-row">
      ${acc ? `<button class="btn danger" id="acc-delete">Delete</button>` : ''}
      <button class="btn" id="acc-save">${acc ? 'Save Changes' : 'Add Account'}</button>
    </div>
    ${acc ? `<div style="height:10px"></div><button class="btn ghost" id="acc-archive">${acc.archived ? 'Unarchive' : 'Archive'} account</button>` : ''}
  `);

  sheet.querySelectorAll('#acc-type-chips .pick-chip').forEach(chip => chip.addEventListener('click', () => {
    type = chip.dataset.id;
    sheet.querySelectorAll('#acc-type-chips .pick-chip').forEach(c => c.classList.toggle('active', c === chip));
    sheet.querySelector('#bal-label').textContent = type === 'credit_card' ? 'Current Outstanding' : 'Opening Balance';
    sheet.querySelector('#field-limit').style.display = type === 'credit_card' ? '' : 'none';
  }));
  sheet.querySelectorAll('#acc-currency button').forEach(btn => btn.addEventListener('click', () => {
    currency = btn.dataset.c;
    sheet.querySelectorAll('#acc-currency button').forEach(b => b.classList.toggle('active', b === btn));
  }));

  if (acc) {
    sheet.querySelector('#acc-delete').addEventListener('click', () => {
      if (confirm('Delete this account and all its transactions? This cannot be undone.')) { store.deleteAccount(editId); finish('Account deleted'); }
    });
    sheet.querySelector('#acc-archive').addEventListener('click', () => {
      store.updateAccount(editId, { archived: !acc.archived }); finish(acc.archived ? 'Account unarchived' : 'Account archived');
    });
  }

  sheet.querySelector('#acc-save').addEventListener('click', () => {
    const name = sheet.querySelector('#acc-name').value.trim();
    const balance = parseFloat(sheet.querySelector('#acc-balance').value) || 0;
    const limit = parseFloat(sheet.querySelector('#acc-limit').value) || null;
    if (!name) { toast('Enter an account name'); return; }
    const payload = { name, type, currency, openingBalance: balance, creditLimit: type === 'credit_card' ? limit : null };
    if (acc) store.updateAccount(editId, payload); else store.addAccount(payload);
    finish(acc ? 'Account updated' : 'Account added');
  });
}

// ---------- ADD / EDIT CATEGORY ----------
const ICON_CHOICES = ['🍔','🛒','🚗','⛽','🛍️','⚡','🏠','💊','🎬','📚','✈️','📱','💇','🎁','🔹','💰','💼','📈','💵','➕','🐾','☕','🍺','🧾','🧻','🏋️','🧑‍💻','🧒','🐶','🚌'];
const COLOR_CHOICES = ['#FF9F43','#2FB866','#3C7CFC','#E85D4C','#9B6BFF','#F5C518','#5C6AC4','#FF4D4F','#D45BC9','#2EA5A5','#3CA0FC','#6B7280','#FF8BA7','#9CA3AF'];

export function openCategorySheet(editId = null, defaultType = 'expense') {
  const cat = editId ? store.getCategory(editId) : null;
  let icon = cat?.icon || ICON_CHOICES[0];
  let color = cat?.color || COLOR_CHOICES[0];
  let type = cat?.type || defaultType;

  const sheet = openSheetShell(cat ? 'Edit Category' : 'Add Category', `
    <div class="field"><label>Type</label>
      <div class="segmented" id="cat-type">
        <button data-t="expense" class="${type==='expense'?'active':''}">Expense</button>
        <button data-t="income" class="${type==='income'?'active':''}">Income</button>
      </div>
    </div>
    <div class="field"><label>Name</label><input id="cat-name" class="input" type="text" placeholder="e.g. Subscriptions" value="${cat ? esc(cat.name) : ''}" /></div>
    <div class="field"><label>Icon</label><div class="chip-grid" id="icon-chips">${ICON_CHOICES.map(i => `<div class="pick-chip ${i===icon?'active':''}" data-i="${i}" style="font-size:18px;padding:8px 11px;">${i}</div>`).join('')}</div></div>
    <div class="field"><label>Color</label><div class="chip-grid" id="color-chips">${COLOR_CHOICES.map(c => `<div class="swatch ${c===color?'active':''}" data-c="${c}" style="background:${c};border:${c===color?'2.5px solid var(--text)':'2.5px solid transparent'};cursor:pointer;"></div>`).join('')}</div></div>
    <div class="btn-row">
      ${cat ? `<button class="btn danger" id="cat-delete">Delete</button>` : ''}
      <button class="btn" id="cat-save">${cat ? 'Save Changes' : 'Add Category'}</button>
    </div>
  `);

  sheet.querySelectorAll('#cat-type button').forEach(btn => btn.addEventListener('click', () => {
    type = btn.dataset.t;
    sheet.querySelectorAll('#cat-type button').forEach(b => b.classList.toggle('active', b === btn));
  }));
  sheet.querySelectorAll('#icon-chips .pick-chip').forEach(chip => chip.addEventListener('click', () => {
    icon = chip.dataset.i;
    sheet.querySelectorAll('#icon-chips .pick-chip').forEach(c => c.classList.toggle('active', c === chip));
  }));
  sheet.querySelectorAll('#color-chips .swatch').forEach(sw => sw.addEventListener('click', () => {
    color = sw.dataset.c;
    sheet.querySelectorAll('#color-chips .swatch').forEach(s => s.style.border = s === sw ? '2.5px solid var(--text)' : '2.5px solid transparent');
  }));

  if (cat) {
    sheet.querySelector('#cat-delete').addEventListener('click', () => {
      if (confirm('Delete this category? Past transactions will show as Uncategorized.')) { store.deleteCategory(editId); finish('Category deleted'); }
    });
  }

  sheet.querySelector('#cat-save').addEventListener('click', () => {
    const name = sheet.querySelector('#cat-name').value.trim();
    if (!name) { toast('Enter a category name'); return; }
    const payload = { name, icon, color, type };
    if (cat) store.updateCategory(editId, payload); else store.addCategory(payload);
    finish(cat ? 'Category updated' : 'Category added');
  });
}
