const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Gunakan DATABASE_URL atau hardcode ke TiDB Cloud
const databaseUrl = process.env.DATABASE_URL;

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

console.log('✅ setup-db.js - Connected to TiDB Cloud');
console.log('   Host: gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
console.log('   Database: Email_cbt_ebina');

// ... lanjutkan kode setup-db.js yang sudah ada ...