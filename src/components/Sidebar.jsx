import { BarChart3, ClipboardCheck, GraduationCap, LayoutDashboard, LogOut, ShieldAlert, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const icons = {
  overview: LayoutDashboard,
  records: ClipboardCheck,
  monthly: BarChart3,
  mark: ClipboardCheck,
  students: Users,
  teachers: GraduationCap,
  manageStudents: Users,
  manageTeachers: GraduationCap,
  low: ShieldAlert
};

export default function Sidebar({ title, items, active, onChange }) {
  const { logout, user } = useAuth();

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark">S</span>
        <div>
          <strong>{title}</strong>
          <small>{user?.name}</small>
        </div>
      </div>

      <nav className="side-nav" aria-label="Dashboard navigation">
        {items.map((item) => {
          const Icon = icons[item.id] || LayoutDashboard;

          return (
            <button
              className={active === item.id ? 'side-link active' : 'side-link'}
              key={item.id}
              onClick={() => onChange(item.id)}
              type="button"
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <button className="side-link logout" onClick={logout} type="button">
        <LogOut size={18} aria-hidden="true" />
        <span>Logout</span>
      </button>
    </aside>
  );
}
