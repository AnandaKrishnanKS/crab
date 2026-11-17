# MudCrab Manager

Mobile-first web app and installable PWA to run a green mud crab (*Scylla serrata*) fattening business on a single recirculating aquaculture system (RAS).

- **Locale & Currency**: `en-IN`, Indian Rupee (`₹1,25,000` formatting), `DD/MM/YYYY` dates in `Asia/Kolkata` (IST), and explicit units (`ppt`, `mg/L`, `g`, `kg`, `L`, `₹`).
- **Single-Owner Auth**: Credentials login backed by Auth.js (`next-auth`) + `bcryptjs`; all pages, Server Actions, and API routes (except `/login`, `/api/auth/*`, `/manifest.webmanifest`, and `/icons/*`) require an authenticated owner session.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript strict mode) + React 19
- **Styling & UI**: Tailwind CSS v4, mobile bottom bar (`Home`, `Daily Log`, `Crabs`, `Water`, `More`) + desktop sidebar, floating `+` quick-add menu, `lucide-react`, `recharts`, `sonner`
- **Database**: PostgreSQL + Prisma ORM v7 (`@prisma/adapter-pg` + `pg`), including partial unique SQL indexes in migrations for single open `TrayAssignment` per tray and per crab
- **Validation & Testing**: Zod, Vitest (`npm test`)
- **PWA**: App Router web manifest (`/manifest.webmanifest`) and icons under `public/icons/`

---

## Environment Variables

Copy `.env.example` to `.env` (or configure environment variables in your host / Neon):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used at runtime (pooled URL recommended for serverless/Neon) |
| `DATABASE_URL_UNPOOLED` | Direct/unpooled PostgreSQL URL used by `prisma7.config.ts` for schema migrations |
| `AUTH_SECRET` | Random 32+ character secret used by Auth.js JWT sessions |
| `OWNER_EMAIL` | Single owner login email created by `prisma/seed.ts` |
| `OWNER_PASSWORD` | Initial password hashed with `bcryptjs` during `prisma/seed.ts` |
| `AUTH_TRUST_HOST` | Set `"true"` behind reverse proxies or custom hosts |

---

## Local Development (Docker Compose)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start local PostgreSQL 16 via `docker-compose.yml` (db `mudcrab`, user `mudcrab`, password `mudcrab_password` on port `5432`):
   ```bash
   docker compose up -d
   ```
3. Copy `.env.example` to `.env`, then generate Prisma client, apply migrations, and seed starter data (trays, minerals with exact hydrate ion fractions, feed types, sample batches/crabs/logs, and the owner user):
   ```bash
   npm run db:generate
   npx prisma migrate deploy --config prisma7.config.ts
   npm run db:seed
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) and sign in with `OWNER_EMAIL` / `OWNER_PASSWORD`.

---

## Production & Neon Setup

This repository includes `neon.ts` and `prisma7.config.ts` configured for Neon PostgreSQL (`DATABASE_URL` pooled at runtime + `DATABASE_URL_UNPOOLED` for Prisma migrations).

- Apply migrations against production:
  ```bash
  npx prisma migrate deploy --config prisma7.config.ts
  ```
- Seed initial owner account, settings, and the 6 hydrated mineral salt formulas (idempotent via `upsert` / `skipDuplicates`):
  ```bash
  npm run db:seed
  ```
- Build and run the production server:
  ```bash
  npm run build
  npm start
  ```

---

## Backups & Data Exports

- **In-app CSV ZIP export (`GET /api/export/csv`)**: Available on **Settings -> Account & Links** and **Reports**. Downloads a `.zip` containing one CSV file per database table plus `manifest.json` (`User.passwordHash` is strictly excluded).
- **In-app JSON backup (`GET /api/export/json`)**: Full structured JSON snapshot of all tables (`User.passwordHash` strictly excluded).
- **Per-table Report CSV**: Export buttons on Monthly, Batch, Crab, and Tray P&L views in `/reports`.
- **PostgreSQL `pg_dump` backup**:
  ```bash
  pg_dump "$DATABASE_URL_UNPOOLED" -Fc -f "mudcrab-$(date +%Y-%m-%d).dump"
  ```
  Restore with:
  ```bash
  pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL_UNPOOLED" mudcrab-YYYY-MM-DD.dump
  ```

---

## Verification & Tests

```bash
npx next typegen
npm run lint
npx tsc --noEmit
npm test
npm run build
```

---

## Documented Design Assumptions

1. **Timezone & Date Anchoring**: All "today", monthly P&L buckets, days-in-system counts, and "not fed today" alerts evaluate against calendar dates in `Asia/Kolkata` (IST).
2. **Latest Weight Derivation**: Derived in order: `crab.finalWeightG`, otherwise the most recent weight across `WeightLog.weightG` and `MoltLog.weightAfterG`, falling back to `crab.initialWeightG`.
3. **FCR Definition**: `totalFeedG / weightGainG`. Displayed as `—` (`null`) when `weightGainG <= 0` so negative/zero gain does not show misleading ratios.
4. **Soft-Crab Alert Trigger**: Shown when a crab's latest `MoltLog.stage` is `SOFT` or `MOLTED` and `Settings.softCrabAlert` is enabled.
5. **Dose Calculator Defaults**: Alkalinity target in CaCO₃ uses `CaCO₃ × 1.2192 = HCO₃⁻` before calculating `NaHCO₃`; Mg deficit defaults to a `50% / 50%` Mg contribution split between `MgCl₂·6H₂O` and `MgSO₄·7H₂O` (adjustable via slider). Only positive target deltas produce doses.
6. **Water Change Delete Behavior**: Deleting a `WaterChange` transactionally deletes linked `MineralAddition` entries (`waterChangeId`) and restores their `quantityG / 1000` back to `Mineral.stockKg`.
7. **Batch Supplier Assignment**: Updating a batch's supplier reassigns `Batch.supplierId` cleanly. Deleting an active/historic tray or feed type used by logs is prevented; deactivate (`active = false`) instead.
8. **Tray History Profit Rule**: Individual tray history stays show realized crab profit (`SOLD` / `DEAD`) only on the final closing stay; intermediate stays before moving (`MOVED`) show `—` so profit/loss is never double-counted across trays. Similarly, Monthly P&L and Dashboard monthly financials sum distinct cost sources (`Crab.purchaseCost`, `FeedLog.costAtTime`, `TreatmentLog.cost`, `MineralAddition.costAtTime`, `SystemLog.cost`, `Expense.amount`) without double counting.
