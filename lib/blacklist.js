// lib/blacklist.js
const path = require('path');
const fs = require('fs').promises;
const DATA = p => path.join(__dirname, '..', 'data', p);

async function read(){ try{ return JSON.parse(await fs.readFile(DATA('blacklist.json'),'utf8')); } catch { return []; } }
async function write(arr){ await fs.writeFile(DATA('blacklist.json'), JSON.stringify(arr,null,2),'utf8'); }

async function getLevel(msisdn){
  const bl = await read();
  const x = bl.find(b=>b.user===msisdn);
  return x ? (x.level||'ABU') : null;
}
async function warn(msisdn, reason){
  const bl = await read();
  let x = bl.find(b=>b.user===msisdn);
  if (!x){
    x = { user: msisdn, level:'ABU', strikes:1, reason, date: new Date().toISOString() };
    bl.push(x);
  } else {
    x.strikes = (x.strikes||0)+1;
    if (x.strikes>=6) x.level='HITAM';
    else if (x.strikes>=3) x.level='MERAH';
    x.reason = reason;
    x.date = new Date().toISOString();
  }
  await write(bl);
  return x.level;
}

module.exports = { getLevel, warn };
