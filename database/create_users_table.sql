-- Kreiranje tabele za korisnike
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(255) UNIQUE NOT NULL,
  github_username varchar(255) UNIQUE,
  first_name varchar(100),
  last_name varchar(100),
  index_year varchar(4), -- godina upisa (2023, 2024, itd.)
  index_number varchar(4), -- broj indeksa
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Dodavanje RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy da korisnici mogu da vide i menjaju samo svoje podatke
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.email() = email);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.email() = email);

CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.email() = email);

-- Trigger za automatsko ažuriranje updated_at kolone
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index za brže pretraživanje po email-u
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_github_username ON users(github_username);
