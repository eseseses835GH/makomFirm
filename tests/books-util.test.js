import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  slugify,
  uniqueSlug,
  addTag,
  tagCounts,
  filterBooks,
  sortBooks,
  computeStats,
  validateBook,
  formatDate,
  todayISO,
} from '../myBooks/js/util.js';
import { html, raw } from '../myBooks/js/html.js';
import { match, path } from '../myBooks/js/router.js';

const book = (o) => ({ title: 'T', author: null, status: 'finished', tags: [], created_at: '2026-01-01T00:00:00Z', ...o });

test('slugify keeps Latin and Hebrew, strips punctuation and niqqud', () => {
  assert.equal(slugify('Thinking, Fast and Slow'), 'thinking-fast-and-slow');
  assert.equal(slugify('  Café Society! '), 'cafe-society');
  assert.equal(slugify('הָאַלְכִּימַאי'), 'האלכימאי');
  assert.equal(slugify('ספר "מיוחד" 2'), 'ספר-מיוחד-2');
  assert.equal(slugify('???'), 'book');
  assert.ok(slugify('a'.repeat(200)).length <= 80);
});

test('uniqueSlug avoids taken and reserved slugs', () => {
  assert.equal(uniqueSlug('dune', []), 'dune');
  assert.equal(uniqueSlug('dune', ['dune', 'dune-2']), 'dune-3');
  assert.equal(uniqueSlug('stats', []), 'stats-2');
  assert.equal(uniqueSlug('new', ['new-2']), 'new-3');
});

test('addTag trims and dedupes case-insensitively', () => {
  let tags = addTag([], '  Psychology ');
  tags = addTag(tags, 'psychology');
  tags = addTag(tags, '   ');
  tags = addTag(tags, 'Fiction');
  assert.deepEqual(tags, ['Psychology', 'Fiction']);
});

test('tagCounts orders by count then name', () => {
  const counts = tagCounts([book({ tags: ['b', 'a'] }), book({ tags: ['B'] }), book({ tags: ['c'] })]);
  assert.deepEqual(
    counts.map((t) => [t.tag, t.count]),
    [['b', 2], ['a', 1], ['c', 1]],
  );
});

test('filterBooks matches status, tag and folded search text', () => {
  const books = [
    book({ title: 'Dune', author: 'Frank Herbert', status: 'finished', tags: ['SciFi'] }),
    book({ title: 'הָאַלְכִּימַאי', author: 'פאולו קואלו', status: 'reading', tags: ['fiction'] }),
  ];
  assert.equal(filterBooks(books, { q: 'herb' }).length, 1);
  assert.equal(filterBooks(books, { q: 'האלכימאי' }).length, 1);
  assert.equal(filterBooks(books, { tag: 'scifi' }).length, 1);
  assert.equal(filterBooks(books, { status: 'reading' })[0].author, 'פאולו קואלו');
  assert.equal(filterBooks(books, {}).length, 2);
});

test('sortBooks puts missing values last', () => {
  const books = [
    book({ title: 'A', rating: null, date_finished: null, created_at: '2026-01-03' }),
    book({ title: 'B', rating: 5, date_finished: '2025-01-01', created_at: '2026-01-01' }),
    book({ title: 'C', rating: 3, date_finished: '2026-02-01', created_at: '2026-01-02' }),
  ];
  assert.deepEqual(sortBooks(books, 'added').map((b) => b.title), ['A', 'C', 'B']);
  assert.deepEqual(sortBooks(books, 'finished').map((b) => b.title), ['C', 'B', 'A']);
  assert.deepEqual(sortBooks(books, 'rating').map((b) => b.title), ['B', 'C', 'A']);
  assert.deepEqual(sortBooks(books, 'title').map((b) => b.title), ['A', 'B', 'C']);
});

test('computeStats fills year gaps and sums finished pages only', () => {
  const s = computeStats([
    book({ date_finished: '2023-05-01', page_count: 100, rating: 4, tags: ['x'] }),
    book({ date_finished: '2025-01-01', page_count: 200, rating: 5, tags: ['x', 'y'] }),
    book({ date_finished: null, page_count: 50 }),
    book({ status: 'reading', page_count: 999, rating: 3 }),
  ]);
  assert.deepEqual(s.finishedPerYear, [
    { year: 2023, count: 1 },
    { year: 2024, count: 0 },
    { year: 2025, count: 1 },
  ]);
  assert.equal(s.finishedCount, 3);
  assert.equal(s.undatedFinished, 1);
  assert.equal(s.pagesRead, 350);
  assert.equal(s.avgRating, 4);
  assert.equal(s.currentlyReading.length, 1);
  assert.deepEqual(s.topTags[0], { tag: 'x', count: 2 });
  assert.deepEqual(computeStats([]).finishedPerYear, []);
});

test('validateBook normalizes good input', () => {
  const { errors, value } = validateBook({
    title: '  Dune ',
    author: '',
    status: 'finished',
    date_started: '2026-01-01',
    date_finished: '2026-02-01',
    rating: '5',
    page_count: '412',
    summary: 'Line one\nLine two\n\n',
    tags: ['Sci-Fi', 'sci-fi'],
    quotes: [{ text: 'Fear is the mind-killer.', page: '8' }, { text: '  ', page: '' }],
  });
  assert.deepEqual(errors, {});
  assert.deepEqual(value, {
    title: 'Dune',
    author: null,
    status: 'finished',
    date_started: '2026-01-01',
    date_finished: '2026-02-01',
    rating: 5,
    page_count: 412,
    summary: 'Line one\nLine two',
    quotes: [{ text: 'Fear is the mind-killer.', page: 8 }],
    tags: ['Sci-Fi'],
  });
});

test('validateBook reports field errors', () => {
  const { errors } = validateBook({
    title: '   ',
    status: 'bogus',
    date_started: '2026-03-01',
    date_finished: '2026-02-01',
    rating: '7',
    page_count: '-3',
    quotes: [{ text: '', page: '4' }, { text: 'ok', page: 'x' }],
  });
  assert.deepEqual(Object.keys(errors).sort(), [
    'date_finished',
    'page_count',
    'quote-0',
    'quote-1',
    'rating',
    'status',
    'title',
  ]);
});

test('formatDate and todayISO avoid timezone drift', () => {
  assert.equal(formatDate('2026-10-03'), '3 Oct 2026');
  assert.equal(formatDate(''), '');
  assert.equal(todayISO(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('html escapes interpolations but not nested templates', () => {
  const name = '<img src=x onerror=alert(1)>"';
  const out = html`<p title="${name}">${name}${html`<b>${'&'}</b>`}${raw('<i>ok</i>')}</p>`.toString();
  assert.equal(
    out,
    '<p title="&lt;img src=x onerror=alert(1)&gt;&quot;">&lt;img src=x onerror=alert(1)&gt;&quot;<b>&amp;</b><i>ok</i></p>',
  );
});

test('router matches app routes', () => {
  assert.deepEqual(match('/myBooks/'), { name: 'list' });
  assert.deepEqual(match('/myBooks'), { name: 'list' });
  assert.deepEqual(match('/mybooks/stats'), { name: 'stats' });
  assert.deepEqual(match('/myBooks/new'), { name: 'new' });
  assert.deepEqual(match('/myBooks/login'), { name: 'login' });
  assert.deepEqual(match(path('האלכימאי')), { name: 'detail', slug: 'האלכימאי' });
  assert.deepEqual(match('/myBooks/dune/edit'), { name: 'edit', slug: 'dune' });
  assert.deepEqual(match('/myBooks/a/b/c'), { name: 'notFound' });
  assert.deepEqual(match('/elsewhere'), { name: 'notFound' });
});
