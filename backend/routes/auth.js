import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Router } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { allowedRoles, isValidEmail } from '../utils.js';

const router = Router();
const jwtSecret = process.env.JWT_SECRET || 'dev_only_change_this_secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1d';

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      role: user.role
    },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );
}

router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    const { name, email, password, role, roll_number, department } = req.body;
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanRole = String(role || '').trim();
    const cleanDepartment = String(department || '').trim();
    const cleanRollNumber = String(roll_number || '').trim();

    if (!cleanName || !isValidEmail(cleanEmail) || !password || !allowedRoles.has(cleanRole)) {
      return res.status(400).json({ message: 'Name, valid email, password, and role are required.' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    if (cleanRole === 'student' && (!cleanRollNumber || !cleanDepartment)) {
      return res.status(400).json({ message: 'Students must provide roll number and department.' });
    }

    if (cleanRole === 'teacher' && !cleanDepartment) {
      return res.status(400).json({ message: 'Teachers must provide department.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      const [result] = await pool.execute(
        `INSERT INTO users (name, email, password_hash, role, roll_number, department)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          cleanName,
          cleanEmail,
          passwordHash,
          cleanRole,
          cleanRole === 'student' ? cleanRollNumber : null,
          cleanDepartment || null
        ]
      );

      return res.status(201).json({
        message: 'Account created successfully.',
        user: {
          id: result.insertId,
          name: cleanName,
          email: cleanEmail,
          role: cleanRole,
          roll_number: cleanRole === 'student' ? cleanRollNumber : null,
          department: cleanDepartment || null
        }
      });
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'An account with this email already exists.' });
      }

      throw error;
    }
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password, role } = req.body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanRole = String(role || '').trim();

    if (!isValidEmail(cleanEmail) || !password || !allowedRoles.has(cleanRole)) {
      return res.status(400).json({ message: 'Valid email, password, and role are required.' });
    }

    const [rows] = await pool.execute(
      `SELECT id, name, email, password_hash, role, roll_number, department
       FROM users
       WHERE email = ? AND role = ?
       LIMIT 1`,
      [cleanEmail, cleanRole]
    );

    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials for this role.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid credentials for this role.' });
    }

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roll_number: user.roll_number,
      department: user.department
    };

    return res.json({
      token: signToken(user),
      user: safeUser
    });
  })
);

export default router;
