-- Test da li auth.uid() radi
SELECT auth.uid() as current_user_id;

-- Proverava da li postoji tabela auth_users
SELECT * FROM auth_users LIMIT 5;

-- Privremeno isključuje RLS za debugging
ALTER TABLE auth_users DISABLE ROW LEVEL SECURITY;
