# Huddle

Fantasy sports analytics dashboard. Built with Vite + React + TypeScript, Express, Clerk auth, Redux Toolkit, TanStack Query, and Tailwind v4.

## Getting started

### 1. Install dependencies

```bash
# Root (concurrently)
npm install

# Install client and server dependencies together
npm run install:all
```

Or install them separately:

```bash
# Client
npm install --prefix client

# Server
npm install --prefix server
```

### 2. Configure environment

Create a single `.env` file in the **project root** (not inside `client/` or `server/`):

```bash
cp .env.example .env
```

Required variables:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_...   # used by the client
CLERK_PUBLISHABLE_KEY=pk_...        # same value, used by the server
CLERK_SECRET_KEY=sk_...             # server only
DATABASE_URL=postgres://...         # Neon Postgres connection string (server only)
```

### 2a. Database (Neon Postgres)

The server uses Neon Postgres via Drizzle ORM. After setting `DATABASE_URL` in `.env`, push the schema:

```bash
npm run db:push --prefix server
```

To open the Drizzle Studio UI:

```bash
npm run db:studio --prefix server
```

### 3. Run

```bash
# Start both client and server together
npm run dev
```

This runs the server (port 4000) and the Vite dev client (port 3000) in parallel with labeled, color-coded output.

To run them separately:

```bash
# Server only
npm run dev --prefix server

# Client only
npm run dev --prefix client
```

### Build (server)

```bash
npm run build --prefix server
```

TypeScript compiles to `server/bin/` (git-ignored).
