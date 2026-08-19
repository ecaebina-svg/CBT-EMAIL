// src/routes/admin.js
const bcrypt = require('bcryptjs');
const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { sendVerificationEmail } = require('../utils/mailer');

const router = express.Router();

// Helper: generate kode verifikasi 6 digit
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// -------------------------------------------------------
// GET /api/admin/summary
// -------------------------------------------------------
router.get('/summary', authenticate, authorize('admin', 'teacher'), async (req, res, next) => {
  try {
    const [[userCount]] = await pool.query('SELECT COUNT(*) AS total_users FROM users');
    const [[examCount]] = await pool.query('SELECT COUNT(*) AS total_exams FROM exams');
    const [[attemptCount]] = await pool.query('SELECT COUNT(*) AS total_attempts FROM exam_attempts');

    res.json({
      total_users: userCount.total_users,
      total_exams: examCount.total_exams,
      total_attempts: attemptCount.total_attempts
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------
// GET /api/admin/users
// -------------------------------------------------------
router.get('/users', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT users.id, users.name, users.email, users.class_name,
              users.is_active, users.email_verified, users.verification_code,
              roles.name AS role
       FROM users
       JOIN roles ON roles.id = users.role_id
       ORDER BY users.id ASC`
    );
    res.json({ users: rows });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------
// GET /api/admin/exams
// -------------------------------------------------------
router.get('/exams', authenticate, authorize('admin', 'teacher'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT exams.id, exams.title, exams.duration_minutes, exams.is_active,
              subjects.name AS subject_name, users.name AS teacher_name
       FROM exams
       JOIN subjects ON subjects.id = exams.subject_id
       JOIN users ON users.id = exams.teacher_id
       ORDER BY exams.id DESC`
    );
    res.json({ exams: rows });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------
// POST /api/admin/users — Tambah user baru + generate kode verifikasi
// -------------------------------------------------------
router.post('/users', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role = 'student', class_name = '' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
    }

    const [[r]] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!r) return res.status(400).json({ message: 'Role tidak valid.' });

    const hash = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    await pool.query(
      'INSERT INTO users (name, email, password, role_id, class_name, is_active, email_verified, verification_code) VALUES (?, ?, ?, ?, ?, 1, 0, ?)',
      [name, email, hash, r.id, class_name, verificationCode]
    );

    // Coba kirim email verifikasi (jika SMTP dikonfigurasi)
    let emailSent = false;
    let emailError = null;
    try {
      if (process.env.MAIL_HOST && process.env.MAIL_USERNAME) {
        await sendVerificationEmail(email, name, verificationCode);
        emailSent = true;
      }
    } catch (mailErr) {
      emailError = mailErr.message;
      console.warn('⚠️  Email tidak terkirim (SMTP belum dikonfigurasi):', mailErr.message);
    }

    res.json({
      message: 'User berhasil ditambahkan.',
      verification_code_demo: verificationCode, // tampilkan di dashboard untuk demo
      email_sent: emailSent,
      email_note: emailSent
        ? `Email verifikasi terkirim ke ${email}`
        : `SMTP belum dikonfigurasi. Kode demo: ${verificationCode}`
    });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------
// POST /api/admin/users/:id/verify — Admin verifikasi manual
// -------------------------------------------------------
router.post('/users/:id/verify', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?',
      [id]
    );
    res.json({ message: 'User berhasil diverifikasi secara manual.' });
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------
// DELETE /api/admin/users/:id
// -------------------------------------------------------
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'User berhasil dihapus.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
