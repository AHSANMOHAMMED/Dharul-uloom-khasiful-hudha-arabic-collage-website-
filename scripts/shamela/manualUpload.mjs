#!/usr/bin/env node
/**
 * Manually add a single book (e.g. an extra Urdu PDF) to the library.
 * Uploads the file to the private `books` bucket and inserts a books row.
 *
 * Usage:
 *   node scripts/shamela/manualUpload.mjs \
 *     --file ./my-book.pdf \
 *     --title-ar "عنوان الكتاب" \
 *     [--title-en "Title"] [--author "اسم المؤلف"] \
 *     [--language ur] [--category "فقه"] [--year 1990] [--cover ./cover.jpg]
 *
 * Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { getSupabaseAdmin } from './lib.mjs';

function parseArgs(argv) {
  const out = { language: 'ur' };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--file') out.file = argv[++i];
    else if (a === '--title-ar') out.titleAr = argv[++i];
    else if (a === '--title-en') out.titleEn = argv[++i];
    else if (a === '--author') out.author = argv[++i];
    else if (a === '--language') out.language = argv[++i];
    else if (a === '--category') out.category = argv[++i];
    else if (a === '--year') out.year = parseInt(argv[++i], 10);
    else if (a === '--cover') out.cover = argv[++i];
  }
  return out;
}

async function ensureAuthor(supabase, name) {
  if (!name) return null;
  const { data, error } = await supabase
    .from('authors')
    .upsert({ name_ar: name }, { onConflict: 'name_ar', ignoreDuplicates: false })
    .select('id')
    .maybeSingle();
  if (error) {
    // name_ar may not be unique; fall back to a plain insert/select.
    const found = await supabase.from('authors').select('id').eq('name_ar', name).maybeSingle();
    if (found.data) return found.data.id;
    const ins = await supabase.from('authors').insert({ name_ar: name }).select('id').single();
    return ins.data?.id ?? null;
  }
  return data?.id ?? null;
}

async function ensureCategory(supabase, name) {
  if (!name) return null;
  const found = await supabase.from('categories').select('id').eq('name_ar', name).maybeSingle();
  if (found.data) return found.data.id;
  const ins = await supabase.from('categories').insert({ name_ar: name }).select('id').single();
  return ins.data?.id ?? null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !args.titleAr) {
    console.error('Required: --file <path> and --title-ar <text>');
    process.exit(1);
  }
  const supabase = getSupabaseAdmin();

  const buffer = fs.readFileSync(args.file);
  const ext = path.extname(args.file).toLowerCase();
  const contentType = ext === '.pdf' ? 'application/pdf' : ext === '.html' ? 'text/html' : 'application/octet-stream';
  const filePath = `manual/${Date.now()}-${path.basename(args.file)}`;

  console.log(`⇡ Uploading ${args.file} -> books/${filePath}`);
  const { error: upErr } = await supabase.storage
    .from('books')
    .upload(filePath, buffer, { contentType, upsert: true });
  if (upErr) throw upErr;

  let coverImage = null;
  if (args.cover) {
    const coverBuf = fs.readFileSync(args.cover);
    const coverPath = `manual/${Date.now()}-${path.basename(args.cover)}`;
    const { error: covErr } = await supabase.storage
      .from('covers')
      .upload(coverPath, coverBuf, { upsert: true });
    if (covErr) throw covErr;
    coverImage = coverPath;
  }

  const authorId = await ensureAuthor(supabase, args.author);
  const categoryId = await ensureCategory(supabase, args.category);

  const { data, error } = await supabase
    .from('books')
    .insert({
      title_ar: args.titleAr,
      title_en: args.titleEn ?? null,
      language: args.language,
      year: args.year ?? null,
      file_path: filePath,
      cover_image: coverImage,
      author_id: authorId,
      category_id: categoryId,
      is_public: true,
      metadata: { source: 'manual' },
    })
    .select('id')
    .single();
  if (error) throw error;

  if (authorId) await supabase.from('book_authors').upsert({ book_id: data.id, author_id: authorId });
  if (categoryId) await supabase.from('book_categories').upsert({ book_id: data.id, category_id: categoryId });

  console.log(`✓ Added book ${data.id}: ${args.titleAr}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
