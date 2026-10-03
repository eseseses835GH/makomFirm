import { html } from '../html.js';
import { path } from '../router.js';
import { loadBooks, setTitle } from '../store.js';
import { coverImage, loadingState, stars } from '../ui.js';
import { computeStats } from '../util.js';

function niceMax(n) {
  if (n <= 4) return 4;
  const step = n <= 10 ? 2 : n <= 25 ? 5 : 10;
  return Math.ceil(n / step) * step;
}

function yearChart(perYear) {
  if (!perYear.length) {
    return html`<p class="subtle">Finish a book (with a finish date) to start the chart.</p>`;
  }
  const max = niceMax(Math.max(...perYear.map((d) => d.count)));
  const ticks = [max, max / 2, 0];
  return html`<div class="chart" role="group" aria-label="Books finished per year">
      <div class="chart-grid" aria-hidden="true">
        ${ticks.map((t) => html`<div class="tick"><span>${t}</span></div>`)}
      </div>
      <ol class="bars">
        ${perYear.map(
          (d) => html`<li class="bar-col" tabindex="0" aria-label="${d.year}: ${d.count} ${d.count === 1 ? 'book' : 'books'}">
            <div class="bar-track">
              <div class="bar" style="--h:${(d.count / max) * 100}%">
                ${d.count ? html`<span class="bar-value">${d.count}</span>` : ''}
              </div>
            </div>
            <span class="bar-label">${d.year}</span>
          </li>`,
        )}
      </ol>
    </div>
    <details class="table-toggle">
      <summary>Show as table</summary>
      <table>
        <thead><tr><th scope="col">Year</th><th scope="col">Books finished</th></tr></thead>
        <tbody>${perYear.map((d) => html`<tr><td>${d.year}</td><td>${d.count}</td></tr>`)}</tbody>
      </table>
    </details>`;
}

export async function renderStats({ view, isCurrent }) {
  setTitle('Stats');
  view.innerHTML = loadingState('Crunching numbers…');
  const books = await loadBooks();
  if (!isCurrent()) return;
  const s = computeStats(books);
  const maxTag = s.topTags[0]?.count ?? 1;

  view.innerHTML = html`<section class="page stats">
    <div class="page-head">
      <h1>Reading stats</h1>
      <p class="subtle">${s.total} ${s.total === 1 ? 'book' : 'books'} tracked</p>
    </div>

    <dl class="tiles">
      <div class="tile"><dt>Books finished</dt><dd>${s.finishedCount}</dd></div>
      <div class="tile"><dt>Pages read</dt><dd>${s.pagesRead.toLocaleString('en')}</dd></div>
      <div class="tile">
        <dt>Average rating</dt>
        <dd>${s.avgRating ?? '—'}${s.avgRating ? html`<span class="tile-unit"> / 5</span>` : ''}</dd>
        ${s.ratedCount ? html`<span class="tile-note">from ${s.ratedCount} rated</span>` : ''}
      </div>
      <div class="tile"><dt>Reading now</dt><dd>${s.currentlyReading.length}</dd></div>
    </dl>

    <div class="stats-grid">
      <section class="card-panel stats-chart" aria-labelledby="year-h">
        <h2 id="year-h">Finished per year</h2>
        ${yearChart(s.finishedPerYear)}
        ${s.undatedFinished
          ? html`<p class="subtle small">${s.undatedFinished} finished ${s.undatedFinished === 1 ? 'book has' : 'books have'} no finish date and ${s.undatedFinished === 1 ? 'isn’t' : 'aren’t'} counted here.</p>`
          : ''}
      </section>

      <section class="card-panel" aria-labelledby="tags-h">
        <h2 id="tags-h">Top tags</h2>
        ${s.topTags.length
          ? html`<ol class="tag-bars">
              ${s.topTags.map(
                (t) => html`<li>
                  <a href="${path()}?tag=${encodeURIComponent(t.tag)}">
                    <span class="tag-name" dir="auto">${t.tag}</span>
                    <span class="tag-meter" aria-hidden="true"><span style="--w:${(t.count / maxTag) * 100}%"></span></span>
                    <span class="tag-count">${t.count}</span>
                  </a>
                </li>`,
              )}
            </ol>`
          : html`<p class="subtle">No tags yet.</p>`}
      </section>
    </div>

    <section class="stats-reading" aria-labelledby="reading-h">
      <h2 id="reading-h">Currently reading</h2>
      ${s.currentlyReading.length
        ? html`<ul class="reading-list">
            ${s.currentlyReading.map(
              (b) => html`<li>
                <a href="${path(b.slug)}">
                  <div class="cover">${coverImage(b)}</div>
                  <div>
                    <span class="card-title" dir="auto">${b.title}</span>
                    ${b.author ? html`<span class="card-author" dir="auto">${b.author}</span>` : ''}
                    ${stars(b.rating)}
                  </div>
                </a>
              </li>`,
            )}
          </ul>`
        : html`<p class="subtle">Nothing on the nightstand right now.</p>`}
    </section>
  </section>`;
}
