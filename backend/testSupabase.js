import { testConnection } from './utils/supabaseHelpers.js';

console.log('Testing Supabase connection...');

const result = await testConnection();

if (result.success) {
  console.log('✅ Supabase connection successful!');
  console.log(`Profiles count: ${result.count}`);
} else {
  console.error('❌ Supabase connection failed:', result.error);
  console.log('\nPlease check:');
  console.log('1. SUPABASE_URL is correct in backend/.env');
  console.log('2. SUPABASE_SERVICE_ROLE_KEY is set in backend/.env (get it from Supabase dashboard > Project Settings > API)');
}

process.exit(result.success ? 0 : 1);
