// utils/buyParser.js
// Parser fleksibel + validator wajib (WA, APK, Durasi, Exp)
// Email akun & email invite sifatnya disarankan (via apkRegistry)

const apkRegistry = require('./apkRegistry');

const VALID_APK = [
  "alight motion","apple music","bstation","canva","capcut","catchplay","chatgpt","disney","disney+",
  "get contact","hbo max","iqiyi","netflix","picsart","prime vidio","remini",
  "vidio","vision+","viu","wetv","youtube"
];

const APK_ALIASES = {
  'yt':'youtube','youtube premium':'youtube','ytp':'youtube','youtube':'youtube',
  'netflix':'netflix','nflx':'netflix',
  'disney+':'disney+','disney plus':'disney+','hotstar':'disney+','disney':'disney',
  'viu':'viu','iqiyi':'iqiyi','iqy':'iqiyi',
  'vidio':'vidio','vision+':'vision+','vision plus':'vision+',
  'getcontact':'get contact','get contact':'get contact',
  'hbo':'hbo max','hbo max':'hbo max',
  'alight':'alight motion','alight motion':'alight motion',
  'apple music':'apple music','bstation':'bstation','bili':'bstation',
  'canva':'canva','capcut':'capcut','catchplay':'catchplay',
  'chatgpt':'chatgpt','picsart':'picsart','prime':'prime vidio',
  'remini':'remini','wetv':'wetv'
};

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// ==== waktu/tanggal (WIB) ====
function toYMD(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function todayJakartaYMD(){
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset()*60000);
  return toYMD(new Date(utc + 7*60*60000));
}
function parseDateAny(s){
  if (!s) return '';
  s = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                 // YYYY-MM-DD
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);             // DD/MM/YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return '';
}

// ==== normalisasi nomor WA ====
function normWa(s){
  if (!s) return '';
  let n = String(s).replace(/[^\d+]/g,'');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('08')) n = '62' + n.slice(1);
  if (n.startsWith('0'))  n = '62' + n.slice(1);
  if (!/^\d{10,15}$/.test(n)) return '';
  return n;
}

// ==== durasi & exp ====
function addDuration(baseYMD, durasiStr){
  if (!durasiStr) return '';
  let d = new Date(baseYMD);
  if (isNaN(d.getTime())) d = new Date();

  const t = durasiStr.toLowerCase();
  const m = t.match(/(\d+)\s*(hari|hr|h|d|minggu|mgg|pekan|wk|bulan|bln|b|tahun|thn|th|yr)/);
  if (!m) return '';
  const n = parseInt(m[1],10);
  const u = m[2];

  if (/(hari|hr|h|d)/.test(u))              d.setDate(d.getDate() + n);
  else if (/(minggu|mgg|pekan|wk)/.test(u)) d.setDate(d.getDate() + n*7);
  else if (/(bulan|bln|b)/.test(u))         d.setMonth(d.getMonth() + n);
  else if (/(tahun|thn|th|yr)/.test(u))     d.setFullYear(d.getFullYear() + n);

  return toYMD(d);
}

// ==== ekstraksi bebas ====
function findApk(text){
  const low = text.toLowerCase();
  for (const key of Object.keys(APK_ALIASES)) {
    if (low.includes(key)) {
      const name = APK_ALIASES[key];
      if (VALID_APK.includes(name)) return name;
    }
  }
  for (const name of VALID_APK) {
    if (low.includes(name)) return name;
  }
  return '';
}
function findWa(text){
  const m1 = text.match(/\b(wa|hp|no|nomor|phone)\b\s*[:=]?\s*([+]?\d[\d\s-]{6,})/i);
  if (m1) { const n = normWa(m1[2]); if (n) return n; }
  const m2 = text.match(/[+]?\d[\d\s-]{8,}/g);
  if (m2) {
    for (const cand of m2) {
      const n = normWa(cand);
      if (n) return n;
    }
  }
  return '';
}
function splitEmails(text){
  const found = text.match(EMAIL_RE) || [];
  return [...new Set(found.map(e => e.trim()))];
}
function findDurasi(text){
  const m = text.toLowerCase().match(/(\d+)\s*(hari|hr|h|d|minggu|mgg|pekan|wk|bulan|bln|b|tahun|thn|th|yr)/);
  return m ? m[0] : '';
}
function findExp(text, baseYMD){
  const low = text.toLowerCase();
  const blk = low.match(/\b(exp|garansi|expired)\b[^a-z0-9]{0,10}([0-9/-]{8,}|(\d+\s*(hari|hr|h|d|minggu|mgg|pekan|wk|bulan|bln|b|tahun|thn|th|yr)))/i);
  if (blk) {
    const val = blk[2] || '';
    const asDate = parseDateAny(val);
    if (asDate) return asDate;
    const asDur  = addDuration(baseYMD, val);
    if (asDur) return asDur;
  }
  return '';
}

// ==== parser utama ====
function parseFlexible(msg){
  const body = msg.replace(/^\/buy\b/i,'').trim();
  const text = body.replace(/\s+/g,' ').trim();

  const dateGiven = (() => {
    const tg = text.match(/\b(tgl|tanggal|dategiven)\b\s*[:=]?\s*([0-9\/-]{8,})/i);
    if (tg) {
      const t = parseDateAny(tg[2]);
      if (t) return t;
    }
    return todayJakartaYMD();
  })();

  const apk     = findApk(text);
  const user    = findWa(text);
  const emails  = splitEmails(text);

  // serviceEmail = email akun (kita), inviteEmail = email buyer
  let serviceEmail = '';
  let inviteEmail  = '';

  if (emails.length >= 2) {
    serviceEmail = emails[0];
    inviteEmail  = emails[1];
  } else if (emails.length === 1) {
    if (/\b(invite|undangan|iv)\b/i.test(text)) inviteEmail = emails[0];
    else serviceEmail = emails[0];
  }

  const durasi  = findDurasi(text);
  const exp     = findExp(text, dateGiven);

  return { user, apk, email: serviceEmail, invite: inviteEmail, durasi, dateGiven, exp };
}

// parser patch (untuk balasan lanjutan sesi)
function parsePatch(text, baseDateYMD){
  const out = {};
  const low = text.toLowerCase();

  const w = findWa(text);         if (w) out.user = w;
  const a = findApk(text);        if (a) out.apk = a;
  const d = findDurasi(text);     if (d) out.durasi = d;

  const e = findExp(text, baseDateYMD || todayJakartaYMD());
  if (e) out.exp = e;
  if (/^(exp|garansi|expired)\b/i.test(low) && !e) out._expMentioned = true;

  const tg = text.match(/\b(tgl|tanggal|dategiven)\b\s*[:=]?\s*([0-9\/-]{8,})/i);
  if (tg) { const t = parseDateAny(tg[2]); if (t) out.dateGiven = t; }

  const emails = splitEmails(text);
  if (emails.length) {
    if (/\b(invite|undangan|iv)\b/i.test(low)) out.invite = emails[emails.length-1];
    else out.email = emails[emails.length-1];
  }
  const invKey = low.match(/\b(invite|undangan|iv)\b\s*[:=]?\s*([^\s,;]+)/i);
  if (invKey && !out.invite) {
    const em = (invKey[2]||'').match(EMAIL_RE);
    out.invite = em ? em[0] : invKey[2];
  }

  return out;
}

// validasi wajib (email/ invite tidak wajib)
function validateRequired(fields){
  const errors = {};

  if (!fields.user)   errors.user   = 'WA belum ada. Contoh: 0812xxxx / 62812xxxx';
  else if (!normWa(fields.user)) errors.user = 'WA tidak valid. Gunakan 08… / +62… / 62… (10–15 digit).';

  if (!fields.apk)    errors.apk    = 'APK belum disebut. Contoh: netflix / disney / youtube / viu';
  else if (!VALID_APK.includes(fields.apk)) errors.apk = `APK "${fields.apk}" tidak dikenal.`;

  if (!fields.durasi) errors.durasi = 'Durasi belum ada. Contoh: 1 bln / 30 hari / 1 th.';
  else if (!addDuration(todayJakartaYMD(), fields.durasi)) errors.durasi = 'Durasi tidak dikenali. Contoh: 7 hari, 2 mgg, 3 bln, 1 th.';

  if (!fields.exp)    errors.exp    = 'Exp/garansi wajib. Contoh: exp 6 bln / exp 2025-12-31.';
  else {
    const asDate = parseDateAny(fields.exp);
    if (asDate) fields.exp = asDate;
    else {
      const computed = addDuration(fields.dateGiven || todayJakartaYMD(), fields.exp);
      if (computed) fields.exp = computed;
      else errors.exp = 'Format exp tidak dikenali. Contoh: exp 6 bln / exp 2025-12-31.';
    }
  }

  return { ok: Object.keys(errors).length===0, errors, fields };
}

// saran opsional berdasar registry
function suggestByApk(fields){
  const key = (fields.apk || '').toLowerCase();
  const rule = apkRegistry[key] || apkRegistry.default;

  const suggests = [];
  if (rule.suggestServiceEmail && !fields.email)  suggests.push('email akun (service)');
  if (rule.suggestInviteEmail  && !fields.invite) suggests.push('email di-invite (buyer)');

  return { rule, suggests };
}

module.exports = {
  parseFlexible,
  parsePatch,
  validateRequired,
  suggestByApk,

  todayJakartaYMD, toYMD, addDuration
};
