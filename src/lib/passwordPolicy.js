import { tx } from './tx';

// Mirrors supabase/config.toml [auth]: minimum_password_length = 10,
// password_requirements = "letters_digits". The server is authoritative;
// this only gives the user the reason before a round trip.
export const MIN_PASSWORD_LENGTH = 10;

/** Returns an error message, or '' when the password is acceptable. */
export function passwordProblem(password) {
  const p = String(password || '');
  if (p.length < MIN_PASSWORD_LENGTH) {
    return tx('يجب أن تكون كلمة المرور 10 أحرف على الأقل', 'Password must be at least 10 characters');
  }
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) {
    return tx('يجب أن تحتوي كلمة المرور على حروف وأرقام', 'Password must contain both letters and numbers');
  }
  return '';
}
