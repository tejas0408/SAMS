import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { normalizePercentage, semesterLabel } from '../utils.js';

const router = Router();

router.get(
  '/low',
  authenticateToken,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `SELECT
         x.student_id,
         x.student_name,
         x.email,
         x.roll_number,
         x.department,
         x.subject_id,
         x.subject_name,
         x.subject_code,
         x.year,
         x.semester,
         LEAST(x.raw_classes_held, 30) AS classes_held,
         LEAST(x.raw_classes_attended, LEAST(x.raw_classes_held, 30)) AS classes_attended,
         ROUND((LEAST(x.raw_classes_attended, LEAST(x.raw_classes_held, 30)) / LEAST(x.raw_classes_held, 30)) * 100, 2) AS percentage
       FROM (
         SELECT
           u.id AS student_id,
           u.name AS student_name,
           u.email,
           u.roll_number,
           u.department,
           s.id AS subject_id,
           s.name AS subject_name,
           s.code AS subject_code,
           YEAR(ar.date) AS year,
           CASE WHEN MONTH(ar.date) BETWEEN 1 AND 6 THEN 1 ELSE 2 END AS semester,
           COUNT(*) AS raw_classes_held,
           COALESCE(SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END), 0) AS raw_classes_attended
         FROM attendance_records ar
         JOIN users u ON u.id = ar.student_id
         JOIN subjects s ON s.id = ar.subject_id
         WHERE u.role = 'student'
         GROUP BY
           u.id,
           u.name,
           u.email,
           u.roll_number,
           u.department,
           s.id,
           s.name,
           s.code,
           YEAR(ar.date),
           CASE WHEN MONTH(ar.date) BETWEEN 1 AND 6 THEN 1 ELSE 2 END
       ) x
       WHERE LEAST(x.raw_classes_held, 30) > 0
         AND ROUND((LEAST(x.raw_classes_attended, LEAST(x.raw_classes_held, 30)) / LEAST(x.raw_classes_held, 30)) * 100, 2) < 75
       ORDER BY percentage ASC, x.student_name ASC`
    );

    return res.json({
      reports: rows.map((row) => {
        return {
          ...row,
          semester_label: semesterLabel(row.semester, row.year),
          classes_held: Number(row.classes_held),
          classes_attended: Number(row.classes_attended),
          percentage: normalizePercentage(row.percentage)
        };
      })
    });
  })
);

export default router;
