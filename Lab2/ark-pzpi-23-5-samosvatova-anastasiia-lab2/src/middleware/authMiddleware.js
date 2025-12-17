const jwt = require('jsonwebtoken');
const UserRepo = require('../repositories/userRepository');

const protect = async (req, res, next) => {
    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            const token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await UserRepo.findById(decoded.id);
            
            if (!user) throw new Error('User not found');
            if (!user.isVerified) throw new Error('Verify email first');

            req.user = user;
            next();
        } catch (error) {
            res.status(401).json({ error: 'Auth failed: ' + error.message });
        }
    } else {
        res.status(401).json({ error: 'No token' });
    }
};
const adminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Access denied: Admins only' });
    }
};
module.exports = { protect, adminOnly };