// lib/promo.js
const path = require('path');
const fs = require('fs').promises;

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROMO_FILE = path.join(DATA_DIR, 'promos.json');
const CLAIMS_FILE = path.join(DATA_DIR, 'claims.json');
const BLACKLIST_FILE = path.join(DATA_DIR, 'blacklist.json');

async function loadJson(file){
  try { return JSON.parse(await fs.readFile(file,'utf8')); } catch { return Array.isArray(file)?[]:[]; }
}

function nowISO(){ return new Date().toISOString(); }
function inRange(now, startAt, endAt){
  if (startAt && now < startAt) return false;
  if (endAt && now > endAt) return false;
  return true;
}

async function hasActiveClaim(userJid){
  const claims = await loadJson(CLAIMS_FILE);
  const active = (claims||[]).some(c =>
    c.reporter === userJid &&
    ['PENDING_ADMIN_REVIEW','READY_FOR_OWNER','IN_PROGRESS','WAITING_CUSTOMER'].includes(c.status)
  );
  return active;
}
async function isBlacklisted(user){
  const bl = await loadJson(BLACKLIST_FILE);
  return (bl||[]).some(b => (b.user||'') === user);
}

// extract keywords layanan
function extractAPKHint(text){
  const s = (text||'').toLowerCase();
  if (s.includes('youtube') || s.includes('yt')) return 'youtube';
  if (s.includes('netflix')) return 'netflix';
  if (s.includes('disney')) return 'disney';
  if (s.includes('spotify')) return 'spotify';
  if (s.includes('viu')) return 'viu';
  if (s.includes('alight')) return 'alight motion';
  return null;
}

/**
 * getEmbeddedPromo(text, userJid)
 * Mengembalikan 1 kalimat promo (string) atau null
 */
async function getEmbeddedPromo(text, userJid){
  const promos = await loadJson(PROMO_FILE);
  if (!Array.isArray(promos) || promos.length===0) return null;

  // eligibility
  if (await hasActiveClaim(userJid)) return null;
  const bare = (userJid||'').split('@')[0];
  if (await isBlacklisted(bare)) return null;

  const hint = extractAPKHint(text);
  const now = nowISO();

  // pilih promo on + embedOnly + cocok apk (atau generic)
  const candidates = promos.filter(p =>
    p.on === true &&
    (p.embedOnly === true) &&
    inRange(now, p.startAt||null, p.endAt||null) &&
    (!hint || !p.apk || p.apk===hint) // kalau p.apk ada → harus match; kalau tidak ada → generic
  );

  if (candidates.length === 0) return null;

  // pilih satu dengan prioritas (index terakhir dianggap terbaru)
  const pick = candidates[candidates.length-1];

  // bentuk kalimat pendek natural
  // contoh: “Lagi ada bundling YouTube Family 15%. Mau cek?”
  if (pick.shortLine && pick.shortLine.length <= 120) {
    return pick.shortLine;
  }
  // fallback dari text panjang, ambil kalimat pertama saja
  const sentence = String(pick.text||'').split(/\.\s+/)[0];
  if (!sentence) return null;
  return sentence.length>120 ? sentence.slice(0,117)+'…' : sentence + '.';
}

module.exports = { getEmbeddedPromo };
