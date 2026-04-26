import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = Router();

router.get(
  '/all',
  authenticateToken,
  requireRole('admin'),
  asyncHandler(async (_req, res) => {
    const [teachers] = await pool.execute(
      `SELECT
         id,
         name,
         email,
         department,
         DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at
       FROM users
       WHERE role = 'teacher'
       ORDER BY name ASC`
    );

    return res.json({ teachers });
  })
);

router.delete(
  '/:teacherId',
  authenticateToken,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const teacherId = Number(req.params.teacherId);

    if (!teacherId) {
      return res.status(400).json({ message: 'Valid teacher id is required.' });
    }

    const [result] = await pool.execute(
      `DELETE FROM users
       WHERE id = ? AND role = 'teacher'`,
      [teacherId]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Teacher was not found.' });
    }

    return res.json({ message: 'Teacher deleted.' });
  })
);

export default router;
