require('dotenv').config();
const moment = require("moment-timezone");

function splitNums(v) {
  return (v || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

console.log('[ENV] OWNER_NUMBERS=', process.env.OWNER_NUMBERS);
console.log('[ENV] ADMIN_NUMBERS=', process.env.ADMIN_NUMBERS);

const config = {
  AutoUpdate       : process.env.AUTO_UPDATE || 'off',
  API_KEY          : process.env.API_KEY || '',
  GEMINI_API_KEY   : process.env.GEMINI_API_KEY || '',
  phone_number_bot : process.env.PHONE_NUMBER_BOT || '',
  type_connection  : process.env.TYPE_CONNECTION || 'qr',
  bot_destination  : process.env.BOT_DESTINATION || 'private',
  name_bot         : process.env.NAME_BOT || 'Resbot Ai',
  owner_name       : process.env.OWNER_NAME || 'Bold',

  // baru (array):
  owner_numbers    : splitNums(process.env.OWNER_NUMBERS),
  admin_numbers    : splitNums(process.env.ADMIN_NUMBERS),

  owner_website    : process.env.OWNER_WEBSITE || '',
  version          : global.version,
  rate_limit       : parseInt(process.env.RATE_LIMIT || '300', 10),
  total_limit      : parseInt(process.env.TOTAL_LIMIT || '100', 10),
  sticker_packname : process.env.STICKER_PACKNAME || 'Bold',
  sticker_author   : process.env.STICKER_AUTHOR || `Date: ${moment.tz('Asia/Jakarta').format('DD/MM/YY')}\\Owner 0895-1282-2345`,
  notification     : {
    limit      : process.env.NOTIFICATION_LIMIT || 'Hai kak, Limit harian anda sudah habis...',
    reset      : process.env.NOTIFICATION_RESET || 'Dialog berhasil dihapus...',
    ig         : process.env.NOTIFICATION_IG || 'kirimkan link instagramnya ya kak',
    fb         : process.env.NOTIFICATION_FB || 'kirimkan link facebooknya ya kak',
    tt         : process.env.NOTIFICATION_TT || 'kirimkan link tiktoknya ya kak',
    waiting    : process.env.NOTIFICATION_WAITING || 'Hai kak mohon tunggu...',
    qc_help    : process.env.NOTIFICATION_QC_HELP || 'Tulis textnya ya kak, misal *qc halo*',
    only_owner : process.env.NOTIFICATION_ONLY_OWNER || '_❗Perintah Ini Hanya Bisa Digunakan Oleh Owner !_'
  },
  success          : {
    hd : process.env.SUCCESS_HD || 'Ini kak hasil gambarnya, Maaf kalau masih blur',
  },
  error            : {
    FILE_TOO_LARGE : process.env.ERROR_FILE_TOO_LARGE || 'File terlalu besar. Maksimal 99 Mb',
    THROW          : process.env.ERROR_THROW || '_Ada masalah saat terhubung ke server_',
    PLAY_ERROR     : process.env.ERROR_PLAY_ERROR || 'Yahh Gagal, error download audio',
    HD_ERROR       : process.env.ERROR_HD_ERROR || 'Gagal HD-in gambar',
    IMAGE_ERROR    : process.env.ERROR_IMAGE_ERROR || 'Gagal cari gambar',
    qc             : process.env.ERROR_QC || 'Gagal bikin QC'
  }
};

module.exports = config;
