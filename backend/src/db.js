const { Pool } = require('pg');

// Use environment variable for connection string
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/generated_db'; // Default to standard port

const pool = new Pool({
  connectionString: connectionString,
});

// Function to connect and test the database connection
const connectDB = async () => {
  try {
    await pool.query('SELECT 1'); // Simple query to test connection
    console.log('PostgreSQL database connected.');
  } catch (error) {
    console.error('Error connecting to PostgreSQL database:', error.message);
    throw error; // Re-throw to be caught by server.js
  }
};

// Helper for database transactions
const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Export the pool and connectDB function
module.exports = {
  query: (text, params) => pool.query(text, params),
  connectDB,
  pool, // Export pool directly for advanced usage if needed
  withTransaction // Export transaction helper
};
