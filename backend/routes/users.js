// backend/routes/users.js - Viết lại cho sql.js
const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb, saveDatabase } = require('../database');
const { protect, isAdmin } = require('../authMiddleware');
const router = express.Router();


router.use(protect, isAdmin);

router.get('/', async (req, res) => {
    try {
        const db = await getDb();
        const results = db.exec("SELECT id, username, role FROM users");
        // Chuyển đổi kết quả sang định dạng JSON chuẩn
        const users = results[0] ? results[0].values.map(row => ({
            id: row[0],
            username: row[1],
            role: row[2]
        })) : [];
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.post('/', async (req, res) => {
    try {
 const db = await getDb();      
   const { username, password, role } = req.body;
        if (!username || !password) return res.status(400).json({ message: 'Vui lòng nhập đủ tên đăng nhập và mật khẩu' });
        
        const password_hash = bcrypt.hashSync(password, 10);
        db.run('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)', [username, password_hash, role || 'user']);
        await saveDatabase(db); 
        const newUserId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
       
        
        res.status(201).json({ id: newUserId, username, role: role || 'user' });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ message: 'Tên đăng nhập đã tồn tại' });
        }
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.put('/:id', async (req, res) => {
    try {
const db = await getDb();
        // ...
        await saveDatabase(db); // Truyền db vào        const { username, password, role } = req.body;
        const { id } = req.params;
        
        if (password) {
            const password_hash = bcrypt.hashSync(password, 10);
            db.run('UPDATE users SET username = ?, role = ?, password_hash = ? WHERE id = ?', [username, role, password_hash, id]);
        } else {
            db.run('UPDATE users SET username = ?, role = ? WHERE id = ?', [username, role, id]);
        }
        
      
        res.json({ message: 'Cập nhật người dùng thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
 const db = await getDb();
        // ...
               const { id } = req.params;
        if (req.user.id == id) return res.status(400).json({ message: 'Bạn không thể tự xóa tài khoản của mình' });
        
        db.run('DELETE FROM users WHERE id = ?', [id]);
        const changes = db.getRowsModified();

        if (changes === 0) return res.status(404).json({ message: 'Không tìm thấy người dùng' });
        
        await saveDatabase(); // Lưu thay đổi lên Blob
        res.json({ message: 'Xóa người dùng thành công' });
    } catch (err) {
        res.status(500).json({ message: 'Lỗi server' });
    }
});

module.exports = router;