const mysql = require('mysql2/promise');

// Gunakan DATABASE_URL dari environment variables
// Di Railway, DATABASE_URL sudah di-set di Environment Variables
const databaseUrl = process.env.DATABASE_URL;

// Jika DATABASE_URL ada, pakai itu. Jika tidak, pakai hardcode TiDB Cloud
// (untuk berjaga-jaga kalau Environment Variables tidak terbaca)
const pool = mysql.createPool(
  databaseUrl || {
    host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
    port: 4000,
    user: '3JNDCKCMvpbBwcf.root',
    password: 'MmdryOnJ4JxVJMXC',
    database: 'Email_cbt_ebina',
    ssl: { rejectUnauthorized: true },
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
  console.log('✅ Using HARDCODE (fallback mode) - TiDB Cloud');
  console.log('   Host: gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
  console.log('   Database: Email_cbt_ebina');
}

module.exports = pool;