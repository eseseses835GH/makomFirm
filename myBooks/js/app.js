import { html, raw } from './html.js';
import * as api from './api.js';
import { startRouter, match, navigate, path } from './router.js';
import { errorState, notFoundState } from './ui.js';
import { state, invalidateBooks, setTitle } from './store.js';
import { renderList } from './views/list.js';
import { renderDetail } from './views/detail.js';
import { renderStats } from './views/stats.js';
import { renderLogin } from './views/login.js';
import { renderEdit } from './views/edit.js';

const header = document.getElementById('site-header');
const view = document.getElementById('view');
let renderToken = 0;

function renderHeader(route) {
  const current = (name) => (route.name === name ? raw('aria-current="page"') : '');
  header.innerHTML = html`
    <div class="header-inner">
      <a class="brand" href="${path()}">
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 6.5c3.6-1 7.3-.6 11 1.6v18c-3.7-2.2-7.4-2.6-11-1.6zM27 6.5c-3.6-1-7.3-.6-11 1.6v18c3.7-2.2 7.4-2.6 11-1.6z"/></svg>
        <span>My Books</span>
      </a>
      <nav aria-label="My Books">
        <a href="${path()}" ${current('list')}>Shelf</a>
        <a href="${path('stats')}" ${current('stats')}>Stats</a>
        ${state.isAdmin
          ? html`<a class="btn btn-sm btn-primary" href="${path('new')}" ${current('new')}>
                <span aria-hidden="true">+</span> Add<span class="hide-xs">&nbsp;book</span>
              </a>
              <button type="button" class="link-btn" data-action="logout">Log out</button>`
          : ''}
      </nav>
    </div>`;
}

async function render() {
  const token = ++renderToken;
  const route = match(location.pathname);
  renderHeader(route);
  window.scrollTo(0, 0);

  const ctx = {
    view,
    route,
    params: new URLSearchParams(location.search),
    // A view checks this after each await so a stale render never paints.
    isCurrent: () => token === renderToken,
  };

  try {
    if (!api.isConfigured && route.name !== 'notFound') {
      view.innerHTML = errorState(
        'My Books isn’t connected to Supabase yet. Add your project URL and anon key to myBooks/js/config.js.',
        { retry: false },
      );
      setTitle('Setup needed');
      return;
    }
    switch (route.name) {
      case 'list':
        await renderList(ctx);
        break;
      case 'detail':
        await renderDetail(ctx);
        break;
      case 'stats':
        await renderStats(ctx);
        break;
      case 'login':
        await renderLogin(ctx);
        break;
      case 'new':
      case 'edit':
        if (!state.isAdmin) {
          navigate(path('login') + `?next=${encodeURIComponent(location.pathname)}`, { replace: true });
          return;
        }
        await renderEdit(ctx);
        break;
      default:
        setTitle('Not found');
        view.innerHTML = notFoundState('There’s no page at this address.');
    }
  } catch (err) {
    if (!ctx.isCurrent()) return;
    console.error(err);
    view.innerHTML = errorState(err.message || 'Unexpected error.');
  }

  // Move focus to the new content for keyboard and screen-reader users,
  // except on the first load where the browser's default is right.
  if (ctx.isCurrent() && rendered && !view.contains(document.activeElement)) {
    view.focus({ preventScroll: true });
  }
  rendered = true;
}
let rendered = false;

async function refreshAuth(session) {
  state.session = session;
  state.isAdmin = session ? await api.isAdmin() : false;
}

document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'retry') {
    invalidateBooks();
    render();
  } else if (btn.dataset.action === 'logout') {
    await api.signOut();
    await refreshAuth(null);
    navigate(path());
  }
});

// Broken cover URL → show the neutral placeholder instead of a broken icon.
document.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('.cover, .detail-cover')) return;
    const div = document.createElement('div');
    div.className = 'cover-broken';
    div.setAttribute('role', 'img');
    div.setAttribute('aria-label', img.alt);
    img.replaceWith(div);
  },
  true,
);

async function boot() {
  try {
    await refreshAuth(await api.getSession());
  } catch {
    // Reading works without a session; ignore auth hiccups here.
  }
  api.onAuthChange(async (session) => {
    const wasAdmin = state.isAdmin;
    if ((session?.user?.id ?? null) === (state.session?.user?.id ?? null)) {
      state.session = session;
      return;
    }
    await refreshAuth(session);
    if (wasAdmin !== state.isAdmin) renderHeader(match(location.pathname));
  });
  startRouter(render);
}

boot();
