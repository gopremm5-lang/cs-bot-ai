const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const router = express.Router();
const { requireLogin, requireOwner } = require('../lib/auth');

function setToast(req, type, msg) {
  req.session.toast = { type, msg };
}
const dataPath = path.join(__dirname, "../data/stock.json");
async function loadStock() {
  try { return JSON.parse(await fs.readFile(dataPath, "utf8")); } catch { return []; }
}
async function saveStock(data) {
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2), "utf8");
}

// Tampil stock
router.get("/", requireLogin, async (req, res) => {
  const stock = await loadStock();
  const toast = req.session.toast || null;
  delete req.session.toast;
  res.render("stock", { stock, toast });
});

// Tambah akun baru
router.post("/add", requireOwner, async (req, res) => {
  const { apk, email, pin, dateCreated, exp } = req.body;
  if (!apk || !email || !pin || !dateCreated || !exp) {
    setToast(req, "danger", "Semua field wajib diisi.");
    return res.redirect("/stock");
  }
  const stock = await loadStock();
  stock.push({ apk, email, pin, dateCreated, exp, slots: [] });
  await saveStock(stock);
  setToast(req, "success", "Akun baru ditambahkan.");
  res.redirect("/stock");
});

// Tambah slot baru ke email tertentu
router.post("/add-slot", requireOwner, async (req, res) => {
  const { apk, email, userEmail, userNumber, pin, duration, dateCreated, exp } = req.body;
  if (!apk || !email || !userEmail || !userNumber || !pin || !duration || !dateCreated || !exp) {
    setToast(req, "danger", "Semua field slot wajib diisi!");
    return res.redirect("/stock");
  }
  const stock = await loadStock();
  const idx = stock.findIndex(a => a.apk.toLowerCase() === apk.toLowerCase() && a.email === email);
  if (idx < 0) {
    setToast(req, "danger", "Akun tidak ditemukan.");
    return res.redirect("/stock");
  }
  stock[idx].slots = stock[idx].slots || [];
  stock[idx].slots.push({ userEmail, userNumber, pin, duration, dateCreated, exp });
  await saveStock(stock);
  setToast(req, "success", "Slot berhasil ditambahkan.");
  res.redirect("/stock");
});

// Hapus akun/email
router.get("/delete", requireOwner, async (req, res) => {
  const { apk, idx } = req.query;
  let stock = await loadStock();
  const filtered = stock.filter((a, i) => !(a.apk.toLowerCase() === apk && i == idx));
  await saveStock(filtered);
  setToast(req, "success", "Akun/email dihapus.");
  res.redirect("/stock");
});

module.exports = router;
