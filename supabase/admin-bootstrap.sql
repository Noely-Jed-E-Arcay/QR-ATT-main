-- Run this ONCE in the Supabase SQL Editor after the administrator
-- account has already been created through Supabase Authentication.
--
-- Replace the email below with the existing administrator account's email.
-- Do not add an administrator option to the public registration form.

update public.profiles
set role = 'administrator',
    updated_at = now()
where email = 'YOUR-ADMIN-EMAIL@example.com';

-- Verify:
select id, email, full_name, role
from public.profiles
where email = 'YOUR-ADMIN-EMAIL@example.com';
