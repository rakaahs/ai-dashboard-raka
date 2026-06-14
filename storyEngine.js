// storyEngine.js
// Menyusun narasi SCR dashboard dari summary + anomali
// Depends on: config.js, aiInsight.js (callOllama / callGroq sudah ada di sana)

// ── Generate judul naratif untuk header dashboard ─────────────
async function generateTitle(summary, anomalies) {
  const severeCount = anomalies.profitOutliers.filter(a => a.severity === 'severe').length
    + anomalies.momSpikes.filter(a => a.severity === 'severe').length;

  const worstProfit = anomalies.profitOutliers[0] || null;
  const worstMoM    = anomalies.momSpikes[0] || null;

  let anomalyHint = '';
  if (worstProfit) {
    anomalyHint += `Anomali terparah: sub-kategori ${worstProfit.name} margin ${worstProfit.margin}% (Z=${worstProfit.zScore}). `;
  }
  if (worstMoM) {
    anomalyHint += `Revenue ${worstMoM.month} berubah ${worstMoM.changePct}% MoM.`;
  }

  const prompt =
    `Data penjualan AdventureWorks Sales:\n` +
    `- Total Sales: ${formatCurrency(summary.totalSales)}, Profit Margin: ${summary.overallMargin}%\n` +
    `- Jumlah anomali kritis: ${severeCount}\n` +
    `- ${anomalyHint}\n\n` +
    `Tulis SATU judul dashboard dalam Bahasa Indonesia.\n` +
    `Judul harus naratif (mengandung insight, bukan deskriptif).\n` +
    `Maksimal 12 kata. Format: fakta kunci + implikasi atau rekomendasi.\n` +
    `Contoh baik: "Tables Rugi 8% — Review Harga Diperlukan Segera"\n` +
    `Contoh buruk: "Dashboard Penjualan AdventureWorks Q3 2024"\n` +
    `Tulis judulnya saja, tanpa tanda kutip dan tanpa penjelasan lain.`;

  if (CONFIG.AI_PROVIDER === 'ollama') return await callOllama(prompt);
  return await callGroq(prompt);
}

// ── Generate full story dalam format SCR ─────────────────────
async function generateStory(summary, anomalies) {
  const catLines = summary.categories
    .map(c => `  - ${c.category}: sales ${formatCurrency(c.sales)}, margin ${c.margin}%`)
    .join('\n');

  const profitLines = anomalies.profitOutliers.length
    ? anomalies.profitOutliers
        .map(a => `  - ${a.name}: margin ${a.margin}% (Z=${a.zScore}, ${a.severity})`)
        .join('\n')
    : '  Tidak ada';

  const momLines = anomalies.momSpikes.length
    ? anomalies.momSpikes.slice(0, 3)
        .map(a => `  - ${a.month}: ${a.changePct}% MoM (${a.severity})`)
        .join('\n')
    : '  Tidak ada';

  const prompt =
    `Kamu adalah analis bisnis senior yang menulis ringkasan eksekutif.\n` +
    `Berdasarkan data AdventureWorks Sales berikut, tulis narasi bisnis dengan format SCR:\n\n` +
    `DATA KESELURUHAN:\n` +
    `  Total Sales: ${formatCurrency(summary.totalSales)}\n` +
    `  Total Profit: ${formatCurrency(summary.totalProfit)}\n` +
    `  Profit Margin: ${summary.overallMargin}%\n` +
    `  Total Orders: ${summary.totalOrders}\n\n` +
    `PERFORMA PER KATEGORI:\n${catLines}\n\n` +
    `ANOMALI PROFIT MARGIN (Z-score):\n${profitLines}\n\n` +
    `ANOMALI PERUBAHAN BULANAN:\n${momLines}\n\n` +
    `Tulis narasi dalam Bahasa Indonesia dengan FORMAT PERSIS seperti ini:\n\n` +
    `SETUP\n` +
    `[1-2 kalimat konteks situasi bisnis saat ini]\n\n` +
    `CONFLICT\n` +
    `[1-2 kalimat masalah atau anomali paling kritis yang ditemukan]\n\n` +
    `RESOLUTION\n` +
    `[1-2 kalimat rekomendasi konkret yang bisa dilakukan]\n\n` +
    `Gunakan angka spesifik dari data. Maksimal 6 kalimat total. Langsung ke poin.`;

  if (CONFIG.AI_PROVIDER === 'ollama') return await callOllama(prompt);
  return await callGroq(prompt);
}

// ── Parse respons LLM menjadi objek SCR ───────────────────────
function parseStoryResponse(text) {
  const result = { setup: '', conflict: '', resolution: '', raw: text };

  // Coba ekstrak tiap bagian — toleran terhadap variasi format LLM
  const setupMatch    = text.match(/SETUP[\s\S]*?\n([\s\S]*?)(?=CONFLICT|RESOLUTION|$)/i);
  const conflictMatch = text.match(/CONFLICT[\s\S]*?\n([\s\S]*?)(?=RESOLUTION|SETUP|$)/i);
  const resolveMatch  = text.match(/RESOLUTION[\s\S]*?\n([\s\S]*?)(?=SETUP|CONFLICT|$)/i);

  if (setupMatch)    result.setup      = setupMatch[1].trim();
  if (conflictMatch) result.conflict   = conflictMatch[1].trim();
  if (resolveMatch)  result.resolution = resolveMatch[1].trim();

  // Fallback: jika parsing gagal sama sekali, tampilkan teks mentah di setup
  if (!result.setup && !result.conflict && !result.resolution) {
    result.setup = text.trim();
  }

  return result;
}
