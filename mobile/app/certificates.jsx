import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import CertificatesView from '../components/views/CertificatesView';

export default function Route() {
  const params = useLocalSearchParams();
  const { user } = useAuth();
  const student = params.student ? String(params.student) : user?.id;
  return <CertificatesView studentId={student} />;
}
