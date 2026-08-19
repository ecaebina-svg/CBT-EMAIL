const express = require('express');
const pool = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

function isExamCurrentlyActive(exam) {
  const now = new Date();
  const startsOk = !exam.start_time || new Date(exam.start_time) <= now;
  const endsOk = !exam.end_time || new Date(exam.end_time) >= now;
  return Boolean(exam.is_active) && startsOk && endsOk;
}

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT exams.id, exams.title, exams.description, exams.duration_minutes, exams.start_time, exams.end_time,
              exams.is_active, subjects.name AS subject_name, users.name AS teacher_name,
              attempts.status AS attempt_status, attempts.score
       FROM exams
       JOIN subjects ON subjects.id = exams.subject_id
       JOIN users ON users.id = exams.teacher_id
       LEFT JOIN exam_attempts attempts
         ON attempts.exam_id = exams.id AND attempts.user_id = ?
       WHERE exams.is_active = 1
       ORDER BY exams.id DESC`,
      [req.user.id]
    );

    res.json({ exams: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/:examId/start', authenticate, authorize('student'), async (req, res, next) => {
  try {
    const examId = Number(req.params.examId);

    const [examRows] = await pool.execute(
      'SELECT * FROM exams WHERE id = ? LIMIT 1',
      [examId]
    );

    if (examRows.length === 0) {
      return res.status(404).json({ message: 'Ujian tidak ditemukan.' });
    }

    const exam = examRows[0];

    if (!isExamCurrentlyActive(exam)) {
      return res.status(400).json({ message: 'Ujian tidak aktif atau berada di luar jadwal.' });
    }

    const [existingRows] = await pool.execute(
      'SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [examId, req.user.id]
    );

    if (existingRows.length > 0) {
      const attempt = existingRows[0];
      if (attempt.status !== 'submitted') {
        return res.json({ message: 'Sesi ujian dilanjutkan.', attempt });
      }
    }

    const [result] = await pool.execute(
      'INSERT INTO exam_attempts (exam_id, user_id, started_at, status) VALUES (?, ?, NOW(), ?)',
      [examId, req.user.id, 'in_progress']
    );

    res.status(201).json({
      message: 'Sesi ujian dimulai.',
      attempt: { id: result.insertId, exam_id: examId, user_id: req.user.id, status: 'in_progress' }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:examId/questions', authenticate, authorize('student'), async (req, res, next) => {
  try {
    const examId = Number(req.params.examId);

    const [examRows] = await pool.execute(
      `SELECT exams.id, exams.title, exams.description, exams.duration_minutes, subjects.name AS subject_name
       FROM exams
       JOIN subjects ON subjects.id = exams.subject_id
       WHERE exams.id = ? AND exams.is_active = 1
       LIMIT 1`,
      [examId]
    );

    if (examRows.length === 0) {
      return res.status(404).json({ message: 'Ujian tidak ditemukan atau tidak aktif.' });
    }

    const [attemptRows] = await pool.execute(
      'SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1',
      [examId, req.user.id]
    );

    if (attemptRows.length === 0) {
      return res.status(400).json({ message: 'Mulai ujian terlebih dahulu.' });
    }

    if (attemptRows[0].status === 'submitted') {
      return res.status(400).json({ message: 'Ujian ini sudah selesai dikerjakan.' });
    }

    const [questionRows] = await pool.execute(
      `SELECT id, question_text, point, question_order
       FROM questions
       WHERE exam_id = ?
       ORDER BY question_order ASC, id ASC`,
      [examId]
    );

    const [optionRows] = await pool.execute(
      `SELECT options.id, options.question_id, options.option_label, options.option_text
       FROM options
       JOIN questions ON questions.id = options.question_id
       WHERE questions.exam_id = ?
       ORDER BY options.question_id ASC, options.option_label ASC`,
      [examId]
    );

    const optionsByQuestion = optionRows.reduce((acc, option) => {
      acc[option.question_id] = acc[option.question_id] || [];
      acc[option.question_id].push(option);
      return acc;
    }, {});

    const questions = questionRows.map((question) => ({
      ...question,
      options: optionsByQuestion[question.id] || []
    }));

    res.json({
      exam: examRows[0],
      attempt: attemptRows[0],
      questions
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:examId/submit', authenticate, authorize('student'), async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const examId = Number(req.params.examId);
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

    if (answers.length === 0) {
      return res.status(400).json({ message: 'Jawaban belum diisi.' });
    }

    await connection.beginTransaction();

    const [attemptRows] = await connection.execute(
      'SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE',
      [examId, req.user.id]
    );

    if (attemptRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Sesi ujian belum dibuat.' });
    }

    const attempt = attemptRows[0];

    if (attempt.status === 'submitted') {
      await connection.rollback();
      return res.status(400).json({ message: 'Ujian ini sudah dikirim sebelumnya.' });
    }

    const [questionRows] = await connection.execute(
      'SELECT id, point FROM questions WHERE exam_id = ?',
      [examId]
    );

    if (questionRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: 'Ujian belum memiliki soal.' });
    }

    const questionIds = questionRows.map((q) => q.id);
    const totalPoint = questionRows.reduce((sum, q) => sum + Number(q.point), 0);

    const [correctRows] = await connection.query(
      `SELECT question_id, id AS correct_option_id
       FROM options
       WHERE is_correct = 1 AND question_id IN (?)`,
      [questionIds]
    );

    const correctMap = new Map(correctRows.map((row) => [Number(row.question_id), Number(row.correct_option_id)]));
    const answerMap = new Map(answers.map((a) => [Number(a.question_id), Number(a.option_id)]));

    let earnedPoint = 0;

    for (const question of questionRows) {
      const questionId = Number(question.id);
      const selectedOptionId = answerMap.get(questionId) || null;
      const correctOptionId = correctMap.get(questionId);
      const isCorrect = selectedOptionId && selectedOptionId === correctOptionId ? 1 : 0;

      if (isCorrect) {
        earnedPoint += Number(question.point);
      }

      await connection.execute(
        `INSERT INTO student_answers (attempt_id, question_id, option_id, is_correct)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE option_id = VALUES(option_id), is_correct = VALUES(is_correct)`,
        [attempt.id, questionId, selectedOptionId, isCorrect]
      );
    }

    const score = totalPoint > 0 ? Number(((earnedPoint / totalPoint) * 100).toFixed(2)) : 0;

    await connection.execute(
      `UPDATE exam_attempts
       SET finished_at = NOW(), score = ?, status = 'submitted'
       WHERE id = ?`,
      [score, attempt.id]
    );

    await connection.commit();

    res.json({
      message: 'Jawaban berhasil dikirim.',
      score,
      total_questions: questionRows.length,
      correct_answers: correctRows.filter((row) => answerMap.get(Number(row.question_id)) === Number(row.correct_option_id)).length
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
});

router.get('/my-results', authenticate, authorize('student'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT attempts.id, attempts.score, attempts.status, attempts.started_at, attempts.finished_at,
              exams.title, subjects.name AS subject_name
       FROM exam_attempts attempts
       JOIN exams ON exams.id = attempts.exam_id
       JOIN subjects ON subjects.id = exams.subject_id
       WHERE attempts.user_id = ?
       ORDER BY attempts.id DESC`,
      [req.user.id]
    );

    res.json({ results: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:examId/results', authenticate, authorize('admin', 'teacher'), async (req, res, next) => {
  try {
    const examId = Number(req.params.examId);

    const [rows] = await pool.execute(
      `SELECT attempts.id, attempts.score, attempts.status, attempts.started_at, attempts.finished_at,
              users.name AS student_name, users.email AS student_email, users.class_name,
              exams.title AS exam_title
       FROM exam_attempts attempts
       JOIN users ON users.id = attempts.user_id
       JOIN exams ON exams.id = attempts.exam_id
       WHERE attempts.exam_id = ?
       ORDER BY attempts.id DESC`,
      [examId]
    );

    res.json({ results: rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

