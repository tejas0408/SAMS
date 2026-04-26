export default function Badge({ status, children }) {
  const label =
    children ||
    {
      eligible: 'Eligible',
      warning: 'Warning',
      not_eligible: 'Not Eligible',
      no_data: 'No Data'
    }[status] ||
    status;

  return <span className={`badge badge-${status}`}>{label}</span>;
}
