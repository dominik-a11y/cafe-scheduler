# cafe-scheduler — Pełne podsumowanie projektu

## Przegląd

Aplikacja do zarządzania grafikiem zmian w kawiarni. Język interfejsu: polski. Dwie role: admin i pracownik (employee). Admin zarządza zmianami, godzinami pracy kawiarni, pracownikami i raportami. Pracownik zgłasza dyspozycyjność i przegląda harmonogram.

**Repo:** `github.com/dominik-a11y/cafe-scheduler` (branch: `main`)
**URL produkcyjny:** `https://cafe-scheduler.vercel.app`
**Właściciel:** Dominik Łyp (`dominik.lyp@gmail.com`)

---

## Stack technologiczny

| Warstwa | Technologia |
|---------|------------|
| Framework | Next.js 16.2.1 (App Router, Turbopack) |
| Hosting | Vercel (team: `team_jwitDkC3Bx2LwUFtfeZmqvNB`, project: `prj_C7Gwa920wFA0GXNrwPWM3V0ZC7dk`) |
| Backend/DB | Supabase (project ID: `uhlmzgqjqxgnuyhntwhn`) |
| Auth | Supabase Auth (email/password) via `@supabase/ssr` |
| Edge Functions | Supabase Edge Functions (Deno runtime) |
| Email | Resend API (key: `re_hNfcPhuL_5qXyF1MNzmSrpPmpCjse3UmG`) |
| Styling | Tailwind CSS v4 |
| Język | TypeScript 6 |
| Biblioteki | date-fns v4, lucide-react, jsPDF, jspdf-autotable |

---

## Struktura plików

```
cafe-scheduler/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
├── src/
│   ├── middleware.ts                          # Wywołuje updateSession()
│   ├── app/
│   │   ├── globals.css                        # @import "tailwindcss"
│   │   ├── layout.tsx                         # Root layout (html, body)
│   │   ├── page.tsx                           # Redirect → /schedule
│   │   ├── login/page.tsx                     # Formularz logowania
│   │   ├── auth/confirm/route.ts              # Weryfikacja tokenów invite/recovery
│   │   ├── complete-profile/page.tsx          # Formularz uzupełniania profilu (po invite)
│   │   ├── api/                               # API routes (jeśli jakieś)
│   │   └── (dashboard)/
│   │       ├── layout.tsx                     # Dashboard layout z Sidebar
│   │       ├── schedule/page.tsx              # Harmonogram — timeline view (desktop + mobile)
│   │       ├── availability/page.tsx          # Dyspozycyjność pracownika
│   │       └── admin/
│   │           ├── layout.tsx                 # Admin guard (sprawdza rolę)
│   │           ├── page.tsx                   # Dashboard admina
│   │           ├── availability/page.tsx      # Zatwierdzanie dyspozycyjności + sync
│   │           ├── employees/page.tsx         # Lista pracowników, zaproszenia
│   │           ├── shifts/page.tsx            # Definicje zmian
│   │           ├── hours/page.tsx             # Godziny otwarcia kawiarni
│   │           └── reports/page.tsx           # Raporty, stawki, PDF export
│   ├── components/
│   │   └── Sidebar.tsx                        # Nawigacja boczna (desktop + mobile hamburger)
│   └── lib/
│       ├── types.ts                           # TypeScript interfaces
│       ├── utils.ts                           # Helpery (getWeekRange, DAY_NAMES_PL, formatDatePL, calculateHours)
│       └── supabase/
│           ├── client.ts                      # createBrowserClient()
│           ├── server.ts                      # createServerClient() (cookies)
│           └── middleware.ts                  # Auth middleware, PUBLIC_PATHS
```

---

## Schemat bazy danych (Supabase / PostgreSQL)

### profiles
| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| id | uuid PK | = auth.users.id |
| email | text NOT NULL | |
| full_name | text NOT NULL | |
| role | text NOT NULL | default 'employee', wartości: 'admin' / 'employee' |
| created_at | timestamptz | default now() |

### shift_definitions
| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| id | uuid PK | auto |
| name | text NOT NULL | np. "Rano", "Popołudnie" |
| start_time | time NOT NULL | |
| end_time | time NOT NULL | |
| color | text NOT NULL | default '#3B82F6' |
| created_at | timestamptz | |

### cafe_hours
| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| id | uuid PK | |
| day_of_week | int NOT NULL | 0=poniedziałek ... 6=niedziela |
| open_time | time NOT NULL | default '08:00' |
| close_time | time NOT NULL | default '20:00' |
| is_closed | boolean NOT NULL | default false |

### availability
| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| id | uuid PK | auto |
| user_id | uuid NOT NULL | FK → auth.users |
| date | date NOT NULL | |
| start_time | time NOT NULL | |
| end_time | time NOT NULL | |
| status | text | default 'pending', wartości: pending/approved/rejected |
| reviewed_by | uuid | FK → auth.users (admin) |
| shift_definition_id | uuid | FK → shift_definitions (opcjonalnie) |
| created_at | timestamptz | |

### schedule_entries
| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| id | uuid PK | auto |
| user_id | uuid NOT NULL | FK → auth.users |
| shift_definition_id | uuid | FK → shift_definitions (NULL jeśli custom) |
| date | date NOT NULL | |
| custom_start_time | time | Używane gdy shift_definition_id = NULL |
| custom_end_time | time | j.w. |
| notes | text | |
| created_by | uuid NOT NULL | FK → auth.users (admin) |
| created_at | timestamptz | |

### invitations
| Kolumna | Typ | Uwagi |
|---------|-----|-------|
| id | uuid PK | auto |
| email | text NOT NULL | |
| role | text NOT NULL | default 'employee' |
| token | text NOT NULL | |
| used | boolean NOT NULL | default false |
| expires_at | timestamptz | default now() + 7 days |
| created_at | timestamptz | |

---

## Trigger bazodanowy

```sql
-- Na auth.users INSERT → tworzy profil automatycznie
CREATE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE WHEN (SELECT COUNT(*) FROM public.profiles) = 0 THEN 'admin' ELSE 'employee' END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

---

## RLS Policies (Row Level Security)

Wszystkie tabele mają RLS włączone. Kluczowe zasady:

**profiles:** SELECT = publiczny; INSERT = własny; UPDATE = własny + admini; DELETE = admini
**availability:** SELECT = własne + admini; INSERT = własne; UPDATE = własne pending + admini; DELETE = własne pending
**schedule_entries:** SELECT = publiczny; INSERT/UPDATE/DELETE = własne + admini (ALL)
**shift_definitions:** SELECT = publiczny; ALL = admini
**cafe_hours:** SELECT = publiczny; ALL = admini
**invitations:** SELECT = publiczny; ALL = admini; UPDATE used = publiczny

### UWAGA — RLS do poprawki!
Pracownicy mogą usuwać/edytować availability TYLKO ze statusem `pending` (policy: `(auth.uid() = user_id) AND (status = 'pending')`). W kodzie frontendu zezwoliliśmy na edycję/usuwanie niezależnie od statusu, ale **RLS to zablokuje**. Trzeba zaktualizować policy:
```sql
-- Usuwanie: zezwól na każdy status
DROP POLICY "Users can delete own pending availability" ON availability;
CREATE POLICY "Users can delete own availability" ON availability FOR DELETE USING (auth.uid() = user_id);

-- Edycja: zezwól na każdy status
DROP POLICY "Users can update own pending availability" ON availability;
CREATE POLICY "Users can update own availability" ON availability FOR UPDATE USING (auth.uid() = user_id);
```
Podobnie admin potrzebuje policy DELETE na availability:
```sql
CREATE POLICY "Admins can delete availability" ON availability FOR DELETE
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
```

---

## Supabase Edge Function: `send-invite` (v6)

**Slug:** `send-invite`
**verify_jwt:** false (autoryzacja wewnętrzna przez sprawdzanie tokena)
**Runtime:** Deno

Przepływ:
1. Waliduje Bearer token → pobiera usera → sprawdza role=admin
2. Wywołuje `auth.admin.generateLink({ type: 'invite', email })` → dostaje `hashed_token`
3. Buduje URL: `https://cafe-scheduler.vercel.app/auth/confirm?token_hash=${hashedToken}&type=invite`
4. Wysyła email przez Resend API z adresu `grafik@babielato.cafe`
5. Zapisuje wpis w tabeli `invitations`

**Resend:** Domena `babielato.cafe` zweryfikowana (DKIM, SPF, DMARC na Squarespace DNS). Klucz API: `re_hNfcPhuL_5qXyF1MNzmSrpPmpCjse3UmG` (restricted: send only).

---

## Przepływ zaproszenia pracownika

1. Admin → `/admin/employees` → wpisuje email + role → klik "Wyślij"
2. Frontend wywołuje Edge Function `send-invite` z Bearer tokenem
3. Edge Function tworzy usera w auth + wysyła email z linkiem
4. Pracownik klika link → `/auth/confirm?token_hash=...&type=invite`
5. `auth/confirm/route.ts` weryfikuje token → redirect do `/complete-profile`
6. Pracownik ustawia hasło + imię → gotowe

**Middleware:** Ścieżki `/login`, `/auth/confirm`, `/complete-profile` są publiczne (nie wymagają auth).

---

## Kluczowe funkcjonalności

### Harmonogram (schedule/page.tsx)
- Widok timeline'owy à la Google Calendar (bez nachodzenia bloków)
- Desktop: 7 kolumn + wspólna oś godzinowa po lewej
- Mobile: karty dzień po dniu ze wspólną globalną osią godzinową
- Hover tooltip z pełną informacją o pracowniku
- Greedy column assignment dla non-overlapping bloków
- Stała: `HOUR_HEIGHT = 56px`

### Dyspozycyjność pracownika (availability/page.tsx)
- Widok tygodniowy, karty per dzień
- Dodawanie: wybór z predefiniowanych zmian lub ręcznie
- Edycja/usuwanie: ikona ołówka + kosz, dostępne dla KAŻDEGO statusu
- Po edycji zatwierdzonego wpisu → status wraca na `pending`
- Status wyświetlany jako kolorowa kropka + tekst

### Admin: Dyspozycyjność (admin/availability/page.tsx)
- Filtr: oczekujące / wszystkie
- Przyciski: Zatwierdź / Odrzuć / Usuń
- "Synchronizuj harmonogram": pobiera approved availability → kasuje schedule_entries za dany tydzień → tworzy nowe
- Usunięcie approved wpisu → kasuje też odpowiedni schedule_entry

### Admin: Raporty (admin/reports/page.tsx)
- Widok miesiąca z podsumowaniem godzin per pracownik
- Stawka godzinowa per pracownik (localStorage key: `cafe_hourly_rates`)
- Automatyczne wyliczanie wynagrodzenia (stawka × godziny)
- Sumaryczne wynagrodzenie w PLN (zł)
- PDF export: "Rejestr godzin realizacji zlecenia" (polskie formatowanie, 31 dni, przedziały, do podpisu)
- Mobile: card layout, Desktop: tabelka

### Admin: Pracownicy (admin/employees/page.tsx)
- Lista pracowników z rolą
- Formularz zaproszenia (email + rola)
- Usuwanie pracowników i zaproszeń

### Admin: Zmiany (admin/shifts/page.tsx)
- CRUD definicji zmian (nazwa, godziny, kolor)

### Admin: Godziny (admin/hours/page.tsx)
- Ustawianie godzin otwarcia/zamknięcia per dzień tygodnia

---

## Konto admin produkcyjne

- **Email:** `kontakt@babielato.cafe`
- **Hasło:** `kawiarnia`
- Utworzone ręcznie przez SQL INSERT do `auth.users` + `auth.identities`
- Profil tworzony automatycznie przez trigger `handle_new_user`
- Rola ustawiona na 'admin' w `profiles`

---

## Znane problemy / TODO

1. **RLS policies do aktualizacji** — availability DELETE/UPDATE ograniczone do `status = 'pending'`, a frontend pozwala na edycję/usuwanie każdego statusu. Trzeba wykonać migrację SQL (patrz sekcja "RLS do poprawki" wyżej).

2. **Email delivery** — zaproszenia wysyłane przez Resend z `grafik@babielato.cafe`. Domena zweryfikowana, ale użytkownik raportował brak dostarczenia maila. Sprawdzić dashboard Resend (https://resend.com/emails) po status wysyłki. Możliwe przyczyny: spam folder, opóźnienie propagacji DNS.

3. **Brak zmiany hasła** — nie ma interfejsu do zmiany hasła w aplikacji. Można dodać stronę settings lub użyć Supabase password reset flow.

4. **Admin nie może usunąć sam siebie** — zabezpieczenie, ale problem przy zmianie konta admina. Workaround: dodać nowego admina → zalogować się na nowego → usunąć starego.

5. **localStorage dla stawek** — `cafe_hourly_rates` trzymane w localStorage przeglądarki admina. Nie jest współdzielone między urządzeniami. Rozważyć przeniesienie do bazy danych.

6. **Mobile display** — użytkownik zgłaszał problemy z wyświetlaniem na mobile (brak szczegółów). Warto przetestować na różnych rozdzielczościach.

---

## Zmienne środowiskowe (Vercel)

```
NEXT_PUBLIC_SUPABASE_URL=https://uhlmzgqjqxgnuyhntwhn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

Edge Function używa automatycznie: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`.

---

## Deployment

- Push na `main` → automatyczny deploy na Vercel
- Edge Functions deployowane przez Supabase MCP tool `deploy_edge_function`
- Brak CI/CD pipeline'u (brak testów, lintingu w CI)
