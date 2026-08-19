const mysql = require('mysql2/promise');

// HARDCODE - PASTI KONEK KE TIDB CLOUD
const pool = mysql.createPool({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  port: 4000,
  user: '3JNDCKCMvpbBwcf.root',
  password: 'MmdryOnJ4JxVJMXC',
  database: 'Email_cbt_ebina',
  ssl: {
    rejectUnauthorized: true
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+07:00'
});

console.log('✅ DATABASE CONFIGURED (HARDCODE) - TiDB Cloud');
console.log('Host: gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
console.log('Database: Email_cbt_ebina');

module.exports = pool;