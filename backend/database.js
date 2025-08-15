// backend/database.js - PHIÊN BẢN VERCEL BLOB + SQL.JS

const { head, put, del } = require('@vercel/blob');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');

const DB_FILENAME = 'database.db';
let db = null; // Biến để giữ database trong bộ nhớ

// Hàm để lưu database lên Vercel Blob
async function saveDatabase() {
    if (!db) return;
    try {
        const data = db.export();
        const buffer = Buffer.from(data);
        await put(DB_FILENAME, buffer, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN });
        console.log('Đã lưu CSDL lên Vercel Blob.');
    } catch (error) {
        console.error('Lỗi khi lưu CSDL:', error);
    }
}

// Hàm khởi tạo CSDL
async function initializeDatabase() {
    if (db) return { db, saveDatabase }; // Nếu đã khởi tạo, trả về ngay

    try {
        const SQL = await initSqlJs({ locateFile: file => `https://sql.js.org/dist/${file}` });
        let dbFileBuffer = null;

        // Thử tải CSDL từ Vercel Blob
        try {
            const blobInfo = await head(DB_FILENAME, { token: process.env.BLOB_READ_WRITE_TOKEN });
            const response = await fetch(blobInfo.url);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                dbFileBuffer = new Uint8Array(arrayBuffer);
                console.log('Đã tải CSDL từ Vercel Blob.');
            }
        } catch (error) {
            // Lỗi 404 nghĩa là file chưa tồn tại, không sao cả
            if (error.status !== 404) {
                console.error('Lỗi khi tải CSDL từ Blob:', error);
            } else {
                 console.log('Không tìm thấy CSDL trên Blob, sẽ tạo mới.');
            }
        }

        // Tạo CSDL mới hoặc load từ buffer
        db = dbFileBuffer ? new SQL.Database(dbFileBuffer) : new SQL.Database();

        // Tạo bảng và admin user nếu là CSDL mới
        db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                password_hash TEXT,
                role TEXT
            )
        `);

        const adminCheck = db.exec("SELECT * FROM users WHERE username = 'admin'");
        if (adminCheck.length === 0) {
            const salt = bcrypt.genSaltSync(10);
            const adminPasswordHash = bcrypt.hashSync('admin123', salt);
            db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', adminPasswordHash, 'admin']);
            console.log('Tài khoản admin mặc định đã được tạo.');
            await saveDatabase(); // Lưu lại ngay sau khi tạo admin
        }

        console.log('Khởi tạo CSDL thành công.');
        return { db, saveDatabase };

    } catch (error) {
        console.error('Lỗi nghiêm trọng khi khởi tạo CSDL:', error);
        throw error;
    }
}

module.exports = { initializeDatabase };