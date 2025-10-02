# Telegram Bot Integration Setup

## 1. Database Setup

Izvršite SQL za dodavanje invite_link kolone:

```sql
-- Run this in your Supabase SQL editor
-- Dodaj kolonu za čuvanje invite link-a
ALTER TABLE auth_users
ADD COLUMN invite_link VARCHAR(255);

-- Kreiraj indeks za brže pretrage po invite_link-u
CREATE INDEX IF NOT EXISTS idx_auth_users_invite_link ON auth_users(invite_link);
```

## 2. Supabase Edge Function Deployment

1. Install Supabase CLI ako ga nemate:
```bash
npm install -g supabase
```

2. Login u Supabase:
```bash
supabase login
```

3. Deploy Edge Function:
```bash
cd supabase
supabase functions deploy telegram-bot
```

## 3. Environment Variables

U Supabase Dashboard → Project Settings → Edge Functions → Secrets, dodajte:

- `BOT_TOKEN` - Vaš Telegram bot token
- `TELEGRAM_GROUP_ID` - ID vaše Telegram grupe (format: -100xxxxxxxxx)
- `SUPABASE_URL` - Vaš Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

## 4. Telegram Bot Setup

1. Kreirajte bot preko @BotFather na Telegram-u
2. Dobijte BOT_TOKEN
3. Dodajte bot u vašu Telegram grupu kao admin sa pravima:
   - Can invite users via link
   - Can manage chat
   - Can restrict members (za /purge komandu)

## 5. Webhook Setup

Postavite webhook da bot može detektovati kada neko uđe u grupu:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://<YOUR_SUPABASE_PROJECT>.functions.supabase.co/telegram-bot"}'
```

## 6. Next.js Environment Variables

U `.env.local` dodajte:
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 7. Admin Komande

### `/status`
**Dostupno samo adminima grupe**

Prikazuje statistike:
- 👥 **Baza podataka:** Broj korisnika sa Telegram username-om
- 💬 **Telegram grupa:** Ukupan broj članova

*Napomena: Telegram API ograničava pristup detaljnim informacijama o članovima grupe, pa se prikazuju osnovne statistike.*

### `/members`
**Dostupno samo adminima grupe**

Prikazuje detaljan spisak članova grupe:
- 👤 **Ime i prezime** svakog člana
- 🆔 **Username** i **ID** svakog člana
- ✅ **Status verifikacije** (da li je u bazi podataka)
- ⚠️ **Problematični članovi** označeni ikonama

*Napomena: Zbog ograničenja Telegram API-ja, možda neće biti prikazani svi članovi. Bot može pristupiti samo administratorima i članovima sa kojima je imao interakciju.*

### `/check @username`
**Dostupno samo adminima grupe**

Proverava određenog korisnika:
- Da li postoji u bazi podataka
- Status verifikacije
- Datum registracije i poslednje aktivnosti

### `/purge`
**Dostupno samo adminima grupe**

Objašnjava logiku automatskog uklanjanja problematičnih korisnika:
- Bot automatski uklanja nove članove koji nemaju username
- Bot automatski uklanja nove članove čiji username nije u bazi podataka
- Postojeći članovi se proveravaju kad god pošalju poruku
- Dodatno: može da resetuje `added=false` za neverifikovane korisnike

*Napomena: Zbog Telegram API ograničenja, `/purge` ne može proći kroz sve postojeće članove odjednom. Umesto toga, bot kontinuirano nadgleda grupu i automatski uklanja problematične korisnike.*

### `/help`
**Dostupno samo adminima grupe**

Prikazuje spisak svih dostupnih admin komandi sa objašnjenjima.

## How It Works

1. Korisnik se registruje i unese Telegram username
2. Klikne "Uzmi Telegram link" - poziva se Edge Function
3. Bot kreira jedinstveni invite link (expires 24h, 1 use)
4. Link se čuva u bazi i prikazuje korisniku
5. Korisnik klikne link i pridružuje se grupi
6. Bot detektuje pridruživanje i postavlja `added = true`
7. Korisnik postaje "verifikovan"

## Admin Usage

Dostupne komande za administratore grupe:

### 📊 `/status` - Sistemski izveštaj
- Detaljne statistike baze podataka
- Broj članova u grupi 
- Potencijalni problemi (korisnici bez username-a, neverifikovani)
- Aktivnost u poslednja 24h (novi invite linkovi)

### 👥 `/members` - Lista članova grupe
- Imena, username-ovi i ID-jevi svih članova
- Status verifikacije za svakog člana
- Označeni problematični članovi (bez username-a ili nisu u bazi)
- *Napomena: Možda neće prikazati sve članove zbog API ograničenja*

### 🧹 `/purge` - Lista problematičnih članova
- Prikazuje članove koji su u Telegram grupi ali nisu u bazi podataka
- Članove bez username-a
- ID, ime i username svakog problematičnog člana
- *Napomena: Možda neće prikazati sve članove zbog API ograničenja*

### 👤 `/check @username` - Proveri korisnika
- Detaljne informacije o određenom korisniku
- Status verifikacije i datum registracije
- Informacije o invite link-u

### ❓ `/help` - Lista komandi
- Pregled svih dostupnih admin komandi
- Objašnjenja funkcionalnosti

**Samo admini grupe mogu koristiti ove komande!**

## Automatska Zaštita Grupe

Bot kontinuirano štiti grupu tako što:
- ✅ **Automatski izbacuje nove članove bez username-a**
  - Šalje detaljnu poruku sa ID, imenom i razlogom izbacivanja
- ✅ **Automatski izbacuje nove članove čiji username nije u bazi**
  - Šalje detaljnu poruku sa ID, imenom, username-om i razlogom
- ✅ Proverava članove kada pošalju poruke
- ✅ Dozvoljava pristup samo verifikovanim korisnicima
- ✅ Generiše invite linkove samo za verifikovane korisnike

### Poruke o izbacivanju sadrže:
- 👤 **Ime i prezime** izbačenog korisnika
- 🆔 **Telegram ID** korisnika  
- 👨‍💻 **Username** (ili "nema username")
- ❌ **Razlog izbacivanja** (nema username / nije u bazi)
- ⚠️ **Objašnjenje** šta treba da uradi da bi pristupio grupi
