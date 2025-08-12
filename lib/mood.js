// lib/mood.js
const path = require('path');
const fs = require('fs').promises;
const DATA = p => path.join(__dirname, '..', 'data', p);

async function read(){ try{ return JSON.parse(await fs.readFile(DATA('mood.json'),'utf8')); } catch { return []; } }
async function write(arr){ await fs.writeFile(DATA('mood.json'), JSON.stringify(arr,null,2),'utf8'); }

function scoreText(t){
  const s = (t||'').toLowerCase();
  const neg = /(kesal|marah|refund|bohong|penipuan|buruk|nggak bisa|tidak bisa|gagal|lama|jelek|hancur)/;
  const pos = /(makasih|bagus|mantap|top|cepat|suka|keren|terima kasih)/;
  if (neg.test(s)) return -1;
  if (pos.test(s)) return +1;
  return 0;
}

async function update(jid, text){
  const arr = await read();
  const idx = arr.findIndex(x=>x.user===jid);
  const sc = scoreText(text);
  const now = new Date().toISOString();
  if (idx<0){
    arr.push({ user: jid, last: now, score: sc });
  } else {
    arr[idx].last = now;
    arr[idx].score = Math.max(-3, Math.min(3, (arr[idx].score||0) + sc));
  }
  await write(arr);
  return arr[idx<0?arr.length-1:idx].score;
}

async function get(jid){
  const arr = await read();
  const x = arr.find(v=>v.user===jid);
  return x ? x.score||0 : 0;
}

module.exports = { update, get };
