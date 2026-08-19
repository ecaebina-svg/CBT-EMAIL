const mysql = require('mysql2/promise');

// Buat koneksi langsung dari DATABASE_URL
// Jika DATABASE_URL tidak ada (misal di lingkungan lokal), baru pakai variabel individual
const pool = mysql.createPool(
  process.env.DATABASE_URL || {
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

module.exports = pool;