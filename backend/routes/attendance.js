import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken, requireAnyRole, requireRole } from '../middleware/auth.js';
import {
  allowedStatuses,
  eligibilityStatus,
  isValidISODate,
  monthYearFromISODate,
  normalizePercentage
} from '../utils.js';

const router = Router();

async function recalculateMonthlySummary(connection, studentId, subjectId, date) {
  const { month, year } = monthYearFromISODate(date);
  const [[counts]] = await connection.execute(
    `SELECT
       COUNT(*) AS raw_classes_held,
       COALESCE(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END), 0) AS raw_classes_attended
     FROM attendance_records
     WHERE student_id = ?
       AND subject_id = ?
       AND MONTH(date) = ?
       AND YEAR(date) = ?`,
    [studentId, subjectId, month, year]
  );

  const classesHeld = Math.min(Number(counts.raw_classes_held || 0), 30);
  const classesAttended = Math.min(Number(counts.raw_classes_attended || 0), classesHeld);

  await connection.execute(
    `INSERT INTO monthly_summary (student_id, subject_id, month, year, classes_held, classes_attended)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       classes_held = ?,
       classes_attended = ?`,
    [studentId, subjectId, month, year, classesHeld, classesAttended, classesHeld, classesAttended]
  );

  const [[summary]] = await connection.execute(
    `SELECT
       ms.id,
       ms.student_id,
       ms.subject_id,
       s.name AS subject_name,
       s.code AS subject_code,
       ms.month,
       ms.year,
       ms.classes_held,
       ms.classes_attended,
       CASE
         WHEN LEAST(ms.classes_held, 30) = 0 THEN 0
         ELSE ROUND((ms.classes_attended / LEAST(ms.classes_held, 30)) * 100, 2)
       END AS percentage,
       CASE
         WHEN LEAST(ms.classes_held, 30) = 0 THEN 0
         ELSE ((ms.classes_attended / LEAST(ms.classes_held, 30)) * 100 >= 75)
       END AS is_eligible
     FROM monthly_summary ms
     JOIN subjects s ON s.id = ms.subject_id
     WHERE ms.student_id = ?
       AND ms.subject_id = ?
       AND ms.month = ?
       AND ms.year = ?`,
    [studentId, subjectId, month, year]
  );

  return {
    ...summary,
    percentage: normalizePercentage(summary.percentage),
    status: eligibilityStatus(summary.percentage, summary.classes_held)
  };
}

router.post(
  '/mark',
  authenticateToken,
  requireAnyRole(['admin', 'teacher']),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.body.student_id);
    const subjectId = Number(req.body.subject_id);
    const date = String(req.body.date || '').trim();
    const status = String(req.body.status || '').trim();

    if (!studentId || !subjectId || !isValidISODate(date) || !allowedStatuses.has(status)) {
      return res.status(400).json({
        message: 'Student, subject, date, and present/absent status are required.'
      });
    }

    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const [[student]] = await connection.execute(
        `SELECT id FROM users WHERE id = ? AND role = 'student' LIMIT 1`,
        [studentId]
      );
      const [[subject]] = await connection.execute(
        `SELECT id FROM subjects WHERE id = ? LIMIT 1`,
        [subjectId]
      );

      if (!student || !subject) {
        await connection.rollback();
        return res.status(404).json({ message: 'Student or subject was not found.' });
      }

      await connection.execute(
        `INSERT INTO attendance_records (student_id, subject_id, date, status)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status = ?`,
        [studentId, subjectId, date, status, status]
      );

      const summary = await recalculateMonthlySummary(connection, studentId, subjectId, date);
      await connection.commit();

      return res.json({
        message: 'Attendance saved.',
        summary
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  })
);

router.get(
  '/my',
  authenticateToken,
  requireRole('student'),
  asyncHandler(async (req, res) => {
    const [records] = await pool.execute(
      `SELECT
         ar.id,
         ar.student_id,
         ar.subject_id,
         s.name AS subject_name,
         s.code AS subject_code,
         DATE_FORMAT(ar.date, '%Y-%m-%d') AS date,
         ar.status
       FROM attendance_records ar
       JOIN subjects s ON s.id = ar.subject_id
       WHERE ar.student_id = ?
       ORDER BY ar.date DESC, s.name ASC`,
      [req.user.id]
    );

    return res.json({ records });
  })
);

router.get(
  '/monthly-report',
  authenticateToken,
  requireAnyRole(['admin', 'teacher']),
  asyncHandler(async (req, res) => {
    const month = Number(req.query.month);
    const year = Number(req.query.year);
    const studentId = req.query.studentId ? Number(req.query.studentId) : null;

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return res.status(400).json({ message: 'Valid month is required.' });
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return res.status(400).json({ message: 'Valid year is required.' });
    }

    if (req.query.studentId && !studentId) {
      return res.status(400).json({ message: 'Valid student id is required.' });
    }

    const params = [month, year];
    let studentFilter = '';

    if (studentId) {
      studentFilter = 'AND ms.student_id = ?';
      params.push(studentId);
    }

    const [reports] = await pool.execute(
      `SELECT
         ms.id,
         ms.student_id,
         u.name AS student_name,
         u.roll_number,
         u.department,
         ms.subject_id,
         s.name AS subject_name,
         s.code AS subject_code,
         ms.month,
         ms.year,
         ms.classes_held,
         ms.classes_attended,
         CASE
           WHEN LEAST(ms.classes_held, 30) = 0 THEN 0
           ELSE ROUND((ms.classes_attended / LEAST(ms.classes_held, 30)) * 100, 2)
         END AS percentage,
         CASE
           WHEN LEAST(ms.classes_held, 30) = 0 THEN 0
           ELSE ((ms.classes_attended / LEAST(ms.classes_held, 30)) * 100 >= 75)
         END AS is_eligible
       FROM monthly_summary ms
       JOIN users u ON u.id = ms.student_id
       JOIN subjects s ON s.id = ms.subject_id
       WHERE ms.month = ?
         AND ms.year = ?
         ${studentFilter}
       ORDER BY u.name ASC, s.name ASC`,
      params
    );

    return res.json({
      reports: reports.map((report) => ({
        ...report,
        percentage: normalizePercentage(report.percentage),
        is_eligible: Boolean(report.is_eligible),
        status: eligibilityStatus(report.percentage, report.classes_held)
      }))
    });
  })
);

router.get(
  '/monthly/:studentId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.studentId);

    if (!studentId) {
      return res.status(400).json({ message: 'Valid student id is required.' });
    }

    if (!['admin', 'teacher'].includes(req.user.role) && req.user.id !== studentId) {
      return res.status(403).json({ message: 'You can only view your own monthly attendance.' });
    }

    const [summaries] = await pool.execute(
      `SELECT
         ms.id,
         ms.student_id,
         u.name AS student_name,
         u.roll_number,
         u.department,
         ms.subject_id,
         s.name AS subject_name,
         s.code AS subject_code,
         ms.month,
         ms.year,
         ms.classes_held,
         ms.classes_attended,
         CASE
           WHEN LEAST(ms.classes_held, 30) = 0 THEN 0
           ELSE ROUND((ms.classes_attended / LEAST(ms.classes_held, 30)) * 100, 2)
         END AS percentage,
         CASE
           WHEN LEAST(ms.classes_held, 30) = 0 THEN 0
           ELSE ((ms.classes_attended / LEAST(ms.classes_held, 30)) * 100 >= 75)
         END AS is_eligible
       FROM monthly_summary ms
       JOIN users u ON u.id = ms.student_id
       JOIN subjects s ON s.id = ms.subject_id
       WHERE ms.student_id = ?
       ORDER BY ms.year DESC, ms.month DESC, s.name ASC`,
      [studentId]
    );

    return res.json({
      summaries: summaries.map((summary) => ({
        ...summary,
        percentage: normalizePercentage(summary.percentage),
        is_eligible: Boolean(summary.is_eligible),
        status: eligibilityStatus(summary.percentage, summary.classes_held)
      }))
    });
  })
);

export default router;
