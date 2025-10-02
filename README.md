# Fonflix

Aplikacija za pristup snimljenim predavanjima Fakulteta Organizacionih Nauka.

## Tehnologije

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: Supabase
- **Stilizovanje**: Neomorphism dizajn sa bojama FON-a
- **Ikone**: Lucide React

## Konfiguracija

1. Kloniraj repozitorijum i instaliraj dependency-je:
```bash
npm install
```

2. Kopiraj `.env.example` u `.env.local`:
```bash
cp .env.example .env.local
```

3. Otvori `.env.local` i zameni placeholder vrednosti sa stvarnim Supabase kredencijalima:
   - Idi na https://supabase.com/dashboard
   - Selektuj svoj projekat ili kreiraj novi
   - Idi na Settings > API
   - Kopiraj Project URL i anon public key u `.env.local`

4. Pokreni development server:
```bash
npm run dev
```

## Deploy na Vercel

1. Push kod na GitHub
2. Conectuj repozitorijum sa Vercel
3. U Vercel dashboard-u, dodaj environment varijable:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy aplikaciju

**Napomena**: `.env.local` se ne commit-uje na GitHub iz bezbednosnih razloga. Environment varijable morate ručno da dodate na platformi za deploy.

## Baza podataka

Aplikacija koristi Supabase sa sledećom tabelom:

```sql
create table lecture (
  id uuid primary key default gen_random_uuid(),
  name text not null,                         -- e.g. "Programming 1"
  session_name text,                          -- e.g. "Week 1 - Introduction"
  date date not null,                         -- e.g. "2025-06-03"
  time text not null,                         -- e.g. "08:00-09:30"
  type text not null check (type in ('P', 'V')),  -- 'P' for lecture, 'V' for exercises
  telegram_url text,
  youtube_url text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
```

## Struktura

- `src/app/` - Next.js App Router stranice
- `src/components/` - React komponente
- `src/lib/` - Utility funkcije (Supabase klijent)
- `src/types/` - TypeScript tipovi
- `src/utils/` - Helper funkcije i podaci

## Karakteristike

- Responzivni dizajn sa neomorphism stilom
- Boje FON-a (#D057A0FF, #5CC2ABFF, #FFCD67FF, #004B7CFF, #F48580FF, #9B95C9FF)
- Sortiranje predavanja po datumu
- Links ka Telegram i YouTube snimcima
- Razlikovanje između predavanja (P) i vežbi (V)

## Deploy

Aplikacija je spremna za deploy na Vercel, Netlify ili bilo koju platformu koja podržava Next.js.
