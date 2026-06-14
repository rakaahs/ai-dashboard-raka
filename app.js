// app.js — P15 Capstone
// Extend dari P14 yang sudah jalan: tambah zona SCR + storyEngine
// Semua fungsi P14 tetap ada, ditambah fungsi baru untuk story

// ── Helper: parse angka (koma sebagai desimal) ────────────────
function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  const cleaned = String(val).trim().replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ── Helper: parse tanggal YYYY-MM-DD atau DD/MM/YYYY ─────────
function parseDate(str) {
  if (!str) return null;
  const trimmed = str.trim();
  if (trimmed.includes('-')) {
    const datePart = trimmed.split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const year  = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day   = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  } else if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length === 3) {
      const day   = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year  = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

// ── Helper: format mata uang secara dinamis ────────────────────
function formatCurrency(val) {
  const num = parseFloat(val);
  if (Math.abs(num) >= 1000000) {
    return (num >= 0 ? '$' : '-$') + Math.abs(num / 1000000).toFixed(2) + 'M';
  } else if (Math.abs(num) >= 1000) {
    return (num >= 0 ? '$' : '-$') + Math.abs(num / 1000).toFixed(1) + 'K';
  } else {
    return (num >= 0 ? '$' : '-$') + Math.abs(num).toFixed(2);
  }
}

// ── Variabel global ───────────────────────────────────────────
let rawData          = [];
let summaryStats     = {};
let currentAnomalies = {};

// ── Entry point ───────────────────────────────────────────────
d3.csv('Sales_BY_Category.csv').then(async function(data) {

  // == FASE 1: DATA ==
  rawData = data.map(d => ({
    category:  d['Category'],
    subcat:    d['SubCategory'],
    region:    d['Territory'],
    segment:   d['Segment'],
    sales:     parseNum(d['Sales']),
    profit:    parseNum(d['Profit']),
    quantity:  parseNum(d['Qty']),
    orderDate: parseDate(d['OrderDate'])
  })).filter(d => !isNaN(d.sales) && !isNaN(d.profit) && d.orderDate !== null);

  // == FASE 2: HITUNG STATISTIK ==
  summaryStats     = computeSummary(rawData);
  currentAnomalies = detectAllAnomalies(rawData);

  // == FASE 3: RENDER VISUAL (sinkron — tampil dulu) ==
  displaySummaryCards(summaryStats);
  dispatchDataReady(summaryStats);

  // Chart lama dari P14
  renderCategoryChart(rawData);
  renderRegionChart(rawData);

  // Chart subcat dengan anomaly highlight
  const anomalyMap = buildAnomalyMap(currentAnomalies);
  renderSubcatChart(rawData, anomalyMap);

  // Alert panel
  const sevCount = countSeverity(currentAnomalies);
  document.getElementById('badge-severe').textContent  = sevCount.severe  + ' Kritis';
  document.getElementById('badge-warning').textContent = sevCount.warning + ' Peringatan';
  renderRawAnomalies(currentAnomalies);

  // Model badge
  const modelName = CONFIG.AI_PROVIDER === 'ollama' ? CONFIG.OLLAMA_MODEL : CONFIG.GROQ_MODEL;
  const mb = document.getElementById('model-badge');
  if (mb) mb.textContent = modelName;

  Promise.allSettled([
    generateTitle(summaryStats, currentAnomalies),
    generateStory(summaryStats, currentAnomalies),
    getInsight(summaryStats, 'Berikan 3 insight paling penting dan rekomendasi konkret. Bahasa Indonesia.')
  ]).then(([titleResult, storyResult, insightResult]) => {

    // 1. Title Fallback
    const titleEl = document.getElementById('narrative-title');
    if (titleEl) {
      if (titleResult.status === 'fulfilled') {
        titleEl.textContent = titleResult.value.trim();
      } else {
        titleEl.textContent = 'Analisis Performa Penjualan & Margin AdventureWorks';
      }
      titleEl.classList.add('loaded');
    }

    // 2. SCR Story Fallback
    if (storyResult.status === 'fulfilled') {
      const scr = parseStoryResponse(storyResult.value);
      fillZone('setup-text',      scr.setup);
      fillZone('conflict-text',   scr.conflict);
      fillZone('resolution-text', scr.resolution);
    } else {
      fillZone('setup-text', 'AdventureWorks Sales beroperasi di wilayah global dengan portofolio produk bervariasi (Bikes, Clothing, Accessories, Components). Kinerja operasional didukung oleh volume transaksi solid.');
      fillZone('conflict-text', 'Beberapa sub-kategori produk mengalami anomali margin profit yang signifikan, memicu kerugian di beberapa territory pemasaran.');
      fillZone('resolution-text', 'Diperlukan review kebijakan harga transfer dan kontrol inventory pada item dengan margin negatif guna menstabilkan profitabilitas.');
    }

    // 3. Insight Panel Fallback
    const insightEl = document.getElementById('insight-output');
    if (insightEl) {
      if (insightResult.status === 'fulfilled') {
        insightEl.innerHTML = formatInsight(insightResult.value);
      } else {
        insightEl.innerHTML = `
          <div class="insight-line"><b>1. Tinjau Ulang Sub-Kategori Margin Negatif</b>: Lakukan penyesuaian harga jual atau kurangi biaya produksi untuk item-item yang merugikan.</div>
          <div class="insight-line"><b>2. Optimalisasi Stok Territory Kritis</b>: Fokuskan distribusi inventory pada wilayah dengan profitabilitas tinggi untuk memaksimalkan ROI.</div>
          <div class="insight-line"><b>3. Efisiensi Biaya Distribusi</b>: Evaluasi skema logistik dan kargo di territory guna meminimalisir overhead cost.</div>
          <div style="font-size: 10px; color: var(--text-subtle); margin-top: 12px; border-top: 1px dashed var(--border); padding-top: 8px; line-height: 1.5;">
            ⚠️ <i>Koneksi ke Ollama Local gagal. Menggunakan analisis cadangan (fallback). Pastikan model <code>gemma3:latest</code> sudah terinstal.</i>
          </div>
        `;
      }
    }
  });
});

// ── fillZone: isi elemen teks dengan animasi ──────────────────
function fillZone(id, text) {
  const el = document.getElementById(id);
  if (!el || !text) return;
  el.textContent = text;
  el.classList.add('ai-loaded');
}

// ── computeSummary ────────────────────────────────────────────
function computeSummary(data) {
  const totalSales  = d3.sum(data, d => d.sales);
  const totalProfit = d3.sum(data, d => d.profit);
  const margin      = (totalProfit / totalSales * 100).toFixed(1);
  const totalOrders = data.length;

  const byCategory = d3.rollup(
    data,
    v => ({ sales: d3.sum(v, d => d.sales), profit: d3.sum(v, d => d.profit) }),
    d => d.category
  );

  const catArray = [...byCategory.entries()].map(([cat, v]) => ({
    category: cat,
    sales:    v.sales,
    profit:   v.profit,
    margin:   (v.profit / v.sales * 100).toFixed(1)
  }));
  catArray.sort((a, b) => b.margin - a.margin);

  const byRegion = d3.rollup(data, v => d3.sum(v, d => d.sales), d => d.region);
  const regionArray = [...byRegion.entries()]
    .map(([r, s]) => ({ region: r, sales: s }))
    .sort((a, b) => b.sales - a.sales);

  return {
    totalSales:    totalSales.toFixed(2),
    totalProfit:   totalProfit.toFixed(2),
    overallMargin: margin,
    totalOrders:   totalOrders,
    categories:    catArray,
    regions:       regionArray,
    bestCategory:  catArray[0],
    worstCategory: catArray[catArray.length - 1]
  };
}

// ── displaySummaryCards ───────────────────────────────────────
function displaySummaryCards(stats) {
  const cards = [
    { label: 'Total Sales',   value: formatCurrency(stats.totalSales),   class: 'kpi-peach' },
    { label: 'Total Profit',  value: formatCurrency(stats.totalProfit),  class: 'kpi-blue' },
    { label: 'Profit Margin', value: `${stats.overallMargin}%`,         class: 'kpi-gray' },
    { label: 'Total Orders',  value: stats.totalOrders.toLocaleString(), class: 'kpi-lavender' }
  ];
  const el = document.getElementById('summary-cards');
  if (el) el.innerHTML = cards.map(c => `
    <div class="summary-card ${c.class}">
      <div>
        <div class="sc-label">${c.label}</div>
        <div class="sc-value">${c.value}</div>
      </div>
      <div class="kpi-arrow">↗</div>
    </div>`).join('');
}

// ── renderCategoryChart ───────────────────────────────────────
function renderCategoryChart(data) {
  const margin = { top: 25, right: 20, bottom: 45, left: 100 };
  const w = 320 - margin.left - margin.right;
  const h = 300 - margin.top  - margin.bottom;

  const byCategory = d3.rollups(data,
    v => d3.sum(v, d => d.sales), d => d.category
  ).map(([cat, val]) => ({ category: cat, sales: val }))
   .sort((a, b) => b.sales - a.sales);

  d3.select('#chart-category').selectAll('*').remove();
  const svg = d3.select('#chart-category').append('svg')
    .attr('viewBox', `0 0 ${w+margin.left+margin.right} ${h+margin.top+margin.bottom}`)
    .style('width','100%').style('height','auto')
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(byCategory, d => d.sales)]).range([0, w]);
  const y = d3.scaleBand()
    .domain(byCategory.map(d => d.category)).range([0, h]).padding(0.35);

  // Add grid lines for X axis
  svg.append('g')
    .attr('transform', `translate(0,${h})`)
    .attr('class', 'grid')
    .call(d3.axisBottom(x).ticks(4).tickSize(-h).tickFormat(''))
    .selectAll('line')
    .style('stroke', '#e2e1dc')
    .style('stroke-dasharray', '3,3');

  svg.selectAll('.bar').data(byCategory).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.category))
    .attr('width', d => x(d.sales)).attr('height', y.bandwidth())
    .attr('fill', '#6366f1') // Modern Indigo
    .attr('rx', 4) // Rounded corners for bars
    .append('title').text(d => `${d.category}: ${formatCurrency(d.sales)}`);

  svg.append('g').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  svg.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d => formatCurrency(d)));
}

// ── renderRegionChart ─────────────────────────────────────────
function renderRegionChart(data) {
  const margin = { top: 25, right: 20, bottom: 45, left: 100 };
  const w = 320 - margin.left - margin.right;
  const h = 300 - margin.top  - margin.bottom;

  const byRegion = d3.rollups(data,
    v => d3.sum(v, d => d.profit), d => d.region
  ).map(([r, p]) => ({ region: r, profit: p }))
   .sort((a, b) => b.profit - a.profit);

  d3.select('#chart-region').selectAll('*').remove();
  const svg = d3.select('#chart-region').append('svg')
    .attr('viewBox', `0 0 ${w+margin.left+margin.right} ${h+margin.top+margin.bottom}`)
    .style('width','100%').style('height','auto')
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear()
    .domain([0, d3.max(byRegion, d => d.profit)]).range([0, w]);
  const y = d3.scaleBand()
    .domain(byRegion.map(d => d.region)).range([0, h]).padding(0.35);

  // Add grid lines for X axis
  svg.append('g')
    .attr('transform', `translate(0,${h})`)
    .attr('class', 'grid')
    .call(d3.axisBottom(x).ticks(4).tickSize(-h).tickFormat(''))
    .selectAll('line')
    .style('stroke', '#e2e1dc')
    .style('stroke-dasharray', '3,3');

  svg.selectAll('.bar').data(byRegion).enter().append('rect')
    .attr('x', 0).attr('y', d => y(d.region))
    .attr('width', d => Math.max(0, x(d.profit))).attr('height', y.bandwidth())
    .attr('fill', d => d.profit >= 0 ? '#10b981' : '#e11d48') // Modern Green / Rose red
    .attr('rx', 4) // Rounded corners for bars
    .append('title').text(d => `${d.region}: ${formatCurrency(d.profit)}`);

  svg.append('g').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
  svg.append('g').attr('transform', `translate(0,${h})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat(d => formatCurrency(d)));
}

// ── renderSubcatChart (dengan anomaly highlight) ──────────────
function renderSubcatChart(data, anomalyMap = new Map()) {
  d3.select('#chart-subcat').selectAll('*').remove();

  const margin = { top: 20, right: 60, bottom: 20, left: 140 };
  const w = 520 - margin.left - margin.right;
  const h = 480 - margin.top  - margin.bottom; // Increased height for better spacing

  const bySubcat = d3.rollups(data,
    v => ({ margin: d3.sum(v, d => d.profit) / d3.sum(v, d => d.sales) * 100 }),
    d => d.subcat
  ).map(([name, v]) => ({ name, margin: +v.margin.toFixed(1) }))
   .sort((a, b) => a.margin - b.margin);

  const getColor = (d) => {
    if (!anomalyMap.has(d.name)) return '#818cf8'; // Soft pastel indigo
    const a = anomalyMap.get(d.name);
    if (a.severity === 'severe')  return '#e11d48'; // Rose red
    if (a.severity === 'warning') return '#ea580c'; // Deep orange
    return '#d97706'; // Dark yellow
  };

  const totalW = w + margin.left + margin.right;
  const totalH = h + margin.top  + margin.bottom;
  const svg = d3.select('#chart-subcat').append('svg')
    .attr('viewBox', `0 0 ${totalW} ${totalH}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')
    .style('width', '100%').style('height', 'auto')
    .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const minMargin = d3.min(bySubcat, d => d.margin);
  const maxMargin = d3.max(bySubcat, d => d.margin);
  // Ensure the zero line is pushed to the right to prevent overlap with left labels
  const xMin = Math.min(minMargin - 2, -15);
  const xMax = maxMargin + 5;

  const x = d3.scaleLinear()
    .domain([xMin, xMax])
    .range([0, w]);
  const y = d3.scaleBand()
    .domain(bySubcat.map(d => d.name)).range([0, h]).padding(0.3);

  // Vertical zero line
  svg.append('line')
    .attr('x1', x(0)).attr('x2', x(0)).attr('y1', 0).attr('y2', h)
    .attr('stroke', '#71717a').attr('stroke-dasharray', '4,3').attr('stroke-width', 1.5);

  // Bars
  svg.selectAll('.bar').data(bySubcat).enter().append('rect')
    .attr('x',      d => d.margin >= 0 ? x(0) : x(d.margin))
    .attr('y',      d => y(d.name))
    .attr('width',  d => Math.max(0.5, Math.abs(x(d.margin) - x(0))))
    .attr('height', y.bandwidth())
    .attr('fill',   d => getColor(d))
    .attr('rx', 3) // Rounded corners for bars
    .append('title').text(d => {
      const tag = anomalyMap.has(d.name) ? ` [ANOMALI Z=${anomalyMap.get(d.name).zScore}]` : '';
      return `${d.name}: ${d.margin}%${tag}`;
    });

  // Labels
  svg.selectAll('.label').data(bySubcat).enter().append('text')
    .attr('x', d => d.margin >= 0 ? x(d.margin) + 6 : x(d.margin) - 6)
    .attr('y', d => y(d.name) + y.bandwidth() / 2)
    .attr('text-anchor', d => d.margin >= 0 ? 'start' : 'end')
    .attr('dominant-baseline', 'middle').attr('font-size', 10)
    .attr('fill', d => anomalyMap.has(d.name) ? '#e11d48' : '#27272a') // Darker font for normal labels
    .attr('font-weight', d => anomalyMap.has(d.name) ? '700' : '500')
    .text(d => `${d.margin}%`);

  svg.append('g').call(d3.axisLeft(y).tickSize(0)).select('.domain').remove();
}

// ── buildAnomalyMap ───────────────────────────────────────────
function buildAnomalyMap(anomalies) {
  const map = new Map();
  anomalies.profitOutliers.forEach(a => {
    map.set(a.name, { severity: a.severity, zScore: a.zScore, direction: a.direction });
  });
  return map;
}

// ── renderRawAnomalies ────────────────────────────────────────
function renderRawAnomalies(anomalies) {
  const container = document.getElementById('alert-tab-raw');
  if (!container) return;

  const items = [];

  anomalies.profitOutliers.forEach(a => {
    items.push({
      severity: a.severity,
      label:    `Profit Margin Anomali: ${a.name}`,
      detail:   `margin ${a.margin}%  |  Z-score ${a.zScore}  |  ${a.direction === 'low' ? 'jauh di bawah' : 'jauh di atas'} rata-rata`
    });
  });

  anomalies.momSpikes.forEach(a => {
    items.push({
      severity: a.severity,
      label:    `Revenue ${a.direction === 'drop' ? 'Turun' : 'Naik'} Drastis: ${a.month}`,
      detail:   `${a.changePct}% MoM  |  ${formatCurrency(a.current)} vs ${formatCurrency(a.previous)} bulan lalu`
    });
  });

  // IQR outliers — sub-kategori dengan banyak transaksi nilai ekstrem
  const iqrSubcats = anomalies.iqrOutliers?.bySubcat || [];
  iqrSubcats.forEach(a => {
    items.push({
      severity: a.severity,
      label:    `Distribusi Tidak Normal: ${a.subcat}`,
      detail:   `${a.count} transaksi outlier  |  rata-rata ${formatCurrency(a.avgSales)}  |  nilai ${a.direction === 'high' ? 'sangat tinggi' : 'sangat rendah'}`
    });
  });

  if (items.length === 0) {
    container.innerHTML = '<p class="placeholder-text">Tidak ada anomali signifikan terdeteksi.</p>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="alert-item">
      <div class="ai-dot ${item.severity}"></div>
      <div>
        <div class="ai-label">${item.label}</div>
        <div class="ai-detail">${item.detail}</div>
      </div>
    </div>`).join('');
}

// ── requestAlertNarration ─────────────────────────────────────
async function requestAlertNarration() {
  const btn    = document.getElementById('btn-narrate');
  const output = document.getElementById('ai-narration-output');
  if (!btn || !output) return;

  btn.disabled    = true;
  btn.textContent = 'Memproses...';
  switchAlertTab('ai', document.querySelector('.alert-tab:last-child'));

  output.innerHTML = `<p class="loading-text"><span class="spinner-inline"></span>Mengirim data anomali ke AI...</p>`;

  try {
    const narration = await narrateAllAlerts(currentAnomalies);
    output.innerHTML = narration
      .split('\n').filter(l => l.trim())
      .map(l => `<div class="narration-line">${l}</div>`)
      .join('');
  } catch (err) {
    output.innerHTML = `<p style="color:#dc2626">Error: ${err.message}</p>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Narasi AI';
  }
}

// ── switchAlertTab ────────────────────────────────────────────
function switchAlertTab(tab, btnEl) {
  document.querySelectorAll('.alert-tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.alert-tab-content').forEach(c => c.style.display = 'none');
  if (btnEl) btnEl.classList.add('active');
  const target = document.getElementById('alert-tab-' + tab);
  if (target) target.style.display = 'block';
}

// ── requestInsight (dari P13, tetap ada) ─────────────────────
async function requestInsight() {
  const btn      = document.getElementById('btn-insight');
  const output   = document.getElementById('insight-output');
  const question = document.getElementById('custom-question');
  if (!btn || !output) return;

  btn.disabled    = true;
  btn.textContent = 'Memproses...';
  output.innerHTML = `<div class="insight-loading"><div class="spinner"></div><span>Mengirim data ke AI...</span></div>`;

  try {
    const result = await getInsight(summaryStats, question ? question.value.trim() : '');
    output.innerHTML = formatInsight(result);
  } catch (err) {
    output.innerHTML = `<div class="insight-error"><strong>Error:</strong> ${err.message}</div>`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Minta Insight';
  }
}

function quickAsk(q) {
  const el = document.getElementById('custom-question');
  if (el) el.value = q;
  requestInsight();
}

// ── askCustomQ (untuk input di resolution zone) ───────────────
async function askCustomQ() {
  const q      = document.getElementById('custom-q');
  const output = document.getElementById('insight-output');
  if (!q || !q.value.trim() || !output) return;

  output.innerHTML = `<p class="loading-text"><span class="spinner-inline"></span>Memproses...</p>`;
  try {
    const resp = await getInsight(summaryStats, q.value.trim());
    output.innerHTML = formatInsight(resp);
  } catch (e) {
    output.innerHTML = `<p style="color:#dc2626">${e.message}</p>`;
  }
}

// ── formatInsight — bersihkan markdown, render rapi ──────────
function formatInsight(text) {
  // 1. Bersihkan tanda markdown: **bold**, *italic*, ## heading, ---
  let t = text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')   // ***x*** -> x
    .replace(/\*\*(.+?)\*\*/g,   '$1')         // **x**   -> x
    .replace(/^#{1,3}\s*/gm,       '')             // ## x    -> x
    .replace(/^---+$/gm,            '')              // ---     -> hapus
    .replace(/`(.+?)`/g,            '$1');           // `x`     -> x

  // 2. Render per baris
  const lines = t.split('\n');
  let html = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { html += '<div class="insight-gap"></div>'; continue; }

    // Baris nomor "1. ..." "2. ..." — heading item
    if (/^\d+\.\s/.test(line)) {
      // Hapus prefix "Insight:" kalau ada
      const txt = line.replace(/^(\d+\.\s*)(insight\s*:\s*)?/i, '<b>$1</b> ');
      html += `<div class="insight-item">${txt}</div>`;
      continue;
    }

    // Bullet "* ..." atau "- ..."
    if (/^[*\-]\s/.test(line)) {
      const txt = line.replace(/^[*\-]\s+/, '');
      html += `<div class="insight-bullet">&#x2022;&nbsp; ${txt}</div>`;
      continue;
    }

    // Baris biasa
    html += `<div class="insight-line">${line}</div>`;
  }

  return html;
}

// ── Dispatch event setelah data siap (untuk category-table di HTML) ──
// Ditambahkan di dalam d3.dsv().then() — ini dipanggil setelah computeSummary
// Cara: kita override akhir fungsi load dengan event
// Event ini ditangkap oleh script inline di index.html
function dispatchDataReady(stats) {
  window.dispatchEvent(new CustomEvent('capstone-data-ready', { detail: stats }));
}
