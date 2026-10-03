import { html, raw } from '../html.js';
import { path } from '../router.js';
import { state, loadBooks, setTitle } from '../store.js';
import { bookCard, skeletonGrid } from '../ui.js';
import { STATUSES, SORTS, filterBooks, sortBooks, tagCounts } from '../util.js';

const EMPTY_ART = `<svg class="empty-art" viewBox="0 0 160 110" aria-hidden="true">
  <path class="shelf-line" d="M8 100h144"/>
  <rect x="26" y="34" width="18" height="66" rx="2"/>
  <rect x="47" y="22" width="22" height="78" rx="2"/>
  <rect x="72" y="44" width="16" height="56" rx="2"/>
  <rect class="tilt" x="96" y="30" width="20" height="72" rx="2" transform="rotate(14 106 100)"/>
</svg>`;

function readFilters(params) {
  const status = STATUSES.some((s) => s.value === params.get('status')) ? params.get('status') : '';
  const sort = SORTS.some((s) => s.value === params.get('sort')) ? params.get('sort') : 'added';
  return { status, tag: params.get('tag') ?? '', q: params.get('q') ?? '', sort };
}

function writeFilters(filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.tag) params.set('tag', filters.tag);
  if (filters.sort !== 'added') params.set('sort', filters.sort);
  const qs = params.toString();
  // replaceState: filtering shouldn't flood the back button.
  history.replaceState(null, '', path() + (qs ? `?${qs}` : ''));
}

export async function renderList({ view, params, isCurrent }) {
  setTitle('');
  view.innerHTML = html`<section class="page">
    <div class="page-head"><h1>My Books</h1></div>
    ${skeletonGrid()}
  </section>`;

  const books = await loadBooks();
  if (!isCurrent()) return;

  if (books.length === 0) {
    view.innerHTML = html`<section class="page">
      <div class="state state-empty">
        ${raw(EMPTY_ART)}
        <h1>The shelf is empty — for now</h1>
        <p>Books will appear here as they’re added.</p>
        ${state.isAdmin ? html`<a class="btn btn-primary" href="${path('new')}">Add your first book</a>` : ''}
      </div>
    </section>`;
    return;
  }

  const filters = readFilters(params);
  const tags = tagCounts(books);
  const counts = Object.fromEntries(STATUSES.map((s) => [s.value, books.filter((b) => b.status === s.value).length]));

  view.innerHTML = html`<section class="page">
    <div class="page-head">
      <h1>My Books</h1>
      <p class="subtle">${books.length} ${books.length === 1 ? 'book' : 'books'} on the shelf</p>
    </div>

    <form class="toolbar" role="search" aria-label="Filter books">
      <div class="search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>
        <label class="sr-only" for="f-q">Search by title or author</label>
        <input id="f-q" name="q" type="search" placeholder="Search title or author" value="${filters.q}" autocomplete="off" dir="auto" />
      </div>

      <fieldset class="chips">
        <legend class="sr-only">Status</legend>
        ${[{ value: '', label: 'All' }, ...STATUSES].map(
          (s) => html`<label class="chip">
            <input type="radio" name="status" value="${s.value}" ${filters.status === s.value ? 'checked' : ''} />
            <span>${s.label}<span class="chip-count">${s.value ? counts[s.value] : books.length}</span></span>
          </label>`,
        )}
      </fieldset>

      <div class="selects">
        <label class="select">
          <span class="sr-only">Tag</span>
          <select name="tag">
            <option value="">All tags</option>
            ${tags.map(
              (t) => html`<option value="${t.tag}" ${t.tag.toLowerCase() === filters.tag.toLowerCase() ? 'selected' : ''}>${t.tag} (${t.count})</option>`,
            )}
          </select>
        </label>
        <label class="select">
          <span class="sr-only">Sort by</span>
          <select name="sort">
            ${SORTS.map((s) => html`<option value="${s.value}" ${filters.sort === s.value ? 'selected' : ''}>${s.label}</option>`)}
          </select>
        </label>
      </div>
    </form>

    <p class="result-count sr-only" aria-live="polite"></p>
    <div class="results"></div>
  </section>`;

  const form = view.querySelector('.toolbar');
  const results = view.querySelector('.results');
  const live = view.querySelector('.result-count');

  function update() {
    const data = new FormData(form);
    Object.assign(filters, {
      q: String(data.get('q') ?? '').trim(),
      status: String(data.get('status') ?? ''),
      tag: String(data.get('tag') ?? ''),
      sort: String(data.get('sort') ?? 'added'),
    });
    writeFilters(filters);
    const shown = sortBooks(filterBooks(books, filters), filters.sort);
    live.textContent = `${shown.length} of ${books.length} books shown`;
    results.innerHTML = shown.length
      ? html`<ul class="shelf">${shown.map(bookCard)}</ul>`
      : html`<div class="state state-empty compact">
          <h2>No books match</h2>
          <p>Try a different search or filter.</p>
          <button type="button" class="btn" data-clear>Clear filters</button>
        </div>`;
  }

  let debounce;
  form.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(update, e.target.name === 'q' ? 160 : 0);
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  results.addEventListener('click', (e) => {
    if (!e.target.closest('[data-clear]')) return;
    form.q.value = '';
    form.querySelector('input[name="status"][value=""]').checked = true;
    form.tag.value = '';
    form.sort.value = 'added';
    update();
    form.q.focus();
  });

  update();
}
