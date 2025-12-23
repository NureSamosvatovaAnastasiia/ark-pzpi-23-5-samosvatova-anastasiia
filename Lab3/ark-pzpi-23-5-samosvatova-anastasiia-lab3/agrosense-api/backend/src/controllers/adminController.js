const AdminRepo = require('../repositories/adminRepository');

// Отримати список користувачів
const getAllUsers = async (req, res, next) => {
    try {
        const users = await AdminRepo.getAllUsers();
        res.json(users);
    } catch (e) { next(e); }
};

const getAllGreenhouses = async (req, res, next) => {
    try {
        const ghList = await AdminRepo.getAllGreenhouses();
        res.json(ghList);
    } catch (e) { next(e); }
};

const deleteUser = async (req, res, next) => {
    try {
        const { userId } = req.params;
        await AdminRepo.deleteUser(userId);
        res.json({ message: 'User deleted successfully' });
    } catch (e) { next(e); }
};

const changeUserRole = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { role } = req.body; // 'admin' або 'user'
        
        if (!['admin', 'user'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const updated = await AdminRepo.updateUserRole(userId, role);
        res.json(updated[0]);
    } catch (e) { next(e); }
};

const getAdminDashboard = async (req, res, next) => {
    try {
        const stats = await AdminRepo.getGlobalStats();
        res.json(stats);
    } catch (e) { next(e); }
};

const getSystemLogs = async (req, res, next) => {
    try {
        const logs = await AdminRepo.getGlobalLogs();
        res.json(logs);
    } catch (e) { next(e); }
};

module.exports = { 
    getAllUsers, 
    deleteUser, 
    changeUserRole, 
    getAdminDashboard,
    getSystemLogs,
    getAllGreenhouses
};