// routes/promo.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { requireLogin, requireOwner } = require('../lib/auth');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');
const PROMO_FILE = path.join(DATA_DIR, 'promos.json');

async function loadJson(){
  try { return JSON.parse(await fs.readFile(PROMO_FILE,'utf8')); } catch { return []; }
}
async function saveJson(arr){
  await fs.writeFile(PROMO_FILE, JSON.stringify(arr,null,2),'utf8');
}

router.get('/', requireLogin, async (req,res)=>{
  const promo = await loadJson();
  const toast = req.session.toast || null; delete req.session.toast;
  res.render('promo/index', { title:'Promo', promo, toast });
});

router.post('/save', requireOwner, async (req,res)=>{
  const { idx, on, apk, embedOnly, startAt, endAt, shortLine, text } = req.body;
  let promo = await loadJson();
  const item = {
    on: !!on,
    apk: (apk||'').trim() || null,        // kosong = generic
    embedOnly: !!embedOnly,               // hanya embedded, bukan blast
    startAt: startAt || null,
    endAt: endAt || null,
    shortLine: (shortLine||'').trim(),
    text: (text||'').trim()
  };
  if (idx === '' || idx === undefined) promo.push(item);
  else promo[Number(idx)] = item;
  await saveJson(promo);
  req.session.toast = { type:'success', msg:'Promo disimpan.' };
  res.redirect('/promo');
});

router.post('/delete', requireOwner, async (req,res)=>{
  const { idx } = req.body;
  let promo = await loadJson();
  promo.splice(Number(idx),1);
  await saveJson(promo);
  req.session.toast = { type:'success', msg:'Promo dihapus.' };
  res.redirect('/promo');
});

module.exports = router;
