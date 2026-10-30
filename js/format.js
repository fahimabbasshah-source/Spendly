const SYMBOLS = { PKR: '₨', USD: '$' };

export function symbolFor(currency) {
  return SYMBOLS[currency] || currency + ' ';
}

export function fmtMoney(amount, currency = 'PKR', { sign = false } = {}) {
  const n = Number(amount) || 0;
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const sym = symbolFor(currency);
  const prefix = sign ? (n < 0 ? '-' : n > 0 ? '+' : '') : (n < 0 ? '-' : '');
  return `${prefix}${sym}${formatted}`;
}

export function fmtDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function fmtDateLong(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtMonthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}

export function fmtMonthLong(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function relativeDay(dateStr, today) {
  if (dateStr === today) return 'Today';
  const d1 = new Date(dateStr + 'T00:00:00');
  const d0 = new Date(today + 'T00:00:00');
  const diff = Math.round((d0 - d1) / 86400000);
  if (diff === 1) return 'Yesterday';
  return fmtDateLong(dateStr);
}
