const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');

const app = express();

/* ---------------- BASIC SETUP ---------------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || 'super-secure-key',
  resave: false,
  saveUninitialized: false
}));

/* ---------------- AWS S3 ---------------- */

const s3 = new AWS.S3({ region: process.env.AWS_REGION });
const BUCKET = process.env.S3_BUCKET;

/* ---------------- CLIENTS ---------------- */

const clients = {
  clientA: {
    username: 'clienta',
    passwordHash: bcrypt.hashSync('password123', 10),
    prefix: 'clientA/'
  }
};

/* ---------------- AUTH ---------------- */

function auth(req, res, next) {
  if (!req.session.client_id) return res.redirect('/login');
  next();
}

/* ---------------- ROOT ---------------- */

app.get('/', (req, res) => res.redirect('/login'));

/* ---------------- LOGIN ---------------- */

app.get('/login', (req, res) => {
  res.send(`
    <h2>Client Login</h2>
    <form method="POST">
      <input name="username" required placeholder="Username"><br><br>
      <input type="password" name="password" required placeholder="Password"><br><br>
      <button>Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const entry = Object.entries(clients)
    .find(([_, c]) => c.username === username);

  if (!entry) return res.send('Invalid login');

  const [id, client] = entry;

  if (!bcrypt.compareSync(password, client.passwordHash)) {
    return res.send('Invalid login');
  }

  req.session.client_id = id;
  res.redirect('/dashboard');
});

/* ---------------- DASHBOARD ---------------- */

app.get('/dashboard', auth, async (req, res) => {
  const client = clients[req.session.client_id];

  const data = await s3.listObjectsV2({
    Bucket: BUCKET,
    Prefix: client.prefix
  }).promise();

  const agents = [...new Set(
    data.Contents
      .map(o => o.Key.split('agent')[1])
      .filter(Boolean)
      .map(v => v.split('_')[0])
  )];

  res.send(`
    <h2>Your Recordings</h2>

    <form action="/recordings">
      Date:
      <input type="date" name="date"><br><br>

      Agent:
      <select name="agent">
        <option value="">All</option>
        ${agents.map(a => <option>${a}</option>).join('')}
      </select><br><br>

      <button>Filter</button>
    </form>

    <br><a href="/logout">Logout</a>
  `);
});

/* ---------------- RECORDINGS ---------------- */

app.get('/recordings', auth, async (req, res) => {
  const client = clients[req.session.client_id];
  const { date, agent } = req.query;

  const data = await s3.listObjectsV2({
    Bucket: BUCKET,
    Prefix: client.prefix
  }).promise();

  let files = data.Contents.map(o => o.Key.replace(client.prefix, ''));

  if (date) files = files.filter(f => f.startsWith(date));
  if (agent) files = files.filter(f => f.includes(_agent_${agent}_));

  if (!files.length) return res.send('No recordings found');

  res.send(
    files.map(f => `
      <div>
        ${f}
        <a href="/play/${encodeURIComponent(f)}">▶ Play</a>
        |
        <a href="/download/${encodeURIComponent(f)}">⬇ Download</a>
      </div>
    `).join('') + '<br><br><a href="/dashboard">Back</a>'
  );
});

/* ---------------- PLAY ---------------- */

app.get('/play/:file', auth, async (req, res) => {
  const client = clients[req.session.client_id];

  const stream = s3.getObject({
    Bucket: BUCKET,
    Key: client.prefix + req.params.file
  }).createReadStream();

  res.setHeader('Content-Type', 'audio/mpeg');
  stream.pipe(res);
});

/* ---------------- DOWNLOAD ---------------- */

app.get('/download/:file', auth, async (req, res) => {
  const client = clients[req.session.client_id];

  const file = client.prefix + req.params.file;

  const url = s3.getSignedUrl('getObject', {
    Bucket: BUCKET,
    Key: file,
    Expires: 60
  });

  res.redirect(url);
});

/* ---------------- LOGOUT ---------------- */

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running'));
