// backend/server.js - GIỮ NGUYÊN NHƯ SAU
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Những dòng này là nơi có thể phát sinh lỗi nếu file được require không export đúng
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users')); // Dòng 14 gây lỗi
app.use('/api/barcode', require('./routes/barcode'));

const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

app.get('*', (req, res) => {
    res.sendFile(path.resolve(publicPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});