import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken, requireAnyRole, requireRole } from '../middleware/auth.js';
import { eligibilityStatus, normalizePercentage } from '../utils.js';

const router = Router();

router.get(
  '/all',
  authenticateToken,
  requireAnyRole(['admin', 'teacher']),
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.roll_number,
         u.department,
         DATE_FORMAT(u.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
         s.id AS subject_id,
         s.name AS subject_name,
         s.code AS subject_code,
         COALESCE(SUM(ms.classes_held), 0) AS classes_held,
         COALESCE(SUM(ms.classes_attended), 0) AS classes_attended
       FROM users u
       LEFT JOIN subjects s
         ON s.department = u.department OR s.department = 'General'
       LEFT JOIN monthly_summary ms
         ON ms.student_id = u.id AND ms.subject_id = s.id
       WHERE u.role = 'student'
       GROUP BY
         u.id,
         u.name,
         u.email,
         u.roll_number,
         u.department,
         u.created_at,
         s.id,
         s.name,
         s.code
       ORDER BY u.name ASC, s.name ASC`
    );

    const students = new Map();

    rows.forEach((row) => {
      if (!students.has(row.id)) {
        students.set(row.id, {
          id: row.id,
          name: row.name,
          email: row.email,
          roll_number: row.roll_number,
          department: row.department,
          created_at: row.created_at,
          subjects: []
        });
      }

      if (row.subject_id) {
        const classesHeld = Number(row.classes_held || 0);
        const classesAttended = Number(row.classes_attended || 0);
        const percentage = classesHeld ? normalizePercentage((classesAttended / classesHeld) * 100) : 0;

        students.get(row.id).subjects.push({
          subject_id: row.subject_id,
          subject_name: row.subject_name,
          subject_code: row.subject_code,
          classes_held: classesHeld,
          classes_attended: classesAttended,
          percentage,
          status: eligibilityStatus(percentage, classesHeld)
        });
      }
    });

    return res.json({ students: Array.from(students.values()) });
  })
);

router.delete(
  '/:studentId',
  authenticateToken,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const studentId = Number(req.params.studentId);

    if (!studentId) {
      return res.status(400).json({ message: 'Valid student id is required.' });
    }

    const [result] = await pool.execute(
      `DELETE FROM users
       WHERE id = ? AND role = 'student'`,
      [studentId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Student was not found.' });
    }

    return res.json({ message: 'Student deleted.' });
  })
);

export default router;
