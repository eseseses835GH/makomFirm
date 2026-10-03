// Shared view building blocks.
import { html, raw } from './html.js';
import { coverUrl } from './api.js';
import { path } from './router.js';
import { STATUS_LABEL } from './util.js';

const STAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

export function stars(rating, { size = 'sm' } = {}) {
  if (!rating) return '';
  const items = [1, 2, 3, 4, 5].map((n) => html`<span class="${n <= rating ? 'on' : 'off'}">${raw(STAR)}</span>`);
  return html`<span class="stars stars-${size}" role="img" aria-label="${rating} out of 5 stars">${items}</span>`;
}

export function statusPill(status) {
  return html`<span class="pill pill-${status}">${STATUS_LABEL[status] ?? status}</span>`;
}

/** Typographic stand-in for books without a cover image. */
export function fallbackCover(book) {
  // Pick a stable tint from the title so the shelf isn't monotone.
  let hash = 0;
  for (const ch of book.title) hash = (hash * 31 + ch.codePointAt(0)) | 0;
  const tint = Math.abs(hash) % 5;
  return html`<div class="cover-fallback tint-${tint}" aria-hidden="true">
    <span class="cf-title" dir="auto">${book.title}</span>
    ${book.author ? html`<span class="cf-author" dir="auto">${book.author}</span>` : ''}
  </div>`;
}

export function coverImage(book, { size = 'sm', eager = false } = {}) {
  if (!book.cover_path) return fallbackCover(book);
  const width = size === 'sm' ? 360 : 900;
  return html`<img
    src="${coverUrl(book.cover_path, size)}"
    alt="${book.title}"
    width="${width}"
    height="${Math.round(width * 1.5)}"
    loading="${eager ? 'eager' : 'lazy'}"
    decoding="async"
    ${eager ? raw('fetchpriority="high"') : ''}
  />`;
}

export function bookCard(book) {
  const label = [
    book.title,
    book.author && `by ${book.author}`,
    book.rating && `rated ${book.rating} out of 5`,
    STATUS_LABEL[book.status],
  ]
    .filter(Boolean)
    .join(', ');
  return html`<li class="card">
    <a class="card-link" href="${path(book.slug)}" aria-label="${label}">
      <div class="cover">
        ${coverImage(book)}
        ${book.status === 'reading' ? html`<span class="cover-badge">Reading</span>` : ''}
      </div>
      <div class="card-info">
        <span class="card-title" dir="auto">${book.title}</span>
        ${book.author ? html`<span class="card-author" dir="auto">${book.author}</span>` : ''}
        ${stars(book.rating)}
      </div>
    </a>
  </li>`;
}

export function skeletonGrid(count = 12) {
  return html`<ul class="shelf" aria-hidden="true">
    ${Array.from({ length: count }, () => html`<li class="card"><div class="cover skeleton"></div></li>`)}
  </ul>`;
}

export function errorState(message, { retry = true } = {}) {
  return html`<div class="state state-error" role="alert">
    <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20"/><path d="M24 14v13M24 33v1"/></svg>
    <h2>Something went wrong</h2>
    <p>${message}</p>
    ${retry ? html`<button type="button" class="btn" data-action="retry">Try again</button>` : ''}
  </div>`;
}

export function loadingState(label = 'Loading…') {
  return html`<div class="state" role="status"><span class="spinner" aria-hidden="true"></span><p>${label}</p></div>`;
}

let toastTimer;
export function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/** Lazy-load Markdown support only on pages that render or preview it. */
let markdownLib;
export async function renderMarkdown(source) {
  markdownLib ??= Promise.all([import('marked'), import('dompurify')]);
  const [{ marked }, { default: DOMPurify }] = await markdownLib;
  const dirty = marked.parse(source ?? '', { breaks: true, gfm: true });
  const clean = DOMPurify.sanitize(dirty, { USE_PROFILES: { html: true } });
  const tpl = document.createElement('template');
  tpl.innerHTML = clean;
  for (const a of tpl.content.querySelectorAll('a[href]')) {
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }
  for (const block of tpl.content.querySelectorAll('p, li, h1, h2, h3, h4, blockquote')) {
    block.setAttribute('dir', 'auto');
  }
  return tpl.innerHTML;
}

export function notFoundState(message) {
  return html`<div class="state">
    <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 11c4.8-1.4 9.6-.8 14 2v25c-4.4-2.8-9.2-3.4-14-2zM38 11c-4.8-1.4-9.6-.8-14 2v25c4.4-2.8 9.2-3.4 14-2z"/></svg>
    <h1>Not found</h1>
    <p>${message}</p>
    <a class="btn" href="${path()}">Back to the shelf</a>
  </div>`;
}
