# Mocha Behavior Contracts

Generated before pass 09 from the original Mocha Worker source. These are
minimum route-preservation contracts that the Hono-to-Next conversion must
satisfy before the import can be considered feature-preserving.

- GET /api/oauth/google/redirect_url -> apps/web/src/app/api/oauth/google/redirect_url/route.ts
  Evidence: `app.get("/api/oauth/google/redirect_url", async (c) => {`
- POST /api/sessions -> apps/web/src/app/api/sessions/route.ts
  Evidence: `app.post("/api/sessions", async (c) => {`
- GET /api/users/me -> apps/web/src/app/api/users/me/route.ts
  Evidence: `app.get("/api/users/me", authMiddleware, async (c) => {`
- GET /api/logout -> apps/web/src/app/api/logout/route.ts
  Evidence: `app.get("/api/logout", async (c) => {`
- GET /api/twilio-test -> apps/web/src/app/api/twilio-test/route.ts
  Evidence: `app.get("/api/twilio-test", async (c) => {`
- GET /api/processar-recorrentes-manual -> apps/web/src/app/api/processar-recorrentes-manual/route.ts
  Evidence: `app.get("/api/processar-recorrentes-manual", async (c) => {`
- GET /api/debug-recorrentes -> apps/web/src/app/api/debug-recorrentes/route.ts
  Evidence: `app.get("/api/debug-recorrentes", async (c) => {`
- GET /api/test-twilio -> apps/web/src/app/api/test-twilio/route.ts
  Evidence: `app.get("/api/test-twilio", async (c) => {`
