// lib/scheduler.js
const path = require('path');
const fs = require('fs').promises;

const FILE = path.join(__dirname, '..', 'data', 'schedule.json');
let QUEUE = [];
let TIMER = null;

async function load(){
  try { QUEUE = JSON.parse(await fs.readFile(FILE,'utf8')); }
  catch { QUEUE = []; }
}
async function save(){
  await fs.writeFile(FILE, JSON.stringify(QUEUE,null,2), 'utf8');
}

function now(){ return Date.now(); }

async function addJob({ whenISO, to, text }){
  await load();
  const job = { id: 'job_'+Date.now(), when: whenISO, to, text, status:'PENDING' };
  QUEUE.push(job);
  await save();
  return job.id;
}

function _tick(sendFn){
  const ts = now();
  const due = [];
  for (const j of QUEUE){
    if (j.status==='PENDING' && new Date(j.when).getTime() <= ts) due.push(j);
  }
  due.forEach(async job=>{
    try {
      await sendFn(job.to, job.text);
      job.status = 'SENT';
      job.sentAt = new Date().toISOString();
      await save();
    } catch(e){
      job.status = 'ERROR';
      job.error = String(e.message||e);
      await save();
    }
  });
}

function start(sendFn){
  if (TIMER) clearInterval(TIMER);
  TIMER = setInterval(()=>_tick(sendFn), 15 * 1000); // cek tiap 15 detik
}

module.exports = { addJob, start, load };
