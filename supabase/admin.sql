-- Make your login account the My Books admin. Run once, AFTER the migrations
-- and AFTER creating the user (Dashboard -> Authentication -> Users ->
-- Add user -> Create new user, email "<username>@tagidmaze.com",
-- "Auto Confirm User" checked).
--
-- You log in on /myBooks/login with just the username; the app adds
-- "@tagidmaze.com" for you. No email is ever sent to that address.
--
-- Replace YOUR_USERNAME below, then run this in the SQL editor.

insert into public.book_admins (user_id)
select id from auth.users where email = lower('YOUR_USERNAME@tagidmaze.com')
on conflict do nothing
returning user_id;  -- should return exactly one row; zero rows = user not found
