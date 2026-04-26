import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import attendanceRoutes from './routes/attendance.js';
import authRoutes from './routes/auth.js';
import reportsRoutes from './routes/reports.js';
import studentsRoutes from './routes/students.js';
import subjectsRoutes from './routes/subjects.js';
import teachersRoutes from './routes/teachers.js';
import { ensureDatabaseCompatibility, pingDatabase } from './db.js';

dotenv.config({ quiet: true });

const app = express();
const port = Number(process.env.PORT || 5000);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://127.0.0.1:5173';

app.use(
  cors({
    origin: clientOrigin,
    credentials: true
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sams-api' });
});

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/teachers', teachersRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.statusCode || 500).json({
    message: error.message || 'Something went wrong.'
  });
});

app.listen(port, async () => {
  try {
    await ensureDatabaseCompatibility();
    await pingDatabase();
    console.log(`SAMS API running on http://127.0.0.1:${port}`);
  } catch (error) {
    console.error('SAMS API started, but MySQL connection failed.');
    console.error(error.message);
  }
});
