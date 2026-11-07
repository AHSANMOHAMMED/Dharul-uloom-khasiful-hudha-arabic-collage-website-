import { useAuth } from '../../lib/auth';
import ResultsView from '../../components/views/ResultsView';

export default function StudentResults() {
  const { user, profile } = useAuth();
  return <ResultsView studentId={user?.id} classNumber={profile?.class_number} />;
}
