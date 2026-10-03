import { html, raw } from '../html.js';
import * as api from '../api.js';
import { path, navigate, setGuard } from '../router.js';
import { loadBooks, invalidateBooks, setTitle } from '../store.js';
import { prepareCover } from '../image.js';
import { loadingState, notFoundState, renderMarkdown, toast } from '../ui.js';
import { STATUSES, addTag, tagCounts, todayISO, validateBook } from '../util.js';

const STAR =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>';

const err = (id) => html`<p class="field-error" id="err-${id}" hidden></p>`;

function quoteRow(q = { text: '', page: null }, i) {
  return html`<li class="quote-row">
    <div class="field grow">
      <label for="q-text-${i}" class="sr-only">Quote ${i + 1}</label>
      <textarea id="q-text-${i}" name="quote-text" rows="2" dir="auto" placeholder="A line worth keeping…" aria-describedby="err-quote-${i}">${q.text}</textarea>
    </div>
    <div class="field page-field">
      <label for="q-page-${i}" class="sr-only">Page for quote ${i + 1}</label>
      <input id="q-page-${i}" name="quote-page" type="number" inputmode="numeric" min="1" placeholder="Page" value="${q.page ?? ''}" />
    </div>
    <button type="button" class="icon-btn" data-remove-quote aria-label="Remove quote ${i + 1}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
    </button>
    <p class="field-error" id="err-quote-${i}" hidden></p>
  </li>`;
}

export async function renderEdit({ view, route, isCurrent }) {
  const isNew = route.name === 'new';
  setTitle(isNew ? 'Add a book' : 'Edit book');
  view.innerHTML = loadingState();

  const books = await loadBooks();
  if (!isCurrent()) return;
  const book = isNew ? null : books.find((b) => b.slug === route.slug);
  if (!isNew && !book) {
    view.innerHTML = notFoundState('This book isn’t on the shelf.');
    return;
  }

  const b = book ?? { status: 'reading', tags: [], quotes: [] };
  let tags = [...(b.tags ?? [])];
  let cover = { path: b.cover_path ?? null, pending: null, removed: false };
  const knownTags = tagCounts(books).map((t) => t.tag);

  view.innerHTML = html`<section class="page edit">
    <a class="back-link" href="${isNew ? path() : path(b.slug)}"><span aria-hidden="true">←</span> ${isNew ? 'All books' : 'Back to book'}</a>
    <h1>${isNew ? 'Add a book' : 'Edit book'}</h1>

    <form class="book-form" novalidate>
      <div class="form-layout">
        <div class="form-cover">
          <span class="label" id="cover-label">Cover</span>
          <label class="cover-drop" for="f-cover">
            <span class="cover-preview" aria-hidden="true"></span>
            <span class="cover-hint">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>
              <span>Choose an image<br /><small>or drop it here</small></span>
            </span>
          </label>
          <input id="f-cover" class="sr-only" type="file" accept="image/*" aria-labelledby="cover-label" aria-describedby="err-cover" />
          <button type="button" class="link-btn" data-remove-cover hidden>Remove cover</button>
          ${err('cover')}
        </div>

        <div class="form-fields">
          <div class="field">
            <label for="f-title">Title <span class="req" aria-hidden="true">*</span></label>
            <input id="f-title" name="title" required dir="auto" value="${b.title ?? ''}" aria-describedby="err-title" maxlength="300" />
            ${err('title')}
          </div>
          <div class="field">
            <label for="f-author">Author</label>
            <input id="f-author" name="author" dir="auto" value="${b.author ?? ''}" aria-describedby="err-author" maxlength="300" />
            ${err('author')}
          </div>

          <fieldset class="field">
            <legend>Status</legend>
            <div class="segmented">
              ${STATUSES.map(
                (s) => html`<label><input type="radio" name="status" value="${s.value}" ${b.status === s.value ? 'checked' : ''} /><span>${s.label}</span></label>`,
              )}
            </div>
          </fieldset>

          <div class="field-row">
            <div class="field">
              <label for="f-started">Date started</label>
              <input id="f-started" name="date_started" type="date" value="${b.date_started ?? ''}" aria-describedby="err-date_started" />
              ${err('date_started')}
            </div>
            <div class="field">
              <label for="f-finished">Date finished</label>
              <input id="f-finished" name="date_finished" type="date" value="${b.date_finished ?? ''}" aria-describedby="err-date_finished" />
              ${err('date_finished')}
            </div>
          </div>

          <div class="field-row">
            <fieldset class="field">
              <legend>Rating <span class="optional">optional</span></legend>
              <div class="star-input">
                ${[5, 4, 3, 2, 1].map(
                  (n) => html`<input type="radio" id="f-r${n}" name="rating" value="${n}" ${b.rating === n ? 'checked' : ''} />
                    <label for="f-r${n}" title="${n} ${n === 1 ? 'star' : 'stars'}"><span class="sr-only">${n} ${n === 1 ? 'star' : 'stars'}</span>${raw(STAR)}</label>`,
                )}
                <input type="radio" id="f-r0" name="rating" value="" ${b.rating ? '' : 'checked'} />
                <label for="f-r0" class="star-clear">No rating</label>
              </div>
            </fieldset>
            <div class="field">
              <label for="f-pages">Pages <span class="optional">optional</span></label>
              <input id="f-pages" name="page_count" type="number" inputmode="numeric" min="1" max="100000" value="${b.page_count ?? ''}" aria-describedby="err-page_count" />
              ${err('page_count')}
            </div>
          </div>

          <div class="field">
            <label for="f-tag">Tags</label>
            <div class="tag-input">
              <ul class="tag-chips" aria-label="Selected tags"></ul>
              <input id="f-tag" list="tag-options" placeholder="Add a tag and press Enter" autocomplete="off" dir="auto" aria-describedby="tag-help" />
              <datalist id="tag-options">${knownTags.map((t) => html`<option value="${t}"></option>`)}</datalist>
            </div>
            <p class="help" id="tag-help">Press Enter or comma to add. Existing tags are suggested as you type.</p>
          </div>
        </div>
      </div>

      <div class="field">
        <div class="label-row">
          <label for="f-summary">My summary</label>
          <div class="tabs" role="tablist" aria-label="Summary editor">
            <button type="button" role="tab" aria-selected="true" aria-controls="f-summary" data-tab="write">Write</button>
            <button type="button" role="tab" aria-selected="false" aria-controls="summary-preview" data-tab="preview">Preview</button>
          </div>
        </div>
        <textarea id="f-summary" name="summary" rows="10" dir="auto" aria-describedby="summary-help">${b.summary ?? ''}</textarea>
        <div id="summary-preview" class="prose preview" role="tabpanel" hidden></div>
        <p class="help" id="summary-help">Markdown supported: **bold**, *italic*, lists, &gt; quotes, [links](https://…).</p>
      </div>

      <fieldset class="field">
        <legend>Favorite quotes</legend>
        <ul class="quote-list">${(b.quotes ?? []).map(quoteRow)}</ul>
        <button type="button" class="btn btn-ghost btn-sm" data-add-quote><span aria-hidden="true">+</span> Add quote</button>
      </fieldset>

      <p class="form-error" role="alert" hidden></p>

      <div class="form-actions">
        ${isNew ? '' : html`<button type="button" class="btn btn-danger-ghost" data-delete>Delete book</button>`}
        <span class="spacer"></span>
        <a class="btn btn-ghost" href="${isNew ? path() : path(b.slug)}">Cancel</a>
        <button type="submit" class="btn btn-primary">${isNew ? 'Add book' : 'Save changes'}</button>
      </div>
    </form>
  </section>

  <dialog class="dialog" aria-labelledby="del-h">
    <form method="dialog">
      <h2 id="del-h">Delete this book?</h2>
      <p>It will be removed from the shelf along with its cover. This can’t be undone.</p>
      <p class="dialog-error" role="alert" hidden></p>
      <div class="dialog-actions">
        <button class="btn" value="cancel" autofocus>Cancel</button>
        <button class="btn btn-danger" type="button" data-confirm>Delete</button>
      </div>
    </form>
  </dialog>`;

  const form = view.querySelector('form.book-form');
  const submitBtn = form.querySelector('button[type="submit"]');
  const formError = form.querySelector('.form-error');
  let dirty = false;
  let saving = false;

  // ---------- Unsaved-changes protection ----------
  const beforeUnload = (e) => {
    if (dirty && !saving) e.preventDefault();
  };
  window.addEventListener('beforeunload', beforeUnload);
  setGuard(() => {
    if (dirty && !saving && !confirm('Discard your unsaved changes?')) return false;
    window.removeEventListener('beforeunload', beforeUnload);
    if (cover.pending) URL.revokeObjectURL(cover.pending.previewUrl);
    return true;
  });
  form.addEventListener('input', () => (dirty = true));

  // ---------- Cover ----------
  const preview = form.querySelector('.cover-preview');
  const drop = form.querySelector('.cover-drop');
  const fileInput = form.querySelector('#f-cover');
  const removeCoverBtn = form.querySelector('[data-remove-cover]');

  function showCover() {
    const url = cover.pending?.previewUrl ?? (!cover.removed && cover.path ? api.coverUrl(cover.path, 'lg') : '');
    preview.innerHTML = url ? html`<img src="${url}" alt="" />` : '';
    drop.classList.toggle('has-image', Boolean(url));
    removeCoverBtn.hidden = !url;
  }

  async function takeFile(file) {
    if (!file) return;
    const errEl = form.querySelector('#err-cover');
    errEl.hidden = true;
    drop.classList.add('busy');
    try {
      const prepared = await prepareCover(file);
      if (cover.pending) URL.revokeObjectURL(cover.pending.previewUrl);
      cover = { ...cover, pending: prepared, removed: false };
      dirty = true;
      showCover();
    } catch (e) {
      errEl.textContent = e.message;
      errEl.hidden = false;
    } finally {
      drop.classList.remove('busy');
      fileInput.value = '';
    }
  }

  fileInput.addEventListener('change', () => takeFile(fileInput.files[0]));
  removeCoverBtn.addEventListener('click', () => {
    if (cover.pending) URL.revokeObjectURL(cover.pending.previewUrl);
    cover = { ...cover, pending: null, removed: true };
    dirty = true;
    showCover();
    fileInput.focus();
  });
  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, (e) => {
      e.preventDefault();
      drop.classList.add('dragging');
    });
  }
  for (const type of ['dragleave', 'drop']) {
    drop.addEventListener(type, () => drop.classList.remove('dragging'));
  }
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    takeFile(e.dataTransfer.files[0]);
  });
  showCover();

  // ---------- Tags ----------
  const chips = form.querySelector('.tag-chips');
  const tagInput = form.querySelector('#f-tag');

  function showTags() {
    chips.innerHTML = html`${tags.map(
      (t, i) => html`<li class="tag tag-chip"><span dir="auto">${t}</span><button type="button" data-remove-tag="${i}" aria-label="Remove tag ${t}">×</button></li>`,
    )}`;
  }
  function commitTag() {
    const before = tags.length;
    tags = addTag(tags, tagInput.value.replace(/,/g, ''));
    tagInput.value = '';
    if (tags.length !== before) {
      dirty = true;
      showTags();
    }
  }
  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag();
    } else if (e.key === 'Backspace' && !tagInput.value && tags.length) {
      tags = tags.slice(0, -1);
      dirty = true;
      showTags();
    }
  });
  // Picking a datalist suggestion fires "input" with the full value.
  tagInput.addEventListener('input', (e) => {
    if (e.inputType === 'insertReplacementText' || (!e.inputType && knownTags.includes(tagInput.value))) {
      commitTag();
    } else if (tagInput.value.includes(',')) {
      commitTag();
    }
  });
  tagInput.addEventListener('blur', commitTag);
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-tag]');
    if (!btn) return;
    tags = tags.filter((_, i) => i !== Number(btn.dataset.removeTag));
    dirty = true;
    showTags();
    tagInput.focus();
  });
  showTags();

  // ---------- Status → helpful date defaults ----------
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'status') return;
    if (e.target.value === 'reading' && !form.date_started.value) form.date_started.value = todayISO();
    if (e.target.value === 'finished' && !form.date_finished.value) form.date_finished.value = todayISO();
  });

  // ---------- Summary preview ----------
  const summary = form.querySelector('#f-summary');
  const previewPanel = form.querySelector('#summary-preview');
  form.querySelector('.tabs').addEventListener('click', async (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    const showPreview = tab.dataset.tab === 'preview';
    for (const t of form.querySelectorAll('[data-tab]')) t.setAttribute('aria-selected', String(t === tab));
    summary.hidden = showPreview;
    previewPanel.hidden = !showPreview;
    if (showPreview) {
      previewPanel.innerHTML = summary.value.trim()
        ? await renderMarkdown(summary.value).catch(() => html`<p class="pre-line">${summary.value}</p>`)
        : html`<p class="subtle">Nothing to preview yet.</p>`;
    }
  });

  // ---------- Quotes ----------
  const quoteList = form.querySelector('.quote-list');
  function renumberQuotes() {
    [...quoteList.children].forEach((li, i) => {
      li.querySelector('textarea').id = `q-text-${i}`;
      li.querySelector('textarea').setAttribute('aria-describedby', `err-quote-${i}`);
      li.querySelector('label[for^="q-text"]').htmlFor = `q-text-${i}`;
      li.querySelector('label[for^="q-text"]').textContent = `Quote ${i + 1}`;
      li.querySelector('input').id = `q-page-${i}`;
      li.querySelector('label[for^="q-page"]').htmlFor = `q-page-${i}`;
      li.querySelector('label[for^="q-page"]').textContent = `Page for quote ${i + 1}`;
      li.querySelector('[data-remove-quote]').setAttribute('aria-label', `Remove quote ${i + 1}`);
      li.querySelector('.field-error').id = `err-quote-${i}`;
    });
  }
  form.querySelector('[data-add-quote]').addEventListener('click', () => {
    quoteList.insertAdjacentHTML('beforeend', quoteRow(undefined, quoteList.children.length).toString());
    quoteList.lastElementChild.querySelector('textarea').focus();
  });
  quoteList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove-quote]');
    if (!btn) return;
    const li = btn.closest('li');
    const next = li.nextElementSibling ?? li.previousElementSibling;
    li.remove();
    renumberQuotes();
    dirty = true;
    (next?.querySelector('textarea') ?? form.querySelector('[data-add-quote]')).focus();
  });

  // ---------- Validation + save ----------
  function readForm() {
    const data = new FormData(form);
    return {
      title: data.get('title'),
      author: data.get('author'),
      status: data.get('status'),
      date_started: data.get('date_started'),
      date_finished: data.get('date_finished'),
      rating: data.get('rating'),
      page_count: data.get('page_count'),
      summary: data.get('summary'),
      tags,
      quotes: [...quoteList.children].map((li) => ({
        text: li.querySelector('textarea').value,
        page: li.querySelector('input').value,
      })),
    };
  }

  function showErrors(errors) {
    for (const el of form.querySelectorAll('.field-error:not(#err-cover)')) {
      el.hidden = true;
      el.textContent = '';
    }
    for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');
    let first = null;
    for (const [key, message] of Object.entries(errors)) {
      const errEl = form.querySelector(`#err-${key}`);
      if (!errEl) continue;
      errEl.textContent = message;
      errEl.hidden = false;
      const input = form.querySelector(`[aria-describedby~="err-${key}"]`);
      input?.setAttribute('aria-invalid', 'true');
      first ??= input;
    }
    return first;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (saving) return;
    formError.hidden = true;
    commitTag();
    const { errors, value } = validateBook(readForm());
    // Number inputs report "" for junk like "1e"; badInput catches that.
    if (form.page_count.validity.badInput) errors.page_count = 'Pages must be a number.';
    const firstInvalid = showErrors(errors);
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    saving = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';
    let uploaded = null;
    try {
      if (cover.pending) {
        submitBtn.textContent = 'Uploading cover…';
        uploaded = await api.uploadCover(cover.pending);
        submitBtn.textContent = 'Saving…';
      }
      const coverPath = uploaded ?? (cover.removed ? null : cover.path);
      const saved = isNew
        ? await api.createBook({ ...value, cover_path: coverPath })
        : await api.updateBook(b.id, { ...value, cover_path: coverPath });

      // Old cover replaced or removed → clean up its files (best effort).
      if (cover.path && cover.path !== coverPath) api.removeCover(cover.path).catch(() => {});
      if (cover.pending) URL.revokeObjectURL(cover.pending.previewUrl);

      invalidateBooks();
      dirty = false;
      window.removeEventListener('beforeunload', beforeUnload);
      toast(isNew ? 'Book added' : 'Changes saved');
      navigate(path(saved.slug), { replace: true });
    } catch (e2) {
      if (uploaded) api.removeCover(uploaded).catch(() => {});
      formError.textContent = e2.message;
      formError.hidden = false;
      saving = false;
      submitBtn.disabled = false;
      submitBtn.textContent = isNew ? 'Add book' : 'Save changes';
    }
  });

  // ---------- Delete ----------
  const dialog = view.querySelector('dialog');
  form.querySelector('[data-delete]')?.addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-confirm]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const errEl = dialog.querySelector('.dialog-error');
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    try {
      await api.deleteBook(b);
      invalidateBooks();
      dirty = false;
      window.removeEventListener('beforeunload', beforeUnload);
      dialog.close();
      toast('Book deleted');
      navigate(path(), { replace: true });
    } catch (e2) {
      errEl.textContent = e2.message;
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  });

  if (isNew) form.elements.title.focus();
}
