# LEGACY — not deployed, not used

This Express/Socket.io backend was AquaFlow's original API server. It has
since been fully ported into `../web/src/app/api/` and `../web/src/lib/server/`
as Next.js Route Handlers, so the whole app (frontend + API) deploys as a
single Vercel project. See the root `README.md` for the current
architecture and why the migration happened.

This folder is kept only for reference and is safe to delete. Nothing in
`web/` imports from or depends on anything here.
