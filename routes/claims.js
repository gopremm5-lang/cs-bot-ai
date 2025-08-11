// routes/claims.js
const express = require('express');
const router = express.Router();
const {
  listClaims, getClaim,
  ownerSetPriority, ownerResolve, ownerReplace
} = require('../handlers/claims');

router.get('/', async (req,res)=>{
  const claims = await listClaims({});
  res.render('claims/index', { title: 'Claims', claims, toast:null });
});

router.get('/:id', async (req,res)=>{
  const cl = await getClaim(req.params.id);
  if (!cl) return res.status(404).send('Not found');
  res.render('claims/detail', { title:`Claim ${cl.id}`, claim:cl, toast:null });
});

router.post('/:id/priority', async (req,res)=>{
  await ownerSetPriority(req.params.id, req.body.priority);
  res.redirect('/claims/'+req.params.id);
});

router.post('/:id/resolve', async (req,res)=>{
  await ownerResolve(req.params.id, req.body.note||'');
  res.redirect('/claims/'+req.params.id);
});

router.post('/:id/replace', async (req,res)=>{
  const { target_apk, target_account_id, buyer_id } = req.body;
  await ownerReplace({ id:req.params.id, target_apk, target_account_id, buyer_id });
  res.redirect('/claims/'+req.params.id);
});

module.exports = router;
