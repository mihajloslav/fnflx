-- Privremeno isključuje RLS za testiranje
ALTER TABLE auth_users DISABLE ROW LEVEL SECURITY;

-- NAPOMENA: Ovo je samo za testiranje!
-- U produkciji treba ponovo uključiti RLS sa ispravnim politikama.
