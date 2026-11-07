import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import ReportCardView from '../components/views/ReportCardView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  return <ReportCardView studentId={student} examId={params.exam ? String(params.exam) : undefined} />;
}
