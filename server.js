require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'mk-trading-secret-key-2024';

// Supabase / PostgreSQL: use DATABASE_URL from Supabase Dashboard → Project Settings → Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// Optional: run schema on startup (e.g. first deploy). Or run schema.sql manually in Supabase SQL Editor.
async function runMigrations() {
  if (!process.env.RUN_MIGRATIONS || !process.env.DATABASE_URL) return;
  const schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) return;
  const sql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(sql);
  console.log('Migrations applied.');
}

app.use(cors());
app.use(express.json());

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Login required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// ----- Auth -----
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const { rows } = await pool.query(
      'SELECT * FROM users WHERE username = $1 AND password = $2',
      [username, String(password)]
    );
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----- Parties -----
app.get('/api/parties', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM parties ORDER BY name');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/parties', authMiddleware, async (req, res) => {
  try {
    const { name, contact, address, gstin } = req.body;
    if (!name) return res.status(400).json({ error: 'Party name required' });
    const { rows } = await pool.query(
      'INSERT INTO parties (name, contact, address, gstin) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, contact || null, address || null, gstin || null]
    );
    res.status(201).json({ id: rows[0].id, name, contact, address, gstin });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/parties/:id', authMiddleware, async (req, res) => {
  try {
    const { name, contact, address, gstin } = req.body;
    await pool.query(
      'UPDATE parties SET name=$1, contact=$2, address=$3, gstin=$4 WHERE id=$5',
      [name, contact, address, gstin, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/parties/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM parties WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/parties/search-by-challan', authMiddleware, async (req, res) => {
  try {
    const challanNumber = req.query.challanNumber?.trim();
    if (!challanNumber) return res.status(400).json({ error: 'challanNumber required' });
    const { rows } = await pool.query(
      `SELECT p.*, c.challan_number, c.date AS challan_date, c.amount AS challan_amount, c.description
       FROM challans c
       JOIN parties p ON p.id = c.party_id
       WHERE c.challan_number = $1`,
      [challanNumber]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'No party found for this challan number' });
    res.json(row);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----- Challans -----
app.get('/api/challans', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT c.*, p.name AS party_name, p.contact AS party_contact
      FROM challans c
      LEFT JOIN parties p ON p.id = c.party_id
      ORDER BY c.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/challans', authMiddleware, async (req, res) => {
  try {
    const { challan_number, party_id, date, amount, description } = req.body;
    if (!challan_number || !party_id) return res.status(400).json({ error: 'challan_number and party_id required' });
    const { rows } = await pool.query(
      'INSERT INTO challans (challan_number, party_id, date, amount, description) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [challan_number, party_id, date || null, amount || 0, description || null]
    );
    res.status(201).json({ id: rows[0].id, challan_number, party_id, date, amount, description });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/challans/:id', authMiddleware, async (req, res) => {
  try {
    const { challan_number, party_id, date, amount, description } = req.body;
    await pool.query(
      'UPDATE challans SET challan_number=$1, party_id=$2, date=$3, amount=$4, description=$5 WHERE id=$6',
      [challan_number, party_id, date, amount, description, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/challans/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM challans WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/challans/search-by-party', authMiddleware, async (req, res) => {
  try {
    const partyId = req.query.partyId?.trim();
    const partyName = req.query.partyName?.trim();
    if (!partyId && !partyName) return res.status(400).json({ error: 'partyId or partyName required' });
    let rows;
    if (partyId) {
      const r = await pool.query(
        `SELECT c.*, p.name AS party_name FROM challans c
         LEFT JOIN parties p ON p.id = c.party_id
         WHERE c.party_id = $1
         ORDER BY c.date DESC`,
        [partyId]
      );
      rows = r.rows;
    } else {
      const r = await pool.query(
        `SELECT c.*, p.name AS party_name FROM challans c
         LEFT JOIN parties p ON p.id = c.party_id
         WHERE LOWER(p.name) LIKE $1
         ORDER BY c.date DESC`,
        ['%' + partyName.toLowerCase() + '%']
      );
      rows = r.rows;
    }
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----- Employees -----
app.get('/api/employees', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM employees ORDER BY name');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/employees', authMiddleware, async (req, res) => {
  try {
    const { name, contact, role, joining_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Employee name required' });
    const { rows } = await pool.query(
      'INSERT INTO employees (name, contact, role, joining_date) VALUES ($1, $2, $3, $4) RETURNING id',
      [name, contact || null, role || null, joining_date || null]
    );
    res.status(201).json({ id: rows[0].id, name, contact, role, joining_date });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/employees/:id', authMiddleware, async (req, res) => {
  try {
    const { name, contact, role, joining_date } = req.body;
    await pool.query(
      'UPDATE employees SET name=$1, contact=$2, role=$3, joining_date=$4 WHERE id=$5',
      [name, contact, role, joining_date, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/employees/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM employees WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----- Salaries -----
app.get('/api/salaries', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT s.*, e.name AS employee_name FROM salaries s
      LEFT JOIN employees e ON e.id = s.employee_id
      ORDER BY s.year DESC, s.month DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/salaries', authMiddleware, async (req, res) => {
  try {
    const { employee_id, month, year, amount, paid_date, notes } = req.body;
    if (!employee_id || amount == null) return res.status(400).json({ error: 'employee_id and amount required' });
    const { rows } = await pool.query(
      'INSERT INTO salaries (employee_id, month, year, amount, paid_date, notes) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [employee_id, month || null, year || null, amount, paid_date || null, notes || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/salaries/:id', authMiddleware, async (req, res) => {
  try {
    const { employee_id, month, year, amount, paid_date, notes } = req.body;
    await pool.query(
      'UPDATE salaries SET employee_id=$1, month=$2, year=$3, amount=$4, paid_date=$5, notes=$6 WHERE id=$7',
      [employee_id, month, year, amount, paid_date, notes, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/salaries/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM salaries WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----- Office Expenses -----
app.get('/api/office-expenses', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM office_expenses ORDER BY date DESC');
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/office-expenses', authMiddleware, async (req, res) => {
  try {
    const { category, description, amount, date } = req.body;
    if (amount == null) return res.status(400).json({ error: 'amount required' });
    const { rows } = await pool.query(
      'INSERT INTO office_expenses (category, description, amount, date) VALUES ($1, $2, $3, $4) RETURNING id',
      [category || null, description || null, amount, date || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/office-expenses/:id', authMiddleware, async (req, res) => {
  try {
    const { category, description, amount, date } = req.body;
    await pool.query(
      'UPDATE office_expenses SET category=$1, description=$2, amount=$3, date=$4 WHERE id=$5',
      [category, description, amount, date, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/office-expenses/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM office_expenses WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----- Payments -----
app.get('/api/payments', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT py.*, p.name AS party_name
      FROM payments py
      LEFT JOIN parties p ON p.id = py.party_id
      ORDER BY py.payment_date DESC, py.created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/payments', authMiddleware, async (req, res) => {
  try {
    const { party_id, amount, payment_date, notes } = req.body;
    if (!party_id || amount == null) return res.status(400).json({ error: 'party_id and amount required' });
    const { rows } = await pool.query(
      'INSERT INTO payments (party_id, amount, payment_date, notes) VALUES ($1, $2, $3, $4) RETURNING id',
      [party_id, amount, payment_date || null, notes || null]
    );
    res.status(201).json({ id: rows[0].id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/payments/:id', authMiddleware, async (req, res) => {
  try {
    const { party_id, amount, payment_date, notes } = req.body;
    await pool.query(
      'UPDATE payments SET party_id=$1, amount=$2, payment_date=$3, notes=$4 WHERE id=$5',
      [party_id, amount, payment_date, notes, req.params.id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/payments/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM payments WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----- Reports: part-wise & totals -----
// Last month: part-wise payment (group by party, payment_date in last month)
app.get('/api/reports/last-month-payments', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id AS party_id, p.name AS party_name,
             COALESCE(SUM(py.amount), 0) AS total_payment
      FROM parties p
      LEFT JOIN payments py ON py.party_id = p.id
        AND py.payment_date >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM-DD')
        AND py.payment_date < TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM-DD')
      GROUP BY p.id, p.name
      HAVING COALESCE(SUM(py.amount), 0) > 0
      ORDER BY total_payment DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Current month: part-wise payment
app.get('/api/reports/current-month-payments', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT p.id AS party_id, p.name AS party_name,
             COALESCE(SUM(py.amount), 0) AS total_payment
      FROM parties p
      LEFT JOIN payments py ON py.party_id = p.id
        AND py.payment_date >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM-DD')
        AND py.payment_date <= CURRENT_DATE
      GROUP BY p.id, p.name
      HAVING COALESCE(SUM(py.amount), 0) > 0
      ORDER BY total_payment DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Total outstanding per party (challan total - payment total)
app.get('/api/reports/outstanding', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH challan_totals AS (
        SELECT party_id, COALESCE(SUM(amount), 0) AS total_challan
        FROM challans GROUP BY party_id
      ),
      payment_totals AS (
        SELECT party_id, COALESCE(SUM(amount), 0) AS total_paid
        FROM payments GROUP BY party_id
      )
      SELECT p.id AS party_id, p.name AS party_name,
             COALESCE(ct.total_challan, 0) AS total_challan,
             COALESCE(pt.total_paid, 0) AS total_paid,
             GREATEST(COALESCE(ct.total_challan, 0) - COALESCE(pt.total_paid, 0), 0) AS outstanding
      FROM parties p
      LEFT JOIN challan_totals ct ON ct.party_id = p.id
      LEFT JOIN payment_totals pt ON pt.party_id = p.id
      WHERE COALESCE(ct.total_challan, 0) > 0
      ORDER BY outstanding DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Total incoming (sum of all payments; optional query: month=current|last|all)
app.get('/api/reports/total-incoming', authMiddleware, async (req, res) => {
  try {
    const month = req.query.month || 'all';
    let whereClause = '';
    if (month === 'current') {
      whereClause = `WHERE payment_date >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM-DD') AND payment_date <= CURRENT_DATE`;
    } else if (month === 'last') {
      whereClause = `WHERE payment_date >= TO_CHAR(DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month'), 'YYYY-MM-DD')
        AND payment_date < TO_CHAR(DATE_TRUNC('month', CURRENT_DATE), 'YYYY-MM-DD')`;
    }
    const { rows } = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) AS total_incoming FROM payments ${whereClause}
    `);
    res.json({ total_incoming: Number(rows[0].total_incoming) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Database error' });
  }
});

// Health check (works without DB for load balancers)
app.get('/api/health', (req, res) => res.json({ ok: true }));

async function start() {
  if (process.env.DATABASE_URL) {
    try {
      await runMigrations();
      await pool.query('SELECT 1');
      console.log('Connected to Supabase (PostgreSQL).');
    } catch (e) {
      console.error('Database connection failed. Set DATABASE_URL and run schema.sql in Supabase SQL Editor.', e.message);
      process.exit(1);
    }
  } else {
    console.warn('DATABASE_URL not set. Using Supabase is required for production.');
  }
  app.listen(PORT, () => console.log(`M.K. Trading API running on http://localhost:${PORT}`));
}

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
