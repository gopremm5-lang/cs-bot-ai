/*
⚠️ Tidak untuk diperjualbelikan.
*/
global.version = '1.0.5';

const config        = require('./config');
const path          = require('path');
const fs            = require('fs');
const chalk         = require('chalk');
const { writeLog }  = require('./lib/log');
const serializeMessage = require('./lib/serializeMessage');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('baileys');
const { processMessage } = require('./lib/ai');
const { Boom }      = require("@hapi/boom");
const qrcode        = require('qrcode-terminal');
const pino          = require("pino");
const lastMessageTime = {};
const logger        = pino({ level: "silent" });
const { addUser, getUser } = require('./lib/users');
const { clearDirectory, logWithTime } = require('./lib/utils');
const EventEmitter  = require('events');

const Mood = require('./lib/mood');
const BL   = require('./lib/blacklist');
const { updateOnBuy } = require('./lib/royal');
const Scheduler = require('./lib/scheduler');

/* === Buyer Royal === */
const { onBuyCommand, onBuyPatch, onBuyStatus, onBuyCancel, onBuyHelp } = require('./handlers/buyersAdd');

/* === Klaim === */
const {
  createFromUserText,
  createFromAdminForm,
  adminVerifyAndPromote,
  ownerSetPriority,
  ownerResolve,
  ownerReplace
} = require('./handlers/claims');

const eventBus = new EventEmitter();
const store = { contacts: {} };
clearDirectory('./tmp');

/* ===================== Helper OWNER / ADMIN ===================== */
function normNum(num){
  if (!num) return '';
  let n = String(num).trim().replace(/[^\d+]/g,'');
  if (n.startsWith('+')) n = n.slice(1);
  if (n.startsWith('08')) n = '62' + n.slice(1);
  if (n.startsWith('0'))  n = '62' + n.slice(1);
  return n;
}
function toJid(num){ const n = normNum(num); return n ? `${n}@s.whatsapp.net` : null; }
function baseJid(jid){ return jid ? jid.replace(/(^\d+):\d+(@s\.whatsapp\.net)$/,'$1$2') : jid; }

const OWNER_JIDS = [
  ...(config.owner_numbers || []).map(toJid),
  ...(config.owner_number ? [toJid(config.owner_number)] : [])
].filter(Boolean);
const ADMIN_JIDS = (config.admin_numbers || []).map(toJid).filter(Boolean);

function isOwner(jid){ return OWNER_JIDS.includes(baseJid(jid)); }
function isAdmin(jid){ return isOwner(jid) || ADMIN_JIDS.includes(baseJid(jid)); }

/* ======================== AutoUpdate + Connect ======================== */
async function checkAndUpdate() {
  if (config.AutoUpdate == 'on') {
    const { cloneOrUpdateRepo } = require('./lib/cekUpdate');
    await cloneOrUpdateRepo();
  }
  await connectToWhatsApp();
}

async function connectToWhatsApp() {
  if (global.sock && global.sock.user && global.sock.ws && global.sock.ws.readyState === 1) {
    console.log(chalk.yellow("⚠️ Bot sudah terkoneksi dan aktif. Tidak membuat koneksi baru."));
    return global.sock;
  }
  const sessionDir = path.join(process.cwd(), 'session');
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
  });
  global.sock = sock;

  // start scheduler (pengiriman terjadwal)
  try {
    Scheduler.start(async (to, text)=>{ await sock.sendMessage(to, { text }); });
  } catch {}

  if (!sock.authState.creds.registered && (config.type_connection||'qr').toLowerCase() == 'pairing') {
    const phoneNumber = config.phone_number_bot;
    const delay = ms => new Promise(r => setTimeout(r, ms));
    await delay(4000);
    const code = await sock.requestPairingCode(phoneNumber.trim());
    console.log(chalk.blue('PHONE NUMBER: '), chalk.yellow(phoneNumber));
    console.log(chalk.blue('CODE PAIRING: '), chalk.yellow(code));
  }

  sock.ev.on('creds.update', saveCreds);
  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
  fs.chmodSync(sessionDir, 0o755);
  fs.readdir(sessionDir, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = path.join(sessionDir, file);
      fs.chmod(filePath, 0o644, (err) => { if (err) console.error('chmod session file:', err); });
    });
  });

  sock.ev.on('contacts.update', (contacts) => {
    contacts.forEach(c => { store.contacts[c.id] = c; });
    eventBus.emit('contactsUpdated', store.contacts);
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const result = serializeMessage(m, sock);
      if (!result) return;
      const { isGroup, content, messageType, message, isQuoted, pushName, sender, remoteJid } = result;
      if (remoteJid == "status@broadcast") return;

      // tujuan (private/group/both)
      const destination = (config.bot_destination || 'private').toLowerCase();
      if ((isGroup && destination === 'private') || (!isGroup && destination === 'group')) return;

      const text = (content || '').trim();
      const now = Date.now();

      // ===== Blacklist quick check (abaikan HITAM) =====
      const bare = (sender||'').split('@')[0];
      try {
        const lvl = await BL.getLevel(bare);
        if (lvl === 'HITAM') return;
      } catch {}

      // rate limit per remoteJid
      let truncated = text.length>10 ? text.slice(0,10)+'...' : text;
      if (text && lastMessageTime[remoteJid] && (now - lastMessageTime[remoteJid] < config.rate_limit)) {
        console.log(chalk.redBright(`Rate limit : ${truncated} - ${remoteJid}`));
        try { await BL.warn(bare, 'spam-rate-limit'); } catch {}
        return;
      }
      if (text) { lastMessageTime[remoteJid] = now; logWithTime(pushName, truncated); }
      writeLog('INFO', `${remoteJid}: ${text}`);

      // register user (limit/premium)
      const userReady = getUser(sender);
      if (!userReady) addUser(sender, -1);

      // mood tracker untuk chat biasa (bukan command)
      if (text && !text.startsWith('/')) {
        try { await Mood.update(sender, text); } catch {}
      }

      // debug
      if (text === '/whoami') {
        return sock.sendMessage(remoteJid, { text: `sender=${sender}\nremote=${remoteJid}\nbaseSender=${baseJid(sender)}` }, { quoted: message });
      }
      if (text === '/whoowner' && isOwner(sender)) {
        return sock.sendMessage(remoteJid, { text: `OWNERS:\n${OWNER_JIDS.join('\n')}\nADMINS:\n${ADMIN_JIDS.join('\n')}` }, { quoted: message });
      }

      /* ===================== BUYER ROYAL ===================== */
      if (text.startsWith('/buy')) {
        if (isGroup) { await sock.sendMessage(remoteJid, { text: 'Perintah /buy hanya di chat pribadi.' }, { quoted: message }); return; }
        if (!isAdmin(sender)) { await sock.sendMessage(remoteJid, { text: config.notification?.only_owner || 'Perintah khusus admin/owner.' }, { quoted: message }); return; }
        const reply = msg => sock.sendMessage(remoteJid, { text: msg }, { quoted: message });
        try {
          const result = await onBuyCommand(text, reply, sender);
          // update royal scoring — gunakan buyerJid dari handler kalau tersedia; fallback ke sender
          const buyerJid = (result && result.buyerJid) ? result.buyerJid : sender;
          try { await updateOnBuy(buyerJid); } catch {}
        } catch(e){
          console.error(e);
          await reply('❌ Terjadi error saat menyimpan buyer.');
        }
        return;
      }
      if (text === '/buy-status' && isAdmin(sender)) {
        const reply = msg => sock.sendMessage(remoteJid, { text: msg }, { quoted: message });
        await onBuyStatus(reply, sender); return;
      }
      if (text === '/buy-cancel' && isAdmin(sender)) {
        const reply = msg => sock.sendMessage(remoteJid, { text: msg }, { quoted: message });
        await onBuyCancel(reply, sender); return;
      }
      if (text === '/buy-help' && isAdmin(sender)) {
        const reply = msg => sock.sendMessage(remoteJid, { text: msg }, { quoted: message });
        await onBuyHelp(reply); return;
      }
      // patch lanjutan sesi /buy (admin/owner saja)
      if (text && !text.startsWith('/') && isAdmin(sender)) {
        const handled = await onBuyPatch(text, (msg)=>sock.sendMessage(remoteJid,{text:msg},{quoted:message}), sender);
        if (handled) return;
      }

      /* ===================== KLAIM: JALUR GANDA ===================== */
      if (/klaim|garansi|claim|replace|reset/i.test(text)) {
        await sock.sendMessage(remoteJid, { text:
`❓ *Ajukan klaim via siapa?*
Balas salah satu:
• \`admin\` — admin bantu verifikasi & proses
• \`bot\` — isi cepat via bot (nanti admin review dulu)` }, { quoted: message });
        return;
      }
      if (['admin','bot'].includes(text.toLowerCase())) {
        if (text.toLowerCase() === 'admin') {
          const cl = await createFromUserText({ reporter: sender, text: '(user pilih admin)' });
          await sock.sendMessage(remoteJid, { text: `✅ *Klaim dikirim ke admin.*\nAdmin akan verifikasi & bantu kamu ya.` }, { quoted: message });
          for (const num of (config.admin_numbers||[])) {
            const jid = `${normNum(num)}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text:
`🆕 *Klaim baru (butuh verifikasi admin)*
ID: ${cl.id}
Reporter: ${sender.split('@')[0]}

Lanjut form: /claim-form ${cl.id}
Usul prioritas: /claim-usul ${cl.id} p1|p2|p3` });
          }
          return;
        } else {
          await createFromUserText({ reporter: sender, text: '(user via bot — pending review admin)' });
          await sock.sendMessage(remoteJid, { text:
`📝 *Langkah berikutnya*
Kirim singkat:
- APK (mis: netflix)
- Email akun (jika ada)
- Invite email (jika ada)
- Kronologi (1 kalimat)
Admin akan review dulu sebelum diproses.` }, { quoted: message });
          return;
        }
      }

      /* ===================== COMMAND ADMIN ===================== */
      if (text.startsWith('/claim-form') && isAdmin(sender)) {
        const arg = text.replace('/claim-form','').trim();
        const [id, ...pairs] = arg.split(/\s+/);
        const patch = {};
        for (const p of pairs) {
          const m = p.match(/^(\w+):(.*)$/);
          if (m) { patch[m[1]] = m[2]; }
        }
        await createFromAdminForm({
          reporter: sender,
          apk: patch.apk,
          category: patch.category || 'klaim',
          invite_email: patch.invite,
          owner_email: patch.owner,
          reason: patch.reason
        });
        await sock.sendMessage(remoteJid, { text: `✅ Form klaim dikirim. Menunggu keputusan owner.` }, { quoted: message });
        return;
      }
      if (text.startsWith('/claim-verify') && isAdmin(sender)) {
        const id = text.split(/\s+/)[1];
        await adminVerifyAndPromote(id, {});
        await sock.sendMessage(remoteJid, { text: `✅ Klaim ${id} dipromosikan ke READY_FOR_OWNER.` }, { quoted: message });
        return;
      }
      if (text.startsWith('/claim-usul') && isAdmin(sender)) {
        const [, id, pr] = text.split(/\s+/);
        for (const num of (config.owner_numbers||[])) {
          const jid = `${normNum(num)}@s.whatsapp.net`;
          await sock.sendMessage(jid, { text: `📌 Usulan prioritas admin untuk ${id}: ${String(pr||'P3').toUpperCase()}` });
        }
        await sock.sendMessage(remoteJid, { text: `✅ Usulan prioritas terkirim ke owner.` }, { quoted: message });
        return;
      }

      /* ===================== COMMAND OWNER ===================== */
      if (text.startsWith('/claim-prio') && isOwner(sender)) {
        const [, id, pr] = text.split(/\s+/);
        await ownerSetPriority(id, String(pr||'P3').toUpperCase());
        await sock.sendMessage(remoteJid, { text: `✅ Prioritas klaim ${id} di-set ${String(pr).toUpperCase()}.` }, { quoted: message });
        return;
      }
      if (text.startsWith('/claim-resolve') && isOwner(sender)) {
        const parts = text.split(/\s+/); const id = parts[1]; const note = parts.slice(2).join(' ');
        await ownerResolve(id, note||'resolved');
        await sock.sendMessage(remoteJid, { text: `✅ Klaim ${id} ditandai selesai.` }, { quoted: message });
        return;
      }
      if (text.startsWith('/claim-replace') && isOwner(sender)) {
        const arg = text.replace('/claim-replace','').trim();
        const [id, ...pairs] = arg.split(/\s+/);
        const patch = {}; for (const p of pairs){ const m=p.match(/^(\w+):(.*)$/); if(m) patch[m[1]]=m[2]; }
        await ownerReplace({ id, target_apk: patch.apk, target_account_id: patch.acc, buyer_id: patch.buyer });
        await sock.sendMessage(remoteJid, { text: `✅ Replace dicatat untuk ${id}. (Link/Unlink lakukan di menu Stock)` }, { quoted: message });
        return;
      }

      /* ===================== DEFAULT → AI ===================== */
      try { await processMessage(text, sock, sender, remoteJid, message, messageType, pushName, isQuoted); }
      catch (e) { console.error("Error processMessage:", e); }

    } catch (error) {
      console.log(chalk.redBright(`Error message upsert: ${error.message}`));
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && (config.type_connection||'qr').toLowerCase() === 'qr') {
      console.log(chalk.yellowBright(`Menampilkan QR`));
      qrcode.generate(qr, { small: true }, q => console.log(q));
    }
    if (connection === 'open') {
      global.sock = sock;
      await new Promise(r => setTimeout(r, 1000));
      await sock.sendMessage(`${config.phone_number_bot}@s.whatsapp.net`, { text: "Bot Connected" });
      console.log(chalk.greenBright(`✅ KONEKSI TERHUBUNG`));
      return;
    }
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      switch (reason) {
        case DisconnectReason.badSession:
        case DisconnectReason.connectionClosed:
        case DisconnectReason.connectionLost:
        case DisconnectReason.connectionReplaced:
        case DisconnectReason.restartRequired:
        case DisconnectReason.timedOut:
          console.log(chalk.redBright(`Reconnect needed (${reason}).`));
          return await connectToWhatsApp();
        case DisconnectReason.loggedOut:
          console.log(chalk.redBright(`Perangkat logout. Silakan scan ulang.`));
          break;
        default:
          console.log(chalk.redBright(`Unknown disconnect reason: ${reason} | ${connection}`));
          return await connectToWhatsApp();
      }
    }
  });

  return sock;
}

checkAndUpdate();
