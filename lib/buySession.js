// lib/buySession.js
// Session /buy per pengirim, plus timer nudge 1 menit (sekali)

const sessions = new Map(); // key: sender JID -> { fields, createdAt, nudged, nudgeTimer, suggestOpen }

function getSession(jid){
  return sessions.get(jid) || null;
}

function createOrReplace(jid, fields){
  clearNudge(jid);
  sessions.set(jid, { fields: { ...fields }, createdAt: Date.now(), nudged: false, nudgeTimer: null, suggestOpen: null });
}

function mergePatch(jid, patch){
  const s = sessions.get(jid);
  if (!s) return null;
  s.fields = { ...s.fields, ...patch };
  return s.fields;
}

function endSession(jid){
  clearNudge(jid);
  sessions.delete(jid);
}

function setSuggestOpen(jid, items){ // simpan items saran (array string) yg sedang diminta
  const s = sessions.get(jid);
  if (!s) return;
  s.suggestOpen = items && items.length ? items : null;
}

function getSuggestOpen(jid){
  const s = sessions.get(jid);
  return s ? s.suggestOpen : null;
}

function setNudgeOnce(jid, fn, delayMs = 60000){
  const s = sessions.get(jid);
  if (!s || s.nudged) return;
  clearNudge(jid);
  s.nudgeTimer = setTimeout(() => {
    const cur = sessions.get(jid);
    if (!cur || cur.nudged) return;
    cur.nudged = true;
    cur.nudgeTimer = null;
    try { fn(); } catch (e) {}
  }, delayMs);
}

function clearNudge(jid){
  const s = sessions.get(jid);
  if (s && s.nudgeTimer) {
    clearTimeout(s.nudgeTimer);
    s.nudgeTimer = null;
  }
}

module.exports = {
  getSession, createOrReplace, mergePatch, endSession,
  setSuggestOpen, getSuggestOpen,
  setNudgeOnce, clearNudge
};
