const express = require('express');
const router = express.Router();

router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === 'admin123') {
        req.session.auth = true;
        return res.redirect('/dashboard');
    }
    res.render('login', { error: 'Password salah!' });
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

module.exports = router;
