const express = require('express');
const router = express.Router();
const { loadSOP, saveSOP, deleteSOP } = require('../lib/dataLoader');
const { requireLogin, requireOwner } = require('../lib/auth');

router.get("/", requireLogin, async (req, res) => {
  const sop = await loadSOP() || [];
  const toast = req.session.toast || null;
  delete req.session.toast;
  res.render("sop", { sop, toast });
});

router.post("/save", requireOwner, async (req, res) => {
  const { trigger, response } = req.body;
  await saveSOP(trigger, response);
  req.session.toast = { type: "success", msg: "SOP berhasil ditambahkan!" };
  res.redirect('/sop');
});

router.post("/delete", requireOwner, async (req, res) => {
  const { file } = req.body;
  await deleteSOP(file);
  req.session.toast = { type: "success", msg: "SOP dihapus!" };
  res.redirect('/sop');
});

module.exports = router;
