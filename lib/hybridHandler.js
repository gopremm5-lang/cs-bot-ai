const fs = require('fs').promises;
const path = require('path');
const stringSimilarity = require('string-similarity');
const { loadProdukTxt, loadFAQ, loadSOP, loadPromo } = require('./dataLoader');

// Fuzzy search produk dengan toleransi typo yang lebih lebar
async function fuzzySearchProduk(msg) {
  const input = msg.toLowerCase();
  const produkDir = path.join(__dirname, '../data/produk');
  let produkNames = [];

  // Baca nama semua produk (file txt)
  try {
    const files = await fs.readdir(produkDir);
    produkNames = files.filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', ''));
  } catch {
    return null;
  }

  // Hard match langsung (pakai includes biar instant kalau cocok)
  for (const name of produkNames) {
    if (input.includes(name)) {
      const content = await loadProdukTxt(name);
      if (content) return content.trim();
    }
  }

  // Fuzzy search: ambil best match
  if (produkNames.length) {
    // Ambil 3 match terbaik, toleransi typo diperbesar
    const { ratings, bestMatch } = stringSimilarity.findBestMatch(input, produkNames);
    // Pilih match dengan rating > 0.55 (lebih longgar dari biasanya, normalnya 0.7)
    if (bestMatch.rating > 0.4) {
      const content = await loadProdukTxt(bestMatch.target);
      if (content) return content.trim();
    }
    // Atau: ambil match dengan rating minimal 0.5 dari ratings, buat antisipasi typo berat
    const strongEnough = ratings.filter(r => r.rating > 0.5);
    if (strongEnough.length) {
      const top = strongEnough.sort((a,b) => b.rating - a.rating)[0];
      const content = await loadProdukTxt(top.target);
      if (content) return content.trim();
    }
  }
  return null;
}

// Fuzzy Mood Detector
const keywordsMood = {
  marah: ["gak dapet", "kecewa", "kesel", "parah", "anjing", "kok lama", "udah nunggu", "masih belum", "gak jelas", "ga kelar2", "bosen", "sampe kapan", "kapan akun", "error terus", "gimana sih", "kok susah", "coba cek lagi", "udah capek", "ngaco", "payah", "tolol"],
  positif: ["makasih", "thanks", "terima kasih", "oke kak", "cepat banget", "mantap", "sip", "lancar", "puas", "good job"],
  oot: ["curhat", "ngopi yuk", "iseng aja", "nongkrong", "gabut", "temenin aku", "ngobrol yuk", "main yuk", "ngomongin lain", "bukan order", "topik lain"]
};

function detectMood(msg) {
  const lower = msg.toLowerCase();
  for (const mood in keywordsMood) {
    if (keywordsMood[mood].some(k => lower.includes(k))) return mood;
  }
  if (/(kenapa|kok|kapan)/.test(lower) && /(dikirim|masuk|proses|error|gagal|akun)/.test(lower)) return 'marah';
  return "netral";
}

// Fuzzy FAQ/SOP Handler
function fuzzyMatch(msg, arr, field = 'keyword') {
  const input = msg.toLowerCase();
  let maxSim = 0, bestRes = null;
  for (const item of arr) {
    for (const kw of item[field]) {
      if (input.includes(kw.toLowerCase())) return item; // hard match
      const sim = stringSimilarity.compareTwoStrings(input, kw.toLowerCase());
      if (sim > maxSim) {
        maxSim = sim;
        bestRes = item;
      }
    }
  }
  return (maxSim > 0.65) ? bestRes : null;
}

// Handler utama
async function handleUserMessage(msg, sender) {
  // 1. Mood detector
  const mood = detectMood(msg);
  if (mood === "marah")
    return "Maaf atas kendala yang terjadi, Kak. Mohon kirim nomor order & screenshot error, tim kami bantu follow-up sesuai SOP.";
  if (mood === "out_of_topic")
    return "Maaf Kak, CS ini hanya menangani order, kendala, atau info garansi Vylozzone ya 🙏.";

  // 2. Produk (includes/fuzzy)
  const produkRes = await fuzzySearchProduk(msg);
  if (produkRes) return produkRes;

  // 3. SOP
  const sopList = await loadSOP() || [];
  const sopRes = fuzzyMatch(msg, sopList, 'trigger');
  if (sopRes) return sopRes.response[Math.floor(Math.random() * sopRes.response.length)];

  // 4. FAQ
  const faqList = await loadFAQ() || [];
  const faqRes = fuzzyMatch(msg, faqList, 'keyword');
  if (faqRes) return faqRes.response[Math.floor(Math.random() * faqRes.response.length)];

  // 5. Promo
  if (msg.toLowerCase().includes("promo")) {
    const promoObj = await loadPromo();
    if (promoObj?.banner) return promoObj.banner;
  }

  // 6. Tidak ketemu: lempar ke AI eksternal
  return null;
}

module.exports = { handleUserMessage };
