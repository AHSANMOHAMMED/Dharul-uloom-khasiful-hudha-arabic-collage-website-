import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import LeaveRequestsView from '../components/views/LeaveRequestsView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  return <LeaveRequestsView studentId={student} />;
}
