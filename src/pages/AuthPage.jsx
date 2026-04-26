import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, ShieldCheck, UserRoundCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  roll_number: '',
  department: ''
};

function validateForm(form, mode, role) {
  const errors = {};

  if (mode === 'signup' && !form.name.trim()) errors.name = 'Name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email.';
  if (form.password.length < 6) errors.password = 'Password must be at least 6 characters.';

  if (mode === 'signup' && role === 'student') {
    if (!form.roll_number.trim()) errors.roll_number = 'Roll number is required.';
    if (!form.department.trim()) errors.department = 'Department is required.';
  }

  if (mode === 'signup' && role === 'teacher' && !form.department.trim()) {
    errors.department = 'Department is required.';
  }

  return errors;
}

export default function AuthPage({ mode, role }) {
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const isSignup = mode === 'signup';
  const isStudent = role === 'student';
  const isTeacher = role === 'teacher';

  const pageCopy = useMemo(() => {
    if (isSignup && isStudent) return { title: 'Student Signup', icon: GraduationCap };
    if (isSignup && isTeacher) return { title: 'Teacher Signup', icon: UserRoundCheck };
    if (isSignup) return { title: 'Admin Signup', icon: ShieldCheck };
    if (isStudent) return { title: 'Student Login', icon: GraduationCap };
    if (isTeacher) return { title: 'Teacher Login', icon: UserRoundCheck };
    return { title: 'Admin Login', icon: ShieldCheck };
  }, [isSignup, isStudent, isTeacher]);

  const Icon = pageCopy.icon;

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validateForm(form, mode, role);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length) return;

    setSubmitting(true);
    setMessage('');

    try {
      if (isSignup) {
        await signup({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role,
          roll_number: isStudent ? form.roll_number.trim() : undefined,
          department: form.department.trim()
        });
        navigate(role === 'admin' ? '/login/admin' : role === 'teacher' ? '/login/teacher' : '/login/student', {
          replace: true,
          state: { created: true }
        });
        return;
      }

      await login({
        email: form.email.trim(),
        password: form.password,
        role
      });
      navigate(role === 'admin' ? '/admin' : role === 'teacher' ? '/teacher' : '/student', { replace: true });
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-tabs auth-tabs-three" aria-label="Login type">
          <Link className={role === 'student' && !isSignup ? 'active' : ''} to="/login/student">
            Student Login
          </Link>
          <Link className={role === 'teacher' && !isSignup ? 'active' : ''} to="/login/teacher">
            Teacher Login
          </Link>
          <Link className={role === 'admin' && !isSignup ? 'active' : ''} to="/login/admin">
            Admin Login
          </Link>
        </div>

        <div className="auth-heading">
          <span className="auth-icon">
            <Icon size={24} aria-hidden="true" />
          </span>
          <div>
            <h1>{pageCopy.title}</h1>
            <p>SAMS</p>
          </div>
        </div>

        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <label>
              Name
              <input
                autoComplete="name"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>
          )}

          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={form.email}
              onChange={(event) => updateField('email', event.target.value)}
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>

          <label>
            Password
            <input
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </label>

          {isSignup && isStudent && (
            <label>
              Roll Number
              <input value={form.roll_number} onChange={(event) => updateField('roll_number', event.target.value)} />
              {errors.roll_number && <span className="field-error">{errors.roll_number}</span>}
            </label>
          )}

          {isSignup && (isStudent || isTeacher) && (
            <label>
              Department
              <input value={form.department} onChange={(event) => updateField('department', event.target.value)} />
              {errors.department && <span className="field-error">{errors.department}</span>}
            </label>
          )}

          {message && <div className="form-message error">{message}</div>}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Please wait...' : isSignup ? 'Create Account' : 'Login'}
          </button>
        </form>

        <div className="auth-switch">
          {isSignup ? (
            <Link to={role === 'admin' ? '/login/admin' : role === 'teacher' ? '/login/teacher' : '/login/student'}>
              Back to login
            </Link>
          ) : (
            <Link to={role === 'admin' ? '/admin/signup' : role === 'teacher' ? '/signup/teacher' : '/signup/student'}>
              {role === 'admin'
                ? 'Create admin account'
                : role === 'teacher'
                  ? 'Create teacher account'
                  : 'Create student account'}
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
