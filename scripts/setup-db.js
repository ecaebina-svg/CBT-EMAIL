const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

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

console.log('✅ setup-db.js - TiDB Cloud');
console.log('Host: gateway01.ap-southeast-1.prod.aws.tidbcloud.com');
console.log('Database: Email_cbt_ebina');

// ===== FUNGSI SETUP DATABASE =====
async function setupDatabase() {
  try {
    console.log('🔄 Memulai setup database...');

    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    const queries = schemaSQL.split(';').filter(q => q.trim() !== '');
    for (const query of queries) {
      try {
        await pool.query(query);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.error('Error:', err.message);
        }
      }
    }
    console.log('✅ Tabel berhasil dibuat/diperiksa');

    // Seed data roles
    const [roles] = await pool.query('SELECT * FROM roles');
    if (roles.length === 0) {
      await pool.query(`
        INSERT INTO roles (name, description) VALUES
        ('admin', 'Administrator sistem'),
        ('guru', 'Guru atau pengajar'),
        ('siswa', 'Siswa atau peserta ujian')
      `);
      console.log('✅ Roles berhasil diisi');
    }

    // Seed data users
    const [users] = await pool.query('SELECT * FROM users WHERE email = ?', ['admin@cbt.test']);
    if (users.length === 0) {
      const hashedPassword = await bcrypt.hash('password123', 10);
      await pool.query(`
        INSERT INTO users (role_id, username, email, password, full_name, is_active, email_verified)
        VALUES
        (1, 'admin', 'admin@cbt.test', ?, 'Administrator Utama', 1, 1),
        (2, 'budi.guru', 'guru@cbt.test', ?, 'Budi Santoso', 1, 1),
        (3, 'anita.siswa', 'siswa@cbt.test', ?, 'Anita Putri', 1, 1)
      `, [hashedPassword, hashedPassword, hashedPassword]);
      console.log('✅ User demo berhasil diisi');
    }

    console.log('🎉 Setup database selesai!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error setup database:', error.message);
    process.exit(1);
  }
}

setupDatabase();