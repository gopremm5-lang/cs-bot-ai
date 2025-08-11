// routes/analytics.js
const express = require('express');
const { requireLogin } = require('../lib/auth');
const { compute } = require('../lib/analytics');

const router = express.Router();

router.get('/', requireLogin, async (req,res)=>{
  const data = await compute();
  // bisa tambahkan toast kalau perlu
  res.render('analytics/index', { title:'Analytics', data, toast: null });
});

module.exports = router;
