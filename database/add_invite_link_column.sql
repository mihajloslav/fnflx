-- Dodaj kolonu za čuvanje invite link-a
ALTER TABLE auth_users
ADD COLUMN invite_link VARCHAR(255);

-- Kreiraj indeks za brže pretrage po invite_link-u
CREATE INDEX IF NOT EXISTS idx_auth_users_invite_link ON auth_users(invite_link);
