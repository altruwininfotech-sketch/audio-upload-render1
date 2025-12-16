const express = require('express');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  secret: 'render-secret-key',
  resave: false,
  saveUninitialized: true
}));

const adminUser = {
  username: 'admin',
  passwordHash: bcrypt.hashSync('admin123', 10)
};

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });

function auth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

app.get('/', auth, (req, res) => {
  res.send(`
    <h2>Upload Audio Recording</h2>
    <form method="POST" enctype="multipart/form-data" action="/upload">
      <input type="file" name="audio" accept="audio/*" required />
      <br/><br/>
      <button type="submit">Upload</button>
    </form>
    <br/>
    <a href="/logout">Logout</a>
  `);
});

app.get('/login', (req, res) => {
  res.send(`
    <h2>Login</h2>
    <form method="POST" action="/login">
      <input name="username" placeholder="Username" required />
      <br/><br/>
      <input name="password" type="password" placeholder="Password" required />
      <br/><br/>
      <button type="submit">Login</button>
    </form>
  `);
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === adminUser.username && bcrypt.compareSync(password, adminUser.passwordHash)) {
    req.session.user = username;
    return res.redirect('/');
  }
  res.send('Invalid login');
});

app.post('/upload', auth, upload.single('audio'), (req, res) => {
  res.send('Upload successful');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on', PORT));
