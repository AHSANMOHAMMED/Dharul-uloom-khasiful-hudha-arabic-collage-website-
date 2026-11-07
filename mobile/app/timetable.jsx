import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../lib/auth';
import TimetableView from '../components/views/TimetableView';

// /timetable?class=3 (class view) or /timetable?tutor=me (teacher view)
export default function Route() {
  const params = useLocalSearchParams();
  const { user, profile } = useAuth();
  if (params.tutor) return <TimetableView tutorId={params.tutor === 'me' ? user?.id : String(params.tutor)} />;
  const cls = params.class ? Number(params.class) : profile?.class_number;
  return <TimetableView classNumber={cls || undefined} />;
}
