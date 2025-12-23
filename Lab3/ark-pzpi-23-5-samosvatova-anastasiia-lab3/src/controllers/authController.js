const UserRepo = require('../repositories/userRepository');
const VerificationRepo = require('../repositories/verificationRepository');
const { generateToken } = require('../utils/tokenService');
const { sendVerificationEmail } = require('../utils/emailSender');
const { generateVerificationCode } = require('../utils/codeGenerator');
const bcrypt = require('bcryptjs');

const register = async (req, res, next) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) return res.status(400).json({ error: 'All fields required' });

        const existing = await UserRepo.findByEmail(email);
        if (existing) return res.status(409).json({ error: 'Email exists' });

        const hash = await bcrypt.hash(password, 10);
        const user = await UserRepo.create({ username, email, passwordHash: hash });
        const code = generateVerificationCode();
        
        await VerificationRepo.create(user.id, email, code);
        await sendVerificationEmail(email, code);

        res.status(201).json({ message: 'User created. Check email for code.' });
    } catch (e) { next(e); }
};

const verifyEmail = async (req, res, next) => {
    try {
        const { email, code } = req.body;
        const valid = await VerificationRepo.findValidCode(email, code);
        if (!valid) return res.status(400).json({ error: 'Invalid code' });

        await UserRepo.markAsVerified(email);
        await VerificationRepo.markAsUsed(valid.id);
        res.json({ message: 'Verified' });
    } catch (e) { next(e); }
};

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const user = await UserRepo.findByEmail(email);
        
        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        if (!user.isVerified) return res.status(403).json({ error: 'Not verified' });

        const token = generateToken(user.id, user.role);
        res.json({ token, user: { id: user.id, name: user.username } });
    } catch (e) { next(e); }
};

module.exports = { register, verifyEmail, login };