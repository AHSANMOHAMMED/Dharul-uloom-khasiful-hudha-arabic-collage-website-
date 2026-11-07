import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import AttendanceHistoryView from '../components/views/AttendanceHistoryView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  return <AttendanceHistoryView studentId={student} />;
}
