const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const { requireLogin, requireOwner } = require('../lib/auth'); // kalau belum ada, pakai requireLogin saja
const router = express.Router();

const DATA = (p) => path.join(__dirname, '..', 'data', p);

// ---------- Utils file ----------
async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(DATA(file), 'utf8')); }
  catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.writeFile(DATA(file), JSON.stringify(data, null, 2), 'utf8');
}

// ---------- Utils format ----------
function normNum(num){
  if (!num) return '';
  let n = String(num).trim().replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('08')) n = '62' + n.slice(1);
  if (n.startsWith('0'))  n = '62' + n.slice(1);
  return n;
}

// Statistik per user per APK (rincian per durasi)
function updateStatistikPerUser(userObj) {
  // bentuk data lama: { user, data:[{apk,email,durasi,dateGiven,exp,invite}] }
  // siapkan wadah statistik
  userObj.statistik = userObj.statistik || {};
  if (!Array.isArray(userObj.data)) return userObj;

  // reset hitungan agar konsisten
  userObj.statistik = {};
  for (const trx of userObj.data) {
    const apk = (trx.apk || 'unknown').toLowerCase();
    const dur = (trx.durasi || 'unknown').toLowerCase();

    if (!userObj.statistik[apk]) {
      userObj.statistik[apk] = { total: 0, rincian: {} };
    }
    userObj.statistik[apk].total += 1;
    userObj.statistik[apk].rincian[dur] = (userObj.statistik[apk].rincian[dur] || 0) + 1;
  }
  return userObj;
}

// Bangun aggregated untuk tabel ringkasan
function buildAggregated(buyers) {
  // hasil: { user, total, statistik, flags? }
  return (buyers || []).map(u => {
    const statistik = u.statistik || {};
    const total = Array.isArray(u.data) ? u.data.length : 0;
    // flags.royal (opsional) — kalau royal.js sudah set, kita ikutkan ke view
    const flags = u.flags || undefined;
    return { user: u.user, total, statistik, flags };
  });
}

// ========== GET: List page ==========
router.get('/', requireLogin, async (req, res) => {
  let buyers = await readJson('buyers.json', []);
  if (!Array.isArray(buyers)) buyers = [];

  // pastikan setiap user punya statistik terbaru
  buyers = buyers.map(updateStatistikPerUser);

  const buyersAggregated = buildAggregated(buyers);

  const toast = req.session.toast || null;
  delete req.session.toast;

  res.render('buyers', { buyers, buyersAggregated, toast });
});

// ========== POST: Simpan entri baru ==========
router.post('/save', requireLogin, async (req, res) => {
  // NOTE: kalau ingin hanya owner yang boleh input di panel, ganti requireLogin -> requireOwner di atas.
  let { user, apk, email, durasi, dateGiven, exp, invite } = req.body;

  // validasi minimal sesuai form (invite opsional)
  user = normNum(user);
  apk = (apk || '').toLowerCase().trim();
  email = (email || '').trim();
  durasi = (durasi || '').trim();
  dateGiven = (dateGiven || '').trim();
  exp = (exp || '').trim();
  invite = (invite || '').trim(); // opsional

  const errors = [];
  if (!user) errors.push('Nomor WA wajib diisi.');
  if (!apk) errors.push('APK wajib dipilih.');
  if (!email) errors.push('Email pembeli wajib diisi.');
  if (!durasi) errors.push('Durasi wajib diisi.');
  if (!dateGiven) errors.push('Tanggal pemberian wajib diisi.');
  if (!exp) errors.push('Expired wajib diisi.');
  // invite opsional — tidak divalidasi

  if (errors.length) {
    req.session.toast = { type: 'danger', msg: `Gagal menyimpan: ${errors.join(' ')}` };
    return res.redirect('/buyers');
  }

  // siapkan entri transaksi
  const trx = {
    apk,
    email,
    durasi,
    dateGiven, // yyyy-mm-dd dari input
    exp,       // yyyy-mm-dd dari input
    invite: invite || '-'  // biar tabel gak kosong
  };

  let buyers = await readJson('buyers.json', []);
  if (!Array.isArray(buyers)) buyers = [];

  // cari user
  let idx = buyers.findIndex(b => b.user === user);
  if (idx === -1) {
    // user baru
    buyers.push({
      user,
      data: [trx],
      flags: { royal: false } // default — nanti diupdate oleh royal.js via /buy / handler WA
    });
    idx = buyers.length - 1;
  } else {
    // user lama → push transaksi
    buyers[idx].data = Array.isArray(buyers[idx].data) ? buyers[idx].data : [];
    buyers[idx].data.push(trx);
  }

  // refresh statistik user
  buyers[idx] = updateStatistikPerUser(buyers[idx]);

  await writeJson('buyers.json', buyers);

  req.session.toast = { type: 'success', msg: 'Data buyer berhasil disimpan.' };
  res.redirect('/buyers');
});

module.exports = router;
