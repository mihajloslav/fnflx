-- Uklanjanje postojećih RLS politika
DROP POLICY IF EXISTS "Users can view own profile" ON auth_users;
DROP POLICY IF EXISTS "Users can update own profile" ON auth_users;
DROP POLICY IF EXISTS "Users can insert own profile" ON auth_users;

-- Dodavanje novih RLS politika koje rade sa OTP autentifikacijom
CREATE POLICY "Users can view own profile" ON auth_users
    FOR SELECT USING (auth.uid()::text = (SELECT auth.uid()::text));

CREATE POLICY "Users can update own profile" ON auth_users
    FOR UPDATE USING (auth.uid()::text = (SELECT auth.uid()::text));

CREATE POLICY "Users can insert own profile" ON auth_users
    FOR INSERT WITH CHECK (auth.uid()::text = (SELECT auth.uid()::text));

-- Alternativno, možemo potpuno isključiti RLS za testiranje
-- ALTER TABLE auth_users DISABLE ROW LEVEL SECURITY;
