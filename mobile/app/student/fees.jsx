import { useAuth } from '../../lib/auth';
import FeesView from '../../components/views/FeesView';

export default function StudentFees() {
  const { user } = useAuth();
  return <FeesView studentId={user?.id} />;
}
