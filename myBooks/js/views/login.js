import { html } from '../html.js';
import * as api from '../api.js';
import { path, navigate } from '../router.js';
import { state, setTitle } from '../store.js';

function safeNext(params) {
  const next = params.get('next') ?? '';
  // Only same-app paths; never an absolute or protocol-relative URL.
  return next.startsWith('/myBooks') && !next.startsWith('//') ? next : path();
}

export async function renderLogin({ view, params }) {
  setTitle('Log in');
  const next = safeNext(params);
  if (state.isAdmin) {
    navigate(next, { replace: true });
    return;
  }

  view.innerHTML = html`<section class="page login">
    <form class="card-panel login-panel" novalidate>
      <h1>Log in</h1>
      <p class="subtle">Only the owner can add or edit books.</p>
      <div class="field">
        <label for="l-user">Username</label>
        <input id="l-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required />
      </div>
      <div class="field">
        <label for="l-pass">Password</label>
        <input id="l-pass" name="password" type="password" autocomplete="current-password" required />
      </div>
      <p class="form-error" role="alert" hidden></p>
      <button class="btn btn-primary btn-block" type="submit">Log in</button>
    </form>
  </section>`;

  const form = view.querySelector('form');
  const errorEl = form.querySelector('.form-error');
  const submit = form.querySelector('button[type="submit"]');
  form.username.focus();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = form.username.value.trim();
    const password = form.password.value;
    errorEl.hidden = true;
    if (!username || !password) {
      errorEl.textContent = 'Enter your username and password.';
      errorEl.hidden = false;
      (username ? form.password : form.username).focus();
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Logging in…';
    try {
      await api.signIn(username, password);
      state.session = await api.getSession();
      state.isAdmin = await api.isAdmin();
      if (!state.isAdmin) {
        await api.signOut();
        state.session = null;
        throw new Error('This account isn’t allowed to edit books.');
      }
      navigate(next, { replace: true });
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.hidden = false;
      submit.disabled = false;
      submit.textContent = 'Log in';
      form.password.select();
    }
  });
}
