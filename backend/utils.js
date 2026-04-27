export const allowedRoles = new Set(['student', 'teacher', 'admin']);
export const allowedStatuses = new Set(['present', 'absent']);

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isValidISODate(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''));
}

export function monthYearFromISODate(date) {
  const [year, month] = String(date).split('-').map(Number);
  return { month, year };
}

export function semesterFromMonth(month) {
  return Number(month) <= 6 ? 1 : 2;
}

export function semesterLabel(semester, year) {
  return `Semester ${semester} ${year}`;
}

export function normalizePercentage(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function eligibilityStatus(percentage, classesHeld = 0) {
  const value = Number(percentage || 0);

  if (!classesHeld) return 'no_data';
  if (value < 75) return 'not_eligible';
  if (value <= 80) return 'warning';
  return 'eligible';
}
