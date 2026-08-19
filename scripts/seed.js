// scripts/seed.js — Part 3: Email Verification
const bcrypt = require('bcryptjs');
const pool = require('../src/config/db');

async function seed() {
  try {
    console.log('🌱 Mulai seeding...');

    // 1. Roles
    await pool.query(`INSERT IGNORE INTO roles (name, description) VALUES
      ('admin',   'Administrator sistem'),
      ('teacher', 'Guru / Dosen'),
      ('student', 'Siswa / Mahasiswa')`);
    console.log('✅ Roles');

    const hash = await bcrypt.hash('password123', 10);

    // 2. Users
    // Admin → email_verified = 1 (langsung aktif)
    // Guru & Siswa → email_verified = 0, punya verification_code
    await pool.query(`INSERT IGNORE INTO users
      (name, email, password, role_id, class_name, is_active, email_verified, verification_code)
    VALUES
      ('Admin CBT',   'admin@cbt.test',  ?, (SELECT id FROM roles WHERE name='admin'),   NULL,      1, 1, NULL),
      ('Guru Demo',   'guru@cbt.test',   ?, (SELECT id FROM roles WHERE name='teacher'), NULL,      1, 0, '123456'),
      ('Siswa Demo',  'siswa@cbt.test',  ?, (SELECT id FROM roles WHERE name='student'), 'Kelas A', 1, 0, '654321')`,
      [hash, hash, hash]);
    console.log('✅ Users (admin verified, guru & siswa belum)');

    // 3. Subjects
    await pool.query(`INSERT IGNORE INTO subjects (name, description) VALUES
      ('Dasar Pemrograman Web', 'HTML, CSS, JavaScript dasar')`);
    const [[subject]] = await pool.query(`SELECT id FROM subjects WHERE name='Dasar Pemrograman Web' LIMIT 1`);
    const [[teacher]] = await pool.query(`SELECT id FROM users WHERE email='guru@cbt.test' LIMIT 1`);

    // 4. Exams
    const [existExam] = await pool.query('SELECT id FROM exams LIMIT 1');
    if (existExam.length === 0) {
      await pool.query(`INSERT INTO exams (subject_id, teacher_id, title, description, duration_minutes, is_active)
        VALUES (?, ?, 'Ujian Dasar CBT', 'Ujian contoh untuk menguji fitur login, daftar ujian, pengerjaan soal, dan penilaian otomatis.', 20, 1)`,
        [subject.id, teacher.id]);

      const [[exam]] = await pool.query('SELECT id FROM exams ORDER BY id DESC LIMIT 1');

      const [q1] = await pool.query(
        `INSERT INTO questions (exam_id, question_text, question_order, point) VALUES (?, ?, 1, 1)`,
        [exam.id, 'Apa kepanjangan dari HTML?']
      );
      await pool.query(`INSERT INTO options (question_id, option_label, option_text, is_correct) VALUES
        (?, 'A', 'HyperText Markup Language', 1),
        (?, 'B', 'High Text Machine Language', 0),
        (?, 'C', 'Hyper Transfer Markup Language', 0),
        (?, 'D', 'HyperText Machine Language', 0)`,
        [q1.insertId, q1.insertId, q1.insertId, q1.insertId]);

      const [q2] = await pool.query(
        `INSERT INTO questions (exam_id, question_text, question_order, point) VALUES (?, ?, 2, 1)`,
        [exam.id, 'Tag HTML untuk membuat teks tebal adalah...']
      );
      await pool.query(`INSERT INTO options (question_id, option_label, option_text, is_correct) VALUES
        (?, 'A', '<i>', 0),
        (?, 'B', '<u>', 0),
        (?, 'C', '<b>', 1),
        (?, 'D', '<s>', 0)`,
        [q2.insertId, q2.insertId, q2.insertId, q2.insertId]);

      console.log('✅ Exam + soal');
    } else {
      console.log('⚠️  Exam sudah ada, skip.');
    }

    console.log('\n🎉 Seed selesai!');
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│  Akun Demo                                          │');
    console.log('├──────────────┬──────────────────┬───────────────────┤');
    console.log('│ Role         │ Email            │ Kode Verifikasi   │');
    console.log('├──────────────┼──────────────────┼───────────────────┤');
    console.log('│ admin        │ admin@cbt.test   │ (sudah verified)  │');
    console.log('│ teacher/guru │ guru@cbt.test    │ 123456            │');
    console.log('│ student/siswa│ siswa@cbt.test   │ 654321            │');
    console.log('└──────────────┴──────────────────┴───────────────────┘');
    console.log('Password semua akun: password123');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
