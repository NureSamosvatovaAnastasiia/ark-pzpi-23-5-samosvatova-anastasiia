require('dotenv').config();
const schema = require('./src/db/schema');

module.exports = {
 
   schema: './src/db/schema.js',
  
  out: "./drizzle",
  driver: "pg", // Для версії 0.20.x використовуємо 'driver', а не 'dialect'
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
};