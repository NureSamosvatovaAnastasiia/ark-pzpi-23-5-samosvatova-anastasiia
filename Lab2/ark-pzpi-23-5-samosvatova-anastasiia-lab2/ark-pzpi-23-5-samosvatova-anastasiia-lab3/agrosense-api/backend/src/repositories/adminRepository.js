const db = require('../config/db');
const { users, greenhouses, sensors, actuatorLogs } = require('../db/schema');
const { eq, sql, desc } = require('drizzle-orm');

class AdminRepository {
    
    async getAllUsers() {
        return await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            role: users.role,
            isVerified: users.isVerified,
            createdAt: users.createdAt
        }).from(users);
    }

    async getAllGreenhouses() {
        return await db.select({
            id: greenhouses.id,
            name: greenhouses.name,
            location: greenhouses.location,
            owner: users.username,
            ownerEmail: users.email,
            createdAt: greenhouses.createdAt
        })
        .from(greenhouses)
        .leftJoin(users, eq(greenhouses.ownerId, users.id));
    }

    async deleteUser(userId) {
        return await db.delete(users).where(eq(users.id, userId)).returning();
    }

    async updateUserRole(userId, newRole) {
        return await db.update(users)
            .set({ role: newRole })
            .where(eq(users.id, userId))
            .returning();
    }

    async getGlobalStats() {
        const userCount = await db.select({ count: sql`count(*)` }).from(users);
        const ghCount = await db.select({ count: sql`count(*)` }).from(greenhouses);
        const sensorCount = await db.select({ count: sql`count(*)` }).from(sensors);
        
        return {
            totalUsers: Number(userCount[0].count),
            totalGreenhouses: Number(ghCount[0].count),
            totalSensors: Number(sensorCount[0].count)
        };
    }

   
    async getGlobalLogs(limit = 100) {
        return await db.select().from(actuatorLogs)
            .orderBy(desc(actuatorLogs.timestamp))
            .limit(limit);
    }
}

module.exports = new AdminRepository();