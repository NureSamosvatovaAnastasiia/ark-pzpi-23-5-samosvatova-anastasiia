const db = require('../config/db');
const { users } = require('../db/schema');
const { eq } = require('drizzle-orm');

class UserRepository {
  async create({ username, email, passwordHash }) {
    const result = await db.insert(users).values({
      username, email, passwordHash, isVerified: false
    }).returning();
    return result[0];
  }

  async findByEmail(email) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async findById(id) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async markAsVerified(email) {
    const result = await db.update(users)
      .set({ isVerified: true })
      .where(eq(users.email, email))
      .returning();
    return result[0];
  }
}
module.exports = new UserRepository();