const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'super-secure-key',
  resave: false,
  saveUninitialized: false
}));

/* ---------------- CLIENTS ---------------- */

const clients = {
  clientA: {
    username: 'clienta',
    passwordHash: bcrypt.hashSync('password123', 10),
    folder: 'clientA'
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
    <form method="POST">
      <input name="username" placeholder="Username" required /><br><br>
      <input type="password" name="password" placeholder="Password" required /><br><br>
      <button>Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const client = Object.entries(clients)
    .find(([_, c]) => c.username === username);

  if (!client) return res.send('Invalid login');

  const [client_id, data] = client;

  if (!bcrypt.compareSync(password, data.passwordHash)) {
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
      Date: <input name="date" />
      Agent: <input name="agent" />
      <button>Filter</button>
    </form>
    <br>
    <a href="/logout">Logout</a>
  `);
});

/* ---------------- LIST RECORDINGS ---------------- */

app.get('/recordings', clientAuth, (req, res) => {
  const client_id = req.session.client_id;
  const folder = path.join(__dirname, 'uploads', client_id);

  if (!fs.existsSync(folder)) return res.json([]);

  let files = fs.readdirSync(folder);

  const { date, agent } = req.query;

  if (date) files = files.filter(f => f.startsWith(date));
  if (agent) files = files.filter(f => f.includes(`_${agent}_`));

  res.send(files.map(f =>
    `<div>${f} <a href="/play/${f}">▶ Play</a></div>`
  ).join(''));
});

/* ---------------- PLAY AUDIO ---------------- */

app.get('/play/:file', clientAuth, (req, res) => {
  const filePath = path.join(
    __dirname,
    'uploads',
    req.session.client_id,
    req.params.file
  );

  if (!fs.existsSync(filePath)) return res.send('Not found');

  res.sendFile(filePath);
});

/* ---------------- LOGOUT ---------------- */

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Running on', PORT));
