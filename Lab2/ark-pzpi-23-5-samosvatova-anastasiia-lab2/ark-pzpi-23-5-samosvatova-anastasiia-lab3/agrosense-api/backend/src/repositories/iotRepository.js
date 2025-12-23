const db = require('../config/db');
const { sensors, readings, actuators, actuatorLogs } = require('../db/schema');
const { eq, desc, and, sql, gte, inArray } = require('drizzle-orm');

class IoTRepository {
  
  async saveReading(sensorId, value, timestamp) {
    const result = await db.insert(readings).values({ 
        sensorId, 
        value: value.toString(),
        timestamp: timestamp ? new Date(timestamp) : new Date()
    }).returning();
    return result[0];
  }

  async getLatestReadings(greenhouseId) {
    const allSensors = await db.select().from(sensors).where(eq(sensors.greenhouseId, greenhouseId));
    
    return await Promise.all(allSensors.map(async (sensor) => {
      const lastReading = await db.select().from(readings)
        .where(eq(readings.sensorId, sensor.id))
        .orderBy(desc(readings.timestamp))
        .limit(1);
      
      return {
        sensorId: sensor.id,
        name: sensor.name,
        type: sensor.type,
        unit: sensor.unit,
        value: lastReading.length ? parseFloat(lastReading[0].value) : null,
        time: lastReading.length ? lastReading[0].timestamp : null
      };
    }));
  }

  async updateActuatorState(actuatorId, newState, newValue, triggeredBy) {
    let val = newValue;
    if (val === undefined || val === null) {
        val = newState ? 100 : 0;
    }

    const result = await db.update(actuators)
      .set({ 
          currentState: newState,
          currentValue: String(val)
      })
      .where(eq(actuators.id, actuatorId))
      .returning();

    if (result.length) {
      let actionText = newState ? 'TURN_ON' : 'TURN_OFF';
      if (newState && val > 0 && val < 100) {
          actionText += ` (${Number(val).toFixed(0)}%)`;
      } else if (newState && val == 100) {
          actionText += ` (100%)`;
      }

      const details = newState 
        ? `Value set to ${Number(val).toFixed(1)}` 
        : `Device stopped`;

      await db.insert(actuatorLogs).values({
        actuatorId,
        action: actionText, 
        triggeredBy,      
        details
      });
      return result[0];
    }
    throw new Error('Device not found');
  }

  async getSystemLogs(greenhouseId, limit = 50) {
    const logs = await db.select({
        id: actuatorLogs.id,
        actuatorName: actuators.name,
        type: actuators.type,
        action: actuatorLogs.action,
        reason: actuatorLogs.triggeredBy,
        details: actuatorLogs.details,
        timestamp: actuatorLogs.timestamp
    })
    .from(actuatorLogs)
    .innerJoin(actuators, eq(actuatorLogs.actuatorId, actuators.id))
    .where(eq(actuators.greenhouseId, greenhouseId))
    .orderBy(desc(actuatorLogs.timestamp))
    .limit(limit);

    return logs;
  }

  async getSystemStats(greenhouseId) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stats = await db.select({
        type: actuators.type,
        count: sql`count(*)`.mapWith(Number)
    })
    .from(actuatorLogs)
    .innerJoin(actuators, eq(actuatorLogs.actuatorId, actuators.id))
    .where(and(
        eq(actuators.greenhouseId, greenhouseId),
        sql`${actuatorLogs.action} LIKE 'TURN_ON%'`,
        gte(actuatorLogs.timestamp, oneDayAgo)
    ))
    .groupBy(actuators.type);

    return stats;
  }
  async clearSystemLogs(greenhouseId) {
  
    const sensorList = await db.select({ id: sensors.id })
        .from(sensors)
        .where(eq(sensors.greenhouseId, greenhouseId));
    
    const sensorIds = sensorList.map(s => s.id);

    if (sensorIds.length > 0) {
        await db.delete(readings)
            .where(inArray(readings.sensorId, sensorIds));
    }

    const actuatorList = await db.select({ id: actuators.id })
        .from(actuators)
        .where(eq(actuators.greenhouseId, greenhouseId));

    const actuatorIds = actuatorList.map(a => a.id);

    if (actuatorIds.length > 0) {
        await db.delete(actuatorLogs)
            .where(inArray(actuatorLogs.actuatorId, actuatorIds));
    }

    return { 
        sensorsCleared: sensorIds.length, 
        actuatorsCleared: actuatorIds.length 
    };
  }
  async getSensorsByGreenhouse(greenhouseId) {
      return await db.select()
          .from(sensors)
          .where(eq(sensors.greenhouseId, greenhouseId));
  }

  async getActuatorsByGreenhouse(greenhouseId) {
      return await db.select()
          .from(actuators)
          .where(eq(actuators.greenhouseId, greenhouseId));
  }
  async updateActuatorConfig(actuatorId, updateData) {
      const result = await db.update(actuators)
          .set(updateData)
          .where(eq(actuators.id, actuatorId))
          .returning();
      
      return result[0];
  }

  async getActuatorById(actuatorId) {
      return await db.query.actuators.findFirst({
          where: eq(actuators.id, actuatorId)
      });
  }
}

module.exports = new IoTRepository();