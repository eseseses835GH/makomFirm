-- My Books: books table, admin list and Row Level Security.
-- Everyone can read; only users listed in public.book_admins can write.

create type public.book_status as enum ('want_to_read', 'reading', 'finished');

create table public.books (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null,
  author        text,
  status        public.book_status not null default 'want_to_read',
  date_started  date,
  date_finished date,
  rating        smallint,
  summary       text,
  quotes        jsonb not null default '[]'::jsonb,
  tags          text[] not null default '{}',
  page_count    integer,
  cover_path    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint books_title_not_blank check (length(btrim(title)) between 1 and 300),
  constraint books_author_length check (author is null or length(author) <= 300),
  -- URL-safe and not colliding with the app's own routes (/myBooks/stats etc.)
  constraint books_slug_format check (
    slug ~ '^[^/?#\s]{1,120}$'
    and slug not in ('stats', 'login', 'logout', 'new', 'edit')
  ),
  constraint books_rating_range check (rating is null or rating between 1 and 5),
  constraint books_page_count_range check (page_count is null or page_count between 1 and 100000),
  constraint books_dates_order check (
    date_started is null or date_finished is null or date_finished >= date_started
  ),
  constraint books_quotes_is_array check (jsonb_typeof(quotes) = 'array'),
  constraint books_summary_length check (summary is null or length(summary) <= 100000)
);

create index books_status_idx on public.books (status);
create index books_date_finished_idx on public.books (date_finished desc nulls last);
create index books_tags_idx on public.books using gin (tags);

-- Keep updated_at current on every update.
create function public.books_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger books_set_updated_at
before update on public.books
for each row execute function public.books_set_updated_at();

-- Who may write. Rows are added manually (see supabase/admin.sql).
-- RLS is on with no policies, so this table is invisible through the API.
create table public.book_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.book_admins enable row level security;

create function public.is_books_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.book_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_books_admin() from public;
grant execute on function public.is_books_admin() to anon, authenticated;

-- Row Level Security: public read, admin-only writes.
alter table public.books enable row level security;

create policy "Books are readable by everyone"
  on public.books for select
  to anon, authenticated
  using (true);

create policy "Admins can insert books"
  on public.books for insert
  to authenticated
  with check ((select public.is_books_admin()));

create policy "Admins can update books"
  on public.books for update
  to authenticated
  using ((select public.is_books_admin()))
  with check ((select public.is_books_admin()));

create policy "Admins can delete books"
  on public.books for delete
  to authenticated
  using ((select public.is_books_admin()));
