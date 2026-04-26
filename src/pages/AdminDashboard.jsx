import { useEffect, useMemo, useState } from 'react';
import Badge from '../components/Badge.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { apiRequest } from '../services/api.js';
import { currentReportPeriod, downloadCsv, eligibilityText, monthLabel, monthOptions } from '../utils/reports.js';

const navItems = [
  { id: 'mark', label: 'Mark Attendance' },
  { id: 'students', label: 'Students' },
  { id: 'teachers', label: 'Teachers' },
  { id: 'monthly', label: 'Monthly Reports' },
  { id: 'low', label: 'Below 75%' }
];

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const emptyStudentForm = { name: '', email: '', password: '', roll_number: '', department: '' };
const emptyTeacherForm = { name: '', email: '', password: '', department: '' };

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

function validateAccountForm(form, role) {
  const nextErrors = {};

  if (!form.name.trim()) nextErrors.name = 'Name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = 'Enter a valid email.';
  if (form.password.length < 6) nextErrors.password = 'Password must be at least 6 characters.';
  if (!form.department.trim()) nextErrors.department = 'Department is required.';
  if (role === 'student' && !form.roll_number.trim()) nextErrors.roll_number = 'Roll number is required.';

  return nextErrors;
}

export default function AdminDashboard() {
  const { token } = useAuth();
  const [active, setActive] = useState('mark');
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [lowReports, setLowReports] = useState([]);
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
  const [studentForm, setStudentForm] = useState(emptyStudentForm);
  const [teacherForm, setTeacherForm] = useState(emptyTeacherForm);
  const [errors, setErrors] = useState({});
  const [studentErrors, setStudentErrors] = useState({});
  const [teacherErrors, setTeacherErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isManaging, setManaging] = useState(false);
  const [isGeneratingReport, setGeneratingReport] = useState(false);

  async function loadAdminData() {
    setError('');

    const [studentData, subjectData, lowData, teacherData] = await Promise.all([
      apiRequest('/students/all', { token }),
      apiRequest('/subjects', { token }),
      apiRequest('/reports/low', { token }),
      apiRequest('/teachers/all', { token })
    ]);

    setStudents(studentData.students || []);
    setSubjects(subjectData.subjects || []);
    setLowReports(lowData.reports || []);
    setTeachers(teacherData.teachers || []);

    setSelectedStudentId((current) => current || String(studentData.students?.[0]?.id || ''));
    setForm((current) => ({
      ...current,
      student_id: current.student_id || String(studentData.students?.[0]?.id || ''),
      subject_id: current.subject_id || String(subjectData.subjects?.[0]?.id || '')
    }));
  }

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      try {
        await loadAdminData();
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

    async function loadMonthly() {
      if (!selectedStudentId) {
        setMonthly([]);
        return;
      }

      try {
        const data = await apiRequest(`/attendance/monthly/${selectedStudentId}`, { token });
        if (!ignore) setMonthly(data.summaries || []);
      } catch (requestError) {
        if (!ignore) setError(requestError.message);
      }
    }

    loadMonthly();

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
  }

  function updateStudentForm(field, value) {
    setStudentForm((current) => ({ ...current, [field]: value }));
    setStudentErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
    setError('');
  }

  function updateTeacherForm(field, value) {
    setTeacherForm((current) => ({ ...current, [field]: value }));
    setTeacherErrors((current) => ({ ...current, [field]: undefined }));
    setNotice('');
    setError('');
  }

  function updateReportFilter(field, value) {
    setReportFilters((current) => ({ ...current, [field]: value }));
    setError('');
  }

  async function handleMarkAttendance(event) {
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
      await loadAdminData();

      if (String(selectedStudentId) === String(form.student_id)) {
        const data = await apiRequest(`/attendance/monthly/${form.student_id}`, { token });
        setMonthly(data.summaries || []);
      } else {
        setSelectedStudentId(form.student_id);
      }

      setNotice('Attendance saved.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateStudent(event) {
    event.preventDefault();
    const nextErrors = validateAccountForm(studentForm, 'student');
    setStudentErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setManaging(true);
    setNotice('');
    setError('');

    try {
      await apiRequest('/auth/signup', {
        method: 'POST',
        token,
        body: {
          ...studentForm,
          name: studentForm.name.trim(),
          email: studentForm.email.trim(),
          roll_number: studentForm.roll_number.trim(),
          department: studentForm.department.trim(),
          role: 'student'
        }
      });
      setStudentForm(emptyStudentForm);
      await loadAdminData();
      setNotice('Student added.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setManaging(false);
    }
  }

  async function handleCreateTeacher(event) {
    event.preventDefault();
    const nextErrors = validateAccountForm(teacherForm, 'teacher');
    setTeacherErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setManaging(true);
    setNotice('');
    setError('');

    try {
      await apiRequest('/auth/signup', {
        method: 'POST',
        token,
        body: {
          ...teacherForm,
          name: teacherForm.name.trim(),
          email: teacherForm.email.trim(),
          department: teacherForm.department.trim(),
          role: 'teacher'
        }
      });
      setTeacherForm(emptyTeacherForm);
      await loadAdminData();
      setNotice('Teacher added.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setManaging(false);
    }
  }

  async function handleDeleteStudent(studentId) {
    if (!window.confirm('Delete this student and all related attendance records?')) return;

    setManaging(true);
    setNotice('');
    setError('');

    try {
      await apiRequest(`/students/${studentId}`, {
        method: 'DELETE',
        token
      });

      if (String(selectedStudentId) === String(studentId)) {
        setSelectedStudentId('');
        setMonthly([]);
      }

      await loadAdminData();
      setNotice('Student deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setManaging(false);
    }
  }

  async function handleDeleteTeacher(teacherId) {
    if (!window.confirm('Delete this teacher account?')) return;

    setManaging(true);
    setNotice('');
    setError('');

    try {
      await apiRequest(`/teachers/${teacherId}`, {
        method: 'DELETE',
        token
      });
      await loadAdminData();
      setNotice('Teacher deleted.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setManaging(false);
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
      Math.min(report.classes_held, 30),
      report.classes_attended,
      `${report.percentage}%`,
      eligibilityText(statusFromPercentage(report.percentage, report.classes_held))
    ]);

    downloadCsv(`monthly_report_${reportFilters.year}_${String(reportFilters.month).padStart(2, '0')}.csv`, [
      {
        title: `${monthLabel(reportFilters.month)} ${reportFilters.year} Monthly Report`,
        headers: [
          'Student',
          'Roll Number',
          'Department',
          'Subject',
          'Code',
          'Classes Held',
          'Classes Attended',
          'Percentage',
          'Eligibility'
        ],
        rows
      }
    ]);
  }

  return (
    <div className="dashboard-shell">
      <Sidebar title="Admin" items={navItems} active={active} onChange={setActive} />

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">SAMS Administration</p>
            <h1>Attendance Control</h1>
          </div>
          <Badge status={lowReports.length ? 'not_eligible' : 'eligible'}>
            {lowReports.length ? `${lowReports.length} Below 75%` : 'Clear'}
          </Badge>
        </header>

        {error && <div className="form-message error">{error}</div>}
        {notice && <div className="form-message success">{notice}</div>}

        {isLoading ? (
          <section className="panel">
            <p className="empty-state">Loading admin dashboard...</p>
          </section>
        ) : (
          <>
            {active === 'mark' && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Mark Attendance</h2>
                  <span>{form.date}</span>
                </div>

                <form className="form-grid form-grid-wide" onSubmit={handleMarkAttendance} noValidate>
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
                    {isSaving ? 'Saving...' : 'Save Attendance'}
                  </button>
                </form>
              </section>
            )}

            {active === 'students' && (
              <div className="stacked-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Add Student</h2>
                    <span>New account</span>
                  </div>

                  <form className="form-grid form-grid-wide" onSubmit={handleCreateStudent} noValidate>
                    <label>
                      Name
                      <input value={studentForm.name} onChange={(event) => updateStudentForm('name', event.target.value)} />
                      {studentErrors.name && <span className="field-error">{studentErrors.name}</span>}
                    </label>

                    <label>
                      Email
                      <input
                        type="email"
                        value={studentForm.email}
                        onChange={(event) => updateStudentForm('email', event.target.value)}
                      />
                      {studentErrors.email && <span className="field-error">{studentErrors.email}</span>}
                    </label>

                    <label>
                      Password
                      <input
                        type="password"
                        value={studentForm.password}
                        onChange={(event) => updateStudentForm('password', event.target.value)}
                      />
                      {studentErrors.password && <span className="field-error">{studentErrors.password}</span>}
                    </label>

                    <label>
                      Roll Number
                      <input
                        value={studentForm.roll_number}
                        onChange={(event) => updateStudentForm('roll_number', event.target.value)}
                      />
                      {studentErrors.roll_number && <span className="field-error">{studentErrors.roll_number}</span>}
                    </label>

                    <label>
                      Department
                      <input
                        value={studentForm.department}
                        onChange={(event) => updateStudentForm('department', event.target.value)}
                      />
                      {studentErrors.department && <span className="field-error">{studentErrors.department}</span>}
                    </label>

                    <button className="primary-button form-action" type="submit" disabled={isManaging}>
                      {isManaging ? 'Saving...' : 'Add Student'}
                    </button>
                  </form>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h2>Students</h2>
                    <span>{students.length} total</span>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Roll</th>
                          <th>Department</th>
                          <th>Cumulative Percentage Per Subject</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student) => (
                          <tr key={student.id}>
                            <td>
                              <strong>{student.name}</strong>
                              <small>{student.email}</small>
                            </td>
                            <td>{student.roll_number || '-'}</td>
                            <td>{student.department || '-'}</td>
                            <td>
                              <div className="subject-stack">
                                {student.subjects.map((subject) => {
                                  const status = statusFromPercentage(subject.percentage, subject.classes_held);

                                  return (
                                    <span className={`mini-summary mini-${status}`} key={subject.subject_id}>
                                      <strong>{subject.subject_code}</strong>
                                      {subject.percentage}%
                                      <small>
                                        {subject.classes_attended}/{subject.classes_held}
                                      </small>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td>
                              <button
                                className="danger-button"
                                type="button"
                                onClick={() => handleDeleteStudent(student.id)}
                                disabled={isManaging}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!students.length && <p className="empty-state">No student accounts found.</p>}
                  </div>
                </section>
              </div>
            )}

            {active === 'teachers' && (
              <div className="stacked-panels">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Add Teacher</h2>
                    <span>New account</span>
                  </div>

                  <form className="form-grid form-grid-wide" onSubmit={handleCreateTeacher} noValidate>
                    <label>
                      Name
                      <input value={teacherForm.name} onChange={(event) => updateTeacherForm('name', event.target.value)} />
                      {teacherErrors.name && <span className="field-error">{teacherErrors.name}</span>}
                    </label>

                    <label>
                      Email
                      <input
                        type="email"
                        value={teacherForm.email}
                        onChange={(event) => updateTeacherForm('email', event.target.value)}
                      />
                      {teacherErrors.email && <span className="field-error">{teacherErrors.email}</span>}
                    </label>

                    <label>
                      Password
                      <input
                        type="password"
                        value={teacherForm.password}
                        onChange={(event) => updateTeacherForm('password', event.target.value)}
                      />
                      {teacherErrors.password && <span className="field-error">{teacherErrors.password}</span>}
                    </label>

                    <label>
                      Department
                      <input
                        value={teacherForm.department}
                        onChange={(event) => updateTeacherForm('department', event.target.value)}
                      />
                      {teacherErrors.department && <span className="field-error">{teacherErrors.department}</span>}
                    </label>

                    <button className="primary-button form-action" type="submit" disabled={isManaging}>
                      {isManaging ? 'Saving...' : 'Add Teacher'}
                    </button>
                  </form>
                </section>

                <section className="panel">
                  <div className="panel-heading">
                    <h2>Teachers</h2>
                    <span>{teachers.length} total</span>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Teacher</th>
                          <th>Department</th>
                          <th>Created</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teachers.map((teacher) => (
                          <tr key={teacher.id}>
                            <td>
                              <strong>{teacher.name}</strong>
                              <small>{teacher.email}</small>
                            </td>
                            <td>{teacher.department || '-'}</td>
                            <td>{teacher.created_at}</td>
                            <td>
                              <button
                                className="danger-button"
                                type="button"
                                onClick={() => handleDeleteTeacher(teacher.id)}
                                disabled={isManaging}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!teachers.length && <p className="empty-state">No teacher accounts found.</p>}
                  </div>
                </section>
              </div>
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
                          <th>Held</th>
                          <th>Attended</th>
                          <th>Percentage</th>
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
                              <td>{Math.min(report.classes_held, 30)}</td>
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
                          <th>Held</th>
                          <th>Attended</th>
                          <th>Percentage</th>
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
                    {!monthly.length && <p className="empty-state">No monthly summary available.</p>}
                  </div>
                </section>
              </div>
            )}

            {active === 'low' && (
              <section className="panel">
                <div className="panel-heading">
                  <h2>Students Below 75%</h2>
                  <span>{lowReports.length} subjects</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Roll</th>
                        <th>Department</th>
                        <th>Subject</th>
                        <th>Percentage</th>
                        <th>Classes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowReports.map((report) => (
                        <tr className="critical-row" key={`${report.student_id}-${report.subject_id}`}>
                          <td>{report.student_name}</td>
                          <td>{report.roll_number || '-'}</td>
                          <td>{report.department || '-'}</td>
                          <td>
                            {report.subject_name} ({report.subject_code})
                          </td>
                          <td>{report.percentage}%</td>
                          <td>
                            {report.classes_attended}/{report.classes_held}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!lowReports.length && <p className="empty-state">No low-attendance records found.</p>}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
