const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const AWS = require('aws-sdk');

const app = express();

/* ---------------- BASIC SETUP ---------------- */

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Ensure SESSION_SECRET is in your .env file
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true if using HTTPS
}));

/* ---------------- AWS S3 ---------------- */

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const BUCKET = process.env.S3_BUCKET_NAME;

/* ---------------- CLIENTS ---------------- */

const clients = {
  clientA: {
    username: 'clienta',
    // In production, this hash should be in a database, not hardcoded
    passwordHash: bcrypt.hashSync('password123', 10),
    prefix: 'clientA/' // Added specific folder prefix for safety
  },
  clientB: {
    username: 'clientb',
    passwordHash: bcrypt.hashSync('securepass', 10),
    prefix: 'clientB/'
  }
};

/* ---------------- AUTH MIDDLEWARE ---------------- */

function auth(req, res, next) {
  if (!req.session.clientId) return res.redirect('/login');
  next();
}

/* ---------------- ROUTES ---------------- */

app.get('/', (req, res) => res.redirect('/login'));

/* --- LOGIN --- */

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

/* --- DASHBOARD --- */

app.get('/dashboard', auth, async (req, res) => {
  try {
    const client = clients[req.session.clientId];

    const data = await s3.listObjectsV2({
      Bucket: BUCKET,
      Prefix: client.prefix
    }).promise();

    // FIXED: Safer parsing logic
    const agents = [...new Set(
      (data.Contents || [])
        .map(o => {
          // Check if filename actually contains 'agent' before splitting
          if (!o.Key.includes('agent')) return null;
          return o.Key.split('agent')[1].split('_')[0];
        })
        .filter(Boolean) // Remove nulls
    )];

    const agentOptions = agents.map(a => `<option value="${a}">${a}</option>`).join('');

    res.send(`
      <h2>Recordings</h2>
      <form method="GET" action="/recordings">
        Date: <input type="date" name="date">
        Agent: 
        <select name="agent">
          <option value="">All</option>
          ${agentOptions}
        </select>
        <button>Filter</button>
      </form>
      <br><a href="/logout">Logout</a>
    `);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading dashboard.");
  }
});

/* --- LIST RECORDINGS --- */

app.get('/recordings', auth, async (req, res) => {
  try {
    const { date, agent } = req.query;
    const client = clients[req.session.clientId];

    const data = await s3.listObjectsV2({
      Bucket: BUCKET,
      Prefix: client.prefix
    }).promise();

    let files = (data.Contents || []).map(o => o.Key);

    // FIXED: Logic handles date and agent filtering correctly
    if (date) files = files.filter(f => f.includes(date));
    if (agent) files = files.filter(f => f.includes(`agent${agent}_`));

    if (!files.length) {
      return res.send('<p>No recordings found<br><br><a href="/dashboard">Back</a></p>');
    }

    const rows = files.map(f => `
      <div>
        <strong>${f}</strong><br>
        <audio controls src="/play?key=${encodeURIComponent(f)}"></audio>
        <a href="/download?key=${encodeURIComponent(f)}">⬇ Download</a>
      </div>
      <hr>
    `).join('');

    res.send(rows + '<br><a href="/dashboard">Back</a>');
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching recordings.");
  }
});

/* --- PLAY (STREAM) --- */

app.get('/play', auth, async (req, res) => {
  try {
    const client = clients[req.session.clientId];
    const requestedKey = req.query.key;

    // SECURITY FIX: Prevent IDOR (Accessing other clients' files)
    if (!requestedKey || !requestedKey.startsWith(client.prefix)) {
      console.warn(`User ${client.username} attempted to access unauthorized file: ${requestedKey}`);
      return res.status(403).send("Access Denied");
    }

    const stream = s3.getObject({
      Bucket: BUCKET,
      Key: requestedKey
    }).createReadStream();

    stream.on('error', (err) => {
      console.error(err);
      res.status(404).end();
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Stream error");
  }
});

/* --- DOWNLOAD --- */

app.get('/download', auth, async (req, res) => {
  try {
    const client = clients[req.session.clientId];
    const requestedKey = req.query.key;

    // SECURITY FIX: Prevent IDOR
    if (!requestedKey || !requestedKey.startsWith(client.prefix)) {
        return res.status(403).send("Access Denied");
    }

    const file = await s3.getObject({
      Bucket: BUCKET,
      Key: requestedKey
    }).promise();

    res.setHeader('Content-Disposition', `attachment; filename="${requestedKey.split('/').pop()}"`);
    res.send(file.Body);
  } catch (err) {
    console.error(err);
    res.status(500).send("Download error");
  }
});

/* ---------------- LOGOUT ---------------- */

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

/* ---------------- START ---------------- */

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on', PORT));
