// All Supabase access for My Books lives here.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, USERNAME_EMAIL_DOMAIN, COVER_BUCKET } from './config.js';
import { slugify, uniqueSlug } from './util.js';

export const isConfigured =
  /^https:\/\/.+/.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('YOUR-') &&
  !SUPABASE_ANON_KEY.includes('YOUR-');

const supabase = isConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mybooks-auth' },
    })
  : null;

const COLUMNS =
  'id, slug, title, author, status, date_started, date_finished, rating, summary, quotes, tags, page_count, cover_path, created_at, updated_at';

function client() {
  if (!supabase) {
    throw new Error('My Books isn’t connected to Supabase yet — fill in myBooks/js/config.js.');
  }
  return supabase;
}

function check({ data, error }) {
  if (error) throw new Error(friendlyError(error));
  return data;
}

function friendlyError(error) {
  const message = error?.message ?? String(error);
  if (error?.code === '42501' || /row-level security/i.test(message)) {
    return 'You don’t have permission to do that. Try logging in again.';
  }
  if (error?.code === '23505') return 'A book with that link already exists.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return 'Couldn’t reach the server. Check your connection and try again.';
  }
  return message;
}

// ---------- Books ----------

export async function listBooks() {
  return check(await client().from('books').select(COLUMNS).order('created_at', { ascending: false }));
}

export async function getBook(slug) {
  return check(await client().from('books').select(COLUMNS).eq('slug', slug).maybeSingle());
}

async function freeSlug(title) {
  const base = slugify(title);
  const rows = check(await client().from('books').select('slug').like('slug', `${base}%`));
  return uniqueSlug(
    base,
    rows.map((r) => r.slug),
  );
}

export async function createBook(values) {
  const slug = await freeSlug(values.title);
  return check(await client().from('books').insert({ ...values, slug }).select(COLUMNS).single());
}

export async function updateBook(id, values) {
  // The slug never changes on edit, so links you've shared keep working.
  return check(await client().from('books').update(values).eq('id', id).select(COLUMNS).single());
}

export async function deleteBook(book) {
  check(await client().from('books').delete().eq('id', book.id));
  if (book.cover_path) await removeCover(book.cover_path).catch(() => {});
}

// ---------- Covers ----------
// Each cover is stored twice: "<id>-lg.<ext>" (detail page) and
// "<id>-sm.<ext>" (grid). cover_path holds the large one.

const smallPath = (path) => path.replace(/-lg\.(\w+)$/, '-sm.$1');

export function coverUrl(path, size = 'lg') {
  if (!path || !supabase) return '';
  const p = size === 'sm' ? smallPath(path) : path;
  return supabase.storage.from(COVER_BUCKET).getPublicUrl(p).data.publicUrl;
}

// randomUUID needs a secure context (and Safari 15.4+); fall back to random hex.
const randomId = () =>
  crypto.randomUUID?.() ??
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

export async function uploadCover({ large, small, ext, type }) {
  const id = randomId();
  const path = `covers/${id}-lg.${ext}`;
  const bucket = client().storage.from(COVER_BUCKET);
  const opts = { contentType: type, cacheControl: '31536000', upsert: false };
  check(await bucket.upload(path, large, opts));
  const res = await bucket.upload(smallPath(path), small, opts);
  if (res.error) {
    await bucket.remove([path]);
    check(res);
  }
  return path;
}

export async function removeCover(path) {
  check(await client().storage.from(COVER_BUCKET).remove([path, smallPath(path)]));
}

// ---------- Auth ----------

export function usernameToEmail(username) {
  const u = username.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${USERNAME_EMAIL_DOMAIN}`;
}

export async function signIn(username, password) {
  const { error } = await client().auth.signInWithPassword({
    email: usernameToEmail(username),
    password,
  });
  if (error) {
    throw new Error(
      error.status === 400 ? 'Wrong username or password.' : friendlyError(error),
    );
  }
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function isAdmin() {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_books_admin');
  return !error && data === true;
}

export function onAuthChange(callback) {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
