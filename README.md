# RentFleet

SaaS για rent-a-car στην Ελλάδα — desk ops, online booking, Stripe, Ψηφιακό Πελατολόγιο Οχημάτων & myDATA.

Ίδια αρχιτεκτονική με το **Katalima**: Next.js App Router, Prisma/PostgreSQL, cookie session (jose), Stripe BYOK, ΑΑΔΕ offline/sandbox/live.

## Stack

- Next.js 15 + TypeScript + Tailwind 4
- Prisma + PostgreSQL
- bcrypt + jose sessions
- Stripe (keys ανά οργανισμό, κρυπτογραφημένα)
- ΑΑΔΕ: myDATA + Ψηφιακό Πελατολόγιο (stubs + offline ουρά)

## Οδηγός νέου χρήστη (επιχείρηση)

Αναλυτικό βήμα-βήμα στήσιμο για ιδιοκτήτη rent-a-car:

→ **[docs/odigos-stisimatos.md](docs/odigos-stisimatos.md)**

Μέσα στην εφαρμογή μετά το login:

- **`/setup`** — ζωντανό checklist προόδου  
- **`/guide`** — πλήρης οδηγός στην οθόνη

## Setup (developers)

```bash
cp .env.example .env
# βάλε DATABASE_URL + AUTH_SECRET

npm install
npm run db:setup
npm run dev
```

Demo login: `demo@rentfleet.gr` / `demo1234`  
Δημόσιο booking: `/book/aegeanwheels`

## Scripts

| Script | Τι κάνει |
|--------|----------|
| `npm run dev` | Dev server |
| `npm run db:push` | Prisma schema → DB |
| `npm run db:seed` | Demo δεδομένα |
| `npm run db:setup` | push + seed |

## Modules (MVP scaffold)

- Auth / multi-tenant org
- Στόλος (CAR / MOTO / SCOOTER / VAN)
- Κρατήσεις, πελάτες, καταστήματα
- Dashboard + ημερολόγιο
- `/tax` ΑΑΔΕ ρυθμίσεις
- `/payments` Stripe BYOK
- `/book/[token]` δημόσιο listing κατηγοριών
