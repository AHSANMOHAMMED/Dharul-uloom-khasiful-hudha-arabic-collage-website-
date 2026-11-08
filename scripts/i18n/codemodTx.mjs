#!/usr/bin/env node
/**
 * One-off / repeatable codemod: rewrite bilingual literal ternaries
 *   ar ? 'عربي' : 'English'          (also `i18n.language === 'ar' ? …` / `isAr ? …`)
 * into
 *   tx('عربي', 'English')
 * so they gain Tamil via src/lib/tx.js. Only ternaries whose BOTH branches are
 * plain string literals (or expression-free template literals) are touched;
 * everything else is left as-is. Text is spliced by source range, so the rest
 * of each file keeps its formatting.
 *
 *   node scripts/i18n/codemodTx.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative, dirname } from 'path';
import { parse } from '@babel/parser';
import traverseMod from '@babel/traverse';

const traverse = traverseMod.default || traverseMod;
const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..');
const SRC = join(ROOT, 'src');
const TX = join(SRC, 'lib', 'tx.js');
const dry = process.argv.includes('--dry');

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'test' || f === 'locales' ? [] : files(p);
    return /\.(jsx?)$/.test(f) ? [p] : [];
  });
}

const isArTest = (t) =>
  (t.type === 'Identifier' && (t.name === 'ar' || t.name === 'isAr' || t.name === 'isRTL' || t.name === 'isArabic')) ||
  (t.type === 'BinaryExpression' && t.operator === '===' &&
    t.right.type === 'StringLiteral' && t.right.value === 'ar' &&
    t.left.type === 'MemberExpression' && !t.left.computed &&
    t.left.property.name === 'language');

const isPlain = (n) => n.type === 'StringLiteral' || (n.type === 'TemplateLiteral' && n.expressions.length === 0);

let total = 0;
for (const file of files(SRC)) {
  if (file === TX || file.endsWith('i18n.js')) continue;
  const code = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(code, { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    console.error('parse failed', file, e.message);
    continue;
  }
  const edits = [];
  traverse(ast, {
    ConditionalExpression(path) {
      const { test, consequent, alternate } = path.node;
      if (isArTest(test) && isPlain(consequent) && isPlain(alternate)) {
        edits.push({
          start: path.node.start,
          end: path.node.end,
          text: `tx(${code.slice(consequent.start, consequent.end)}, ${code.slice(alternate.start, alternate.end)})`,
        });
        path.skip();
      }
    },
  });
  if (!edits.length) continue;
  let out = code;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  if (!/import \{[^}]*\btx\b[^}]*\} from '[^']*lib\/tx'/.test(out)) {
    let rel = relative(dirname(file), TX).replace(/\\/g, '/').replace(/\.js$/, '');
    if (!rel.startsWith('.')) rel = `./${rel}`;
    // insert after the last import (position from the ORIGINAL AST, shifted
    // by edits that happened before it — none can, imports precede code)
    const imports = ast.program.body.filter((n) => n.type === 'ImportDeclaration');
    const at = imports.length ? imports[imports.length - 1].end : 0;
    out = `${out.slice(0, at)}\nimport { tx } from '${rel}';${out.slice(at)}`;
  }
  total += edits.length;
  console.log(`${relative(ROOT, file)}: ${edits.length}`);
  if (!dry) writeFileSync(file, out);
}
console.log(`\n${dry ? '[dry] ' : ''}rewrote ${total} ternaries`);
