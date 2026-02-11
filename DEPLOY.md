# Deploy backend on Render (free tier)

Your backend is Node.js + Express and uses **Supabase** for the database. You deploy the **code** on Render; the **database** stays on Supabase.

---

## Before you start

1. **Supabase** – Project created, tables created (run `schema.sql` in SQL Editor), and you have the **Database connection string** (Session pooler URI is best for Render).
2. **Git** – Your project is in a Git repo (GitHub, GitLab, or Bitbucket) so Render can connect to it.

---

## Deploy on Render

### 1. Sign up and create a Web Service

1. Go to [render.com](https://render.com) and sign in (or create an account with GitHub).
2. Click **Dashboard** → **New +** → **Web Service**.

### 2. Connect your repository

1. Connect your Git provider (GitHub/GitLab/Bitbucket) if you haven’t already.
2. Select the **repository** that contains your M.K. Trading project (backend + frontend in one repo is fine).
3. Click **Connect**.

### 3. Configure the Web Service

Use these settings:

| Field | Value |
|-------|--------|
| **Name** | e.g. `mk-trading-api` |
| **Region** | Choose one close to you |
| **Branch** | `main` (or your default branch) |
| **Root Directory** | **`backend`** (important – so Render only uses the backend folder) |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |

### 4. Add environment variables

Scroll to **Environment** / **Environment Variables** and add:

| Key | Value | Notes |
|-----|--------|--------|
| **DATABASE_URL** | Your Supabase connection string | From Supabase → Project Settings → Database → Connection string (URI). Use **Session pooler** (port 6543) if possible. Replace `[YOUR-PASSWORD]` with your DB password. |
| **JWT_SECRET** | A long random string | Optional but recommended in production (e.g. generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). |

Do **not** add `PORT` – Render sets it automatically.

### 5. Deploy

1. Click **Create Web Service**.
2. Render will clone the repo, run `npm install`, then `npm start`. Wait for the build and deploy to finish.
3. When it’s live, you’ll see a URL like:  
   **`https://mk-trading-api.onrender.com`**  
   (your name may differ).

### 6. Test the API

- Open: `https://your-app-name.onrender.com/api/health`  
  You should see: `{"ok":true}`.
- Your frontend (e.g. on Vercel) should use this URL as **VITE_API_URL** (no trailing slash).

---

## After deployment

- **Free tier:** The service may **spin down** after ~15 minutes of no traffic. The first request after that can take 30–60 seconds; then it’s fast again.
- **Logs:** In Render dashboard, open your service → **Logs** to see errors and `Connected to Supabase (PostgreSQL).`
- **Frontend:** In Vercel (or wherever the frontend is hosted), set **VITE_API_URL** = `https://your-app-name.onrender.com` and redeploy the frontend so it talks to this backend.

---

## Deploy on Railway instead

1. Go to [railway.app](https://railway.app), sign in with GitHub.
2. **New Project** → **Deploy from GitHub repo** → select your repo.
3. After the first deploy, open the service → **Settings** → set **Root Directory** to **`backend`**.
4. **Variables** → add **DATABASE_URL** (Supabase connection string) and optionally **JWT_SECRET**.
5. Redeploy if needed. Use the generated URL (e.g. `https://xxx.up.railway.app`) as **VITE_API_URL** in your frontend.

---

## Troubleshooting

| Issue | What to do |
|-------|------------|
| Build fails | Ensure **Root Directory** is `backend` and **Build Command** is `npm install`. |
| "Database connection failed" | Check **DATABASE_URL** in Render env vars. Use Session pooler URI from Supabase. Ensure password has no typos and special characters are correct. |
| CORS errors from frontend | The backend already uses `cors()` and allows all origins; if you still see CORS errors, confirm the frontend is using the correct backend URL. |
| 503 or slow first request | Normal on free tier when the service was sleeping; wait for the instance to wake up. |
