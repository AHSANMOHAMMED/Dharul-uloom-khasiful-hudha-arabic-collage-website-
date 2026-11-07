import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import FeesView from '../components/views/FeesView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  return <FeesView studentId={student} />;
}
