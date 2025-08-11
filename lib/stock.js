// lib/stock.js
const { loadJson, saveJson } = require('./dataLoader');

const STOCK_FILE = 'stock.json';
const BUYERS_FILE = 'buyers.json';

async function ensureStock() {
  let s = await loadJson(STOCK_FILE);
  if (!s || typeof s !== 'object' || !Array.isArray(s.apk)) s = { apk: [] };
  return s;
}
async function saveStock(s) { await saveJson(STOCK_FILE, s); }

function maskEmail(email) {
  if (!email) return '-';
  const [u, d=''] = email.split('@');
  return u.slice(0,2) + '***@' + d;
}

async function allBuyerRows() {
  const buyers = await loadJson(BUYERS_FILE);
  const rows = [];
  for (const person of (buyers || [])) {
    const user = person.user;
    for (const tr of (person.data || [])) {
      rows.push({
        buyer_id: tr.id || null,
        apk: tr.apk,
        service_email: tr.email || '',
        invite: tr.invite || '',
        durasi: tr.durasi || '',
        dateGiven: tr.dateGiven || '',
        exp: tr.exp || '',
        user
      });
    }
  }
  return rows;
}

async function aggregateHeadline() {
  const s = await ensureStock();
  const buyers = await allBuyerRows();
  return s.apk.map(apkNode => {
    const accounts = apkNode.accounts || [];
    const totalAccounts = accounts.filter(a => a.status !== 'SUSPENDED').length;
    let used = 0, max = 0;
    for (const acc of accounts) { used += (acc.links||[]).length; max += (acc.max_slots||0); }
    const buyersCount = buyers.filter(r => r.apk === apkNode.name).length;
    return { apk: apkNode.name, totalAccounts, used, max, buyersCount };
  });
}

async function getApkNode(apkName) {
  const s = await ensureStock();
  let node = s.apk.find(x => x.name === apkName);
  if (!node) { node = { name: apkName, accounts: [] }; s.apk.push(node); await saveStock(s); }
  return node;
}

async function listAccounts(apkName) {
  const node = await getApkNode(apkName);
  return (node.accounts||[]).map(a => ({
    account_id: a.account_id,
    service_email: a.service_email,
    service_email_mask: maskEmail(a.service_email),
    // password disimpan plain; JANGAN render ini di UI admin.
    service_password_plain: a.service_password_plain || '',
    max_slots: a.max_slots || 0,
    status: a.status || 'ACTIVE',
    notes: a.notes || '',
    used: (a.links||[]).length
  }));
}

async function addAccount(apkName, { service_email, service_password, max_slots=0, notes='' }) {
  const s = await ensureStock();
  let node = s.apk.find(x => x.name === apkName);
  if (!node) { node = { name: apkName, accounts: [] }; s.apk.push(node); }
  const account_id = 'acc_' + apkName.replace(/\W+/g,'').toLowerCase() + '_' + Date.now();
  node.accounts.push({
    account_id,
    service_email,
    service_password_plain: service_password || '',
    max_slots: Number(max_slots)||0,
    notes,
    created_at: new Date().toISOString().slice(0,10),
    status: 'ACTIVE',
    links: []
  });
  await saveStock(s);
  return account_id;
}

async function getAccount(apkName, account_id) {
  const s = await ensureStock();
  const node = s.apk.find(x => x.name === apkName);
  if (!node) return null;
  return (node.accounts||[]).find(a => a.account_id === account_id) || null;
}

async function updateAccount(apkName, account_id, patch) {
  const s = await ensureStock();
  const node = s.apk.find(x => x.name === apkName);
  if (!node) return false;
  const acc = (node.accounts||[]).find(a => a.account_id === account_id);
  if (!acc) return false;
  if (patch.service_email      !== undefined) acc.service_email       = patch.service_email;
  if (patch.service_password   !== undefined) acc.service_password_plain = patch.service_password || '';
  if (patch.max_slots          !== undefined) acc.max_slots           = Number(patch.max_slots)||0;
  if (patch.notes              !== undefined) acc.notes                = patch.notes;
  if (patch.status             !== undefined) acc.status               = patch.status;
  await saveStock(s);
  return true;
}

async function linkBuyer(apkName, account_id, buyer_id) {
  const s = await ensureStock();
  const node = s.apk.find(x => x.name === apkName);
  if (!node) return { ok:false, reason:'NOT_FOUND' };
  const acc = (node.accounts||[]).find(a => a.account_id === account_id);
  if (!acc) return { ok:false, reason:'NOT_FOUND' };
  acc.links = acc.links || [];
  if (acc.links.find(l => l.buyer_id === buyer_id)) return { ok:true };
  if ((acc.max_slots||0) > 0 && acc.links.length >= acc.max_slots) return { ok:false, reason:'FULL' };
  acc.links.push({ buyer_id });
  await saveStock(s);
  return { ok:true };
}

async function unlinkBuyer(apkName, account_id, buyer_id) {
  const s = await ensureStock();
  const node = s.apk.find(x => x.name === apkName);
  if (!node) return false;
  const acc = (node.accounts||[]).find(a => a.account_id === account_id);
  if (!acc) return false;
  acc.links = (acc.links||[]).filter(l => l.buyer_id !== buyer_id);
  await saveStock(s);
  return true;
}

async function accountAssignments(apkName, account_id) {
  const acc = await getAccount(apkName, account_id);
  if (!acc) return { rows: [], meta: { used:0, max:0 } };
  const buyers = await allBuyerRows();
  const rows = (acc.links||[]).map(l => {
    const br = buyers.find(r => r.buyer_id === l.buyer_id) || {};
    const today = new Date().toISOString().slice(0,10);
    const expired = br.exp && br.exp < today;
    return {
      buyer_id: l.buyer_id,
      invite: br.invite || '-',
      user: br.user || '-',
      dateGiven: br.dateGiven || '-',
      exp: br.exp || '-',
      durasi: br.durasi || '-',
      status: expired ? 'EXPIRED' : 'ACTIVE'
    };
  });
  return { rows, meta: { used: (acc.links||[]).length, max: (acc.max_slots||0) } };
}

async function findCandidates(apkName, serviceEmail) {
  const buyers = await allBuyerRows();
  return buyers.filter(r => (r.apk||'').toLowerCase() === apkName.toLowerCase()
                         && (r.service_email||'').toLowerCase() === (serviceEmail||'').toLowerCase());
}

module.exports = {
  aggregateHeadline,
  listAccounts,
  addAccount,
  getAccount,
  updateAccount,
  linkBuyer,
  unlinkBuyer,
  accountAssignments,
  findCandidates
};
