const express = require('express');
const router = express.Router();
const { loadFAQ, saveFAQ, deleteFAQ } = require('../lib/dataLoader');
const { requireLogin, requireOwner } = require('../lib/auth');

router.get("/", requireLogin, async (req, res) => {
  const faq = await loadFAQ() || [];
  const toast = req.session.toast || null;
  delete req.session.toast;
  res.render("faq", { faq, toast });
});
router.post('/save', requireOwner, async (req, res) => {
  const { question, answer } = req.body;
  await saveFAQ(question, answer);
  req.session.toast = { type: "success", msg: "FAQ berhasil ditambahkan!" };
  res.redirect('/faq');
});

router.post('/delete', requireOwner, async (req, res) => {
  const { file } = req.body;
  await deleteFAQ(file);
  req.session.toast = { type: "success", msg: "FAQ dihapus!" };
  res.redirect('/faq');
});

module.exports = router;
