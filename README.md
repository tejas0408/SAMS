# Student Attendance Management System (SAMS)

SAMS is a full-stack attendance management web application for students, teachers, and administrators. It uses a React + Vite frontend, an Express backend, and a MySQL database through `mysql2`.

The app supports role-based authentication, attendance marking, monthly eligibility calculation, dashboards, low-attendance reports, account management, charts, and CSV report exports.

## Tech Stack

- Frontend: React, Vite, React Router, Recharts, Lucide icons
- Backend: Node.js, Express
- Database: MySQL with `mysql2`
- Authentication: JWT with `jsonwebtoken`
- Password hashing: `bcryptjs`
- Styling: CSS variables with a dark responsive UI

## Project Structure

```text
.
├── backend/
│   ├── middleware/
│   │   ├── asyncHandler.js
│   │   └── auth.js
│   ├── routes/
│   │   ├── attendance.js
│   │   ├── auth.js
│   │   ├── reports.js
│   │   ├── students.js
│   │   ├── subjects.js
│   │   └── teachers.js
│   ├── scripts/
│   │   └── initDb.js
│   ├── db.js
│   ├── server.js
│   └── utils.js
├── database/
│   └── schema.sql
├── scripts/
│   └── serveFrontend.js
├── src/
│   ├── components/
│   ├── context/
│   ├── pages/
│   ├── services/
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
├── .env.example
├── package.json
└── vite.config.js
```

## Features

### Student

- Student signup and login.
- Protected student dashboard.
- Attendance percentage per subject using a Recharts bar chart.
- Full attendance record table.
- Monthly attendance breakdown.
- Eligibility badges:
  - Green: eligible
  - Red: not eligible
  - Amber: warning between 75% and 80%
- Export attendance report as CSV from the dashboard.

### Teacher

- Teacher signup and login.
- Protected teacher dashboard.
- Select a student and update attendance by subject, date, and status.
- Remove a mistaken attendance entry by student, subject, and date.
- View monthly summary for a selected student.
- Generate month/year attendance reports.
- Export generated monthly reports as CSV.

### Admin

- Admin signup and login.
- Protected admin dashboard.
- Mark attendance for any student.
- Remove a mistaken attendance entry by student, subject, and date.
- View all students with cumulative subject percentages.
- Add and delete students.
- Add and delete teachers.
- View monthly reports by student.
- Generate month/year attendance reports for all students or one student.
- Export generated monthly reports as CSV.
- View students below 75% attendance highlighted in red.

## Database

The database name is:

```sql
sams_db
```

Main tables:

- `users`
  - Stores students, teachers, and admins.
  - Roles are `student`, `teacher`, and `admin`.
- `subjects`
  - Stores subject name, code, and department.
- `attendance_records`
  - Stores daily attendance.
  - Has a unique constraint on student, subject, and date.
- `monthly_summary`
  - Stores monthly calculated attendance for quick reference.
  - Visible reports calculate eligibility from `attendance_records` so the 30-class cap applies to the whole semester, not each month.

Attendance eligibility formula:

```text
(semester_classes_attended / MIN(semester_classes_held, 30)) * 100 >= 75
```

Semester split:

```text
Semester 1: January to June
Semester 2: July to December
```

The backend calculates semester percentage and eligibility in API queries, so month reports show monthly activity while eligibility is based on semester totals.

## Setup

### 1. Install Dependencies

```powershell
npm install
```

If npm has permission issues with the global cache, use a local cache:

```powershell
npm install --cache .\.npm-cache --ignore-scripts
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```powershell
copy .env.example .env
```

Update `.env` with your MySQL credentials:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=sams_db
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=1d
CLIENT_ORIGIN=http://127.0.0.1:5173
```

### 3. Create the Database and Tables

Run:

```powershell
npm run db:init
```

You can also run the SQL manually in MySQL Workbench:

```sql
SOURCE path/to/database/schema.sql;
```

Or open `database/schema.sql`, paste it into a MySQL Workbench query tab, and run it.

### 4. Start the Backend

```powershell
npm run server
```

Backend URL:

```text
http://127.0.0.1:5000
```

### 5. Start the Frontend

In a second terminal:

```powershell
npm run client
```

Frontend URL:

```text
http://127.0.0.1:5173
```

### 6. Run Both Together

```powershell
npm run dev
```

## Scripts

```text
npm run dev             Start backend and frontend together
npm run client          Start Vite frontend on port 5173
npm run server          Start Express backend on port 5000
npm run server:dev      Start backend with nodemon
npm run build           Build frontend for production
npm run preview         Preview Vite production build
npm run serve:frontend  Serve the built dist folder with a small Node server
npm run db:init         Create sams_db and initialize tables
```

## Frontend Routes

Public routes:

```text
/login/student
/signup/student
/login/teacher
/signup/teacher
/login/admin
/admin/signup
```

Protected routes:

```text
/student
/teacher
/admin
```

The root route `/` redirects based on the logged-in user role.

## Backend API

Base URL:

```text
http://127.0.0.1:5000/api
```

### Auth

```text
POST /api/auth/signup
POST /api/auth/login
```

Signup request body:

```json
{
  "name": "Student Name",
  "email": "student@example.com",
  "password": "password123",
  "role": "student",
  "roll_number": "23110541",
  "department": "Computer Science"
}
```

Teacher signup uses `role: "teacher"` and requires `department`. Admin signup uses `role: "admin"`.

Login request body:

```json
{
  "email": "student@example.com",
  "password": "password123",
  "role": "student"
}
```

Login response includes a JWT token and user object.

### Attendance

```text
POST /api/attendance/mark
DELETE /api/attendance/record
GET  /api/attendance/my
GET  /api/attendance/monthly/:studentId
GET  /api/attendance/monthly-report?month=4&year=2026
GET  /api/attendance/monthly-report?month=4&year=2026&studentId=1
```

`POST /api/attendance/mark` is allowed for admins and teachers.
`DELETE /api/attendance/record` is also allowed for admins and teachers.

Mark attendance request body:

```json
{
  "student_id": 1,
  "subject_id": 2,
  "date": "2026-04-26",
  "status": "present"
}
```

Remove attendance request body:

```json
{
  "student_id": 1,
  "subject_id": 2,
  "date": "2026-04-26"
}
```

When attendance is marked:

- The app inserts or updates the daily record.
- The monthly summary is recalculated.
- Report percentages use semester totals.
- `semester_classes_held` is capped at 30.
- `semester_classes_attended` is capped to the semester held count.

When attendance is removed, the monthly summary is recalculated. If no records remain for that student, subject, and month, the monthly summary row is removed.

### Students

```text
GET    /api/students/all
DELETE /api/students/:studentId
```

`GET /api/students/all` is allowed for admins and teachers. Delete is admin-only.

### Teachers

```text
GET    /api/teachers/all
DELETE /api/teachers/:teacherId
```

Teacher list and delete are admin-only.

### Subjects

```text
GET /api/subjects
```

Returns all subjects.

### Reports

```text
GET /api/reports/low
```

Returns students with any subject below 75% attendance. Admin-only.

## Authentication and Authorization

The backend expects JWT auth in this header:

```text
Authorization: Bearer <token>
```

JWT payload contains:

```json
{
  "id": 1,
  "name": "User Name",
  "role": "student"
}
```

Role rules:

- Students can view only their own attendance.
- Teachers can list students, mark attendance, view monthly student summaries, and generate monthly reports.
- Admins can do everything teachers can do, plus manage student and teacher accounts and view low-attendance reports.

## Report Export

Student dashboard:

- Exports the student's attendance summary and attendance records as a CSV file.

Admin dashboard:

- Generates a month/year report for all students or one selected student.
- Exports the generated monthly report as CSV.

Teacher dashboard:

- Generates a month/year report for all students or one selected student.
- Exports the generated monthly report as CSV.

## Styling

The UI uses a dark theme with CSS variables:

```css
--bg: #0f1117;
--surface: #1a1d2e;
--accent: #6c63ff;
```

Other UI details:

- Inter font
- Responsive dashboard layout
- Sidebar navigation on dashboards
- Card-based dark panels
- No plain white backgrounds
- Role-specific login and signup pages

## Default Subjects

The schema inserts these default subjects:

```text
CS301 - Database Management Systems
CS302 - Operating Systems
CS303 - Computer Networks
CS201 - Data Structures
MA201 - Engineering Mathematics
HU101 - Professional Communication
```

You can add more subjects directly in MySQL Workbench:

```sql
USE sams_db;

INSERT INTO subjects (name, code, department)
VALUES ('Artificial Intelligence', 'CS401', 'Computer Science');
```

## MySQL Workbench Notes

If your database was created before teacher support was added, the backend attempts this update on startup:

```sql
ALTER TABLE users
MODIFY role ENUM('student', 'teacher', 'admin') NOT NULL;
```

If your MySQL user does not have permission to run `ALTER TABLE`, run it once manually in MySQL Workbench:

```sql
USE sams_db;

ALTER TABLE users
MODIFY role ENUM('student', 'teacher', 'admin') NOT NULL;
```

Teachers do not need a separate table. They are stored in `users` with:

```text
role = teacher
```

## Troubleshooting

### MySQL Access Denied

If the backend shows:

```text
Access denied for user 'root'@'localhost'
```

Update `.env` with the correct MySQL username and password, then restart the backend.

### Unknown Column `ms.percentage`

If you previously saw:

```text
Unknown column 'ms.percentage' in 'field list'
```

The API now calculates percentage directly from `classes_held` and `classes_attended`, so restart the backend and refresh the page.

### MySQL `ONLY_FULL_GROUP_BY`

If you previously saw an `ORDER BY` and `GROUP BY` error, the low-attendance report query has been updated to use aggregated percentage values. Restart the backend after pulling the latest code.

### PowerShell Blocks `npm`

If PowerShell blocks `npm` because scripts are disabled, use:

```powershell
npm.cmd run client
npm.cmd run server
```

### Vite Node Warning

You may see a warning similar to:

```text
Vite requires Node.js version 20.19+ or 22.12+
```

The build may still complete, but the recommended fix is to install a supported Node.js version.

### Large Chunk Warning

Vite may warn about chunks larger than 500 kB. This is not a functional error. It is caused mainly by frontend dependencies such as Recharts.

## Development Checklist

After making changes:

```powershell
npm run build
```

Check backend syntax:

```powershell
Get-ChildItem -Path backend -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Restart servers:

```powershell
npm run server
npm run client
```

## Important Files

- Backend entry point: `backend/server.js`
- Database connection: `backend/db.js`
- Database schema: `database/schema.sql`
- Auth routes: `backend/routes/auth.js`
- Attendance routes: `backend/routes/attendance.js`
- Student dashboard: `src/pages/StudentDashboard.jsx`
- Teacher dashboard: `src/pages/TeacherDashboard.jsx`
- Admin dashboard: `src/pages/AdminDashboard.jsx`
- Auth context: `src/context/AuthContext.jsx`
- API helper: `src/services/api.js`
- CSV report helper: `src/utils/reports.js`
- Main stylesheet: `src/styles.css`
