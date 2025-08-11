const config = require('../config');
const { getSession, resetSession } = require("./session");
const { checkLimit, getUser } = require("./users");
const { displayMenu } = require('./utils');
const { GEMINI_TEXT } = require("./gemini");
const { handleUserMessage } = require('./hybridHandler');

// Helper validasi JID (opsional, jika mau kirim pesan manual ke JID WA)
function isValidJid(jid) {
  return jid.endsWith('@s.whatsapp.net') || jid.endsWith('@g.us');
}

// --- Handler utama processMessage ---
async function processMessage(content, sock, sender, remoteJid, message, messageType, pushName, isQuoted) {
  // Step 1: Handler internal
  const session = getSession(sender);
  const lowerCaseMessage = content.toLowerCase().trim();
  const user = getUser(sender);
  const userLimit = checkLimit(user);

  // Quick reply: limit / menu / reset / sapaan
  const greetings = ['halo', 'hai', 'p', 'bot', 'assalamualaikum', 'halo bot'];
  const greetingResponses = [
    `Halo Kak! ${config.name_bot} siap bantu order APK atau SMM 😊`,
    `Hai Kak! Ada kendala di web order APK/SMM? Boleh tanya aja ya.`,
    `Selamat datang Kak! CS ${config.name_bot} siap bantu info & kendala Anda.`
  ];

  if (!userLimit) {
    return await sock.sendMessage(remoteJid, { text: config.notification.limit }, { quoted: message });
  }
  if (greetings.includes(lowerCaseMessage)) {
    return await sock.sendMessage(remoteJid, { text: greetingResponses[Math.floor(Math.random() * greetingResponses.length)] }, { quoted: message });
  }
  if (lowerCaseMessage === 'menu') {
    return await sock.sendMessage(remoteJid, { text: await displayMenu(sender) }, { quoted: message });
  }
  if (lowerCaseMessage === 'limit') {
    return await sock.sendMessage(remoteJid, { text: `_Sisa limit harian Anda:_ ${userLimit}` }, { quoted: message });
  }
  if (lowerCaseMessage === 'reset') {
    resetSession(sender);
    return await sock.sendMessage(remoteJid, { text: config.notification.reset }, { quoted: message });
  }

  // Step 2: HybridHandler → mood, produk, FAQ, SOP, promo
  let reply = await handleUserMessage(content, sender);
  if (!reply) {
    // Fallback: AI eksternal Gemini
    reply = await GEMINI_TEXT(sender, content);
  }
  return await sock.sendMessage(remoteJid, { text: reply }, { quoted: message });
}

module.exports = { processMessage };
