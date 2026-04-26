import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  authenticateToken,
  asyncHandler(async (_req, res) => {
    const [subjects] = await pool.execute(
      `SELECT id, name, code, department
       FROM subjects
       ORDER BY department ASC, name ASC`
    );

    return res.json({ subjects });
  })
);

export default router;
