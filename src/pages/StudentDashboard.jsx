import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import Badge from '../components/Badge.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import { downloadCsv, eligibilityText, monthLabel } from '../utils/reports.js';

const navItems = [
  { id: 'overview', label: 'Overview' },
  { id: 'records', label: 'Records' },
  { id: 'monthly', label: 'Monthly' }
];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function statusFromPercentage(percentage, classesHeld = 0) {
  if (!classesHeld) return 'no_data';
  if (Number(percentage) < 75) return 'not_eligible';
  if (Number(percentage) <= 80) return 'warning';
  return 'eligible';
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function safeFilename(value) {
  return String(value || 'student').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
}

export default function StudentDashboard() {
  const { token, user } = useAuth();
  const [active, setActive] = useState('overview');
  const [records, setRecords] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;

    async function loadAttendance() {
      setLoading(true);
      setError('');

      try {
        const [recordsData, summaryData] = await Promise.all([
          apiRequest('/attendance/my', { token }),
          apiRequest(`/attendance/monthly/${user.id}`, { token })
        ]);

        if (!ignore) {
          setRecords(recordsData.records || []);
          setSummaries(summaryData.summaries || []);
        }
      } catch (requestError) {
        if (!ignore) setError(requestError.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadAttendance();

    return () => {
      ignore = true;
    };
  }, [token, user.id]);

  const chartData = useMemo(() => {
    const grouped = new Map();

    summaries.forEach((summary) => {
      const key = summary.subject_id;
      const current = grouped.get(key) || {
        subject: summary.subject_code,
        name: summary.subject_name,
        held: 0,
        attended: 0
      };

      current.held += Number(summary.classes_held || 0);
      current.attended += Number(summary.classes_attended || 0);
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).map((item) => ({
      ...item,
      percentage: item.held ? Number(((item.attended / item.held) * 100).toFixed(2)) : 0
    }));
  }, [summaries]);

  const totals = useMemo(() => {
    const held = summaries.reduce((sum, item) => sum + Number(item.classes_held || 0), 0);
    const attended = summaries.reduce((sum, item) => sum + Number(item.classes_attended || 0), 0);
    const percentage = held ? Number(((attended / held) * 100).toFixed(2)) : 0;

    return { held, attended, percentage, status: statusFromPercentage(percentage, held) };
  }, [summaries]);

  function handleExportReport() {
    const summaryRows = summaries.map((summary) => {
      const status = statusFromPercentage(summary.percentage, summary.classes_held);

      return [
        `${monthLabel(summary.month)} ${summary.year}`,
        summary.subject_name,
        summary.subject_code,
        Math.min(summary.classes_held, 30),
        summary.classes_attended,
        `${summary.percentage}%`,
        eligibilityText(status)
      ];
    });
    const recordRows = records.map((record) => [
      record.date,
      record.subject_name,
      record.subject_code,
      record.status
    ]);

    downloadCsv(`attendance_report_${safeFilename(user?.roll_number || user?.name)}.csv`, [
      {
        title: 'Attendance Summary',
        headers: ['Month', 'Subject', 'Code', 'Classes Held', 'Classes Attended', 'Percentage', 'Eligibility'],
        rows: summaryRows
      },
      {
        title: 'Attendance Records',
        headers: ['Date', 'Subject', 'Code', 'Status'],
        rows: recordRows
      }
    ]);
  }

  return (
    <div className="dashboard-shell">
      <Sidebar title="Student" items={navItems} active={active} onChange={setActive} />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">{user?.roll_number || user?.department || 'Student'}</p>
            <h1>Attendance Dashboard</h1>
          </div>
          <div className="header-actions">
            <button className="secondary-button" type="button" onClick={handleExportReport}>
              Export Report
            </button>
            <Badge status={totals.status}>{totals.status === 'warning' ? 'Warning' : undefined}</Badge>
          </div>
        </header>

        {error && <div className="form-message error">{error}</div>}

        {isLoading ? (
          <section className="panel">
            <p className="empty-state">Loading attendance...</p>
          </section>
        ) : (
          <>
            {active === 'overview' && (
              <section className="dashboard-grid">
                <div className="panel span-2">
                  <div className="panel-heading">
                    <h2>Subject Percentage</h2>
                    <span>{totals.percentage}% overall</span>
                  </div>

                  {chartData.length ? (
                    <div className="chart-frame">
                      <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData}>
                          <CartesianGrid stroke="#2b2f45" vertical={false} />
                          <XAxis dataKey="subject" stroke="#aab0c5" />
                          <YAxis stroke="#aab0c5" domain={[0, 100]} />
                          <Tooltip
                            cursor={{ fill: 'rgba(108, 99, 255, 0.12)' }}
                            contentStyle={{
                              background: '#1a1d2e',
                              border: '1px solid #343955',
                              color: '#f4f6ff'
                            }}
                          />
                          <Bar dataKey="percentage" fill="#6c63ff" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="empty-state">No attendance marked yet.</p>
                  )}
                </div>

                <div className="panel metric-panel">
                  <h2>Classes</h2>
                  <strong>
                    {totals.attended}/{totals.held}
                  </strong>
                  <p>attended</p>
                </div>
              </section>
            )}

            {active === 'records' && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Attendance Records</h2>
                  <span>{records.length} entries</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id}>
                          <td>{formatDate(record.date)}</td>
                          <td>{record.subject_name}</td>
                          <td>{record.subject_code}</td>
                          <td>
                            <span className={`status-dot ${record.status}`}>{record.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!records.length && <p className="empty-state">No attendance records found.</p>}
                </div>
              </section>
            )}

            {active === 'monthly' && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Monthly Breakdown</h2>
                  <span>30-class monthly cap</span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Subject</th>
                        <th>Held</th>
                        <th>Attended</th>
                        <th>Percentage</th>
                        <th>Eligibility</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map((summary) => {
                        const status = statusFromPercentage(summary.percentage, summary.classes_held);

                        return (
                          <tr key={summary.id}>
                            <td>
                              {months[summary.month - 1]} {summary.year}
                            </td>
                            <td>{summary.subject_name}</td>
                            <td>{Math.min(summary.classes_held, 30)}</td>
                            <td>{summary.classes_attended}</td>
                            <td>{summary.percentage}%</td>
                            <td>
                              <Badge status={status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!summaries.length && <p className="empty-state">No monthly summary available.</p>}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
