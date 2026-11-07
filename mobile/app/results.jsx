import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import ResultsView from '../components/views/ResultsView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  const cls = params.class ? Number(params.class) : profile?.class_number;
  return <ResultsView studentId={student} classNumber={cls || undefined} />;
}
