import { supabase, isSupabaseConfigured } from './supabaseClient';
import { generateFeeReceipt } from './exportUtils';

export async function listStaffHr() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('staff_hr')
    .select('*, profiles:profile_id(id, full_name, email, phone, account_type, assigned_tutor_role)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[hrmApi] listStaffHr', error);
    return [];
  }
  return data ?? [];
}

export async function listTutorProfiles() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, assigned_tutor_role, class_number')
    .eq('account_type', 'tutor')
    .eq('is_approved', true)
    .order('full_name');
  if (error) return [];
  return data ?? [];
}

export async function upsertStaffHr(row) {
  if (!isSupabaseConfigured) throw new Error('Not configured');
  const { data, error } = await supabase
    .from('staff_hr')
    .upsert(row, { onConflict: 'profile_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listSalariesForMonth(month) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from('tutor_salaries')
    .select('*, profiles:tutor_id(full_name, index_number)')
    .eq('month', month)
    .order('updated_at', { ascending: false });
  if (error) return [];
  return data ?? [];
}

/** Printable salary slip — reuses fee receipt HTML pattern. */
export function printSalarySlip(tutor, salary, issuedBy = 'Treasurer') {
  generateFeeReceipt(
    {
      full_name: tutor?.full_name || tutor?.profiles?.full_name || 'Staff',
      index_number: tutor?.index_number || 'STAFF',
      class_number: tutor?.department || 'HR',
    },
    {
      month: salary.month,
      total_due: salary.amount,
      paid_amount: salary.status === 'paid' ? salary.amount : 0,
      status: salary.status,
      payments: [
        {
          amount: salary.amount,
          date: new Date().toISOString(),
          note: `Salary ${salary.status}`,
        },
      ],
    },
    issuedBy
  );
}
