const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SESSION_TTL = 1000 * 60 * 60 * 24 * 7;

const app = express();
app.use(express.json({ limit: '10kb' }));

// ---------- user store (JSON file) ----------
function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return {}; }
}
function saveUsers(users) {
  fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}
let users = loadUsers();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

// ---------- sessions (in memory) ----------
const sessions = new Map();
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
function startSession(res, email) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email, expires: Date.now() + SESSION_TTL });
  res.setHeader('Set-Cookie',
    `sid=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}`);
}
function currentUser(req) {
  const token = parseCookies(req).sid;
  const s = token && sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return users[s.email] ? { email: s.email, ...users[s.email] } : null;
}
function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (user) { req.user = user; return next(); }
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Not logged in' });
  res.redirect('/login');
}

// ---------- simple login throttling ----------
const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  const list = (attempts.get(key) || []).filter(t => now - t < 15 * 60 * 1000);
  attempts.set(key, list);
  return list.length >= 10;
}
function recordAttempt(key) { attempts.get(key).push(Date.now()); }

// ---------- auth routes ----------
const validEmail = e => typeof e === 'string' && e.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!validEmail(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 200)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const key = email.toLowerCase();
  if (users[key]) return res.status(409).json({ error: 'An account with this email already exists.' });
  const { salt, hash } = hashPassword(password);
  users[key] = {
    name: String(name || '').trim().slice(0, 60) || key.split('@')[0],
    salt, hash, favorites: [], created: new Date().toISOString()
  };
  saveUsers(users);
  startSession(res, key);
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const key = String(email || '').toLowerCase();
  const tKey = req.ip + '|' + key;
  if (throttled(tKey)) return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  const user = users[key];
  if (!user || typeof password !== 'string' || !verifyPassword(password, user)) {
    recordAttempt(tKey);
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }
  startSession(res, key);
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  sessions.delete(parseCookies(req).sid);
  res.setHeader('Set-Cookie', 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  res.json({ ok: true });
});

// ---------- protected API ----------
app.get('/api/me', requireAuth, (req, res) =>
  res.json({ name: req.user.name, email: req.user.email, favorites: req.user.favorites }));

app.get('/api/places', requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'private', 'places.json')));
app.get('/api/cuisine', requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'private', 'cuisine.json')));
app.get('/api/credits', requireAuth, (req, res) =>
  res.sendFile(path.join(__dirname, 'credits.json')));

app.post('/api/favorites', requireAuth, (req, res) => {
  const { id } = req.body || {};
  if (typeof id !== 'string' || id.length > 60) return res.status(400).json({ error: 'Bad id' });
  const u = users[req.user.email];
  u.favorites = u.favorites.includes(id) ? u.favorites.filter(f => f !== id) : [...u.favorites, id];
  saveUsers(users);
  res.json({ favorites: u.favorites });
});

// ---------- pages ----------
app.get('/login', (req, res) => {
  if (currentUser(req)) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'private', 'app.html')));
app.get('/app.js', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'private', 'app.js')));

app.use('/static', express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));

app.listen(PORT, () => console.log(`Pankisi guide running on http://localhost:${PORT}`));
