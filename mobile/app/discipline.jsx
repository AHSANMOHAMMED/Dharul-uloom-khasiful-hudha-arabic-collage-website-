import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import DisciplineView from '../components/views/DisciplineView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  return <DisciplineView studentId={student} />;
}
