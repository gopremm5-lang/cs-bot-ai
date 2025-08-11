const config = require('../config');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

function getWaktuWIB() {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const wibTime = new Date(utcTime + (7 * 60 * 60 * 1000));
    const hari = wibTime.getDate();
    const bulanIndex = wibTime.getMonth();
    const tahun = wibTime.getFullYear();
    const jam = wibTime.getHours().toString().padStart(2, '0');
    const menit = wibTime.getMinutes().toString().padStart(2, '0');
    const namaBulan = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${hari} ${namaBulan[bulanIndex]} ${tahun} jam ${jam}:${menit} WIB`;
}

global.conversationHistories = {};

async function loadPrompt(file) {
    const filepath = path.join(__dirname, `../prompt/${file}`);
    const raw = await fs.readFile(filepath, 'utf8');
    return raw.replace('@NOW', getWaktuWIB());
}

async function GEMINI_TEXT(id_user, prompt, role = 'cs') {
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`;

    try {
        if (!conversationHistories[id_user]) {
            conversationHistories[id_user] = [];
        }

        const initialContext = await loadPrompt(`context-${role}.txt`);
        const fullPrompt = `${initialContext}\n${conversationHistories[id_user].join('\n')}\nUser: ${prompt}\nAI:`;

        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: fullPrompt }]
                }
            ]
        };

        const response = await axios.post(API_URL, requestBody);
        const responseText = response.data.candidates[0].content.parts[0].text;

        conversationHistories[id_user].push('User: ' + prompt);
        conversationHistories[id_user].push('AI: ' + responseText);
        if (conversationHistories[id_user].length > 10) {
            conversationHistories[id_user] = conversationHistories[id_user].slice(-10);
        }

        return responseText;
    } catch (error) {
        console.error('Error generating AI content:', error.message || error);

        const panduan = 'https://youtu.be/02oGg3-3a-s?si=ElXoKafRCG9B-7XD';
        const pesan_ERROR = `Jika melihat error ini, berarti apikey gemini terkena limit karena pengguna yang terlalu banyak. Silakan gunakan apikey gemini pribadi.\n\n${panduan}`;

        if (error.message?.includes('Too Many Requests') || error.message?.includes('status code 429')) {
            return pesan_ERROR;
        }
        if (error.message?.includes('status code 403')) {
            return `Jika melihat error ini, berarti apikey gemini masih kosong atau kena limit karena pengguna yang terlalu banyak. Silakan gunakan apikey gemini pribadi.\n\n${panduan}`;
        }

        return error.message || 'Terjadi kesalahan pada sistem. Silakan coba lagi nanti.';
    }
}

module.exports = { GEMINI_TEXT };
