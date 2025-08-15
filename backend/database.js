// backend/database.js - PHIÊN BẢN HOÀN THIỆN

const { head, put } = require('@vercel/blob');
const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_FILENAME = 'database.db';
let dbPromise = null; // Dùng promise để đảm bảo CSDL chỉ khởi tạo một lần

// Hàm lưu CSDL lên Blob. Nó cần db instance để hoạt động.
async function saveDatabase(dbInstance) {
    if (!dbInstance) return;
    try {
        const data = dbInstance.export();
        const buffer = Buffer.from(data);
        await put(DB_FILENAME, buffer, { access: 'public', token: process.env.BLOB_READ_WRITE_TOKEN });
        console.log('Đã lưu CSDL lên Vercel Blob.');
    } catch (error) {
        console.error('Lỗi khi lưu CSDL:', error);
    }
}

function initializeDatabase() {
    if (dbPromise) return dbPromise; // Nếu đang khởi tạo hoặc đã xong, trả về promise cũ

    dbPromise = (async () => {
        try {
            // Tự động tìm đường dẫn đến file wasm một cách chính xác
            const sqlJsWasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
            const wasmBinary = fs.readFileSync(sqlJsWasmPath);
            const SQL = await initSqlJs({ wasmBinary });

            let db;
            // Thử tải CSDL từ Vercel Blob
            try {
                const blobInfo = await head(DB_FILENAME, { token: process.env.BLOB_READ_WRITE_TOKEN });
                const response = await fetch(blobInfo.url);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    db = new SQL.Database(new Uint8Array(arrayBuffer));
                    console.log('Đã tải CSDL từ Vercel Blob.');
                }
            } catch (error) {
                if (error.status !== 404) console.error('Lỗi khi tải CSDL từ Blob:', error);
            }
            
            if (!db) {
                db = new SQL.Database();
                console.log('Không tìm thấy CSDL trên Blob, đã tạo mới.');
            }

            db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password_hash TEXT, role TEXT)`);

            const adminCheck = db.exec("SELECT * FROM users WHERE username = 'admin'");
            if (adminCheck.length === 0) {
                const salt = bcrypt.genSaltSync(10);
                const adminPasswordHash = bcrypt.hashSync('admin123', salt);
                db.run("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", ['admin', adminPasswordHash, 'admin']);
                console.log('Tài khoản admin mặc định đã được tạo.');
                await saveDatabase(db); // Lưu ngay sau khi tạo admin
            }

            console.log('Khởi tạo CSDL thành công.');
            
            // Trả về một object chứa cả db instance và hàm save đã được gắn sẵn
            return {
                db,
                save: () => saveDatabase(db)
            };

        } catch (error) {
            console.error('Lỗi nghiêm trọng khi khởi tạo CSDL:', error);
            dbPromise = null; // Reset promise nếu có lỗi để có thể thử lại
            throw error;
        }
    })();
    return dbPromise;
}

module.exports = { initializeDatabase };