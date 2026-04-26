import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { normalizePercentage } from '../utils.js';

const router = Router();

router.get(
  '/low',
  authenticateToken,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const [rows] = await pool.execute(
      `SELECT
         u.id AS student_id,
         u.name AS student_name,
         u.email,
         u.roll_number,
         u.department,
         s.id AS subject_id,
         s.name AS subject_name,
         s.code AS subject_code,
         SUM(ms.classes_held) AS classes_held,
         SUM(ms.classes_attended) AS classes_attended,
         ROUND((SUM(ms.classes_attended) / SUM(ms.classes_held)) * 100, 2) AS percentage
       FROM monthly_summary ms
       JOIN users u ON u.id = ms.student_id
       JOIN subjects s ON s.id = ms.subject_id
       WHERE u.role = 'student'
       GROUP BY
         u.id,
         u.name,
         u.email,
         u.roll_number,
         u.department,
         s.id,
         s.name,
         s.code
       HAVING classes_held > 0
          AND percentage < 75
       ORDER BY percentage ASC, u.name ASC`
    );

    return res.json({
      reports: rows.map((row) => {
        return {
          ...row,
          classes_held: Number(row.classes_held),
          classes_attended: Number(row.classes_attended),
          percentage: normalizePercentage(row.percentage)
        };
      })
    });
  })
);

export default router;
