const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();

/* ---------------- BASIC SETUP ---------------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'super-secure-key',
  resave: false,
  saveUninitialized: false
}));

/* ---------------- ROOT ROUTE (FIXED) ---------------- */

app.get('/', (req, res) => {
  return res.redirect('/login');
});

/* ---------------- CLIENT DATA ---------------- */

const clients = {
  clientA: {
    username: 'clienta',
    passwordHash: bcrypt.hashSync('password123', 10)
  }
};

/* ---------------- AUTH MIDDLEWARE ---------------- */

function clientAuth(req, res, next) {
  if (!req.session.client_id) {
    return res.redirect('/login');
  }
  next();
}

/* ---------------- LOGIN ---------------- */

app.get('/login', (req, res) => {
  res.send(`
    <h2>Client Login</h2>
    <form method="POST" action="/login">
      <input name="username" placeholder="Username" required /><br><br>
      <input type="password" name="password" placeholder="Password" required /><br><br>
      <button type="submit">Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const clientEntry = Object.entries(clients)
    .find(([_, c]) => c.username === username);

  if (!clientEntry) return res.send('Invalid login');

  const [client_id, client] = clientEntry;

  if (!bcrypt.compareSync(password, client.passwordHash)) {
    return res.send('Invalid login');
  }

  req.session.client_id = client_id;
  res.redirect('/dashboard');
});

/* ---------------- DASHBOARD ---------------- */

app.get('/dashboard', clientAuth, (req, res) => {
  res.send(`
    <h2>Your Recordings</h2>

    <form method="GET" action="/recordings">
      Date (YYYY-MM-DD): <input name="date" />
      Agent: <input name="agent" />
      <button type="submit">Filter</button>
    </form>

    <br>
    <a href="/logout">Logout</a>
  `);
});

/* ---------------- LIST RECORDINGS ---------------- */

app.get('/recordings', clientAuth, (req, res) => {
  const client_id = req.session.client_id;
  const clientFolder = path.join(__dirname, 'uploads', client_id);

  if (!fs.existsSync(clientFolder)) {
    return res.send('<p>No recordings found</p>');
  }

  let files = fs.readdirSync(clientFolder);

  const { date, agent } = req.query;

  if (date) files = files.filter(f => f.startsWith(date));
  if (agent) files = files.filter(f => f.includes(`_${agent}_`));

  if (!files.length) {
    return res.send('<p>No matching recordings</p>');
  }

  const list = files.map(f =>
    `<div>${f} <a href="/play/${f}">▶ Play</a></div>`
  ).join('');

  res.send(list + `<br><br><a href="/dashboard">Back</a>`);
});

/* ---------------- PLAY AUDIO ---------------- */

app.get('/play/:file', clientAuth, (req, res) => {
  const filePath = path.join(
    __dirname,
    'uploads',
    req.session.client_id,
    req.params.file
  );

  if (!fs.existsSync(filePath)) {
    return res.send('File not found');
  }

  res.sendFile(filePath);
});

/* ---------------- LOGOUT ---------------- */

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
