const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const AWS = require('@aws-sdk/client-s3');

const app = express();

/* ---------------- BASIC SETUP ---------------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

/* ---------------- AWS S3 CLIENT ---------------- */

const s3 = new AWS.S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const BUCKET = process.env.S3_BUCKET;

/* ---------------- ROOT ---------------- */

app.get('/', (req, res) => res.redirect('/login'));

/* ---------------- CLIENT CREDENTIALS ---------------- */

const clients = {
  clientA: {
    username: 'clienta',
    passwordHash: bcrypt.hashSync('password123', 10)
  }
};

/* ---------------- AUTH MIDDLEWARE ---------------- */

function clientAuth(req, res, next) {
  if (!req.session.client_id) return res.redirect('/login');
  next();
}

/* ---------------- LOGIN ---------------- */

app.get('/login', (req, res) => {
  res.send(`
    <h2>Client Login</h2>
    <form method="POST">
      <input name="username" required placeholder="Username"/><br><br>
      <input name="password" type="password" required placeholder="Password"/><br><br>
      <button>Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const entry = Object.entries(clients)
    .find(([_, c]) => c.username === username);

  if (!entry) return res.send('Invalid login');

  const [client_id, client] = entry;

  if (!bcrypt.compareSync(password, client.passwordHash))
    return res.send('Invalid login');

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
      <button>Filter</button>
    </form>

    <br><a href="/logout">Logout</a>
  `);
});

/* ---------------- LIST RECORDINGS FROM S3 ---------------- */

app.get('/recordings', clientAuth, async (req, res) => {
  const client_id = req.session.client_id;
  const { date, agent } = req.query;

  const params = {
    Bucket: BUCKET,
    Prefix: ${client_id}/
  };

  const data = await s3.send(
    new AWS.ListObjectsV2Command(params)
  );

  if (!data.Contents) return res.send('No recordings');

  let files = data.Contents.map(o => o.Key.replace(${client_id}/, ''));

  if (date) files = files.filter(f => f.startsWith(date));
  if (agent) files = files.filter(f => f.includes(agent_${agent}));

  if (!files.length) return res.send('No matching recordings');

  const html = files.map(f => `
    <div>
      ${f}
      <audio controls src="/play/${encodeURIComponent(f)}"></audio>
    </div>
  `).join('');

  res.send(html + <br><a href="/dashboard">Back</a>);
});

/* ---------------- STREAM AUDIO FROM S3 ---------------- */

app.get('/play/:file', clientAuth, async (req, res) => {
  const key = ${req.session.client_id}/${req.params.file};

  const command = new AWS.GetObjectCommand({
    Bucket: BUCKET,
    Key: key
  });

  const data = await s3.send(command);

  res.setHeader('Content-Type', 'audio/mpeg');
  data.Body.pipe(res);
});

/* ---------------- LOGOUT ---------------- */

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ---------------- START SERVER ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on', PORT));
