import { html } from '../html.js';
import * as api from '../api.js';
import { path, navigate } from '../router.js';
import { state, invalidateBooks, setTitle } from '../store.js';
import { coverImage, stars, statusPill, renderMarkdown, notFoundState, loadingState, toast } from '../ui.js';
import { formatDate } from '../util.js';

export async function renderDetail({ view, route, isCurrent }) {
  view.innerHTML = loadingState('Loading book…');

  const book = state.books?.find((b) => b.slug === route.slug) ?? (await api.getBook(route.slug));
  if (!isCurrent()) return;
  if (!book) {
    setTitle('Not found');
    view.innerHTML = notFoundState('This book isn’t on the shelf (anymore).');
    return;
  }
  setTitle(book.title);

  const facts = [
    book.date_started && ['Started', formatDate(book.date_started)],
    book.date_finished && ['Finished', formatDate(book.date_finished)],
    book.page_count && ['Pages', book.page_count.toLocaleString('en')],
  ].filter(Boolean);

  view.innerHTML = html`<article class="page detail">
    <a class="back-link" href="${path()}"><span aria-hidden="true">←</span> All books</a>

    <div class="detail-grid">
      <div class="detail-cover">${coverImage(book, { size: 'lg', eager: true })}</div>

      <div class="detail-main">
        <div class="detail-head">
          ${statusPill(book.status)}
          <h1 dir="auto">${book.title}</h1>
          ${book.author ? html`<p class="detail-author" dir="auto">${book.author}</p>` : ''}
          ${book.rating ? html`<div class="detail-rating">${stars(book.rating, { size: 'lg' })}</div>` : ''}
        </div>

        ${facts.length
          ? html`<dl class="facts">
              ${facts.map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}
            </dl>`
          : ''}

        ${book.tags?.length
          ? html`<ul class="tags" aria-label="Tags">
              ${book.tags.map(
                (t) => html`<li><a class="tag" href="${path()}?tag=${encodeURIComponent(t)}" dir="auto">${t}</a></li>`,
              )}
            </ul>`
          : ''}

        <div class="detail-actions">
          <button type="button" class="btn btn-ghost" data-share>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>
            Copy link
          </button>
          ${state.isAdmin
            ? html`<a class="btn" href="${path(book.slug, 'edit')}">Edit</a>
                <button type="button" class="btn btn-danger-ghost" data-delete>Delete</button>`
            : ''}
        </div>
      </div>
    </div>

    ${book.summary
      ? html`<section class="detail-section" aria-labelledby="summary-h">
          <h2 id="summary-h">My summary</h2>
          <div class="prose" data-summary>${loadingState('')}</div>
        </section>`
      : ''}

    ${book.quotes?.length
      ? html`<section class="detail-section" aria-labelledby="quotes-h">
          <h2 id="quotes-h">Favorite quotes</h2>
          <ul class="quotes">
            ${book.quotes.map(
              (q) => html`<li>
                <blockquote dir="auto">${q.text}</blockquote>
                ${q.page ? html`<span class="quote-page">p. ${q.page}</span>` : ''}
              </li>`,
            )}
          </ul>
        </section>`
      : ''}
  </article>

  <dialog class="dialog" aria-labelledby="del-h">
    <form method="dialog">
      <h2 id="del-h">Delete this book?</h2>
      <p>“<span dir="auto">${book.title}</span>” and its cover will be removed for good.</p>
      <p class="dialog-error" role="alert" hidden></p>
      <div class="dialog-actions">
        <button class="btn" value="cancel" autofocus>Cancel</button>
        <button class="btn btn-danger" value="delete" type="button" data-confirm>Delete</button>
      </div>
    </form>
  </dialog>`;

  if (book.summary) {
    const target = view.querySelector('[data-summary]');
    renderMarkdown(book.summary)
      .then((out) => {
        if (isCurrent()) target.innerHTML = out;
      })
      .catch(() => {
        // Markdown library failed to load: show the plain text, line breaks kept.
        if (isCurrent()) target.innerHTML = html`<p class="pre-line" dir="auto">${book.summary}</p>`;
      });
  }

  view.querySelector('[data-share]').addEventListener('click', async () => {
    const url = location.origin + path(book.slug);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: book.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Link copied');
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast(url);
    }
  });

  const dialog = view.querySelector('dialog');
  view.querySelector('[data-delete]')?.addEventListener('click', () => dialog.showModal());
  view.querySelector('[data-confirm]')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const errorEl = dialog.querySelector('.dialog-error');
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    errorEl.hidden = true;
    try {
      await api.deleteBook(book);
      invalidateBooks();
      dialog.close();
      toast('Book deleted');
      navigate(path(), { replace: true });
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Delete';
    }
  });
}
