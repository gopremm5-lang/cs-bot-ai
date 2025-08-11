// handlers/buyersAdd.js
// /buy interaktif + fleksibel, output rapi pakai blockquote WhatsApp

const {
  parseFlexible,
  parsePatch,
  validateRequired,
  suggestByApk,
  todayJakartaYMD
} = require('../utils/buyParser');

const { loadJson, saveJson } = require('../lib/dataLoader');
const {
  getSession,
  createOrReplace,
  mergePatch,
  endSession,
  setSuggestOpen,
  getSuggestOpen,
  setNudgeOnce,
  clearNudge
} = require('../lib/buySession');

/* =========================
   UTIL SIMPAN / BUYERS.JSON
   ========================= */
async function addBuyerEntry({ user, apk, email, durasi, dateGiven, exp, invite }) {
  let buyersData = await loadJson("buyers.json");
  if (!Array.isArray(buyersData)) buyersData = [];

  const transaksi = { apk, email, durasi, dateGiven, exp, invite };
  let idx = buyersData.findIndex(b => b.user === user);

  if (idx === -1) {
    buyersData.push({
      user,
      statistik: { [apk]: { total: 1, rincian: { [durasi]: 1 } } },
      data: [ transaksi ]
    });
  } else {
    buyersData[idx].data = buyersData[idx].data || [];
    buyersData[idx].data.push(transaksi);

    buyersData[idx].statistik = buyersData[idx].statistik || {};
    if (!buyersData[idx].statistik[apk]) buyersData[idx].statistik[apk] = { total: 0, rincian: {} };
    buyersData[idx].statistik[apk].total += 1;
    buyersData[idx].statistik[apk].rincian[durasi] =
      (buyersData[idx].statistik[apk].rincian[durasi] || 0) + 1;
  }

  await saveJson("buyers.json", buyersData);
}

/* =========================
   FORMAT PESAN (BLOCKQUOTE)
   ========================= */

// blok data utama (rapi + markup WA)
function blockquoteData(fields) {
  return [
    `> WA: ${fields.user ? `\`${fields.user}\`` : '-'}`,
    `> APK: ${fields.apk ? `\`${fields.apk}\`` : '-'}`,
    `> Email layanan: ${fields.email ? `\`${fields.email}\`` : '-'}`,
    `> Durasi layanan: ${fields.durasi || '-'}`,
    `> Tanggal pemberian: ${fields.dateGiven ? `\`${fields.dateGiven}\`` : '-'}`,
    `> Exp/Garansi: ${fields.exp ? `\`${fields.exp}\`` : '-'}`,
    `> Email di-invite: ${fields.invite ? `\`${fields.invite}\`` : '-'}`
  ].join('\n');
}

// contoh singkat per error (maks 2 contoh)
function compactExamples(errors) {
  const ex = [];
  if (errors.user)   ex.push('`0812xxxx`');
  if (errors.apk)    ex.push('`netflix`');
  if (errors.durasi) ex.push('`1 bulan`');
  if (errors.exp)    ex.push('`2026-02-10`');
  return ex.slice(0, 2).join(' | ');
}

// pesan: kurang/invalid (WAJIB)
function buildMissingMessage(fields, errors) {
  const lines = [];
  lines.push('⚠️ *Data belum lengkap / invalid*\n');
  lines.push(blockquoteData(fields));
  lines.push('\n⚠️ Yang belum:');

  // tampilkan maks 3 error
  const list = Object.values(errors).slice(0, 3);
  if (list.length === 0) lines.push('• -');
  else lines.push(list.map(e => `• ${e.replace(/Contoh:.*/i, '').trim()}`).join('\n'));

  const ex = compactExamples(errors);
  if (ex) {
    lines.push('\n💡 Contoh cepat: ' + ex);
  }

  lines.push('\nBalas *hanya* data yang kurang (satu baris).');
  return lines.join('\n');
}

// pesan: saran opsional (registry)
function buildSuggestMessage(fields, suggests) {
  const bullets = [];
  if (suggests.includes('email akun (service)'))  bullets.push('• Isi *Email layanan (akun)* (disarankan).');
  if (suggests.includes('email di-invite (buyer)')) bullets.push('• Isi *Email di-invite (buyer)* (jika via undangan).');

  return [
    'ℹ️ *Data tambahan disarankan*\n',
    blockquoteData(fields),
    '\n' + (bullets.length ? bullets.join('\n') : '• -'),
    '\n💡 Contoh: `email akun: service@kita.com`  |  `invite buyer@mail.com`',
    'Balas salah satu atau ketik `skip` untuk lanjut.'
  ].join('\n');
}

// pesan: sukses simpan
function buildSuccessMessage(fields) {
  return [
    '✅ *Data pembelian berhasil disimpan*\n',
    blockquoteData(fields)
  ].join('\n');
}

/* =========================
   HANDLER UTAMA
   ========================= */

async function onBuyCommand(text, reply, senderJid) {
  const f0 = parseFlexible(text);
  if (!f0.dateGiven) f0.dateGiven = todayJakartaYMD();

  const { ok, errors, fields } = validateRequired({ ...f0 });
  createOrReplace(senderJid, fields);

  if (!ok) {
    await reply(buildMissingMessage(fields, errors));
    // nudge otomatis 1 menit (sekali)
    setNudgeOnce(senderJid, () => {
      reply('⏰ *Reminder:* lengkapi data yang kurang ya. Contoh: `exp 6 bln`');
    }, 60000);
    return;
  }

  // lolos wajib → cek saran opsional berdasar APK
  const { suggests } = suggestByApk(fields);
  if (suggests.length) {
    setSuggestOpen(senderJid, suggests);
    await reply(buildSuggestMessage(fields, suggests));
    setNudgeOnce(senderJid, () => {
      reply('⏰ *Reminder:* boleh isi `email akun`/`invite`, atau balas `skip` untuk lanjut.');
    }, 60000);
    return;
  }

  // tidak ada saran → simpan
  await addBuyerEntry(fields);
  endSession(senderJid);
  await reply(buildSuccessMessage(fields));
}

async function onBuyPatch(text, reply, senderJid) {
  const sess = getSession(senderJid);
  if (!sess) return false;

  // SKIP saran opsional?
  if (text.trim().toLowerCase() === 'skip') {
    clearNudge(senderJid);
    setSuggestOpen(senderJid, null);
    await addBuyerEntry(sess.fields);
    endSession(senderJid);
    await reply(buildSuccessMessage(sess.fields));
    return true;
  }

  const patch = parsePatch(text, sess.fields.dateGiven || todayJakartaYMD());
  const merged = mergePatch(senderJid, patch);

  // jika ada saran terbuka, cek lagi
  const open = getSuggestOpen(senderJid);
  if (open && open.length) {
    const still = [];
    if (open.includes('email akun (service)') && !merged.email)  still.push('email akun (service)');
    if (open.includes('email di-invite (buyer)') && !merged.invite) still.push('email di-invite (buyer)');

    if (still.length) {
      await reply(buildSuggestMessage(merged, still));
      return true;
    } else {
      setSuggestOpen(senderJid, null);
    }
  }

  // validasi wajib ulang
  const { ok, errors, fields } = validateRequired({ ...merged });
  if (!ok) {
    await reply(buildMissingMessage(fields, errors));
    setNudgeOnce(senderJid, () => {
      reply('⏰ *Reminder:* lengkapi data yang kurang ya. Contoh: `exp 6 bln`');
    }, 60000);
    return true;
  }

  // cek saran lagi (misal APK berubah)
  const { suggests } = suggestByApk(fields);
  if (suggests.length) {
    setSuggestOpen(senderJid, suggests);
    await reply(buildSuggestMessage(fields, suggests));
    setNudgeOnce(senderJid, () => {
      reply('⏰ *Reminder:* boleh isi `email akun`/`invite`, atau balas `skip` untuk lanjut.');
    }, 60000);
    return true;
  }

  // simpan final
  clearNudge(senderJid);
  await addBuyerEntry(fields);
  endSession(senderJid);
  await reply(buildSuccessMessage(fields));
  return true;
}

/* =========================
   UTIL COMMANDS
   ========================= */

async function onBuyStatus(reply, senderJid) {
  const s = getSession(senderJid);
  if (!s) {
    await reply('ℹ️ Tidak ada sesi /buy yang aktif.');
    return;
  }
  await reply(
    '🧾 *Status sementara*\n\n' +
    blockquoteData(s.fields) +
    '\n\nBalas isi yang kurang atau ketik `skip` untuk lanjut.'
  );
}

async function onBuyCancel(reply, senderJid) {
  const s = getSession(senderJid);
  if (!s) return await reply('ℹ️ Tidak ada sesi /buy yang aktif.');
  endSession(senderJid);
  await reply('✅ Sesi /buy dibatalkan.');
}

async function onBuyHelp(reply) {
  await reply(
`📘 *Panduan cepat /buy*
- Bebas urutan, contoh minimal:
  \`/buy 0812xxxx netflix 1 bln exp 6 bln\`
- Contoh YouTube (via invite):
  \`/buy youtube 0895xxxx 1 th exp 6 bln email akun: service@kita.com invite buyer@mail.com\`

Kata kunci:
- WA: 08… / +62… / 62…
- Durasi: 7 hari / 2 mgg / 3 bln / 1 th
- Exp (wajib): \`exp 6 bln\` / \`exp 2025-12-31\`
- Email layanan (akun): \`email akun: service@kita.com\`
- Invite (buyer): \`invite buyer@mail.com\`

Perintah:
- /buy-status  •  /buy-cancel  •  /buy-help
- Balas \`skip\` untuk lewati data opsional (saran).`
  );
}

module.exports = {
  onBuyCommand,
  onBuyPatch,
  onBuyStatus,
  onBuyCancel,
  onBuyHelp
};
