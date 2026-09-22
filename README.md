# AquaFlow — Multi-Branch Water Delivery, Payments & RBAC

A multi-branch operations platform for a jerrycan water delivery business:
field staff take split cash/M-Pesa payments from a sunlight-optimized
mobile terminal, and Branch Managers / a Super Admin watch every branch
reconcile in real time from a global control center.

## Architecture: two services, not one

This is a **monorepo with two independently deployed services**, not a
single Next.js app with API routes:

```
aquaflow/
  server/   Express + Mongoose (MongoDB) + Socket.io — the API, auth, and
            real-time backbone. Runs as a standalone, long-lived Node
            process.
  web/      Next.js (App Router) + Tailwind — the UI. Talks to `server`
            over HTTPS/WSS.
```

**Why not serverless API routes for everything?** Two of this app's
requirements — MongoDB Change Streams (the Super Admin live feed) and
persistent Socket.io connections — both need a long-lived process that
stays connected to the database and to clients between requests.
Serverless functions are spun up per-request and torn down; they cannot
hold a Change Stream cursor open or maintain a WebSocket connection across
invocations. `server/` therefore runs as a conventional Node server
(Docker container, VM, or a platform like Render/Railway/Fly.io — not
Vercel functions), while `web/` can still deploy anywhere Next.js runs,
including Vercel, since it's a pure client of `server/`'s API.

## Roles & RBAC

Three roles, enforced at three layers (Mongoose model invariants, Express
route middleware, and the frontend's own route guards — defense in depth,
not just UI-level hiding). Every role authenticates the same way, at the
same single page:

| Role | Login route | Credential | Branch scope |
|---|---|---|---|
| `DELIVERY` | `/login` | Email + password | Locked to one branch |
| `BRANCH_MANAGER` | `/login` | Email + password | Locked to one branch |
| `SUPER_ADMIN` | `/login` | Email + password | None — sees/filters all branches |

- There is one login page and one endpoint (`POST /api/auth/login`) for
  every role. The person's email and password ARE what determines where
  they land — the server looks up the account, authenticates it, and
  returns a `redirectTo` computed from that account's own role
  (`DELIVERY` → `/terminal`, everyone else → `/admin/dashboard`). The
  client never branches on role itself; it just follows the server's
  answer. See `server/src/routes/auth.routes.ts` and
  `web/src/app/login/page.tsx`.
- Device binding (below) still applies only to `DELIVERY` accounts, since
  that's the scenario it guards against — field staff sharing/rotating
  phones — not branch managers or the super admin.
- `/admin/login` still exists as a bare redirect to `/login`, so any old
  bookmark or link forwards gracefully instead of 404ing.

## Session security

- **Persistent sessions**: a short-lived access token (15m, in an httpOnly
  cookie) is paired with a long-lived refresh token (30d) stored, hashed,
  server-side per device. `web/src/lib/api.ts` transparently refreshes on
  a 401 before retrying the original request — a delivery worker doesn't
  get logged out mid-shift over a bad signal window.
- **Device binding**: `UserSession` documents (one per user+device) cap a
  `DELIVERY` account at `DELIVERY_MAX_DEVICES` (default 2) simultaneous
  active sessions. A login attempt from a third device gets a `409` with
  the list of currently-active devices rather than silently evicting one —
  see `enforceDeviceBinding` in `auth.routes.ts`. A manager can free a slot
  from the Staff page.
- **Tamper prevention**: every `Transaction` document's authoritative
  `createdAt` comes from MongoDB's own clock via Mongoose's
  `timestamps: true` — no API route ever accepts a client-supplied
  timestamp into that field. The device's own clock is captured separately
  as `clientSubmittedAt` (informational only, used purely for offline-queue
  UI ordering), so a delivery worker changing their phone's date/time
  cannot forge when a sale happened. See the long comment on
  `ITransaction.clientSubmittedAt` in `server/src/models/Transaction.ts`.
- **Account lockout**: 5 failed login attempts locks the account for 15
  minutes, independent of the IP-based rate limiter on the login endpoint
  (`server/src/middleware/rateLimit.ts`), so an attacker can't dodge the
  lockout by rotating source IPs.

## MongoDB / Mongoose implementation

- **Models**: `Branch`, `User`, `UserSession`, `Product` (+
  `BranchPricing` override), `Transaction`, `DailyInventory`,
  `MpesaCallbackLog` — see `server/src/models/`.
- **Indexes** (all in the model files, applied automatically on first
  connect): single indexes on `Transaction.branchId`,
  `Transaction.createdAt`, and `Transaction.mpesaDetails.checkoutRequestId`;
  a compound `{branchId: 1, date: 1}` index on `DailyInventory` (the exact
  shape of both the dispatch-entry upsert and the reconciliation query's
  `$match`); plus a practical `{branchId: 1, createdAt: -1}` compound index
  on `Transaction` for the hot "this branch, most recent first" query
  pattern used by both the live feed backlog and reconciliation's sold-sum.
- **Change Streams**: `server/src/sockets/index.ts` opens
  `Transaction.watch()` once at boot and broadcasts every insert/update to
  connected Socket.io clients, room-scoped (`global` for `SUPER_ADMIN`,
  `branch:<id>` for everyone else). **Requires MongoDB to be a replica
  set** — Atlas clusters are by default; the bundled `docker-compose.yml`
  runs a single-node replica set locally for the same reason. Against a
  plain standalone `mongod`, this throws at startup (logged, not fatal —
  the REST API keeps working, just without the live push).
- **Aggregation pipelines**: `server/src/routes/dashboard.routes.ts` —
  `/api/dashboard/summary` computes cash/M-Pesa totals and (in the global
  view) a revenue-ranked branch breakdown, `$match`-ing on `branchId` first
  whenever a specific branch is selected so the query hits the compound
  index rather than scanning every branch's transactions.
  `/api/dashboard/reconciliation` runs the
  `Morning Dispatched − Total Sold = Expected Evening Stock` formula per
  branch × product, `$match`-ing `DailyInventory` on the required
  `{branchId, date}` index.

## Split-payment flow

**Cash** — `POST /api/transactions/cash`. The terminal writes to an
IndexedDB queue first (works fully offline), attempts an immediate sync,
and is marked `SUCCESS` on the spot. Every queued sale carries a
client-generated `clientUuid`; the server's unique index on that field
makes a replayed offline batch a no-op rather than a duplicate sale.

**M-Pesa** — `POST /api/mpesa/stkpush` resolves the branch and product
price server-side, rate-limits per staff member (5/min), inserts a
`PENDING` transaction, and calls Safaricom's Daraja API. The terminal shows
"Awaiting Customer PIN entry…" and polls `/api/mpesa/status/:id` every 3s
as a fallback, while Safaricom's async result independently lands at the
**public, unauthenticated** `POST /api/mpesa/callback` — which logs every
hit (matched or not) to `MpesaCallbackLog` before touching anything, and
only ever updates a transaction it can match by a `checkoutRequestId` it
itself issued, and only while that transaction is still `PENDING`.

## Setup

### 1. MongoDB

Use MongoDB Atlas (a replica set by default — required for Change
Streams) for anything beyond local development, or run the bundled
`docker-compose.yml`, which stands up a local single-node replica set.

### 2. Server

```bash
cd server
cp .env.example .env   # fill in MongoDB URI, JWT secrets, Daraja credentials
npm install
npm run seed            # bootstraps the first SUPER_ADMIN + default product catalog
npm run dev              # or: npm run build && npm start
```

The seed script creates a `SUPER_ADMIN` from `SEED_SUPER_ADMIN_EMAIL` /
`SEED_SUPER_ADMIN_PASSWORD` in `.env`, and seeds a 5L/10L/20L product
catalog. Log in at `/login`, then use the **Staff** page to create
branches' managers and delivery workers (a `SUPER_ADMIN`-only capability
for manager/admin accounts; branch managers can add `DELIVERY` staff to
their own branch). Every account — delivery, manager, admin — signs in
the same way, with email and password, at the same page.

Note: the seed script creates the Super Admin with a placeholder phone
number (`254700000000`), kept only for contact/reference — it plays no
role in login. Update it via the Staff page whenever convenient.

### 3. Web

```bash
cd web
cp .env.example .env.local   # NEXT_PUBLIC_API_URL pointing at the server
npm install
npm run dev
```

### 4. Daraja (M-Pesa)

Same guidance as any Daraja integration: build against the sandbox
Shortcode/passkey first (values in `server/.env.example` are Safaricom's
published sandbox constants), tunnel `DARAJA_CALLBACK_URL` via ngrok for
local testing since Safaricom cannot reach `localhost`, and only switch
`DARAJA_ENV=production` with real production credentials once the full
push to callback round trip is verified end to end in sandbox.

## Deploying

```bash
docker compose up --build
```

brings up MongoDB (as a replica set), the API server, and the web app
together. In production, run `server/` and `web/` as separate deployments
(the compose file is one convenient way to do that, but any container
platform, or Atlas + a Node host + Vercel, works too) — just make sure:

- `server/` stays a long-lived process (not a serverless function) so
  Change Streams and Socket.io connections survive.
- `CORS_ORIGINS` on the server includes the web app's real production
  origin, and `web`'s `NEXT_PUBLIC_API_URL` points at the server's real
  production URL — both over HTTPS/WSS.
- `DARAJA_CALLBACK_URL` points at the server's public production URL.

## Going-live checklist

- [ ] MongoDB Atlas production cluster (replica set), backups enabled.
- [ ] Real, unique `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — never the
      placeholder values from `.env.example`.
- [ ] Daraja production Shortcode approved; `DARAJA_ENV=production`;
      `DARAJA_CALLBACK_URL` on the real domain, HTTPS.
- [ ] `DARAJA_CALLBACK_IP_ALLOWLIST` set once Safaricom's IP ranges are
      confirmed for your account.
- [ ] Change the seeded `SUPER_ADMIN` password immediately after first
      login; update its placeholder phone number if it needs terminal
      access too.
- [ ] Each branch's opening `DailyInventory.morningDispatched` entry
      process assigned to someone — this app doesn't auto-populate it.
- [ ] Alerting wired to server logs for `error`-level entries from the
      `mpesa/stkpush` and `mpesa/callback` routes — a payment failing
      silently is the worst failure mode here.
- [ ] `/api/health` wired into uptime monitoring.
- [ ] Confirm Change Streams are live (check server startup logs for
      "Socket.io + Transaction change stream initialized" with no
      following error) — this silently degrades to REST-only if MongoDB
      isn't a replica set, which is easy to miss.

## Extending this scaffold

Still worth adding before broader rollout: a self-serve "log out this
device" flow reachable before login (currently a manager must do it via
the Staff page), SMS/receipt confirmation to customers, pagination on the
activity feed and reconciliation history, and end-to-end tests against
Daraja's sandbox simulator as part of CI.
