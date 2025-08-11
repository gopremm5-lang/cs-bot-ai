// utils/intent.js
function norm(s){ return (s||'').toLowerCase().trim(); }

function isPriceIntent(t){
  const s = norm(t);
  return /\b(harga|berapa|pricelist|list harga|price|bayar|biaya)\b/.test(s) ||
         /\b(yt|youtube|netflix|disney|spotify|viu|alight)\b.*\b(harga|berapa)\b/.test(s);
}
function isHelpIntent(t){
  const s = norm(t);
  // minta solusi/problem
  return /\b(error|nggak bisa|tidak bisa|gagal|hilang|logout|incorrect|salah|trouble|masalah)\b/.test(s) ||
         /\b(bantu|solusi|gimana|cara)\b.*\b(login|akses|aktif|klaim)\b/.test(s);
}
function isClaimIntent(t){
  const s = norm(t);
  return /\b(klaim|garansi|claim|replace|reset)\b/.test(s);
}
function isRecommendIntent(t){
  const s = norm(t);
  // bandingin layanan
  return /\b(mending|bagusan|pilih|rekomendasi|rekomendasinya)\b/.test(s) &&
         /\b(yt|youtube|spotify|netflix|disney|viu|alight)\b/.test(s);
}

function classify(t){
  if (isClaimIntent(t))      return 'CLAIM';
  if (isPriceIntent(t))      return 'PRODUCT';
  if (isHelpIntent(t))       return 'FAQ';
  if (isRecommendIntent(t))  return 'RECOMMEND';
  return 'OTHER';
}

module.exports = { classify };
