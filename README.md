# Student Attendance Management System

A full-stack SAMS app built with React + Vite, Express, MySQL, JWT auth, bcrypt password hashing, and Recharts.

## Setup

1. Copy `.env.example` to `.env` and update the MySQL credentials.
2. Install dependencies:

```bash
npm install
```

3. Create the database and tables:

```bash
npm run db:init
```

4. Run the app:

```bash
npm run dev
```

Frontend: `http://127.0.0.1:5173`

Backend: `http://127.0.0.1:5000`

## Routes

- Student login: `/login/student`
- Student signup: `/signup/student`
- Teacher login: `/login/teacher`
- Teacher signup: `/signup/teacher`
- Admin login: `/login/admin`
- Admin signup: `/admin/signup`
- Student dashboard: `/student`
- Teacher dashboard: `/teacher`
- Admin dashboard: `/admin`

Reports can be exported from the student dashboard. Admin and teacher dashboards can generate month/year attendance reports and export them as CSV files.

## Attendance Rules

Monthly classes are capped at 30. If more than 30 records exist for a month, `monthly_summary.classes_held` remains 30 and `classes_attended` is capped at 30 as well. Eligibility is calculated as:

```text
(classes_attended / MIN(classes_held, 30)) * 100 >= 75
```
