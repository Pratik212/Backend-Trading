-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- Or set RUN_MIGRATIONS=1 and start the server to apply automatically

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL
);

INSERT INTO users (id, username, password) VALUES (1, 'Mukesh', '0308')
ON CONFLICT (username) DO NOTHING;

CREATE TABLE IF NOT EXISTS parties (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  address TEXT,
  gstin TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challans (
  id SERIAL PRIMARY KEY,
  challan_number TEXT UNIQUE NOT NULL,
  party_id INTEGER NOT NULL REFERENCES parties(id),
  date TEXT,
  amount REAL DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  role TEXT,
  joining_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS salaries (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id),
  month TEXT,
  year INTEGER,
  amount REAL NOT NULL,
  paid_date TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS office_expenses (
  id SERIAL PRIMARY KEY,
  category TEXT,
  description TEXT,
  amount REAL NOT NULL,
  date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challans_party ON challans(party_id);
CREATE INDEX IF NOT EXISTS idx_challans_number ON challans(challan_number);
