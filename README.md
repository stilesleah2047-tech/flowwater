# AquaFlow — Multi-Branch Water Delivery, Payments & RBAC

A multi-branch operations platform for a jerrycan water delivery business:
field staff take split cash/M-Pesa payments from a sunlight-optimized
mobile terminal, and Branch Managers / a Super Admin watch every branch
reconcile from a global control center.

## Architecture: one Next.js app, deployed entirely on Vercel

```
aquaflow/
  web/      Next.js (App Router) + Tailwind. The UI (src/app/**/page.tsx)
            AND the API (src/app/api/**/route.ts) live in this single
            project, deployed as one Vercel project.
  server/   LEGACY — an earlier Express + Socket.io backend, no longer
            used or deployed. Kept only for reference.
```

Everything — auth, sales, M-Pesa, dashboard aggregation — runs as Next.js
Route Handlers under `web/src/app/api/`, deployed as Vercel serverless
functions. There is nothing else to deploy or wire together: one Vercel
project, one set of environment variables, one URL.

### Why `server/` still exists, and what changed to get rid of it

The original design ran a standalone Express server so it could hold a
persistent MongoDB Change Stream and Socket.io connections open — pushing
new sales to the Super Admin dashboard instantly. Vercel's serverless
functions can't do that (they spin up per-request and don't stay alive),
which is exactly why this app used to need two separately-hosted pieces.

Moving everything onto Vercel meant two real changes:

1. **The live dashboard feed is now polling, not push.** `web/src/lib/pollingFeed.ts`
   refetches `/api/transactions` every 4 seconds instead of receiving
   instant Socket.io events. Not millisecond-instant, but the dashboard
   still updates on its own.
2. **MongoDB connections are cached across invocations.** Serverless
   functions can be invoked many times against the same warm container;
   without caching, each invocation would open a new connection and
   quickly exhaust Atlas's connection limit. See
   `web/src/lib/server/db.ts`.

`server/` is dead code at this point — safe to ignore or delete. If you
delete it, also remove `docker-compose.yml` at the repo root, which only
existed to run `server/` alongside a local MongoDB replica set.

## Roles & RBAC

Three roles, enforced at three layers (Mongoose model invariants, each
API route's own checks, and the frontend's route guards). Every role
authenticates the same way, at the same single page:

| Role | Login route | Credential | Branch scope |
|---|---|---|---|
| `DELIVERY` | `/login` | Email + password | Locked to one branch |
| `BRANCH_MANAGER` | `/login` | Email + password | Locked to one branch |
| `SUPER_ADMIN` | `/login` | Email + password | None — sees/filters all branches |

`POST /api/auth/login` looks up the account, authenticates it, and
returns a `redirectTo` computed from that account's own role (`DELIVERY`
-> `/terminal`, everyone else -> `/admin/dashboard`). The client never
branches on role itself; it just follows the server's answer.
`/admin/login` still exists as a one-line redirect to `/login`.

## Session security

- **Persistent sessions**: a short-lived access token (15m, httpOnly
  cookie) pairs with a long-lived refresh token (30d, stored hashed
  server-side per device).
- **Same-site cookies, genuinely simple now**: frontend and API are the
  same Vercel deployment on the same domain, so session cookies are
  ordinary `SameSite=Lax` cookies.
- **Device binding**: `DELIVERY` accounts are capped at
  `DELIVERY_MAX_DEVICES` (default 2) simultaneous sessions.
- **Tamper prevention**: every transaction's authoritative `createdAt`
  comes from MongoDB's own clock via Mongoose timestamps.
- **Account lockout**: 5 failed login attempts locks the account for 15
  minutes.

## MongoDB / Mongoose implementation

- **Models**: `Branch`, `User`, `UserSession`, `Product` (+
  `BranchPricing`), `Transaction`, `DailyInventory`, `MpesaCallbackLog` —
  `web/src/lib/server/models/`.
- **Indexes**: single indexes on `Transaction.branchId`,
  `Transaction.createdAt`, `Transaction.mpesaDetails.checkoutRequestId`;
  compound `{branchId: 1, date: 1}` on `DailyInventory`; compound
  `{branchId: 1, createdAt: -1}` on `Transaction`.
- **Aggregation pipelines**: `api/dashboard/summary` and
  `api/dashboard/reconciliation` both `$match` on `branchId` first.

## Split-payment flow

**Cash** — `POST /api/transactions/cash`. Writes to an IndexedDB queue
first, shows confirmation immediately (optimistic UI), syncs in the
background. Every queued sale carries a `clientUuid`; a unique index
makes a replayed offline batch a no-op rather than a duplicate sale.

**M-Pesa** — `POST /api/mpesa/stkpush` resolves branch and price
server-side, inserts a `PENDING` transaction, calls Daraja. The terminal
polls `/api/mpesa/status/:id` every 3s while Safaricom's async result
lands at the public `POST /api/mpesa/callback`, which logs every hit
before touching anything and only updates a transaction it can match by
a `checkoutRequestId` it itself issued, only while still `PENDING`.

## Setup

### 1. MongoDB

Use MongoDB Atlas.

### 2. Environment variables

Copy `web/.env.example` to `web/.env.local` for local dev, and set the
same variables in **Vercel -> Project Settings -> Environment Variables**
for production. Every variable is required.

`DARAJA_CALLBACK_URL` needs a two-step setup: deploy once with a
placeholder, note the real Vercel URL, then update it to
`https://<your-app>.vercel.app/api/mpesa/callback` and redeploy.

### 3. Bootstrap the first Super Admin

```bash
cd web
npm install
npm run seed
```

Reads `SEED_SUPER_ADMIN_EMAIL` / `SEED_SUPER_ADMIN_PASSWORD` and creates
that account, plus a default 5L/10L/20L product catalog. Idempotent.

### 4. Run locally

```bash
cd web
npm run dev
```

### 5. Deploy

Import the repo into Vercel, set **Root Directory** to `web`, add every
environment variable from `web/.env.example`, and deploy.

## Going-live checklist

- [ ] MongoDB Atlas production cluster, backups enabled.
- [ ] Real, unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.
- [ ] Daraja production Shortcode approved; `DARAJA_ENV=production`;
      `DARAJA_CALLBACK_URL` updated to the real Vercel domain, HTTPS.
- [ ] `DARAJA_CALLBACK_IP_ALLOWLIST` set once confirmed for your account.
- [ ] Change the seeded `SUPER_ADMIN` password immediately.
- [ ] Each branch's opening `DailyInventory.morningDispatched` entry
      process assigned to someone.
- [ ] `/api/health` wired into uptime monitoring.
- [ ] Confirm the polling feed's 4s interval feels acceptable for your
      team — tune `intervalMs` in `lib/pollingFeed.ts` if not.

## Extending this scaffold

Still worth adding: a self-serve "log out this device" flow reachable
before login, SMS/receipt confirmation to customers, pagination on the
activity feed and reconciliation history, and end-to-end tests against
Daraja's sandbox simulator as part of CI.
