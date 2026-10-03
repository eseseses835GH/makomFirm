-- Public bucket for book covers. Files are resized to WebP/JPEG in the
-- browser before upload, so 5 MB is a generous ceiling.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-covers', 'book-covers', true, 5242880, array['image/webp', 'image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve files by URL without a select policy; the policies
-- below only let admins list, upload, replace and delete.

create policy "Admins can read book cover objects"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'book-covers' and (select public.is_books_admin()));

create policy "Admins can upload book covers"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'book-covers' and (select public.is_books_admin()));

create policy "Admins can update book covers"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'book-covers' and (select public.is_books_admin()))
  with check (bucket_id = 'book-covers' and (select public.is_books_admin()));

create policy "Admins can delete book covers"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'book-covers' and (select public.is_books_admin()));
