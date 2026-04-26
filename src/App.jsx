import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth } from './context/AuthContext.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AuthPage from './pages/AuthPage.jsx';
import StudentDashboard from './pages/StudentDashboard.jsx';
import TeacherDashboard from './pages/TeacherDashboard.jsx';

function RootRedirect() {
  const { user } = useAuth();

  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  if (user?.role === 'teacher') return <Navigate to="/teacher" replace />;
  if (user?.role === 'student') return <Navigate to="/student" replace />;
  return <Navigate to="/login/student" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login/student" element={<AuthPage mode="login" role="student" />} />
      <Route path="/signup/student" element={<AuthPage mode="signup" role="student" />} />
      <Route path="/login/teacher" element={<AuthPage mode="login" role="teacher" />} />
      <Route path="/signup/teacher" element={<AuthPage mode="signup" role="teacher" />} />
      <Route path="/login/admin" element={<AuthPage mode="login" role="admin" />} />
      <Route path="/admin/signup" element={<AuthPage mode="signup" role="admin" />} />
      <Route
        path="/student"
        element={
          <ProtectedRoute role="student">
            <StudentDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher"
        element={
          <ProtectedRoute role="teacher">
            <TeacherDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
