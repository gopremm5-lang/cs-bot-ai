// utils/claimParser.js
function norm(text){ return (text||'').toLowerCase(); }

function extractAPK(t){
  const s = norm(t);
  const known = ['netflix','youtube','yt','yt premium','disney','viu','spotify','alight motion'];
  for (const k of known){
    if (s.includes(k)) return k.replace('yt premium','youtube').replace('yt','youtube');
  }
  return null;
}
function extractCategory(t){
  const s = norm(t);
  if (s.match(/\b(replace|diganti|tukar|ganti)\b/)) return 'replace';
  if (s.match(/\b(reset|ulang|reset akun)\b/)) return 'reset';
  if (s.match(/\b(klaim|garansi|claim)\b/)) return 'klaim';
  if (s.match(/\b(info|tanya)\b/)) return 'info';
  return 'klaim';
}
function extractInviteEmail(t){
  const m = t.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return m ? m[0] : null;
}
function detectPriority(t){
  const s = norm(t);
  if (s.match(/\b(urgent|asap|kerja|meeting|deadline|penting banget)\b/)) return 'P1';
  if (s.match(/\b(secepatnya|error berulang|nggak bisa akses)\b/)) return 'P2';
  return 'P3';
}
function summarize(t){
  const s = t.trim().replace(/\s+/g,' ');
  return s.length>160 ? s.slice(0,160)+'…' : s;
}
module.exports = { extractAPK, extractCategory, extractInviteEmail, detectPriority, summarize };
