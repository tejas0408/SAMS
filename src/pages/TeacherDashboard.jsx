import { useEffect, useMemo, useState } from 'react';
import Badge from '../components/Badge.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import {
  currentReportPeriod,
  downloadCsv,
  eligibilityText,
  monthLabel,
  monthOptions,
  semesterLabel
} from '../utils/reports.js';

const navItems = [
  { id: 'mark', label: 'Update Attendance' },
  { id: 'monthly', label: 'Monthly Summary' }
];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function todayISO() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function statusFromPercentage(percentage, classesHeld = 0) {
  if (!classesHeld) return 'no_data';
  if (Number(percentage) < 75) return 'not_eligible';
  if (Number(percentage) <= 80) return 'warning';
  return 'eligible';
}

export default function TeacherDashboard() {
  const { token, user } = useAuth();
  const [active, setActive] = useState('mark');
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [monthlyReport, setMonthlyReport] = useState([]);
  const [hasGeneratedReport, setHasGeneratedReport] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [reportFilters, setReportFilters] = useState(() => ({
    ...currentReportPeriod(),
    student_id: ''
  }));
  const [form, setForm] = useState({
    student_id: '',
    subject_id: '',
    date: todayISO(),
    status: 'present'
  });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isRemovingAttendance, setRemovingAttendance] = useState(false);
  const [isGeneratingReport, setGeneratingReport] = useState(false);

  async function loadBaseData() {
    const [studentData, subjectData] = await Promise.all([
      apiRequest('/students/all', { token }),
      apiRequest('/subjects', { token })
    ]);

    setStudents(studentData.students || []);
    setSubjects(subjectData.subjects || []);

    const firstStudentId = String(studentData.students?.[0]?.id || '');
    const firstSubjectId = String(subjectData.subjects?.[0]?.id || '');

    setSelectedStudentId((current) => current || firstStudentId);
    setForm((current) => ({
      ...current,
      student_id: current.student_id || firstStudentId,
      subject_id: current.subject_id || firstSubjectId
    }));
  }

  async function loadMonthly(studentId) {
    if (!studentId) {
      setMonthly([]);
      return;
    }

    const data = await apiRequest(`/attendance/monthly/${studentId}`, { token });
    setMonthly(data.summaries || []);
  }

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      setError('');

      try {
        await loadBaseData();
      } catch (requestError) {
        if (!ignore) setError(requestError.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();

    return () => {
      ignore = true;
    };
  }, [token]);

  useEffect(() => {
    let ignore = false;

    async function refreshMonthly() {
      try {
        if (!ignore) await loadMonthly(selectedStudentId);
      } catch (requestError) {
        if (!ignore) setError(requestError.message);
      }
    }

    refreshMonthly();

    return () => {
      ignore = true;
    };
  }, [selectedStudentId, token]);

  const selectedStudent = useMemo(
    () => students.find((student) => String(student.id) === String(selectedStudentId)),
    [students, selectedStudentId]
  );

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
    setError('');

    if (field === 'student_id') {
      setSelectedStudentId(value);
    }
  }

  function updateReportFilter(field, value) {
    setReportFilters((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = {};

    if (!form.student_id) nextErrors.student_id = 'Select a student.';
    if (!form.subject_id) nextErrors.subject_id = 'Select a subject.';
    if (!form.date) nextErrors.date = 'Select a date.';
    if (!['present', 'absent'].includes(form.status)) nextErrors.status = 'Select a status.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setNotice('');
    setError('');

    try {
      await apiRequest('/attendance/mark', {
        method: 'POST',
        token,
        body: {
          student_id: Number(form.student_id),
          subject_id: Number(form.subject_id),
          date: form.date,
          status: form.status
        }
      });
      await loadMonthly(form.student_id);
      setSelectedStudentId(form.student_id);
      setNotice('Attendance updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveAttendance() {
    const nextErrors = {};

    if (!form.student_id) nextErrors.student_id = 'Select a student.';
    if (!form.subject_id) nextErrors.subject_id = 'Select a subject.';
    if (!form.date) nextErrors.date = 'Select a date.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!window.confirm('Remove this attendance record?')) return;

    setRemovingAttendance(true);
    setNotice('');
    setError('');

    try {
      await apiRequest('/attendance/record', {
        method: 'DELETE',
        token,
        body: {
          student_id: Number(form.student_id),
          subject_id: Number(form.subject_id),
          date: form.date
        }
      });
      await loadMonthly(form.student_id);
      setSelectedStudentId(form.student_id);
      setNotice('Attendance removed.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRemovingAttendance(false);
    }
  }

  async function handleGenerateMonthlyReport(event) {
    event.preventDefault();
    setGeneratingReport(true);
    setHasGeneratedReport(false);
    setNotice('');
    setError('');

    try {
      const params = new URLSearchParams({
        month: String(reportFilters.month),
        year: String(reportFilters.year)
      });

      if (reportFilters.student_id) {
        params.set('studentId', reportFilters.student_id);
      }

      const data = await apiRequest(`/attendance/monthly-report?${params.toString()}`, { token });
      setMonthlyReport(data.reports || []);
      setHasGeneratedReport(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setGeneratingReport(false);
    }
  }

  function handleExportMonthlyReport() {
    const rows = monthlyReport.map((report) => [
      report.student_name,
      report.roll_number || '',
      report.department || '',
      report.subject_name,
      report.subject_code,
      report.semester_label || semesterLabel(report.semester, report.year),
      report.monthly_classes_held,
      report.monthly_classes_attended,
      report.classes_held,
      report.classes_attended,
      `${report.percentage}%`,
      eligibilityText(statusFromPercentage(report.percentage, report.classes_held))
    ]);

    downloadCsv(`teacher_monthly_report_${reportFilters.year}_${String(reportFilters.month).padStart(2, '0')}.csv`, [
      {
        title: `${monthLabel(reportFilters.month)} ${reportFilters.year} Monthly Report`,
        headers: [
          'Student',
          'Roll Number',
          'Department',
          'Subject',
          'Code',
          'Semester',
          'Month Classes Held',
          'Month Classes Attended',
          'Semester Classes Held',
          'Semester Classes Attended',
          'Semester Percentage',
          'Eligibility'
        ],
        rows
      }
    ]);
  }

  return (
    <div className="dashboard-shell">
      <Sidebar title="Teacher" items={navItems} active={active} onChange={setActive} />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">{user?.department || 'Teacher'}</p>
            <h1>Teacher Dashboard</h1>
          </div>
          <Badge status="eligible">Attendance</Badge>
        </header>

        {error && <div className="form-message error">{error}</div>}
        {notice && <div className="form-message success">{notice}</div>}

        {isLoading ? (
          <section className="panel">
            <p className="empty-state">Loading teacher dashboard...</p>
          </section>
        ) : (
          <>
            {active === 'mark' && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Update Student Attendance</h2>
                  <span>{form.date}</span>
                </div>

                <form className="form-grid form-grid-wide" onSubmit={handleSubmit} noValidate>
                  <label>
                    Student
                    <select value={form.student_id} onChange={(event) => updateForm('student_id', event.target.value)}>
                      <option value="">Select student</option>
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} {student.roll_number ? `(${student.roll_number})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.student_id && <span className="field-error">{errors.student_id}</span>}
                  </label>

                  <label>
                    Subject
                    <select value={form.subject_id} onChange={(event) => updateForm('subject_id', event.target.value)}>
                      <option value="">Select subject</option>
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name} ({subject.code})
                        </option>
                      ))}
                    </select>
                    {errors.subject_id && <span className="field-error">{errors.subject_id}</span>}
                  </label>

                  <label>
                    Date
                    <input type="date" value={form.date} onChange={(event) => updateForm('date', event.target.value)} />
                    {errors.date && <span className="field-error">{errors.date}</span>}
                  </label>

                  <label>
                    Status
                    <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                    </select>
                    {errors.status && <span className="field-error">{errors.status}</span>}
                  </label>

                  <button className="primary-button form-action" type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Update Attendance'}
                  </button>

                  <button
                    className="danger-button form-action"
                    type="button"
                    onClick={handleRemoveAttendance}
                    disabled={isSaving || isRemovingAttendance}
                  >
                    {isRemovingAttendance ? 'Removing...' : 'Remove Attendance'}
                  </button>
                </form>
              </section>
            )}

            {active === 'monthly' && (
              <div className="stacked-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Generate Monthly Report</h2>
                    <span>
                      {monthLabel(reportFilters.month)} {reportFilters.year}
                    </span>
                  </div>

                  <form className="report-toolbar" onSubmit={handleGenerateMonthlyReport}>
                    <label>
                      Month
                      <select
                        value={reportFilters.month}
                        onChange={(event) => updateReportFilter('month', Number(event.target.value))}
                      >
                        {monthOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Year
                      <input
                        min="2000"
                        max="2100"
                        type="number"
                        value={reportFilters.year}
                        onChange={(event) => updateReportFilter('year', Number(event.target.value))}
                      />
                    </label>

                    <label>
                      Student
                      <select
                        value={reportFilters.student_id}
                        onChange={(event) => updateReportFilter('student_id', event.target.value)}
                      >
                        <option value="">All students</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name} {student.roll_number ? `(${student.roll_number})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>

                    <button className="primary-button form-action" type="submit" disabled={isGeneratingReport}>
                      {isGeneratingReport ? 'Generating...' : 'Generate'}
                    </button>

                    <button
                      className="secondary-button form-action"
                      type="button"
                      onClick={handleExportMonthlyReport}
                      disabled={!monthlyReport.length}
                    >
                      Export CSV
                    </button>
                  </form>

                  <div className="table-wrap report-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Roll</th>
                          <th>Department</th>
                          <th>Subject</th>
                          <th>Month Held</th>
                          <th>Month Attended</th>
                          <th>Semester</th>
                          <th>Semester Held</th>
                          <th>Semester Attended</th>
                          <th>Semester %</th>
                          <th>Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyReport.map((report) => {
                          const status = statusFromPercentage(report.percentage, report.classes_held);

                          return (
                            <tr key={report.id}>
                              <td>{report.student_name}</td>
                              <td>{report.roll_number || '-'}</td>
                              <td>{report.department || '-'}</td>
                              <td>
                                {report.subject_name} ({report.subject_code})
                              </td>
                              <td>{report.monthly_classes_held}</td>
                              <td>{report.monthly_classes_attended}</td>
                              <td>{report.semester_label || semesterLabel(report.semester, report.year)}</td>
                              <td>{report.classes_held}</td>
                              <td>{report.classes_attended}</td>
                              <td>{report.percentage}%</td>
                              <td>
                                <Badge status={status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {hasGeneratedReport && !monthlyReport.length && (
                      <p className="empty-state">No records found for this month.</p>
                    )}
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h2>Student Monthly Summary</h2>
                    <span>{selectedStudent?.name || 'Select student'}</span>
                  </div>

                  <div className="toolbar-row">
                    <label>
                      Student
                      <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                        <option value="">Select student</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.name} {student.roll_number ? `(${student.roll_number})` : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Subject</th>
                          <th>Month Held</th>
                          <th>Month Attended</th>
                          <th>Semester</th>
                          <th>Semester Held</th>
                          <th>Semester Attended</th>
                          <th>Semester %</th>
                          <th>Eligibility</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthly.map((summary) => {
                          const status = statusFromPercentage(summary.percentage, summary.classes_held);

                          return (
                            <tr key={summary.id}>
                              <td>
                                {months[summary.month - 1]} {summary.year}
                              </td>
                              <td>{summary.subject_name}</td>
                              <td>{summary.monthly_classes_held}</td>
                              <td>{summary.monthly_classes_attended}</td>
                              <td>{summary.semester_label || semesterLabel(summary.semester, summary.year)}</td>
                              <td>{summary.classes_held}</td>
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
                    {!monthly.length && <p className="empty-state">No monthly summary available.</p>}
                  </div>
                </section>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
