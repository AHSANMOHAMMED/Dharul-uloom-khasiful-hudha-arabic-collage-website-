import FinanceTabView from '../../components/views/FinanceTabView';

// Leadership / finance / HR staff get the admin-lite dashboard inside the staff portal.
// Finance viewers (treasurer, accountant, principal, vice principal) land on "Today".
export default function StaffDashboard() {
  return <FinanceTabView withStats />;
}
