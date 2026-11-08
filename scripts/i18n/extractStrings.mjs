#!/usr/bin/env node
/**
 * Collect every English UI string that needs a Tamil translation:
 *   tx('عربي', 'English')  → second argument
 *   t('English', 'عربي')   → first argument (ERP useLang)
 * Writes scripts/i18n/strings.json and reports which are missing from
 * src/locales/ta.json.   node scripts/i18n/extractStrings.mjs [--missing]
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';

const traverse = traverseMod.default || traverseMod;
const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..');
const SRC = join(ROOT, 'src');
const files = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) return f === 'test' || f === 'locales' ? [] : files(p);
  return /\.jsx?$/.test(f) ? [p] : [];
});
const lit = (n) => (n?.type === 'StringLiteral' ? n.value
  : n?.type === 'TemplateLiteral' && !n.expressions.length ? n.quasis[0].value.cooked : null);

const out = new Set();
for (const file of files(SRC)) {
  const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  traverse(ast, {
    CallExpression({ node }) {
      const name = node.callee.type === 'Identifier' ? node.callee.name : null;
      if (name === 'tx') { const v = lit(node.arguments[1]); if (v) out.add(v); }
      if (name === 't' && node.arguments.length >= 2) { const v = lit(node.arguments[0]); if (v) out.add(v); }
    },
  });
}
const all = [...out].filter((s) => /[A-Za-z]/.test(s)).sort();
writeFileSync(join(ROOT, 'scripts/i18n/strings.json'), JSON.stringify(all, null, 1) + '\n');
const taPath = join(SRC, 'locales/ta.json');
const ta = {};
for (const f of readdirSync(join(SRC, 'locales')).filter((n) => /^ta.*\.json$/.test(n))) {
  Object.assign(ta, JSON.parse(readFileSync(join(SRC, 'locales', f), 'utf8')));
}
const missing = all.filter((s) => !ta[s]);
console.log(`${all.length} strings, ${all.length - missing.length} translated, ${missing.length} missing`);
if (process.argv.includes('--missing')) writeFileSync(join(ROOT, 'scripts/i18n/missing.json'), JSON.stringify(missing, null, 1) + '\n');
