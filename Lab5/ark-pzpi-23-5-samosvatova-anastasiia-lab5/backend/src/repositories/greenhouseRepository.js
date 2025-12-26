const db = require('../config/db');
const { greenhouses, sensors, actuators, crops } = require('../db/schema');
const { eq } = require('drizzle-orm');

class GreenhouseRepository {

 async create(ownerId, { name, location, areaSqMeters, heightMeters }) {
    const result = await db.insert(greenhouses).values({
      ownerId,
      name,
      location,
      areaSqMeters: areaSqMeters ? String(areaSqMeters) : '1.00',
      heightMeters: heightMeters ? String(heightMeters) : '3.00' 
    }).returning();
    return result[0];
  }

  async update(id, data) {
    
    const result = await db.update(greenhouses)
      .set(data)
      .where(eq(greenhouses.id, id))
      .returning();
    return result[0];
  }

  async findAllByOwner(ownerId) {
    return await db.query.greenhouses.findMany({
        where: eq(greenhouses.ownerId, ownerId),
        with: { activeCrop: true }
    });
  }

  async findById(id) {
    return await db.query.greenhouses.findFirst({
        where: eq(greenhouses.id, id),
        with: { 
            activeCrop: true,
            sensors: true,
            actuators: true
        }
    });
  }


  async delete(id) {
    const result = await db.delete(greenhouses)
      .where(eq(greenhouses.id, id))
      .returning();
    return result[0];
  }


  async addSensor(greenhouseId, { name, type, unit }) {
    const result = await db.insert(sensors).values({ 
        greenhouseId, 
        name, 
        type, 
        unit 
    }).returning();
    return result[0];
  }

  async addActuator(greenhouseId, { name, type, capacity }) {
    const result = await db.insert(actuators).values({ 
        greenhouseId, 
        name, 
        type, 
        capacity: capacity ? String(capacity) : '0.00' 
    }).returning();
    return result[0];
  }


  async getAllCrops() {
    return await db.select().from(crops);
  }

  async getCropById(id) {
    const result = await db.select().from(crops).where(eq(crops.id, id));
    return result[0];
  }

  async createCrop(data) {
    const result = await db.insert(crops).values(data).returning();
    return result[0];
  }

  async updateCrop(id, data) {
    const result = await db.update(crops)
      .set(data)
      .where(eq(crops.id, id))
      .returning();
    return result[0];
  }

  async deleteCrop(id) {
    const result = await db.delete(crops)
      .where(eq(crops.id, id))
      .returning();
    return result[0];
  }

  async updateActiveCrop(greenhouseId, cropId) {
    const result = await db.update(greenhouses)
      .set({ activeCropId: cropId })
      .where(eq(greenhouses.id, greenhouseId))
      .returning();
    return result[0];
  }
}

module.exports = new GreenhouseRepository();