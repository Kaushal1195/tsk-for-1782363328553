const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // Load .env for local runs

// Database connection string from environment variable
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/generated_db'; // Default to standard port

// Path to the SQL schema file
const schemaFilePath = path.join(__dirname, '../database/schema.sql');

async function migrate() {
    const client = new Client({
        connectionString: connectionString,
    });

    try {
        console.log('Attempting to connect to the database...');
        await client.connect();
        console.log('Successfully connected to the database.');

        console.log(`Reading SQL schema from ${schemaFilePath}...`);
        const schemaSql = fs.readFileSync(schemaFilePath, 'utf8');
        console.log('SQL schema read successfully. Executing migration...');

        // Execute the SQL schema
        await client.query(schemaSql);
        console.log('Database migration completed successfully!');

    } catch (error) {
        console.error('Database migration failed:', error);
        process.exit(1); // Exit with a non-zero code to indicate failure
    } finally {
        console.log('Closing database connection.');
        await client.end();
    }
}

// Execute the migration function
migrate();
