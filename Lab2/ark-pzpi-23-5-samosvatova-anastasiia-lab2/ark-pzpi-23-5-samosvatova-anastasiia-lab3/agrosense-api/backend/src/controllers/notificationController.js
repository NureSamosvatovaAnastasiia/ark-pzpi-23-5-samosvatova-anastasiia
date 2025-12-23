const NotificationRepo = require('../repositories/notificationRepository');
const GreenhouseRepo = require('../repositories/greenhouseRepository');

const getNotifications = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
        
        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        const list = await NotificationRepo.getAll(greenhouseId);
        res.json(list);
    } catch (e) { next(e); }
};

const markRead = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await NotificationRepo.markAsRead(id);
        res.json(result);
    } catch (e) { next(e); }
};

module.exports = { getNotifications, markRead };