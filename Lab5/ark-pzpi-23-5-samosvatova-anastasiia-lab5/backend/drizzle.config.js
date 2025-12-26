require('dotenv').config();
const schema = require('./src/db/schema');

module.exports = {
 
   schema: './src/db/schema.js',
  
  out: "./drizzle",
  driver: "pg", 
  dbCredentials: {
    connectionString: process.env.DATABASE_URL,
  },
};