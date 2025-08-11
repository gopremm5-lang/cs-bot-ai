const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

const produkDir = path.join(__dirname, './data/produk');

router.get('/', async (req, res) => {
    const files = await fs.readdir(produkDir);
    const list = [];
    for (const f of files) {
        const content = await fs.readFile(path.join(produkDir, f), 'utf8');
        list.push({ name: f.replace('.txt', ''), content });
    }
    res.render('produk', { produk: list });
});

router.post('/save', async (req, res) => {
    const { produk, content } = req.body;
    await fs.writeFile(path.join(produkDir, `${produk}.txt`), content, 'utf8');
    res.redirect('/produk');
});

router.post('/delete', async (req, res) => {
    const { produk } = req.body;
    await fs.unlink(path.join(produkDir, `${produk}.txt`));
    res.redirect('/produk');
});

module.exports = router;
