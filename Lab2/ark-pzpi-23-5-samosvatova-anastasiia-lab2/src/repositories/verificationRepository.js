const db = require('../config/db');
const { emailVerifications } = require('../db/schema');
const { eq, and, gt } = require('drizzle-orm');

class VerificationRepository {
  async create(userId, email, code) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); 
    const result = await db.insert(emailVerifications).values({
      userId, email, code, expiresAt
    }).returning();
    return result[0];
  }

  async findValidCode(email, code) {
    const result = await db.select().from(emailVerifications)
      .where(and(
        eq(emailVerifications.email, email),
        eq(emailVerifications.code, code),
        eq(emailVerifications.isUsed, false),
        gt(emailVerifications.expiresAt, new Date())
      ));
    return result[0];
  }

  async markAsUsed(id) {
    await db.update(emailVerifications)
      .set({ isUsed: true })
      .where(eq(emailVerifications.id, id));
  }
}
module.exports = new VerificationRepository();