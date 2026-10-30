// Thin wrappers around Chart.js (loaded globally via CDN as window.Chart)
const instances = new Map();

function destroy(canvasId) {
  const prev = instances.get(canvasId);
  if (prev) { prev.destroy(); instances.delete(canvasId); }
}

function themeColors() {
  const dark = matchMedia('(prefers-color-scheme: dark)').matches &&
    document.documentElement.getAttribute('data-theme') !== 'light';
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || (dark && document.documentElement.getAttribute('data-theme') !== 'light');
  return {
    text: isDark ? '#9AA0AC' : '#6B7280',
    grid: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(17,19,24,0.06)',
  };
}

export function renderMonthlyBarChart(canvasId, labels, expenseData, incomeData) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !window.Chart) return;
  const t = themeColors();
  instances.set(canvasId, new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Spent', data: expenseData, backgroundColor: '#FF4D4F', borderRadius: 6, maxBarThickness: 22 },
        { label: 'Income', data: incomeData, backgroundColor: '#2FB866', borderRadius: 6, maxBarThickness: 22 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: t.text, font: { size: 11, weight: '600' } } } },
      scales: {
        x: { ticks: { color: t.text, font: { size: 11 } }, grid: { display: false } },
        y: { ticks: { color: t.text, font: { size: 11 } }, grid: { color: t.grid } },
      },
    },
  }));
}

export function renderDonutChart(canvasId, labels, data, colors) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !window.Chart) return;
  const t = themeColors();
  instances.set(canvasId, new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: { legend: { display: false } },
    },
  }));
}

export function renderHBarChart(canvasId, labels, data, colors) {
  destroy(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !window.Chart) return;
  const t = themeColors();
  instances.set(canvasId, new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: t.text, font: { size: 11 } }, grid: { color: t.grid } },
        y: { ticks: { color: t.text, font: { size: 12, weight: '600' } }, grid: { display: false } },
      },
    },
  }));
}
