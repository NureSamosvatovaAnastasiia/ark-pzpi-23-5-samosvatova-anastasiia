const GreenhouseRepo = require('../repositories/greenhouseRepository');

// === ТЕПЛИЦІ ===

const createGreenhouse = async (req, res, next) => {
    try {
        const { name, location, areaSqMeters, heightMeters } = req.body;
        const gh = await GreenhouseRepo.create(req.user.id, { name, location, areaSqMeters, heightMeters });
        res.status(201).json(gh);
    } catch (e) { next(e); }
};

const getMyGreenhouses = async (req, res, next) => {
    try {
        const ghs = await GreenhouseRepo.findAllByOwner(req.user.id);
        res.json(ghs);
    } catch (e) { next(e); }
};

const updateGreenhouse = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
        const { name, location, areaSqMeters, heightMeters } = req.body;

        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        const updated = await GreenhouseRepo.update(greenhouseId, { name, location, areaSqMeters, heightMeters });
        res.json(updated);
    } catch (e) { next(e); }
};

const deleteGreenhouse = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;

        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        await GreenhouseRepo.delete(greenhouseId);
        res.json({ message: 'Greenhouse deleted successfully' });
    } catch (e) { next(e); }
};


const addDevice = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
  
        const { category, name, type, unit, capacity } = req.body;
        
        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) return res.status(403).json({ error: 'Access denied' });

        let result;
        if (category === 'sensor') {
            result = await GreenhouseRepo.addSensor(greenhouseId, { name, type, unit });
        } else if (category === 'actuator') {
            result = await GreenhouseRepo.addActuator(greenhouseId, { name, type, capacity });
        } else {
            return res.status(400).json({ error: 'Invalid category' });
        }
        
        res.status(201).json(result);
    } catch (e) { next(e); }
};


const getCrops = async (req, res, next) => {
    try {
        const allCrops = await GreenhouseRepo.getAllCrops();
        res.json(allCrops);
    } catch (e) { next(e); }
};

const createCrop = async (req, res, next) => {
    try {
        const newCrop = await GreenhouseRepo.createCrop(req.body);
        res.status(201).json(newCrop);
    } catch (e) { next(e); }
};

const updateCrop = async (req, res, next) => {
    try {
        const { cropId } = req.params;
        const updatedCrop = await GreenhouseRepo.updateCrop(cropId, req.body);
        if (!updatedCrop) return res.status(404).json({ error: 'Crop not found' });
        res.json(updatedCrop);
    } catch (e) { next(e); }
};

const deleteCrop = async (req, res, next) => {
    try {
        const { cropId } = req.params;
        const deleted = await GreenhouseRepo.deleteCrop(cropId);
        if (!deleted) return res.status(404).json({ error: 'Crop not found' });
        res.json({ message: 'Crop deleted successfully' });
    } catch (e) { next(e); }
};

const setCrop = async (req, res, next) => {
    try {
        const { greenhouseId } = req.params;
        const { cropId } = req.body;

        const gh = await GreenhouseRepo.findById(greenhouseId);
        if (!gh || gh.ownerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const updatedGh = await GreenhouseRepo.updateActiveCrop(greenhouseId, cropId);

        res.json({ 
            message: 'Crop updated successfully', 
            activeCropId: updatedGh.activeCropId 
        });
    } catch (e) { next(e); }
};



module.exports = { 
    createGreenhouse, getMyGreenhouses, updateGreenhouse, deleteGreenhouse,
    addDevice, 
    getCrops, createCrop, updateCrop, deleteCrop, setCrop 
};