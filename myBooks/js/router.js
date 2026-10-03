// History-API router for everything under /myBooks.

export const BASE = '/myBooks';

/** Build an app URL from path segments, e.g. path('my-book', 'edit'). */
export function path(...segments) {
  const rest = segments.filter(Boolean).map(encodeURIComponent).join('/');
  return rest ? `${BASE}/${rest}` : `${BASE}/`;
}

/** Match a pathname to a route: { name, slug? } */
export function match(pathname) {
  const lower = pathname.toLowerCase();
  if (!lower.startsWith(BASE.toLowerCase())) return { name: 'notFound' };
  const parts = pathname
    .slice(BASE.length)
    .split('/')
    .filter(Boolean)
    .map((p) => {
      try {
        return decodeURIComponent(p);
      } catch {
        return p;
      }
    });
  if (parts.length === 0) return { name: 'list' };
  if (parts.length === 1 && ['stats', 'login', 'new'].includes(parts[0])) {
    return { name: parts[0] };
  }
  if (parts.length === 1) return { name: 'detail', slug: parts[0] };
  if (parts.length === 2 && parts[1] === 'edit') return { name: 'edit', slug: parts[0] };
  return { name: 'notFound' };
}

let onRoute = () => {};
let guard = null;

/** A guard returns false to cancel navigation (e.g. unsaved form changes). */
export function setGuard(fn) {
  guard = fn;
}

export function navigate(url, { replace = false } = {}) {
  if (guard && !guard()) return;
  guard = null;
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  onRoute();
}

export function startRouter(render) {
  onRoute = render;

  // GitHub Pages fallback: 404.html stashes the real URL and loads /myBooks/.
  const stashed = sessionStorage.getItem('mybooks:redirect');
  if (stashed) {
    sessionStorage.removeItem('mybooks:redirect');
    history.replaceState(null, '', stashed);
  }
  // Accept /mybooks, /MYBOOKS… but always show the canonical casing.
  const { pathname, search, hash } = location;
  if (pathname.toLowerCase().startsWith(BASE.toLowerCase()) && !pathname.startsWith(BASE)) {
    history.replaceState(null, '', BASE + pathname.slice(BASE.length) + search + hash);
  }

  window.addEventListener('popstate', () => {
    guard = null;
    onRoute();
  });

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    const a = e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith(BASE)) return;
    e.preventDefault();
    if (url.pathname + url.search === location.pathname + location.search) return;
    navigate(url.pathname + url.search + url.hash);
  });

  onRoute();
}
