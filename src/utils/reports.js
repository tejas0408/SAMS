export const monthOptions = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

export function currentReportPeriod() {
  const date = new Date();
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear()
  };
}

export function monthLabel(month) {
  return monthOptions.find((option) => Number(option.value) === Number(month))?.label || month;
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function downloadCsv(filename, sections) {
  const lines = [];

  sections.forEach((section, index) => {
    if (index) lines.push('');
    if (section.title) lines.push(escapeCsv(section.title));
    lines.push(section.headers.map(escapeCsv).join(','));
    section.rows.forEach((row) => {
      lines.push(row.map(escapeCsv).join(','));
    });
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function eligibilityText(status) {
  if (status === 'eligible') return 'Eligible';
  if (status === 'warning') return 'Warning';
  if (status === 'not_eligible') return 'Not Eligible';
  return 'No Data';
}
