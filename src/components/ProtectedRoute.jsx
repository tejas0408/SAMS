import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function dashboardPath(role) {
  if (role === 'admin') return '/admin';
  if (role === 'teacher') return '/teacher';
  return '/student';
}

function loginPath(role) {
  if (role === 'admin') return '/login/admin';
  if (role === 'teacher') return '/login/teacher';
  return '/login/student';
}

export default function ProtectedRoute({ role, children }) {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={loginPath(role)} replace />;
  }

  if (user.role !== role) {
    return <Navigate to={dashboardPath(user.role)} replace />;
  }

  return children;
}
