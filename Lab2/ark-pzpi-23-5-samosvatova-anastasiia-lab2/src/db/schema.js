const { pgTable, uuid, varchar, boolean, timestamp, decimal, pgEnum, integer, text } = require('drizzle-orm/pg-core');
const { relations } = require('drizzle-orm');

const sensorTypeEnum = pgEnum('sensor_type', ['temperature', 'humidity', 'soil_moisture', 'light']);
const actuatorTypeEnum = pgEnum('actuator_type', ['fan', 'pump', 'heater', 'grow_light', 'vent', 'humidifier']);

const crops = pgTable('crops', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  
 
  idealTempMin: decimal('ideal_temp_min', { precision: 5, scale: 2 }).default('18.00'),
  idealTempMax: decimal('ideal_temp_max', { precision: 5, scale: 2 }).default('25.00'),

  idealSoilMoistureMin: decimal('ideal_soil_moisture_min', { precision: 5, scale: 2 }).default('60.00'),
  idealSoilMoistureMax: decimal('ideal_soil_moisture_max', { precision: 5, scale: 2 }).default('80.00'),
  
  idealAirHumidityMin: decimal('ideal_air_humidity_min', { precision: 5, scale: 2 }).default('50.00'),
  idealAirHumidityMax: decimal('ideal_air_humidity_max', { precision: 5, scale: 2 }).default('70.00'),

  idealLightLevel: integer('ideal_light_level').default(10000),
  requiredDayHours: integer('required_day_hours').default(14),
  
  waterNeedFactor: integer('water_need_factor').default(50), 
  
  description: varchar('description', { length: 500 }),
});

const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  username: varchar('username', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).default('user'),
  isVerified: boolean('is_verified').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

const greenhouses = pgTable('greenhouses', {
  id: uuid('id').defaultRandom().primaryKey(),
  ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  activeCropId: uuid('active_crop_id').references(() => crops.id, { onDelete: 'set null' }),
  
  name: varchar('name', { length: 100 }).notNull(),
  location: varchar('location', { length: 255 }),
  areaSqMeters: decimal('area_sq_meters', { precision: 5, scale: 2 }).default('1.00'),
  heightMeters: decimal('height_meters', { precision: 4, scale: 2 }).default('3.00'),
  createdAt: timestamp('created_at').defaultNow(),
});

const sensors = pgTable('sensors', {
  id: uuid('id').defaultRandom().primaryKey(),
  greenhouseId: uuid('greenhouse_id').references(() => greenhouses.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: sensorTypeEnum('type').notNull(),
  unit: varchar('unit', { length: 20 }),
  isActive: boolean('is_active').default(true),
});

const actuators = pgTable('actuators', {
  id: uuid('id').defaultRandom().primaryKey(),
  greenhouseId: uuid('greenhouse_id').references(() => greenhouses.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  type: actuatorTypeEnum('type').notNull(),
  
  // pump: мл/сек
  // fan: CFM Ват
  // heater: Ват
  // humidifier: мл/год
  capacity: decimal('capacity', { precision: 10, scale: 2 }).default('0.00'),
  
  currentState: boolean('current_state').default(false),
  currentValue: decimal('current_value', { precision: 5, scale: 2 }).default('0.00'), 
});

const readings = pgTable('readings', {
  id: uuid('id').defaultRandom().primaryKey(),
  sensorId: uuid('sensor_id').references(() => sensors.id, { onDelete: 'cascade' }).notNull(),
  value: decimal('value', { precision: 10, scale: 2 }).notNull(),
  timestamp: timestamp('timestamp').defaultNow(),
});

const actuatorLogs = pgTable('actuator_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  actuatorId: uuid('actuator_id').references(() => actuators.id, { onDelete: 'cascade' }).notNull(),
  action: varchar('action', { length: 50 }).notNull(),
  triggeredBy: varchar('triggered_by', { length: 50 }),
  details: varchar('details', { length: 255 }),
  timestamp: timestamp('timestamp').defaultNow(),
});

const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  greenhouseId: uuid('greenhouse_id').references(() => greenhouses.id, { onDelete: 'cascade' }).notNull(),
  message: text('message').notNull(),
  severity: varchar('severity', { length: 20 }).default('INFO'),
  isRead: boolean('is_read').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  isUsed: boolean('is_used').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

const greenhousesRelations = relations(greenhouses, ({ one, many }) => ({
  owner: one(users, { fields: [greenhouses.ownerId], references: [users.id] }),
  activeCrop: one(crops, { fields: [greenhouses.activeCropId], references: [crops.id] }),
  sensors: many(sensors),
  actuators: many(actuators),
  notifications: many(notifications),
}));

const usersRelations = relations(users, ({ many }) => ({
  greenhouses: many(greenhouses),
  verifications: many(emailVerifications),
}));

const sensorsRelations = relations(sensors, ({ one, many }) => ({
  greenhouse: one(greenhouses, { fields: [sensors.greenhouseId], references: [greenhouses.id] }),
  readings: many(readings),
}));

const actuatorsRelations = relations(actuators, ({ one, many }) => ({
  greenhouse: one(greenhouses, { fields: [actuators.greenhouseId], references: [greenhouses.id] }),
  logs: many(actuatorLogs),
}));

const notificationsRelations = relations(notifications, ({ one }) => ({
  greenhouse: one(greenhouses, { fields: [notifications.greenhouseId], references: [greenhouses.id] }),
}));

module.exports = {
  sensorTypeEnum, actuatorTypeEnum,
  crops, users, greenhouses, sensors, actuators, readings, actuatorLogs, notifications, emailVerifications,
  greenhousesRelations, usersRelations, sensorsRelations, actuatorsRelations, notificationsRelations
};