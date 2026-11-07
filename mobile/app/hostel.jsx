import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import HostelView from '../components/views/HostelView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  return <HostelView studentId={student} />;
}
