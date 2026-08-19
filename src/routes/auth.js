// src/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Helper: generate kode verifikasi 8 digit
function generateVerificationCode() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan password wajib diisi.' });
    }

    const [rows] = await pool.execute(
      `SELECT users.id, users.name, users.email, users.password, users.full_name,
              users.is_active, users.email_verified, users.verification_code, roles.name AS role
       FROM users
       JOIN roles ON roles.id = users.role_id
       WHERE users.email = ?
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    const user = rows[0];
    if (!user.is_active) {
      return res.status(403).json({ message: 'Akun tidak aktif.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({
        message: 'Akun belum diverifikasi. Silakan verifikasi email terlebih dahulu.',
        needs_verification: true,
        email: user.email
      });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name, email: user.email },
      process.env.JWT_SECRET || 'local_secret',
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({
      message: 'Login berhasil.',
      token,
      user: {
        id: user.id,
        name: user.name || user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'student' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
    }

    const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'Email sudah terdaftar.' });
    }

    const [roleRows] = await pool.execute('SELECT id FROM roles WHERE name = ?', [role]);
    if (roleRows.length === 0) {
      return res.status(400).json({ message: `Role '${role}' tidak ditemukan.` });
    }
    const roleId = roleRows[0].id;

    const hashed = await bcrypt.hash(password, 10);
    const verificationCode = generateVerificationCode();

    const [result] = await pool.execute(
      `INSERT INTO users 
        (name, full_name, email, password, role_id, email_verified, is_active, verification_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, name, email, hashed, roleId, 0, 1, verificationCode]
    );

    const [newUser] = await pool.execute(
      `SELECT users.id, users.name, users.email, roles.name AS role, users.verification_code
       FROM users
       JOIN roles ON roles.id = users.role_id
       WHERE users.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      message: 'Akun berhasil dibuat. Silakan verifikasi email dengan kode.',
      user: newUser[0],
      verification_code_demo: verificationCode
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ message: 'Email dan kode verifikasi wajib diisi.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, email_verified, verification_code FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Email tidak ditemukan.' });
    }

    const user = rows[0];
    if (user.email_verified) {
      return res.status(400).json({ message: 'Email sudah terverifikasi. Silakan login.' });
    }

    if (!user.verification_code || user.verification_code !== code.toString()) {
      return res.status(400).json({ message: 'Kode verifikasi tidak valid.' });
    }

    await pool.execute(
      'UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?',
      [user.id]
    );

    res.json({ message: 'Email berhasil diverifikasi. Silakan login.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;