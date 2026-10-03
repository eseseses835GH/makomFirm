// Pure helpers for My Books: no DOM, no network. Covered by tests/books-util.test.js.

export const STATUSES = [
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
  { value: 'want_to_read', label: 'Want to read' },
];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

export const SORTS = [
  { value: 'added', label: 'Recently added' },
  { value: 'finished', label: 'Date finished' },
  { value: 'rating', label: 'Rating' },
  { value: 'title', label: 'Title' },
];

// Path segments the router owns; a book slug can never be one of these.
export const RESERVED_SLUGS = ['stats', 'login', 'logout', 'new', 'edit'];

const MAX_SLUG = 80;

/** Strip accents and Hebrew niqqud/cantillation so search and slugs ignore them. */
export function foldText(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-֑ͯ-ׇ]/g, '')
    .toLowerCase();
}

/** Readable, URL-safe slug that keeps Hebrew and other non-Latin letters. */
export function slugify(title) {
  const slug = foldText(title)
    .replace(/['"׳״’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG)
    .replace(/-+$/, '');
  return slug || 'book';
}

/** First of `base`, `base-2`, `base-3`… that is neither taken nor reserved. */
export function uniqueSlug(base, taken) {
  const used = new Set(taken);
  const isFree = (s) => !used.has(s) && !RESERVED_SLUGS.includes(s);
  if (isFree(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (isFree(candidate)) return candidate;
  }
}

/** Trim and collapse whitespace; empty tags are dropped by callers. */
export function normalizeTag(tag) {
  return String(tag ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

/** Add a tag unless an equivalent (case-insensitive) one is already present. */
export function addTag(tags, tag) {
  const clean = normalizeTag(tag);
  if (!clean) return tags;
  const key = clean.toLowerCase();
  return tags.some((t) => t.toLowerCase() === key) ? tags : [...tags, clean];
}

/** All distinct tags across books, most used first, ties alphabetical. */
export function tagCounts(books) {
  const counts = new Map();
  for (const book of books) {
    for (const tag of book.tags ?? []) {
      const key = tag.toLowerCase();
      const entry = counts.get(key) ?? { tag, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function filterBooks(books, { status = '', tag = '', q = '' } = {}) {
  const needle = foldText(q).trim();
  const tagKey = tag.toLowerCase();
  return books.filter((b) => {
    if (status && b.status !== status) return false;
    if (tagKey && !(b.tags ?? []).some((t) => t.toLowerCase() === tagKey)) return false;
    if (needle && !foldText(`${b.title} ${b.author ?? ''}`).includes(needle)) return false;
    return true;
  });
}

// Compare with nulls/undefined always last, regardless of direction.
function byDesc(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? 1 : a > b ? -1 : 0;
}

export function sortBooks(books, sort = 'added') {
  const list = [...books];
  const added = (a, b) => byDesc(a.created_at, b.created_at);
  switch (sort) {
    case 'finished':
      return list.sort((a, b) => byDesc(a.date_finished, b.date_finished) || added(a, b));
    case 'rating':
      return list.sort(
        (a, b) =>
          byDesc(a.rating, b.rating) || byDesc(a.date_finished, b.date_finished) || added(a, b),
      );
    case 'title':
      return list.sort((a, b) => foldText(a.title).localeCompare(foldText(b.title)));
    default:
      return list.sort(added);
  }
}

/** 'YYYY-MM-DD' → '3 Oct 2026' without timezone drift. */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Today as 'YYYY-MM-DD' in local time. */
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function computeStats(books) {
  const finished = books.filter((b) => b.status === 'finished');
  const byYear = new Map();
  for (const b of finished) {
    if (!b.date_finished) continue;
    const year = Number(b.date_finished.slice(0, 4));
    byYear.set(year, (byYear.get(year) ?? 0) + 1);
  }
  // Continuous range so empty years show as gaps, not as missing bars.
  const years = [...byYear.keys()];
  const finishedPerYear = [];
  if (years.length) {
    for (let y = Math.min(...years); y <= Math.max(...years); y += 1) {
      finishedPerYear.push({ year: y, count: byYear.get(y) ?? 0 });
    }
  }
  const rated = books.filter((b) => b.rating);
  const avgRating = rated.length
    ? Math.round((rated.reduce((s, b) => s + b.rating, 0) / rated.length) * 10) / 10
    : null;
  return {
    total: books.length,
    finishedCount: finished.length,
    undatedFinished: finished.filter((b) => !b.date_finished).length,
    finishedPerYear,
    pagesRead: finished.reduce((s, b) => s + (b.page_count ?? 0), 0),
    avgRating,
    ratedCount: rated.length,
    topTags: tagCounts(books).slice(0, 10),
    currentlyReading: sortBooks(
      books.filter((b) => b.status === 'reading'),
      'added',
    ),
  };
}

/**
 * Validate and normalize form input into a row for the books table.
 * Returns { errors, value }; errors is keyed by field name.
 */
export function validateBook(input) {
  const errors = {};
  const text = (v) => (typeof v === 'string' ? v.trim() : '');

  const title = text(input.title);
  if (!title) errors.title = 'Title is required.';
  else if (title.length > 300) errors.title = 'Title is too long (300 characters max).';

  const author = text(input.author);
  if (author.length > 300) errors.author = 'Author is too long (300 characters max).';

  const status = STATUS_LABEL[input.status] ? input.status : null;
  if (!status) errors.status = 'Choose a status.';

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const dateStarted = text(input.date_started) || null;
  const dateFinished = text(input.date_finished) || null;
  if (dateStarted && !dateRe.test(dateStarted)) errors.date_started = 'Enter a valid date.';
  if (dateFinished && !dateRe.test(dateFinished)) errors.date_finished = 'Enter a valid date.';
  if (dateStarted && dateFinished && !errors.date_started && dateFinished < dateStarted) {
    errors.date_finished = 'Finish date can’t be before the start date.';
  }

  let rating = input.rating === '' || input.rating == null ? null : Number(input.rating);
  if (rating !== null && !(Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
    errors.rating = 'Rating must be 1–5 stars.';
    rating = null;
  }

  const pagesRaw = text(String(input.page_count ?? ''));
  let pageCount = null;
  if (pagesRaw) {
    pageCount = Number(pagesRaw);
    if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 100000) {
      errors.page_count = 'Pages must be a whole number between 1 and 100,000.';
      pageCount = null;
    }
  }

  const quotes = [];
  (input.quotes ?? []).forEach((q, i) => {
    const quoteText = text(q.text);
    const pageRaw = text(String(q.page ?? ''));
    if (!quoteText && !pageRaw) return; // blank row, ignore
    if (!quoteText) {
      errors[`quote-${i}`] = 'Quote text is missing.';
      return;
    }
    let page = null;
    if (pageRaw) {
      page = Number(pageRaw);
      if (!Number.isInteger(page) || page < 1) {
        errors[`quote-${i}`] = 'Page must be a positive whole number.';
        return;
      }
    }
    quotes.push({ text: quoteText, page });
  });

  const tags = (input.tags ?? []).reduce(addTag, []);

  return {
    errors,
    value: {
      title,
      author: author || null,
      status: status ?? 'want_to_read',
      date_started: dateStarted,
      date_finished: dateFinished,
      rating,
      page_count: pageCount,
      summary: text(input.summary) ? input.summary.replace(/\s+$/, '') : null,
      quotes,
      tags,
    },
  };
}
