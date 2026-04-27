import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken, requireAnyRole, requireRole } from '../middleware/auth.js';
import { eligibilityStatus, normalizePercentage, semesterLabel } from '../utils.js';

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
         st.year,
         st.semester,
         COALESCE(LEAST(st.raw_classes_held, 30), 0) AS classes_held,
         COALESCE(LEAST(st.raw_classes_attended, LEAST(st.raw_classes_held, 30)), 0) AS classes_attended
       FROM users u
       LEFT JOIN subjects s
         ON s.department = u.department OR s.department = 'General'
       LEFT JOIN (
         SELECT
           student_id,
           subject_id,
           YEAR(date) AS year,
           CASE WHEN MONTH(date) BETWEEN 1 AND 6 THEN 1 ELSE 2 END AS semester,
           COUNT(*) AS raw_classes_held,
           COALESCE(SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END), 0) AS raw_classes_attended
         FROM attendance_records
         GROUP BY student_id, subject_id, YEAR(date), CASE WHEN MONTH(date) BETWEEN 1 AND 6 THEN 1 ELSE 2 END
       ) st
         ON st.student_id = u.id AND st.subject_id = s.id
       WHERE u.role = 'student'
       ORDER BY u.name ASC, s.name ASC, st.year DESC, st.semester DESC`
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
          year: row.year,
          semester: row.semester,
          semester_label: row.semester ? semesterLabel(row.semester, row.year) : 'No semester data',
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
