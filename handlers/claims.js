// handlers/claims.js
const { loadJson, saveJson } = require('../lib/dataLoader');
const { extractAPK, extractCategory, extractInviteEmail, detectPriority, summarize } = require('../utils/claimParser');
const { linkBuyer, unlinkBuyer, getAccount, findCandidates } = require('../lib/stock');

const CLAIMS_FILE = 'claims.json';

// thresholds & SLA bisa dari apk_rules.json (opsional)
const ROYAL_MIN_ORDERS = 10; // dlm 90 hari — nanti hitung di users.json (Sprint C)
const DEFAULT_SLA = { P1: 3, P2: 12, P3: 48 }; // jam

function newId(prefix='clm'){
  const ts = new Date().toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.floor(Math.random()*1e5).toString().padStart(5,'0');
  return `${prefix}_${ts}_${rand}`;
}
function addHours(date, hours){
  const d = new Date(date); d.setHours(d.getHours()+hours); return d.toISOString();
}

async function createFromUserText({ reporter, text }){
  const claims = await loadJson(CLAIMS_FILE)||[];
  const apk = extractAPK(text) || 'unknown';
  const category = extractCategory(text);
  const invite_email = extractInviteEmail(text);
  const priority = detectPriority(text);
  const now = new Date().toISOString();

  const id = newId();
  const item = {
    id, createdAt: now, reporter,
    apk, category,
    buyer_id: null, owner_email: null, invite_email: invite_email || null,
    reason: summarize(text), evidence: [],
    priority, status: 'PENDING_ADMIN_REVIEW',
    timeline: [{ at: now, by: 'system', action: 'CREATE', note: 'user-initiated via bot' }],
    slaDue: addHours(now, DEFAULT_SLA[priority] || 24)
  };
  claims.push(item);
  await saveJson(CLAIMS_FILE, claims);
  return item;
}

async function createFromAdminForm({ reporter, apk, category, invite_email, owner_email, reason, evidence }){
  const claims = await loadJson(CLAIMS_FILE)||[];
  const now = new Date().toISOString();
  const priority = 'P3'; // admin usul nanti, owner finalkan
  const id = newId();
  const item = {
    id, createdAt: now, reporter,
    apk: apk||'unknown', category: category||'klaim',
    buyer_id: null, invite_email: invite_email||null, owner_email: owner_email||null,
    reason: reason||'-', evidence: evidence||[],
    priority, status: 'READY_FOR_OWNER',
    timeline: [{ at: now, by: 'admin', action: 'CREATE', note: 'admin-form' }],
    slaDue: addHours(now, DEFAULT_SLA[priority] || 24)
  };
  claims.push(item);
  await saveJson(CLAIMS_FILE, claims);
  return item;
}

async function adminVerifyAndPromote(id, patch={}){
  const claims = await loadJson(CLAIMS_FILE)||[];
  const idx = claims.findIndex(x => x.id === id);
  if (idx<0) return null;
  const now = new Date().toISOString();
  Object.assign(claims[idx], patch);
  claims[idx].status = 'READY_FOR_OWNER';
  claims[idx].timeline.push({ at: now, by:'admin', action:'PROMOTE', note:'verified' });
  await saveJson(CLAIMS_FILE, claims);
  return claims[idx];
}

async function ownerSetPriority(id, priority){
  const claims = await loadJson(CLAIMS_FILE)||[];
  const idx = claims.findIndex(x => x.id === id);
  if (idx<0) return null;
  const now = new Date().toISOString();
  claims[idx].priority = priority;
  claims[idx].timeline.push({ at: now, by:'owner', action:'PRIORITY', note:priority });
  await saveJson(CLAIMS_FILE, claims);
  return claims[idx];
}

async function ownerResolve(id, note='resolved'){
  const claims = await loadJson(CLAIMS_FILE)||[];
  const idx = claims.findIndex(x => x.id === id);
  if (idx<0) return null;
  const now = new Date().toISOString();
  claims[idx].status = 'RESOLVED';
  claims[idx].timeline.push({ at: now, by:'owner', action:'RESOLVE', note });
  await saveJson(CLAIMS_FILE, claims);
  return claims[idx];
}

async function ownerReplace({ id, target_apk, target_account_id, buyer_id }){
  // SINI hanya catat; link/unlink buyer dilakukan oleh owner di layar Stock
  const claims = await loadJson(CLAIMS_FILE)||[];
  const idx = claims.findIndex(x => x.id === id);
  if (idx<0) return null;
  const now = new Date().toISOString();
  claims[idx].status = 'REPLACED';
  claims[idx].timeline.push({ at: now, by:'owner', action:'REPLACE', note:`to ${target_apk}/${target_account_id} for ${buyer_id}` });
  await saveJson(CLAIMS_FILE, claims);
  return claims[idx];
}

async function listClaims(filter={}){
  const claims = await loadJson(CLAIMS_FILE)||[];
  // filter sederhana
  return claims.filter(c => {
    if (filter.status && c.status !== filter.status) return false;
    if (filter.apk && c.apk !== filter.apk) return false;
    return true;
  });
}
async function getClaim(id){
  const claims = await loadJson(CLAIMS_FILE)||[];
  return claims.find(c => c.id === id) || null;
}

module.exports = {
  createFromUserText,
  createFromAdminForm,
  adminVerifyAndPromote,
  ownerSetPriority,
  ownerResolve,
  ownerReplace,
  listClaims,
  getClaim
};
