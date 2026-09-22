const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { OAuth2Client } = require('google-auth-library');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const client = new OAuth2Client(CLIENT_ID);

const app = express();
const PORT = 8080;

// --- Database Setup ---
const db = new Database(path.join(__dirname, 'spendwise.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    phone_number TEXT,
    preferences TEXT,
    auth_provider TEXT DEFAULT 'local',
    oauth_id TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS accounts (
    account_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider_name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    balance REAL DEFAULT 0,
    account_mask TEXT,
    status TEXT DEFAULT 'Connected',
    last_synced DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    account_id INTEGER,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense', 'transfer', 'investment')),
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    merchant_name TEXT,
    date DATE NOT NULL,
    description TEXT,
    payment_method TEXT,
    notes TEXT,
    status TEXT DEFAULT 'completed',
    is_recurring BOOLEAN DEFAULT 0,
    confidence INTEGER DEFAULT 100,
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS merchants (
    merchant_id INTEGER PRIMARY KEY AUTOINCREMENT,
    merchant_name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    total_spent REAL DEFAULT 0.00,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS budgets (
    budget_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    monthly_limit REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS goals (
    goal_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    goal_name TEXT NOT NULL,
    target_amount REAL NOT NULL,
    current_amount REAL DEFAULT 0.00,
    deadline DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    sub_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sub_name TEXT NOT NULL,
    amount REAL NOT NULL,
    billing_cycle TEXT NOT NULL CHECK(billing_cycle IN ('monthly', 'yearly')),
    next_billing_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS debts (
    debt_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    debt_name TEXT NOT NULL,
    debt_type TEXT NOT NULL,
    outstanding_balance REAL NOT NULL,
    interest_rate REAL DEFAULT 0.00,
    minimum_payment REAL DEFAULT 0.00,
    next_payment_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS net_worth_history (
    history_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_assets REAL DEFAULT 0.00,
    total_liabilities REAL DEFAULT 0.00,
    net_worth REAL DEFAULT 0.00,
    recorded_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
  );
`);

// Run column migrations safely if database existed prior to update
try { db.exec("ALTER TABLE transactions ADD COLUMN payment_method TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE transactions ADD COLUMN notes TEXT;"); } catch (e) {}

console.log('Database and tables initialized successfully using SQLite.');

// Helper to add real notifications to DB
function createNotification(userId, type, message) {
  try {
    db.prepare('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)')
      .run(userId, type, message);
  } catch (e) {
    console.error('Notification insertion error:', e);
  }
}

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: 'spendwise-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 60 * 1000 }
}));

// Serve static files from webapp directory
app.use(express.static(path.join(__dirname, 'src', 'main', 'webapp')));

// --- Auth Helper ---
function getUser(req, res) {
  if (!req.session || !req.session.user) {
    res.status(401).json({ error: 'Not logged in' });
    return null;
  }
  return req.session.user;
}

// ===================== AUTH API =====================

app.get('/api/auth', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  res.json({
    name: user.name,
    email: user.email,
    userId: user.userId,
    createdAt: user.createdAt || null
  });
});

app.get('/api/auth/', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  res.json({
    name: user.name,
    email: user.email,
    userId: user.userId,
    createdAt: user.createdAt || null
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (row && row.password && bcrypt.compareSync(password, row.password)) {
    req.session.user = {
      userId: row.user_id,
      name: row.name,
      email: row.email,
      createdAt: row.created_at
    };
    res.json({ success: true, message: 'Login successful', redirect: 'dashboard.html' });
  } else if (row && row.auth_provider === 'google') {
    res.status(401).json({ success: false, error: 'Please log in with Google.' });
  } else {
    res.status(401).json({ success: false, error: 'Invalid email or password' });
  }
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: 'No Google credential provided.' });
  }
  try {
    const ticket = await client.verifyIdToken({ idToken: credential, audience: CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name } = payload;
    
    let userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (userRow) {
      if (!userRow.oauth_id) {
        db.prepare("UPDATE users SET oauth_id = ?, auth_provider = 'google' WHERE user_id = ?").run(googleId, userRow.user_id);
      }
    } else {
      const result = db.prepare("INSERT INTO users (name, email, oauth_id, auth_provider) VALUES (?, ?, ?, 'google')").run(name, email, googleId);
      userRow = db.prepare('SELECT * FROM users WHERE user_id = ?').get(result.lastInsertRowid);
    }
    
    req.session.user = { userId: userRow.user_id, name: userRow.name, email: userRow.email, createdAt: userRow.created_at };
    res.json({ success: true, message: 'Google Login successful', redirect: 'dashboard.html' });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(401).json({ success: false, error: 'Google authentication failed.' });
  }
});

app.post('/api/auth/google/mock', (req, res) => {
  try {
    const email = "demouser@gmail.com";
    const name = "Demo User";
    const googleId = "mock-google-id-12345";
    
    let userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (userRow) {
      if (!userRow.oauth_id) {
        db.prepare("UPDATE users SET oauth_id = ?, auth_provider = 'google' WHERE user_id = ?").run(googleId, userRow.user_id);
      }
    } else {
      const result = db.prepare("INSERT INTO users (name, email, oauth_id, auth_provider) VALUES (?, ?, ?, 'google')").run(name, email, googleId);
      userRow = db.prepare('SELECT * FROM users WHERE user_id = ?').get(result.lastInsertRowid);
    }
    
    req.session.user = { userId: userRow.user_id, name: userRow.name, email: userRow.email, createdAt: userRow.created_at };
    res.json({ success: true, message: 'Mock Google Login successful', redirect: 'dashboard.html' });
  } catch (err) {
    console.error('Mock Auth Error:', err);
    res.status(500).json({ success: false, error: 'Mock authentication failed.' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || !name.trim() || !email.trim() || !password.trim()) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!/^[A-Za-z0-9+_.-]+@(.+)$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must meet the required requirements.' });
  }
  const existing = db.prepare('SELECT count(*) as cnt FROM users WHERE email = ?').get(email);
  if (existing && existing.cnt > 0) {
    return res.status(409).json({ error: 'Email address is already registered.' });
  }
  const hashed = bcrypt.hashSync(password, 12);
  try {
    const result = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name.trim(), email.trim(), hashed);
    createNotification(result.lastInsertRowid, 'welcome', `Welcome to SpendWise, ${name.trim()}! Start tracking your finances.`);
    res.json({ success: true, message: 'Registration successful!', redirect: 'login.html' });
  } catch (e) {
    res.status(500).json({ error: 'Unable to connect to the server. Please try again.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true, redirect: 'login.html' });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  res.json({ success: true, resetLink: `reset-password.html?email=${encodeURIComponent(email)}` });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Invalid data or password too short.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const hashed = bcrypt.hashSync(newPassword, 12);
  try {
    db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hashed, email);
    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update password.' });
  }
});

// ===================== TRANSACTIONS API =====================

app.get('/api/transactions', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  
  const { search, dateRange, startDate, endDate } = req.query;
  let sql = 'SELECT * FROM transactions WHERE user_id=?';
  const params = [user.userId];

  if (search && search.trim()) {
    const q = '%' + search.trim() + '%';
    sql += ' AND (description LIKE ? OR merchant_name LIKE ? OR category LIKE ? OR payment_method LIKE ? OR CAST(amount AS TEXT) LIKE ?)';
    params.push(q, q, q, q, q);
  }

  if (dateRange) {
    if (dateRange === 'today') {
      sql += " AND date = date('now')";
    } else if (dateRange === 'week') {
      sql += " AND date >= date('now', '-7 days')";
    } else if (dateRange === 'month') {
      sql += " AND strftime('%m', date) = strftime('%m', 'now') AND strftime('%Y', date) = strftime('%Y', 'now')";
    } else if (dateRange === 'last_month') {
      sql += " AND strftime('%m', date) = strftime('%m', 'now', '-1 month') AND strftime('%Y', date) = strftime('%Y', 'now', '-1 month')";
    } else if (dateRange === 'custom' && startDate && endDate) {
      sql += " AND date >= ? AND date <= ?";
      params.push(startDate, endDate);
    }
  }

  sql += ' ORDER BY date DESC, created_at DESC';
  const rows = db.prepare(sql).all(...params);

  res.json(rows.map(r => ({
    transactionId: r.transaction_id,
    userId: r.user_id,
    type: r.type,
    amount: r.amount,
    category: r.category,
    merchantName: r.merchant_name || r.description,
    paymentMethod: r.payment_method || 'Other',
    notes: r.notes || '',
    date: r.date,
    description: r.description,
    createdAt: r.created_at
  })));
});

app.post('/api/transactions', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    let { type, amount, category, date, description, merchant, payment_method, notes, account_id } = req.body;
    
    amount = parseFloat(amount);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0.' });
    }
    if (!type || !['income', 'expense', 'transfer', 'investment'].includes(type)) {
      return res.status(400).json({ error: 'Valid transaction type is required.' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Category is required.' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Valid date is required.' });
    }

    const descText = (description || merchant || '').trim();
    const merchantName = (merchant || descText || category).trim();
    const paymentMethod = payment_method || 'Cash';
    const notesText = notes || '';

    let isRecurring = 0;
    const recurringKeywords = ['netflix', 'spotify', 'prime', 'gym', 'rent', 'electricity', 'water', 'broadband', 'jio', 'airtel'];
    if (recurringKeywords.some(kw => descText.toLowerCase().includes(kw))) {
      isRecurring = 1;
    }

    db.prepare(`
      INSERT INTO transactions (user_id, account_id, type, amount, category, merchant_name, date, description, payment_method, notes, is_recurring)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.userId, account_id || null, type, amount, category.trim(), merchantName, date, descText, paymentMethod, notesText, isRecurring);

    createNotification(
      user.userId,
      'transaction_added',
      `${type.toUpperCase()}: ₹${amount.toLocaleString('en-IN')} added for ${descText || category} (${paymentMethod}).`
    );

    res.json({ success: true, message: 'Transaction added successfully' });
  } catch (e) {
    res.status(400).json({ error: 'Failed to add transaction: ' + e.message });
  }
});

app.put('/api/transactions', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { transactionId, type, amount, category, date, description, merchant, payment_method, notes } = req.body;
    const txId = parseInt(transactionId || req.body.id);
    const parsedAmount = parseFloat(amount);
    
    if (!txId || isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: 'Valid transaction ID and amount > 0 are required.' });
    }

    const descText = (description || merchant || '').trim();
    const merchantName = (merchant || descText || category).trim();
    const paymentMethod = payment_method || 'Cash';
    const notesText = notes || '';

    const result = db.prepare(`
      UPDATE transactions
      SET type=?, amount=?, category=?, merchant_name=?, date=?, description=?, payment_method=?, notes=?
      WHERE transaction_id=? AND user_id=?
    `).run(type, parsedAmount, category, merchantName, date, descText, paymentMethod, notesText, txId, user.userId);

    if (result.changes > 0) {
      createNotification(
        user.userId,
        'transaction_updated',
        `Transaction updated: ₹${parsedAmount.toLocaleString('en-IN')} for ${descText || category}.`
      );
      res.json({ success: true, message: 'Transaction updated successfully' });
    } else {
      res.status(444).json({ error: 'Transaction not found or unauthorized.' });
    }
  } catch (e) {
    res.status(400).json({ error: 'Failed to update transaction: ' + e.message });
  }
});

app.delete('/api/transactions', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const id = parseInt(req.query.id || req.body.id);
    if (!id) return res.status(400).json({ error: 'Transaction ID is required.' });

    const existing = db.prepare('SELECT * FROM transactions WHERE transaction_id=? AND user_id=?').get(id, user.userId);
    const result = db.prepare('DELETE FROM transactions WHERE transaction_id=? AND user_id=?').run(id, user.userId);
    
    if (result.changes > 0) {
      createNotification(
        user.userId,
        'transaction_deleted',
        `Transaction of ₹${existing ? existing.amount : ''} deleted.`
      );
      res.json({ success: true, message: 'Transaction deleted successfully' });
    } else {
      res.status(404).json({ error: 'Transaction not found.' });
    }
  } catch (e) {
    res.status(400).json({ error: 'Failed to delete transaction: ' + e.message });
  }
});

// ===================== BUDGETS API =====================

app.get('/api/budgets', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const budgets = db.prepare('SELECT * FROM budgets WHERE user_id=?').all(user.userId);
  const result = budgets.map(b => {
    const spentRow = db.prepare(
      "SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE user_id=? AND type='expense' AND category=? AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now')"
    ).get(user.userId, b.category);
    const spent = spentRow ? spentRow.total : 0;
    const pct = b.monthly_limit > 0 ? (spent / b.monthly_limit) * 100 : 0;
    return {
      budgetId: b.budget_id,
      category: b.category,
      monthlyLimit: b.monthly_limit,
      spent,
      percentage: pct
    };
  });
  res.json(result);
});

app.post('/api/budgets', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { category, monthlyLimit } = req.body;
    if (!category || !monthlyLimit || parseFloat(monthlyLimit) <= 0) {
      return res.status(400).json({ error: 'Valid category and limit > 0 are required.' });
    }
    db.prepare('INSERT INTO budgets (user_id, category, monthly_limit) VALUES (?, ?, ?)')
      .run(user.userId, category, parseFloat(monthlyLimit));
    
    createNotification(user.userId, 'budget_created', `Budget set for ${category}: ₹${parseFloat(monthlyLimit).toLocaleString('en-IN')}`);
    res.json({ success: true, message: 'Budget added successfully' });
  } catch (e) {
    res.status(400).json({ error: 'Failed to create budget: ' + e.message });
  }
});

app.delete('/api/budgets', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const id = parseInt(req.query.id || req.body.id);
    const result = db.prepare('DELETE FROM budgets WHERE budget_id=? AND user_id=?').run(id, user.userId);
    res.json(result.changes > 0 ? { success: true } : { error: 'Budget not found' });
  } catch (e) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// ===================== GOALS API =====================

app.get('/api/goals', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const goals = db.prepare('SELECT * FROM goals WHERE user_id=?').all(user.userId);
  res.json(goals.map(g => ({
    goalId: g.goal_id,
    userId: g.user_id,
    goalName: g.goal_name,
    targetAmount: g.target_amount,
    currentAmount: g.current_amount,
    deadline: g.deadline
  })));
});

app.post('/api/goals', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { goalName, targetAmount, deadline } = req.body;
    if (!goalName || !targetAmount || parseFloat(targetAmount) <= 0) {
      return res.status(400).json({ error: 'Valid goal name and target > 0 are required.' });
    }
    db.prepare('INSERT INTO goals (user_id, goal_name, target_amount, current_amount, deadline) VALUES (?, ?, ?, 0, ?)')
      .run(user.userId, goalName.trim(), parseFloat(targetAmount), deadline || null);
    
    createNotification(user.userId, 'goal_created', `Savings Goal created: "${goalName.trim()}" (Target: ₹${parseFloat(targetAmount).toLocaleString('en-IN')})`);
    res.json({ success: true, message: 'Goal created successfully' });
  } catch (e) {
    res.status(400).json({ error: 'Failed to create goal: ' + e.message });
  }
});

app.post('/api/goals/contribute', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { goalId, amount } = req.body;
    const parsedAmt = parseFloat(amount);
    if (!goalId || isNaN(parsedAmt) || parsedAmt <= 0) {
      return res.status(400).json({ error: 'Valid goal ID and contribution amount > 0 are required.' });
    }
    const result = db.prepare('UPDATE goals SET current_amount = current_amount + ? WHERE goal_id=? AND user_id=?')
      .run(parsedAmt, parseInt(goalId), user.userId);
    
    if (result.changes > 0) {
      createNotification(user.userId, 'goal_updated', `Contributed ₹${parsedAmt.toLocaleString('en-IN')} to savings goal.`);
      res.json({ success: true, message: 'Contribution added' });
    } else {
      res.status(404).json({ error: 'Goal not found' });
    }
  } catch (e) {
    res.status(400).json({ error: 'Failed to add contribution: ' + e.message });
  }
});

app.delete('/api/goals', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const id = parseInt(req.query.id || req.body.id);
    const result = db.prepare('DELETE FROM goals WHERE goal_id=? AND user_id=?').run(id, user.userId);
    res.json(result.changes > 0 ? { success: true } : { error: 'Goal not found' });
  } catch (e) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// ===================== SUBSCRIPTIONS API =====================

app.get('/api/subscriptions', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id=? ORDER BY next_billing_date ASC').all(user.userId);
  const mapped = subs.map(s => ({
    subId: s.sub_id,
    userId: s.user_id,
    subName: s.sub_name,
    amount: s.amount,
    billingCycle: s.billing_cycle,
    nextBillingDate: s.next_billing_date
  }));
  let totalMonthlyCost = 0;
  let totalYearlyCost = 0;
  for (const s of mapped) {
    if (s.billingCycle === 'monthly') {
      totalMonthlyCost += s.amount;
      totalYearlyCost += s.amount * 12;
    } else {
      totalMonthlyCost += s.amount / 12;
      totalYearlyCost += s.amount;
    }
  }
  res.json({ subscriptions: mapped, totalMonthlyCost, totalYearlyCost });
});

app.post('/api/subscriptions', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { subName, amount, billingCycle, nextBillingDate } = req.body;
    db.prepare('INSERT INTO subscriptions (user_id, sub_name, amount, billing_cycle, next_billing_date) VALUES (?, ?, ?, ?, ?)')
      .run(user.userId, subName, parseFloat(amount), billingCycle, nextBillingDate || null);
    res.json({ success: true, message: 'Subscription added' });
  } catch (e) {
    res.status(400).json({ error: 'Invalid data: ' + e.message });
  }
});

app.delete('/api/subscriptions', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const id = parseInt(req.query.id || req.body.id);
    const result = db.prepare('DELETE FROM subscriptions WHERE sub_id=? AND user_id=?').run(id, user.userId);
    res.json(result.changes > 0 ? { success: true } : { error: 'Subscription not found' });
  } catch (e) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// ===================== DASHBOARD API =====================

app.get('/api/dashboard', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const userId = user.userId;

  const getSum = (sql, params = [userId]) => {
    const row = db.prepare(sql).get(...params);
    return row ? Object.values(row)[0] : 0;
  };

  const totalIncome = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='income'");
  const totalExpense = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense'");
  
  const monthlyIncome = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='income' AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now')");
  const monthlyExpense = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now')");
  const weeklyExpense = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND strftime('%Y-%W', date)=strftime('%Y-%W', 'now')");
  const dailyExpense = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND date=date('now')");
  
  const prevMonthIncome = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='income' AND strftime('%m', date)=strftime('%m', 'now', '-1 month') AND strftime('%Y', date)=strftime('%Y', 'now', '-1 month')");
  const prevMonthExpense = getSum("SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id=? AND type='expense' AND strftime('%m', date)=strftime('%m', 'now', '-1 month') AND strftime('%Y', date)=strftime('%Y', 'now', '-1 month')");

  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id=?').all(userId).map(a => ({
    accountId: a.account_id, providerName: a.provider_name,
    accountType: a.account_type, balance: a.balance,
    status: a.status, lastSynced: a.last_synced
  }));

  const accountsTotalBalance = accounts.reduce((sum, a) => sum + (parseFloat(a.balance) || 0), 0);
  const totalBalance = accounts.length > 0 ? accountsTotalBalance + (totalIncome - totalExpense) : (totalIncome - totalExpense);
  const totalSavings = Math.max(0, totalBalance);

  const recentTransactions = db.prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC, created_at DESC LIMIT 15').all(userId).map(r => ({
    transactionId: r.transaction_id, userId: r.user_id, type: r.type, amount: r.amount,
    category: r.category, merchantName: r.merchant_name || r.description, date: r.date,
    paymentMethod: r.payment_method || 'Other', notes: r.notes || '',
    description: r.description, createdAt: r.created_at
  }));

  const monthlyTrend = db.prepare(
    "SELECT strftime('%Y-%m', date) as month, type, SUM(amount) as total FROM transactions WHERE user_id=? AND date >= date('now', '-6 months') GROUP BY strftime('%Y-%m', date), type ORDER BY month"
  ).all(userId);

  const catRows = db.prepare(
    "SELECT category, SUM(amount) as total FROM transactions WHERE user_id=? AND type='expense' AND strftime('%m', date)=strftime('%m', 'now') AND strftime('%Y', date)=strftime('%Y', 'now') GROUP BY category"
  ).all(userId);
  const categoryExpenses = {};
  catRows.forEach(r => { categoryExpenses[r.category] = r.total; });

  const budgets = db.prepare('SELECT * FROM budgets WHERE user_id=?').all(userId).map(b => ({
    budgetId: b.budget_id, userId: b.user_id, category: b.category, monthlyLimit: b.monthly_limit
  }));

  const goals = db.prepare('SELECT * FROM goals WHERE user_id=?').all(userId).map(g => {
    const progress = g.target_amount > 0 ? Math.min((g.current_amount / g.target_amount) * 100, 100) : 0;
    return {
      goalId: g.goal_id, goalName: g.goal_name, currentAmount: g.current_amount,
      targetAmount: g.target_amount, deadline: g.deadline, progress
    };
  });

  const subs = db.prepare('SELECT * FROM subscriptions WHERE user_id=? ORDER BY next_billing_date ASC').all(userId).map(s => ({
    subId: s.sub_id, userId: s.user_id, subName: s.sub_name, amount: s.amount,
    billingCycle: s.billing_cycle, nextBillingDate: s.next_billing_date
  }));

  let monthlySubs = 0;
  subs.forEach(s => { monthlySubs += s.billingCycle === 'monthly' ? s.amount : s.amount / 12; });

  let score = 0;
  if (monthlyIncome > 0) {
    const savingsRate = (monthlyIncome - monthlyExpense) / monthlyIncome;
    if (savingsRate >= 0.30) score += 40;
    else if (savingsRate >= 0.20) score += 30;
    else if (savingsRate >= 0.10) score += 20;
    else if (savingsRate >= 0) score += 10;
  } else { score += 5; }

  if (budgets.length > 0) {
    let withinBudget = 0;
    budgets.forEach(b => {
      const spent = categoryExpenses[b.category] || 0;
      if (spent <= b.monthlyLimit) withinBudget++;
    });
    score += Math.round((withinBudget / budgets.length) * 30);
  } else { score += 15; }

  if (totalBalance > 0) {
    score += 20;
    if (monthlyIncome > 0 && monthlyExpense < monthlyIncome * 0.7) score += 10;
  } else if (totalBalance === 0) { score += 10; }
  score = Math.min(score, 100);

  const insights = [];
  const addInsight = (type, message) => insights.push({ type, message });

  if (Object.keys(categoryExpenses).length > 0) {
    let highestCat = '', highestAmt = 0;
    for (const [cat, amt] of Object.entries(categoryExpenses)) {
      if (amt > highestAmt) { highestAmt = amt; highestCat = cat; }
    }
    if (highestAmt > 0) addInsight('info', `🔍 ${highestCat} is your highest spending category this month at ₹${highestAmt.toFixed(0)}.`);
  }

  if (monthlyIncome > 0) {
    const savingsRate = ((monthlyIncome - monthlyExpense) / monthlyIncome) * 100;
    if (savingsRate >= 30) addInsight('success', `🎉 Great job! You're saving ${savingsRate.toFixed(0)}% of your income this month. Keep it up!`);
    else if (savingsRate >= 10) addInsight('warning', `💡 You're saving ${savingsRate.toFixed(0)}% of your income. Try to aim for 20-30% for better financial health.`);
    else if (savingsRate >= 0) addInsight('danger', `⚠️ Your savings rate is only ${savingsRate.toFixed(0)}%. Consider cutting non-essential expenses.`);
    else addInsight('danger', `🚨 You're spending more than you earn this month! Review your expenses immediately.`);
  }

  const cashFlowForecast = totalBalance + monthlyIncome - monthlyExpense - monthlySubs;

  // --- Dynamic REAL Calculation for Safe to Spend Today ---
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthIndex = now.getMonth();
  const currentDay = now.getDate();
  const daysInMonth = new Date(currentYear, currentMonthIndex + 1, 0).getDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

  let totalBudgetLimit = 0;
  let totalBudgetSpent = 0;
  budgets.forEach(b => {
    totalBudgetLimit += (parseFloat(b.monthlyLimit) || 0);
    totalBudgetSpent += (categoryExpenses[b.category] || 0);
  });
  const remainingMonthlyBudget = totalBudgetLimit > 0 ? Math.max(0, totalBudgetLimit - totalBudgetSpent) : null;

  let upcomingSubscriptions = 0;
  subs.forEach(s => {
    if (s.nextBillingDate) {
      const bDate = new Date(s.nextBillingDate);
      if (bDate.getFullYear() === currentYear && bDate.getMonth() === currentMonthIndex && bDate.getDate() >= currentDay) {
        upcomingSubscriptions += s.amount;
      }
    } else {
      upcomingSubscriptions += s.billingCycle === 'monthly' ? s.amount : s.amount / 12;
    }
  });

  let goalContributions = 0;
  goals.forEach(g => {
    if (g.targetAmount > g.currentAmount) {
      const remainingNeed = g.targetAmount - g.currentAmount;
      if (g.deadline) {
        const dDate = new Date(g.deadline);
        const monthsLeft = Math.max(1, (dDate.getFullYear() - currentYear) * 12 + (dDate.getMonth() - currentMonthIndex));
        goalContributions += remainingNeed / monthsLeft;
      } else {
        goalContributions += remainingNeed * 0.1;
      }
    }
  });

  const txCountRow = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE user_id=?').get(userId);
  const totalTxCount = txCountRow ? txCountRow.count : 0;

  let isSafeToSpendDataAvailable = true;
  let missingSafeDataReason = '';

  if (totalTxCount === 0 && accounts.length === 0 && totalBalance <= 0) {
    isSafeToSpendDataAvailable = false;
    missingSafeDataReason = 'No linked accounts or transactions recorded yet.';
  }

  let safePool = Math.max(0, totalBalance - upcomingSubscriptions - goalContributions);
  if (remainingMonthlyBudget !== null) {
    safePool = Math.min(safePool, remainingMonthlyBudget);
  }

  const safeToSpendToday = isSafeToSpendDataAvailable ? Math.max(0, safePool / daysRemaining) : 0;

  let safeStatus = 'on_track';
  if (totalBalance <= 0 || (remainingMonthlyBudget !== null && remainingMonthlyBudget <= 0)) {
    safeStatus = 'overspending_risk';
  } else if (dailyExpense > safeToSpendToday && dailyExpense > 0) {
    safeStatus = 'be_careful';
  } else {
    safeStatus = 'on_track';
  }

  const safeToSpendData = {
    isDataAvailable: isSafeToSpendDataAvailable,
    missingDataReason: missingSafeDataReason,
    amount: safeToSpendToday,
    status: safeStatus,
    breakdown: {
      totalBalance,
      remainingMonthlyBudget,
      upcomingSubscriptions,
      goalContributions,
      daysRemaining,
      safePool
    }
  };

  // --- Dynamic REAL Calculation for Monthly Comparison ("What Changed This Month?") ---
  const formatMonthStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const currMonthStr = formatMonthStr(now);
  const prevMonthDateObj = new Date(currentYear, currentMonthIndex - 1, 1);
  const prevMonthStr = formatMonthStr(prevMonthDateObj);

  const currMonthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const prevMonthName = prevMonthDateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

  const currCatRows = db.prepare(
    "SELECT category, SUM(amount) as total FROM transactions WHERE user_id=? AND type='expense' AND strftime('%Y-%m', date)=? GROUP BY category"
  ).all(userId, currMonthStr);

  const prevCatRows = db.prepare(
    "SELECT category, SUM(amount) as total FROM transactions WHERE user_id=? AND type='expense' AND strftime('%Y-%m', date)=? GROUP BY category"
  ).all(userId, prevMonthStr);

  const currCatMap = {};
  currCatRows.forEach(r => { currCatMap[r.category] = r.total; });

  const prevCatMap = {};
  prevCatRows.forEach(r => { prevCatMap[r.category] = r.total; });

  const allCategoriesSet = new Set([...Object.keys(currCatMap), ...Object.keys(prevCatMap)]);
  const categoryComparison = [];

  allCategoriesSet.forEach(cat => {
    const currentAmount = currCatMap[cat] || 0;
    const previousAmount = prevCatMap[cat] || 0;
    const difference = currentAmount - previousAmount;
    let pctChange = 0;
    if (previousAmount > 0) {
      pctChange = ((currentAmount - previousAmount) / previousAmount) * 100;
    } else if (currentAmount > 0) {
      pctChange = 100;
    }

    let status = 'neutral';
    if (difference < 0) status = 'positive';
    else if (difference > 0) status = 'negative';

    categoryComparison.push({
      category: cat,
      currentAmount,
      previousAmount,
      difference,
      pctChange,
      status
    });
  });

  const totalCurrExpense = monthlyExpense;
  const totalPrevExpense = prevMonthExpense;
  const diffExpense = totalCurrExpense - totalPrevExpense;
  let pctDiffExpense = 0;
  if (totalPrevExpense > 0) {
    pctDiffExpense = ((totalCurrExpense - totalPrevExpense) / totalPrevExpense) * 100;
  } else if (totalCurrExpense > 0) {
    pctDiffExpense = 100;
  }

  const totalCurrIncome = monthlyIncome;
  const totalPrevIncome = prevMonthIncome;
  const diffIncome = totalCurrIncome - totalPrevIncome;
  let pctDiffIncome = 0;
  if (totalPrevIncome > 0) {
    pctDiffIncome = ((totalCurrIncome - totalPrevIncome) / totalPrevIncome) * 100;
  } else if (totalCurrIncome > 0) {
    pctDiffIncome = 100;
  }

  const currSavings = totalCurrIncome - totalCurrExpense;
  const prevSavings = totalPrevIncome - totalPrevExpense;
  const diffSavings = currSavings - prevSavings;
  let pctDiffSavings = 0;
  if (prevSavings !== 0) {
    pctDiffSavings = ((currSavings - prevSavings) / Math.abs(prevSavings)) * 100;
  } else if (currSavings > 0) {
    pctDiffSavings = 100;
  }

  const txHistoryCount = db.prepare(
    "SELECT COUNT(*) as cnt FROM transactions WHERE user_id=? AND (strftime('%Y-%m', date)=? OR strftime('%Y-%m', date)=?)"
  ).get(userId, currMonthStr, prevMonthStr).cnt;

  const hasHistoricalData = txHistoryCount > 0;

  let summaryText = '';
  if (hasHistoricalData) {
    if (diffExpense < 0) {
      summaryText = `In ${currMonthName}, your total expenses decreased by ₹${Math.abs(diffExpense).toLocaleString('en-IN')} (${Math.abs(pctDiffExpense).toFixed(1)}%) compared to ${prevMonthName}.`;
    } else if (diffExpense > 0) {
      summaryText = `In ${currMonthName}, your total expenses increased by ₹${diffExpense.toLocaleString('en-IN')} (+${pctDiffExpense.toFixed(1)}%) compared to ${prevMonthName}.`;
    } else {
      summaryText = `In ${currMonthName}, your total expenses remained unchanged compared to ${prevMonthName}.`;
    }

    if (categoryComparison.length > 0) {
      const sortedDiffs = [...categoryComparison].sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
      const topCat = sortedDiffs[0];
      if (topCat && topCat.difference !== 0) {
        const changeWord = topCat.difference > 0 ? 'increase' : 'decrease';
        summaryText += ` Main driver: a ₹${Math.abs(topCat.difference).toLocaleString('en-IN')} ${changeWord} in ${topCat.category}.`;
      }
    }
  } else {
    summaryText = 'Not enough historical data for comparison.';
  }

  const monthlyComparisonData = {
    hasHistoricalData,
    missingDataText: 'Not enough historical data for comparison.',
    currMonthName,
    prevMonthName,
    categories: categoryComparison,
    totals: {
      expenses: { current: totalCurrExpense, previous: totalPrevExpense, difference: diffExpense, pctChange: pctDiffExpense, status: diffExpense <= 0 ? 'positive' : 'negative' },
      income: { current: totalCurrIncome, previous: totalPrevIncome, difference: diffIncome, pctChange: pctDiffIncome, status: diffIncome >= 0 ? 'positive' : 'negative' },
      savings: { current: currSavings, previous: prevSavings, difference: diffSavings, pctChange: pctDiffSavings, status: diffSavings >= 0 ? 'positive' : 'negative' }
    },
    summaryText
  };

  res.json({
    totalBalance, monthlyIncome, monthlyExpense, weeklyExpense, dailyExpense,
    totalSavings, userName: user.name, prevMonthIncome, prevMonthExpense,
    recentTransactions, monthlyTrend, categoryExpenses, spendwiseScore: score,
    budgets, goals, subscriptions: subs, cashFlowForecast, insights, accounts,
    safeToSpend: safeToSpendData,
    monthlyComparison: monthlyComparisonData
  });
});

// ===================== ACCOUNTS API =====================

app.get('/api/accounts', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const accounts = db.prepare('SELECT * FROM accounts WHERE user_id=?').all(user.userId);
  res.json(accounts.map(a => ({
    accountId: a.account_id, providerName: a.provider_name, accountType: a.account_type,
    balance: a.balance, accountMask: a.account_mask, status: a.status, lastSynced: a.last_synced
  })));
});

app.post('/api/accounts', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { providerName, accountType } = req.body;
    db.prepare('INSERT INTO accounts (user_id, provider_name, account_type) VALUES (?, ?, ?)')
      .run(user.userId, providerName, accountType);
    res.json({ success: true, message: 'Account connected successfully' });
  } catch (e) {
    res.status(400).json({ error: 'Invalid data' });
  }
});

app.post('/api/accounts/link', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { providerName, accountType: customType, balance: customBalance, accountMask: customMask } = req.body;
    if (!providerName) return res.status(400).json({ error: 'Provider name is required' });

    const existing = db.prepare('SELECT * FROM accounts WHERE user_id=? AND provider_name=?').get(user.userId, providerName);
    if (existing) {
      return res.status(409).json({ error: 'This bank is already connected to your account.' });
    }

    const isWallet = providerName.toLowerCase().includes('wallet') || providerName.toLowerCase().includes('paytm') || providerName.toLowerCase().includes('phonepe') || providerName.toLowerCase().includes('gpay') || providerName.toLowerCase().includes('upi');
    const accountType = customType || (isWallet ? 'wallet' : 'bank_account');
    const mockBalance = customBalance ? parseFloat(customBalance) : parseFloat((Math.random() * 45000 + 12000).toFixed(2));
    const mockMask = customMask || Math.floor(1000 + Math.random() * 9000).toString();

    const info = db.prepare('INSERT INTO accounts (user_id, provider_name, account_type, balance, account_mask, status, last_synced) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)')
      .run(user.userId, providerName, accountType, mockBalance, mockMask, 'Connected');

    createNotification(user.userId, 'account_linked', `${providerName} account linked successfully.`);
    res.json({ success: true, message: 'Account connected successfully', accountId: info.lastInsertRowid, balance: mockBalance, accountMask: mockMask });
  } catch (e) {
    res.status(500).json({ error: 'Internal server error while linking account.' });
  }
});

app.delete('/api/accounts/:id', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM accounts WHERE account_id=? AND user_id=?').run(id, user.userId);
    res.json({ success: true, message: 'Account unlinked successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

app.post('/api/accounts/:id/sync', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { id } = req.params;
    db.prepare("UPDATE accounts SET last_synced=CURRENT_TIMESTAMP, status='Connected' WHERE account_id=? AND user_id=?").run(id, user.userId);
    const acc = db.prepare('SELECT * FROM accounts WHERE account_id=? AND user_id=?').get(id, user.userId);
    res.json({ success: true, message: 'Account synced successfully', lastSynced: acc.last_synced, balance: acc.balance });
  } catch (e) {
    res.status(500).json({ error: 'Failed to sync account' });
  }
});

// ===================== NOTIFICATIONS API =====================

app.get('/api/notifications', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(user.userId);
  res.json(notifs.map(n => ({
    id: n.notification_id,
    type: n.type,
    message: n.message,
    isRead: Boolean(n.is_read),
    createdAt: n.created_at
  })));
});

app.post('/api/notifications/mark-read', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { id } = req.body;
    db.prepare('UPDATE notifications SET is_read=1 WHERE notification_id=? AND user_id=?').run(id, user.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Failed to mark as read' });
  }
});

app.post('/api/notifications/mark-all-read', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(user.userId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Failed to mark all as read' });
  }
});

app.delete('/api/notifications', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  try {
    const { id } = req.body || req.query;
    if (id) {
      db.prepare('DELETE FROM notifications WHERE notification_id=? AND user_id=?').run(id, user.userId);
    } else {
      db.prepare('DELETE FROM notifications WHERE user_id=?').run(user.userId);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: 'Failed to delete notifications' });
  }
});

// ===================== DEBTS, NET WORTH & MERCHANTS API =====================

app.get('/api/debts', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const debts = db.prepare('SELECT * FROM debts WHERE user_id=?').all(user.userId);
  res.json(debts.map(d => ({
    debtId: d.debt_id, debtName: d.debt_name, debtType: d.debt_type,
    outstandingBalance: d.outstanding_balance, interestRate: d.interest_rate,
    minimumPayment: d.minimum_payment, nextPaymentDate: d.next_payment_date
  })));
});

app.get('/api/net-worth', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const history = db.prepare('SELECT * FROM net_worth_history WHERE user_id=? ORDER BY recorded_date ASC').all(user.userId);
  res.json(history.map(h => ({
    totalAssets: h.total_assets, totalLiabilities: h.total_liabilities,
    netWorth: h.net_worth, recordedDate: h.recorded_date
  })));
});

app.get('/api/merchants', (req, res) => {
  const user = getUser(req, res);
  if (!user) return;
  const merchants = db.prepare("SELECT merchant_name as name, category, COUNT(*) as txCount, SUM(amount) as totalSpent, MAX(date) as lastTx FROM transactions WHERE user_id=? AND merchant_name IS NOT NULL GROUP BY merchant_name ORDER BY totalSpent DESC").all(user.userId);
  res.json(merchants);
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'main', 'webapp', 'login.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n✅ SpendWise server is running on http://localhost:${PORT}`);
});
