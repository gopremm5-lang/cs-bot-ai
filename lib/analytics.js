// lib/analytics.js
const path = require('path');
const fs = require('fs').promises;

const DATA = p => path.join(__dirname, '..', 'data', p);

async function read(file, fallback){
  try { return JSON.parse(await fs.readFile(DATA(file), 'utf8')); }
  catch { return fallback; }
}

function startOfDay(ts=new Date()){
  const d = new Date(ts); d.setHours(0,0,0,0); return d;
}
function daysAgo(n){
  const d = new Date(); d.setDate(d.getDate()-n); d.setHours(0,0,0,0); return d;
}
function toKey(d){ const x = new Date(d); return x.toISOString().slice(0,10); }

function inRange(ts, from, to){
  const t = new Date(ts).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

async function compute(){
  const buyers     = await read('buyers.json', []);
  const claims     = await read('claims.json', []);
  const blacklist  = await read('blacklist.json', []);

  const today = startOfDay();
  const last30 = daysAgo(30);
  const last90 = daysAgo(90);

  // === Daily Active Chat Users (aproksimasi dari buyers & claims) ===
  // kalau kamu punya log chat harian sendiri, ganti bagian ini pakai log tsb.
  const dauMap = {};
  for (const b of buyers){
    for (const tr of (b.data||[])){
      const k = toKey(tr.createdAt || tr.dateGiven || tr.ts || tr.date || new Date());
      dauMap[k] = (dauMap[k]||0) + 1;
    }
  }
  for (const c of claims){
    const k = toKey(c.createdAt || c.timestamp || c.created || new Date());
    dauMap[k] = (dauMap[k]||0) + 1;
  }
  const dauSeries = [];
  for (let i=29;i>=0;i--){
    const k = toKey(daysAgo(i));
    dauSeries.push({ day:k, count: dauMap[k]||0 });
  }

  // === Claims per APK (30 hari) ===
  const claimsByApk = {};
  for (const c of claims){
    const ts = new Date(c.createdAt || c.timestamp || new Date());
    if (!inRange(ts, last30, today)) continue;
    const apk = (c.apk||'unknown').toLowerCase();
    claimsByApk[apk] = (claimsByApk[apk]||0)+1;
  }
  const claimsByApkArr = Object.keys(claimsByApk).sort((a,b)=>claimsByApk[b]-claimsByApk[a]).map(k=>({ apk:k, count:claimsByApk[k] }));

  // === Status Claim breakdown ===
  const byStatus = {};
  for (const c of claims){
    const s = (c.status||'UNKNOWN').toUpperCase();
    byStatus[s] = (byStatus[s]||0)+1;
  }
  const statusArr = Object.keys(byStatus).map(s=>({ status:s, count:byStatus[s] }));

  // === Royal vs Non-Royal (90 hari) ===
  let royalCnt=0, nonRoyalCnt=0;
  for (const b of buyers){
    // order dalam 90 hari
    const recent = (b.data||[]).filter(tr=>{
      const ts = new Date(tr.createdAt || tr.dateGiven || tr.ts || new Date());
      return inRange(ts, last90, today);
    });
    if (recent.length >= 10) royalCnt++; else nonRoyalCnt++;
  }

  // === Blacklist breakdown ===
  const blLevels = { ABU:0, MERAH:0, HITAM:0 };
  for (const x of (blacklist||[])){
    const lvl = (x.level||'ABU').toUpperCase();
    if (blLevels[lvl]===undefined) blLevels[lvl]=0;
    blLevels[lvl]++;
  }
  const blacklistArr = Object.keys(blLevels).map(k=>({ level:k, count:blLevels[k] }));

  // === Ringkas untuk KPI di atas ===
  const kpi = {
    buyersTotal: buyers.length,
    claimsTotal: claims.length,
    blacklistTotal: (blacklist||[]).length,
    royalTotal: royalCnt,
    nonRoyalTotal: nonRoyalCnt
  };

  return { kpi, dauSeries, claimsByApk: claimsByApkArr, statusArr, blacklistArr };
}

module.exports = { compute };
