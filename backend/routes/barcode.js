const express = require('express');
const { protect } = require('../authMiddleware');
const { generateAamvaDataString } = require('../services/pdf417-service');
const router = express.Router();

router.post('/pdf417', protect, (req, res) => {
    try {
        const record_data = req.body;
        if (!record_data) return res.status(400).json({ message: "Dữ liệu đầu vào không hợp lệ." });
        const generationResult = generateAamvaDataString(record_data);
        res.json(generationResult);
    } catch (e) {
        res.status(500).json({ message: "Lỗi server khi tạo mã vạch: " + e.message });
    }
});

module.exports = router;