const mysql = require('mysql2/promise');

// Gunakan DATABASE_URL dari environment variables
const databaseUrl = process.env.DATABASE_URL;

// Jika DATABASE_URL tidak ada, gunakan konfigurasi individual (untuk lokal)
const pool = mysql.createPool(
  databaseUrl || {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'cbt_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: '+07:00'
  }
);

console.log('✅ Database connection configured');
if (databaseUrl) {
  console.log('✅ Using DATABASE_URL (production mode)');
} else {
  console.log('⚠️ Using individual DB variables (local mode)');
}

module.exports = pool;