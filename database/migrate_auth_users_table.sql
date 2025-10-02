-- Migracija postojeće auth_users tabele da dodamo user_id kolonu

-- Korak 1: Dodaj user_id kolonu
ALTER TABLE auth_users 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Korak 2: Kreiraj indeks za user_id
CREATE INDEX IF NOT EXISTS idx_auth_users_user_id ON auth_users(user_id);

-- Korak 3: Obriši stare RLS politike
DROP POLICY IF EXISTS "Users can view own profile" ON auth_users;
DROP POLICY IF EXISTS "Users can update own profile" ON auth_users;
DROP POLICY IF EXISTS "Users can insert own profile" ON auth_users;

-- Korak 4: Kreiraj nove RLS politike
CREATE POLICY "Users can view own profile" ON auth_users
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON auth_users
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON auth_users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Korak 5: Popuni user_id kolonu za postojeće korisniki (ako ih ima)
-- Ovo možda neće raditi automatski jer nema garantije da će email iz auth.users 
-- tačno odgovarati email-u u auth_users tabeli
-- UPDATE auth_users SET user_id = (
--     SELECT id FROM auth.users WHERE auth.users.email = auth_users.email
-- ) WHERE user_id IS NULL;
