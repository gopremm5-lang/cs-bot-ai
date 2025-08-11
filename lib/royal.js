// lib/royal.js
const path = require('path');
const fs = require('fs').promises;

const DATA = p => path.join(__dirname, '..', 'data', p);

async function read(file, fb){ try{ return JSON.parse(await fs.readFile(DATA(file),'utf8')); } catch { return fb; } }
async function write(file, data){ await fs.writeFile(DATA(file), JSON.stringify(data,null,2), 'utf8'); }

function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); d.setHours(0,0,0,0); return d; }
function inRange(ts, from, to){ const t=new Date(ts).getTime(); return t>=from.getTime() && t<=to.getTime(); }

async function updateOnBuy(buyerJid){
  const buyers = await read('buyers.json', []);
  const idx = buyers.findIndex(b=>b.user===buyerJid);
  if (idx<0) return; // belum masuk list
  const now = new Date(); const from = daysAgo(90);
  const recent = (buyers[idx].data||[]).filter(x=>{
    const ts = new Date(x.createdAt || x.dateGiven || x.ts || now);
    return inRange(ts, from, now);
  });
  buyers[idx].flags = buyers[idx].flags || {};
  buyers[idx].flags.royal = recent.length >= 10;
  // statistik simpel
  buyers[idx].statistik = buyers[idx].statistik || {};
  buyers[idx].statistik.orders90 = recent.length;
  await write('buyers.json', buyers);
  return buyers[idx].flags.royal;
}

module.exports = { updateOnBuy };
