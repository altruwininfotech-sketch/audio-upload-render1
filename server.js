const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');

const app = express();

/* ---------------- BASIC SETUP ---------------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

/* ---------------- AWS S3 ---------------- */

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const BUCKET = process.env.S3_BUCKET_NAME;

/* ---------------- CLIENTS (MULTI-CLIENT READY) ---------------- */

const clients = {
  clientA: {
    username: 'clienta',
    passwordHash: bcrypt.hashSync('password123', 10),
    prefix: '' // optional folder prefix in S3
  }
};

/* ---------------- AUTH ---------------- */

function auth(req, res, next) {
  if (!req.session.clientId) return res.redirect('/login');
  next();
}

/* ---------------- ROOT ---------------- */

app.get('/', (req, res) => res.redirect('/login'));

/* ---------------- LOGIN ---------------- */

app.get('/login', (req, res) => {
  res.send(`
    <h2>Client Login</h2>
    <form method="POST">
      <input name="username" placeholder="Username" required><br><br>
      <input type="password" name="password" placeholder="Password" required><br><br>
      <button>Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const entry = Object.entries(clients).find(
    ([, c]) => c.username === username
  );

  if (!entry) return res.send('Invalid login');

  const [clientId, client] = entry;

  if (!bcrypt.compareSync(password, client.passwordHash)) {
    return res.send('Invalid login');
  }

  req.session.clientId = clientId;
  res.redirect('/dashboard');
});

/* ---------------- DASHBOARD ---------------- */

app.get('/dashboard', auth, async (req, res) => {
  const client = clients[req.session.clientId];

  const data = await s3.listObjectsV2({
    Bucket: BUCKET,
    Prefix: client.prefix
  }).promise();

  const agents = [...new Set(
    (data.Contents || [])
      .map(o => o.Key.split('agent')[1])
      .filter(Boolean)
      .map(v => v.split('_')[0])
  )];

  const agentOptions = agents.map(a => <option value="${a}">${a}</option>).join('');

  res.send(`
    <h2>Recordings</h2>

    <form method="GET" action="/recordings">
      Date:
      <input type="date" name="date">

      Agent:
      <select name="agent">
        <option value="">All</option>
        ${agentOptions}
      </select>

      <button>Filter</button>
    </form>

    <br>
    <a href="/logout">Logout</a>
  `);
});

/* ---------------- LIST RECORDINGS ---------------- */

app.get('/recordings', auth, async (req, res) => {
  const { date, agent } = req.query;
  const client = clients[req.session.clientId];

  const data = await s3.listObjectsV2({
    Bucket: BUCKET,
    Prefix: client.prefix
  }).promise();

  let files = (data.Contents || []).map(o => o.Key);

  if (date) files = files.filter(f => f.startsWith(date));
  if (agent) files = files.filter(f => f.includes(_agent_${agent}_));

  if (!files.length) {
    return res.send('<p>No recordings found<br><br><a href="/dashboard">Back</a></p>');
  }

  const rows = files.map(f => `
    <div>
      ${f}
      <audio controls src="/play?key=${encodeURIComponent(f)}"></audio>
      <a href="/download?key=${encodeURIComponent(f)}">⬇ Download</a>
    </div>
    <hr>
  `).join('');

  res.send(rows + <br><a href="/dashboard">Back</a>);
});

/* ---------------- PLAY ---------------- */

app.get('/play', auth, async (req, res) => {
  const stream = s3.getObject({
    Bucket: BUCKET,
    Key: req.query.key
  }).createReadStream();

  res.setHeader('Content-Type', 'audio/mpeg');
  stream.pipe(res);
});

/* ---------------- DOWNLOAD ---------------- */

app.get('/download', auth, async (req, res) => {
  const file = await s3.getObject({
    Bucket: BUCKET,
    Key: req.query.key
  }).promise();

  res.setHeader('Content-Disposition', 'attachment');
  res.send(file.Body);
});

/* ---------------- LOGOUT ---------------- */

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on', PORT));
