-- Kreiranje tabele za autentifikovane korisnike
CREATE TABLE auth_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    telegram_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kreiranje indeksa za brže pretrage
CREATE INDEX idx_auth_users_email ON auth_users(email);

-- RLS (Row Level Security) politike
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

-- Politika da korisnici mogu da čitaju samo svoje podatke
CREATE POLICY "Users can view own profile" ON auth_users
    FOR SELECT USING (auth.jwt() ->> 'email' = email);

-- Politika da korisnici mogu da ažuriraju samo svoje podatke
CREATE POLICY "Users can update own profile" ON auth_users
    FOR UPDATE USING (auth.jwt() ->> 'email' = email);

-- Politika da korisnici mogu da umeću svoje podatke
CREATE POLICY "Users can insert own profile" ON auth_users
    FOR INSERT WITH CHECK (auth.jwt() ->> 'email' = email);


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


-- 1. Dodaj kolonu 'added'
ALTER TABLE auth_users
ADD COLUMN added BOOLEAN DEFAULT false;

-- 2. Ukloni postojeću 'update' politiku, ako postoji
DROP POLICY IF EXISTS "Users can update own profile" ON auth_users;

-- 3. Kreiraj novu 'update' politiku koja NE dozvoljava promenu 'added' kolone
CREATE POLICY "Users can update their profile (except added)" ON auth_users
FOR UPDATE USING (
    auth.uid() = user_id
) WITH CHECK (
    auth.uid() = user_id AND added IS NOT DISTINCT FROM added
);


-- Dodaj kolonu za čuvanje invite link-a
ALTER TABLE auth_users
ADD COLUMN invite_link VARCHAR(255);

-- Kreiraj indeks za brže pretrage po invite_link-u
CREATE INDEX IF NOT EXISTS idx_auth_users_invite_link ON auth_users(invite_link);


-- Dozvoli full access adminima (npr. iz Supabase UI / SQL Editora)
CREATE POLICY "Admin can do anything" ON auth_users
FOR ALL
USING (
    auth.role() = 'service_role'
)
WITH CHECK (
    auth.role() = 'service_role'
);
