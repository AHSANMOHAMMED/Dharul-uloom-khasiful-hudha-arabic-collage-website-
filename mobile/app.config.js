/**
 * Expo config — loads EXPO_PUBLIC_* from mobile/.env at build time
 * so the release APK talks to the live Supabase project.
 */
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    const val = trimmed.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
}

const appJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'app.json'), 'utf8'));

module.exports = ({ config }) => ({
  ...appJson.expo,
  ...config,
  android: {
    ...appJson.expo.android,
    versionCode: 1,
  },
  extra: {
    ...(appJson.expo.extra || {}),
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
    webUrl: process.env.EXPO_PUBLIC_WEB_URL || 'https://kashifulhudha.lk',
    eas: {
      ...(appJson.expo.extra?.eas || {}),
    },
  },
});
