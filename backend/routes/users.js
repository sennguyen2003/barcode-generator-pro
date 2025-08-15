// backend/routes/users.js - PHIÊN BẢN HOÀN THIỆN
const express = require('express');
const bcrypt = require('bcryptjs');
const { initializeDatabase } = require('../database');
const { protect, isAdmin } = require('../authMiddleware');
const router = express.Router();

router.use(protect, isAdmin);

router.get('/', async (req, res) => {
    try {
        const { db } = await initializeDatabase(); // <<< THAY ĐỔI Ở ĐÂY
        const results = db.exec("SELECT id, username, role FROM users");
        const users = results[0] ? results[0].values.map(row => ({
            id: row[0],
            username: row[1],
            role: row[2]
        })) : [];
        res.json(users);
    } catch (err) {
        console.error("Lỗi GET /api/users:", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { db, save } = await initializeDatabase(); // <<< THAY ĐỔI Ở ĐÂY
        const { username, password, role } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Vui lòng nhập đủ tên đăng nhập và mật khẩu' });
        
        const password_hash = bcrypt.hashSync(password, 10);
        db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, password_hash, role || 'user']);
        
        const newUserId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
        await save(); // <<< THAY ĐỔI Ở ĐÂY
        
        res.status(201).json({ id: newUserId, username, role: role || 'user' });
    } catch (err) {
        console.error("Lỗi POST /api/users:", err);
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
        }
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { db, save } = await initializeDatabase(); // <<< THAY ĐỔI Ở ĐÂY
        const { username, password, role } = req.body;
        const { id } = req.params;
        
        if (password) {
            const password_hash = bcrypt.hashSync(password, 10);
            db.run('UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?', [username, role, password_hash, id]);
        } else {
            db.run('UPDATE users SET username = ?, role = ? WHERE id = ?', [username, role, id]);
        }
        
        await save(); // <<< THAY ĐỔI Ở ĐÂY
        res.json({ message: 'Cập nhật người dùng thành công' });
    } catch (err) {
        console.error("Lỗi PUT /api/users/:id :", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { db, save } = await initializeDatabase(); // <<< THAY ĐỔI Ở ĐÂY
        const { id } = req.params;
        if (req.user.id == id) return res.status(400).json({ message: 'Bạn không thể tự xóa tài khoản của mình' });
        
        db.run('DELETE FROM users WHERE id = ?', [id]);
        const changes = db.getRowsModified();

        if (changes === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        
        await save(); // <<< THAY ĐỔI Ở ĐÂY
        res.json({ message: 'Xóa người dùng thành công' });
    } catch (err) {
        console.error("Lỗi DELETE /api/users/:id :", err);
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;