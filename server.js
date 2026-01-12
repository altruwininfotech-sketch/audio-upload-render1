/*****************************************************************
 * LOAD ENV
 *****************************************************************/
import 'dotenv/config';

/*****************************************************************
 * IMPORTS
 *****************************************************************/
import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand
} from '@aws-sdk/client-s3';

/*****************************************************************
 * __dirname FIX (ES MODULE)
 *****************************************************************/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/*****************************************************************
 * APP SETUP
 *****************************************************************/
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

/* ✅ STATIC FILES — THIS IS CRITICAL */
app.use(express.static(path.join(__dirname, 'public')));

/*****************************************************************
 * ADMIN CREDS
 *****************************************************************/
const ADMIN_USER = {
  username: process.env.ADMIN_USERNAME || 'admin',
  password: process.env.ADMIN_PASSWORD || 'admin123'
};

/*****************************************************************
 * JWT MIDDLEWARE
 *****************************************************************/
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/*****************************************************************
 * LOGIN ROUTE ✅ FIXED (ONLY ONE)
 *****************************************************************/
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (
    username === ADMIN_USER.username &&
    password === ADMIN_USER.password
  ) {
    const token = jwt.sign(
      { username },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ token });
  }

  return res.status(401).json({ error: 'Invalid credentials' });
});

/*****************************************************************
 * AWS S3
 *****************************************************************/
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim()
  }
});

/*****************************************************************
 * S3 TEST
 *****************************************************************/
(async () => {
  try {
    await s3.send(
      new HeadBucketCommand({
        Bucket: process.env.S3_BUCKET_NAME
      })
    );
    console.log('✅ S3 CONNECTED');
  } catch (err) {
    console.error('❌ S3 ERROR:', err.message);
  }
})();

/*****************************************************************
 * LIST AUDIOS
 *****************************************************************/
app.get('/api/audios', auth, async (req, res) => {
  try {
    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.S3_BUCKET_NAME,
        MaxKeys: 1000
      })
    );

    if (!data.Contents) return res.json([]);

    const files = data.Contents
      .filter(o => o.Key.endsWith('.mp3'))
      .map(o => ({
        key: o.Key,
        url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(o.Key)}`
      }));

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/*****************************************************************
 * FALLBACK — MUST BE LAST
 *****************************************************************/
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

/*****************************************************************
 * START SERVER
 *****************************************************************/
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

