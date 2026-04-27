CREATE DATABASE IF NOT EXISTS sams_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sams_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student', 'teacher', 'admin') NOT NULL,
  roll_number VARCHAR(60),
  department VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_department (department)
);

ALTER TABLE users
  MODIFY role ENUM('student', 'teacher', 'admin') NOT NULL;

CREATE TABLE IF NOT EXISTS subjects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  department VARCHAR(120) NOT NULL,
  INDEX idx_subjects_department (department)
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'absent') NOT NULL,
  UNIQUE KEY uq_attendance_student_subject_date (student_id, subject_id, date),
  INDEX idx_attendance_student_date (student_id, date),
  INDEX idx_attendance_subject_date (subject_id, date),
  CONSTRAINT fk_attendance_student
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_attendance_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monthly_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  subject_id INT NOT NULL,
  month TINYINT NOT NULL,
  year SMALLINT NOT NULL,
  classes_held SMALLINT NOT NULL DEFAULT 0,
  classes_attended SMALLINT NOT NULL DEFAULT 0,
  percentage DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE
      WHEN classes_held = 0 THEN 0
      ELSE ROUND((classes_attended / classes_held) * 100, 2)
    END
  ) STORED,
  is_eligible BOOLEAN GENERATED ALWAYS AS (
    CASE
      WHEN classes_held = 0 THEN FALSE
      ELSE ((classes_attended / classes_held) * 100 >= 75)
    END
  ) STORED,
  UNIQUE KEY uq_monthly_summary_student_subject_month (student_id, subject_id, month, year),
  CHECK (month BETWEEN 1 AND 12),
  CHECK (classes_held >= 0),
  CHECK (classes_attended >= 0),
  CHECK (classes_attended <= classes_held),
  INDEX idx_monthly_student (student_id, year, month),
  INDEX idx_monthly_subject (subject_id, year, month),
  CONSTRAINT fk_summary_student
    FOREIGN KEY (student_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_summary_subject
    FOREIGN KEY (subject_id) REFERENCES subjects(id)
    ON DELETE CASCADE
);

INSERT INTO subjects (name, code, department) VALUES
  ('Database Management Systems', 'CS301', 'Computer Science'),
  ('Operating Systems', 'CS302', 'Computer Science'),
  ('Computer Networks', 'CS303', 'Computer Science'),
  ('Data Structures', 'CS201', 'Computer Science'),
  ('Engineering Mathematics', 'MA201', 'General'),
  ('Professional Communication', 'HU101', 'General')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  department = VALUES(department);
