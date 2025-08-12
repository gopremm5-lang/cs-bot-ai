require('dotenv').config();
const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs").promises;

const { loadFAQ, loadSOP }   = require('./lib/dataLoader');
const { requireLogin, requireOwner } = require('./lib/auth');

const app  = express();
const PORT = process.env.PORT || 9011;
const ADMIN_PASS = process.env.ADMIN_PASS || "Konfirmasi";
const OWNER_PASS = process.env.OWNER_PASS || "OwnerKonfirmasi";

/* ================== SETUP ================== */
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'vylozzone_secret_12345',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 8 * 60 * 60 * 1000 }
}));
app.use((req, res, next) => { res.locals.role = req.session.role; next(); });

/* ================== HELPERS ================== */
function setToast(req, type, msg){ req.session.toast = { type, msg }; }
async function loadJson(file){
  try { return JSON.parse(await fs.readFile(path.join(__dirname,"data",file),"utf8")); }
  catch { return []; }
}
async function saveJson(file, data){
  await fs.writeFile(path.join(__dirname,"data",file), JSON.stringify(data,null,2), "utf8");
}

/* ===== Produk storage (txt per produk) ===== */
const produkDir = path.join(__dirname, "data/produk");
async function listProdukFiles(){
  try {
    return (await fs.readdir(produkDir))
      .filter(f => f.endsWith(".txt"))
      .map(f => f.replace(/\.txt$/,''));
  } catch { return []; }
}
async function loadProdukData(){
  const files = await listProdukFiles();
  const out = [];
  for (const name of files){
    let content = "";
    try { content = await fs.readFile(path.join(produkDir, name + ".txt"), "utf8"); } catch {}
    out.push({ name, content });
  }
  return out;
}

/* ================== AUTH ================== */
app.get("/login", (req, res) => res.render("login", { error: null }));
app.post("/login", (req, res) => {
  const { role, password } = req.body;
  const ok = (role === 'owner' && password === OWNER_PASS) ||
             (role === 'admin' && password === ADMIN_PASS);
  if (!ok) return res.render("login", { error: "Role atau password salah!" });
  req.session.isLoggedIn = true;
  req.session.role = role;
  res.redirect("/dashboard");
});
app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/login")));

/* ================== DASHBOARD ================== */
app.get(["/","/dashboard"], requireLogin, async (req, res) => {
  const [produk, promo, faq, sop, claims] = await Promise.all([
    listProdukFiles(),
    loadJson("promo.json"),
    loadFAQ(),
    loadSOP(),
    loadJson("log_claim.json")  // konsisten: log klaim
  ]);

  const stats = {
    produk: produk.length,
    promo : Array.isArray(promo) ? promo.length : 0,
    faq   : faq.length,
    sop   : sop.length,
    claim : Array.isArray(claims) ? claims.length : 0
  };

  const toast = req.session.toast || null; delete req.session.toast;
  res.render("dashboard", { stats, toast });
});

/* ================== PRODUK ================== */
app.get("/produk", requireLogin, async (req, res) => {
  const produk = await loadProdukData();
  const toast = req.session.toast || null; delete req.session.toast;
  res.render("produk", { produk, toast });
});
app.post("/produk/save", requireOwner, async (req, res) => {
  const { produk, content } = req.body;
  if (!produk || !content){
    setToast(req,"danger","Nama produk & konten wajib diisi!"); return res.redirect("/produk");
  }
  await fs.writeFile(path.join(produkDir, produk.toLowerCase()+".txt"), content, "utf8");
  setToast(req,"success","Produk berhasil disimpan."); res.redirect("/produk");
});
app.post("/produk/delete", requireOwner, async (req, res) => {
  const { produk } = req.body;
  try { await fs.unlink(path.join(produkDir, produk.toLowerCase()+".txt")); } catch {}
  setToast(req,"success","Produk berhasil dihapus."); res.redirect("/produk");
});

/* ================== MODULAR PAGES ================== */
app.use('/faq',    require('./routes/faq'));
app.use('/sop',    require('./routes/sop'));
app.use('/buyers', require('./routes/buyers'));  // user royal
app.use('/stock',  require('./routes/stock'));
app.use('/promo',  require('./routes/promo'));
app.use('/analytics', require('./routes/analytics')); // kalau ada
app.use('/claims', require('./routes/claims'));

/* ================== CLAIMS PAGES (VIEW) ================== */
/* legacy redirect */
app.get('/claim', (req,res)=> res.redirect('/claims'));
app.post('/claim/resolve', (req,res)=> res.redirect('/claims'));

/* /claims-replace -> daftar khusus replace */
app.get("/claims-replace", requireLogin, async (req, res) => {
  let claimsReplace = await loadJson("claimsReplace.json");
  if (!Array.isArray(claimsReplace)) claimsReplace = [];
  const toast = req.session.toast || null; delete req.session.toast;
  res.render("claims_replace", { claimsReplace, toast });
});
app.post("/claims-replace/resolve", requireOwner, async (req, res) => {
  const { index } = req.body;
  let claimsReplace = await loadJson("claimsReplace.json");
  if (Array.isArray(claimsReplace) && claimsReplace[index])
    claimsReplace[index].status = "RESOLVED";
  await saveJson("claimsReplace.json", claimsReplace);
  setToast(req,"success","Replace ditandai selesai.");
  res.redirect("/claims-replace");
});

/* /claims-reset page */
app.get('/claims-reset', requireLogin, async (req, res) => {
  let claimsReset = await loadJson('claimsReset.json');
  if (!Array.isArray(claimsReset)) claimsReset = [];
  const toast = req.session.toast || null; delete req.session.toast;
  res.render('claims_reset', { claimsReset, toast });
});
app.post('/claims-reset/mark', requireOwner, async (req, res) => {
  const { index } = req.body;
  let claimsReset = await loadJson('claimsReset.json');
  if (Array.isArray(claimsReset) && claimsReset[index])
    claimsReset[index].done = true;
  await saveJson('claimsReset.json', claimsReset);
  setToast(req,'success','Reset ditandai selesai.');
  res.redirect('/claims-reset');
});
// legacy alias
app.get('/reset', (req,res)=> res.redirect('/claims-reset'));
app.post('/reset/mark', (req,res)=> res.redirect('/claims-reset'));

/* ================== BLACKLIST ================== */
app.get("/blacklist", requireLogin, async (req, res) => {
  const blacklist = await loadJson("blacklist.json");
  const toast = req.session.toast || null; delete req.session.toast;
  res.render("blacklist", { blacklist, toast });
});
app.post("/blacklist/save", requireOwner, async (req, res) => {
  const { user, reason } = req.body;
  let blacklist = await loadJson("blacklist.json");
  if (!Array.isArray(blacklist)) blacklist = [];
  blacklist.push({ user, reason, date:new Date().toISOString() });
  await saveJson("blacklist.json", blacklist);
  setToast(req,"success","User masuk blacklist."); res.redirect("/blacklist");
});
app.post("/blacklist/delete", requireOwner, async (req, res) => {
  const { idx } = req.body;
  let blacklist = await loadJson("blacklist.json");
  if (Array.isArray(blacklist)) blacklist.splice(idx,1);
  await saveJson("blacklist.json", blacklist);
  setToast(req,"success","Blacklist dihapus."); res.redirect("/blacklist");
});

/* ================== 404 ================== */
app.use((req, res) => res.status(404).render("404"));

/* ================== START ================== */
(async () => {
  await fs.mkdir(produkDir, { recursive: true });
  app.listen(PORT, () => console.log(`Admin Panel running on port ${PORT}`));
})();
