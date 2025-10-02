-- Obriši postojeću tabelu ako postoji
DROP TABLE IF EXISTS auth_users;

-- Kreiranje tabele za autentifikovane korisnike
CREATE TABLE auth_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    telegram_username VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Kreiranje indeksa za brže pretrage
CREATE INDEX idx_auth_users_user_id ON auth_users(user_id);
CREATE INDEX idx_auth_users_email ON auth_users(email);

-- RLS (Row Level Security) politike
ALTER TABLE auth_users ENABLE ROW LEVEL SECURITY;

-- Politika da korisnici mogu da čitaju samo svoje podatke
CREATE POLICY "Users can view own profile" ON auth_users
    FOR SELECT USING (auth.uid() = user_id);

-- Politika da korisnici mogu da ažuriraju samo svoje podatke
CREATE POLICY "Users can update own profile" ON auth_users
    FOR UPDATE USING (auth.uid() = user_id);

-- Politika da korisnici mogu da umeću svoje podatke
CREATE POLICY "Users can insert own profile" ON auth_users
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Kreiranje triggera za automatsko ažuriranje updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_auth_users_updated_at 
    BEFORE UPDATE ON auth_users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
