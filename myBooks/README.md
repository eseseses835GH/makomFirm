# My Books (`/myBooks`)

A private-to-edit, public-to-read reading list. Plain HTML/CSS/ES modules, no build step.
Data lives in Supabase (Postgres + Storage + Auth). It is **not linked from the home page**.

| URL | Page |
| --- | --- |
| `/myBooks` | Shelf: filter by status/tag, search, sort |
| `/myBooks/<slug>` | Book page (share this link with friends) |
| `/myBooks/stats` | Reading stats |
| `/myBooks/login` | Owner login (username + password) |
| `/myBooks/new`, `/myBooks/<slug>/edit` | Add / edit (owner only) |

## One-time Supabase setup

1. **Create a project** at <https://supabase.com/dashboard>.
2. **Run the migrations**, either way works:
   - **CLI** (recommended, keeps future migrations in order):
     ```sh
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npx supabase db push
     ```
   - **or** paste each file from `supabase/migrations/` (in name order) into
     Dashboard → SQL Editor → Run.
3. **Turn off sign-ups**: Authentication → Sign In / Providers → disable
   "Allow new users to sign up".
4. **Create your login**: Authentication → Users → Add user → Create new user
   - Email: `<your-username>@tagidmaze.com` (never emailed; it's just your username)
   - Password: your password
   - ✅ Auto Confirm User
5. **Make it the admin**: edit `YOUR_USERNAME` in `supabase/admin.sql` and run it in the
   SQL Editor. It must return one row.
6. **Connect the site**: Project Settings → API (API Keys). Copy the **Project URL** and the
   **anon / publishable** key into `myBooks/js/config.js`.
   Never use the `service_role` / secret key anywhere in this repo.

Then commit `config.js` and deploy (just push; it's a static site).

## Logging in

Go to `tagidmaze.com/myBooks/login` and enter your username (the part before
`@tagidmaze.com`) and password. You stay logged in on that browser until you click
**Log out**. "Add book", "Edit" and "Delete" only appear while you're logged in. Writes are
enforced by Row Level Security in the database, not just hidden in the UI.

To change your password: Authentication → Users → your user → Reset/Update password.

## How it works

- **Security:** RLS on `books`: everyone can `select`; only users in `book_admins` can
  insert/update/delete. The `book-covers` bucket is public-read, admin-write.
- **Covers** are resized in the browser to WebP (JPEG fallback): 900px for the book
  page and 360px for the grid. Grid covers are lazy-loaded.
- **Slugs** are generated from the title on creation (Hebrew is kept) and never change,
  so links you've shared keep working.
- **Clean URLs:** GitHub Pages uses the root `404.html` to hand `/myBooks/...` deep links
  to the app. Netlify/Cloudflare use `_redirects`; Vercel uses `vercel.json`.
- **Markdown** in summaries is rendered with `marked` and sanitized with `DOMPurify`, both
  loaded only when needed.

## Tests

```sh
npm test   # node --test, no dependencies
```
