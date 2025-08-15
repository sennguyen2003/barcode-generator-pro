// backend/routes/auth.js - Viết lại cho sql.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { initializeDatabase } = require('../database');
const router = express.Router();

const generateToken = (id, username, role) => {
    return jwt.sign({ id, username, role }, process.env.JWT_SECRET, { expiresIn: '1d' });
};

router.post('/login', async (req, res) => {
    try {
        const { db } = await initializeDatabase();
        const { username, password } = req.body;

        const stmt = db.prepare('SELECT * FROM users WHERE username = :username');
        const user = stmt.getAsObject({ ':username': username });
        stmt.free();

        if (!user || !bcrypt.compareSync(password, user.password_hash)) {
            return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng' });
        }
        
        res.json({
            message: 'Đăng nhập thành công',
            token: generateToken(user.id, user.username, user.role),
            user: { username: user.username, role: user.role }
        });
    } catch (err) {
        console.error("Lỗi đăng nhập:", err.message);
        res.status(500).json({ message: "Lỗi server" });
    }
});

module.exports = router;