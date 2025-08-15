const jwt = require('jsonwebtoken');
const protect = (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            next();
        } catch (error) {
            res.status(401).json({ message: 'Không có quyền truy cập, token không hợp lệ' });
        }
    } else {
        res.status(401).json({ message: 'Không có quyền truy cập, không tìm thấy token' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Yêu cầu quyền Admin' });
    }
};

module.exports = { protect, isAdmin };
