#!/usr/bin/env node
/**
 * Find UI text that cannot become Tamil:
 *  - `ar ? X : Y` / `i18n.language === 'ar' ? X : Y` whose branches are not plain strings
 *  - English JSX text not wrapped in tx()/t()
 *  - English string literals in placeholder/title/aria-label/alt attributes
 *  - yup / toast messages written as plain English literals
 *   node scripts/i18n/auditUntranslated.mjs [--json]
 *
 * Also importable: `auditUntranslated(rootDir)` returns the findings
 * ({ file, line, kind, text? }, file relative to rootDir with `/`).
 * src/test/untranslated.test.js asserts there are none, apart from the
 * intentional English listed in scripts/i18n/allowlist.json.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';

const traverse = traverseMod.default || traverseMod;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const files = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) return ['test', 'locales'].includes(f) ? [] : files(p);
  return /\.jsx?$/.test(f) ? [p] : [];
});
const isArTest = (t) => (t.type === 'Identifier' && /^(ar|isAr|isArabic|isRTL)$/.test(t.name))
  || (t.type === 'BinaryExpression' && t.right?.value === 'ar' && t.left?.property?.name === 'language');
const english = (s) => /[A-Za-z]{2,}/.test(s) && !/^[\w.\-/#:]+$/.test(s.trim()) || /\s/.test(s.trim()) && /[A-Za-z]{3,}/.test(s);
const ATTRS = new Set(['placeholder', 'title', 'aria-label', 'alt', 'label']);

/** Every untranslatable UI string under `<rootDir>/src`. */
export function auditUntranslated(rootDir = ROOT) {
  const out = [];
  for (const file of files(join(rootDir, 'src'))) {
    const code = readFileSync(file, 'utf8');
    const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
    const rel = relative(rootDir, file).split('\\').join('/');
    traverse(ast, {
      ConditionalExpression(p) {
        if (isArTest(p.node.test)) out.push({ file: rel, line: p.node.loc.start.line, kind: 'ar-ternary' });
      },
      JSXText(p) {
        const t = p.node.value.trim();
        const parent = p.parent;
        const classAttr = parent?.openingElement?.attributes?.find?.((a) => a.name?.name === 'className');
        if (typeof classAttr?.value?.value === 'string' && classAttr.value.value.includes('material-symbols')) {
          return;
        }
        if (t && /[A-Za-z]{3,}/.test(t)) out.push({ file: rel, line: p.node.loc.start.line, kind: 'jsx-text', text: t.slice(0, 60) });
      },
      JSXAttribute(p) {
        const n = p.node.name?.name;
        const v = p.node.value;
        if (ATTRS.has(n) && v?.type === 'StringLiteral' && english(v.value)) {
          out.push({ file: rel, line: v.loc.start.line, kind: `attr:${n}`, text: v.value.slice(0, 60) });
        }
      },
      CallExpression(p) {
        const c = p.node.callee;
        const name = c.type === 'MemberExpression' ? c.property?.name : c.name;
        const obj = c.type === 'MemberExpression' && c.object?.type === 'Identifier' ? c.object.name : '';
        const msgArgs = ['required', 'min', 'max', 'matches', 'email', 'typeError', 'length'].includes(name) ? p.node.arguments
          : (obj === 'toast' ? p.node.arguments.slice(0, 1) : []);
        for (const a of msgArgs) {
          if (a?.type === 'StringLiteral' && english(a.value)) out.push({ file: rel, line: a.loc.start.line, kind: obj === 'toast' ? 'toast' : 'validation', text: a.value.slice(0, 60) });
        }
      },
    });
  }
  return out;
}

/** scripts/i18n/allowlist.json → [{ file, text, reason }] (intentional English). */
export function loadAllowlist(rootDir = ROOT) {
  return JSON.parse(readFileSync(join(rootDir, 'scripts/i18n/allowlist.json'), 'utf8'));
}

/** Drop findings the allow-list marks as intentional. */
export function withoutAllowed(findings, allowlist) {
  return findings.filter((f) => !allowlist.some((a) => a.file === f.file && a.text === f.text));
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const out = auditUntranslated(ROOT);
  if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1));
  else {
    const by = {};
    for (const o of out) (by[o.file] ||= []).push(o);
    for (const [f, items] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`${String(items.length).padStart(4)}  ${f}  [${[...new Set(items.map((i) => i.kind))].join(', ')}]`);
    }
    console.log(`\n${out.length} untranslatable UI strings in ${Object.keys(by).length} files`);
  }
}
