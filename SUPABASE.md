# Backend with Supabase

The backend uses **Supabase** as the PostgreSQL database. The Node/Express app runs on your own host (e.g. Render, Railway); only the database is on Supabase.

## 1. Create Supabase project

- Go to [supabase.com](https://supabase.com) → **New project**.
- Set project name, database password (save it), and region.

## 2. Get connection string

- **Project Settings** → **Database** → **Connection string**.
- Choose **URI** and copy it.
- Replace `[YOUR-PASSWORD]` with your database password.

Examples:

- **Session pooler (recommended for Render/Railway):**  
  `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- **Direct:**  
  `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`

## 3. Create tables

- In Supabase: **SQL Editor** → **New query**.
- Paste the contents of **`schema.sql`** (in this folder) and run it.
- This creates all tables and inserts the default user (Mukesh / 0308).

## 4. Environment variables

Set these where you run or deploy the API:

| Variable        | Required | Description |
|----------------|----------|-------------|
| `DATABASE_URL` | Yes      | Supabase PostgreSQL connection string (from step 2) |
| `JWT_SECRET`   | No       | Secret for JWT (default in code; set in production) |
| `PORT`         | No       | Server port (default 5000) |
| `RUN_MIGRATIONS` | No    | Set to `1` to run `schema.sql` on startup (optional) |

## 5. Run locally

```bash
npm install
set DATABASE_URL=postgresql://postgres.xxx:YOUR_PASSWORD@...supabase.com:6543/postgres
node server.js
```

(Use `export DATABASE_URL=...` on Linux/Mac.)

## 6. Deploy API (e.g. Render)

- New **Web Service**, connect your repo.
- **Root directory:** `backend`
- **Build:** `npm install`
- **Start:** `npm start`
- **Environment:** Add `DATABASE_URL` (paste your Supabase connection string) and optionally `JWT_SECRET`.

After deploy, use the service URL (e.g. `https://mk-trading-api.onrender.com`) as your API base. In the frontend, set `VITE_API_URL` to this URL when building.
