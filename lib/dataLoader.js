const fs = require('fs').promises;
const path = require('path');

// Loader TXT untuk file di /data
async function loadTxt(filename) {
  const filePath = path.join(__dirname, '../data', filename);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Loader TXT untuk produk di /data/produk
async function loadProdukTxt(nama) {
  const filePath = path.join(__dirname, '../data/produk', `${nama}.txt`);
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

// Loader JSON universal (untuk data/*.json)
async function loadJson(filename) {
  const filePath = path.join(__dirname, '../data', filename);
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Gagal load file ${filename}:`, err.message);
    return null;
  }
}

// Save JSON universal
async function saveJson(filename, data) {
  const filePath = path.join(__dirname, '../data', filename);
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Gagal save file ${filename}:`, err.message);
    return false;
  }
}

// util for slugging file names
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Directory based loader for FAQ/SOP (txt per item)
async function loadFAQ() {
  const dir = path.join(__dirname, '../data/faq');
  try {
    const files = await fs.readdir(dir);
    const faq = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      const [question, ...ans] = content.split('\n');
      faq.push({ file, question: question.trim(), answer: ans.join('\n').trim() });
    }
    return faq;
  } catch {
    return [];
  }
}

async function saveFAQ(question, answer) {
  const dir = path.join(__dirname, '../data/faq');
  await fs.mkdir(dir, { recursive: true });
  const filename = slugify(question) + '.txt';
  await fs.writeFile(path.join(dir, filename), `${question}\n${answer}`, 'utf8');
}

async function deleteFAQ(file) {
  const dir = path.join(__dirname, '../data/faq');
  await fs.unlink(path.join(dir, file));
}

async function loadSOP() {
  const dir = path.join(__dirname, '../data/sop');
  try {
    const files = await fs.readdir(dir);
    const sop = [];
    for (const file of files) {
      const content = await fs.readFile(path.join(dir, file), 'utf8');
      const [triggersLine, ...resp] = content.split('\n');
      const triggers = triggersLine.split(',').map(t => t.trim()).filter(Boolean);
      sop.push({ file, trigger: triggers, response: resp.join('\n').trim() });
    }
    return sop;
  } catch {
    return [];
  }
}

async function saveSOP(trigger, response) {
  const dir = path.join(__dirname, '../data/sop');
  await fs.mkdir(dir, { recursive: true });
  const filename = slugify(trigger.split(',')[0]) + '.txt';
  await fs.writeFile(path.join(dir, filename), `${trigger}\n${response}`, 'utf8');
}

async function deleteSOP(file) {
  const dir = path.join(__dirname, '../data/sop');
  await fs.unlink(path.join(dir, file));
}

async function loadBlacklist()   { return loadJson('blacklist.json'); }
async function loadPromo()       { return loadJson('promo.json'); }
async function loadLogClaim()    { return loadJson('log_claim.json'); }
async function loadFeedback()    { return loadJson('feedback.json'); }

// Export
module.exports = {
  loadTxt, loadJson, saveJson,
  loadFAQ, saveFAQ, deleteFAQ,
  loadSOP, saveSOP, deleteSOP,
  loadProdukTxt,
  loadBlacklist, loadPromo, loadLogClaim, loadFeedback
};
