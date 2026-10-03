// Shared app state. Views read and update it through these helpers.
import { listBooks } from './api.js';

export const state = {
  session: null,
  isAdmin: false,
  books: null, // cached list; null = not loaded yet
};

export async function loadBooks({ force = false } = {}) {
  if (!state.books || force) state.books = await listBooks();
  return state.books;
}

export function invalidateBooks() {
  state.books = null;
}

export function setTitle(title) {
  document.title = title ? `${title} · My Books` : 'My Books';
}
