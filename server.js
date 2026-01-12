/*****************************************************************
 * LOAD ENV — MUST BE FIRST
 *****************************************************************/
import 'dotenv/config';

/*****************************************************************
 * IMPORTS
 *****************************************************************/
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  S3Client,
  ListObjectsV2Command,
  HeadBucketCommand
} from '@aws-sdk/client-s3';

/*****************************************************************
 * ES MODULE __dirname FIX
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
app.use(express.static(path.join(__dirname, 'public')));

/*****************************************************************
 * ENV CHECK (SAFE)
 *****************************************************************/
console.log('ENV CHECK', {
  AWS_ACCESS_KEY_ID: !!process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: !!process.env.AWS_SECRET_ACCESS_KEY,
  AWS_REGION: process.env.AWS_REGION,
  S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME
});

/*****************************************************************
 * STATIC ADMIN USER
 *****************************************************************/
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

/*****************************************************************
 * JWT AUTH MIDDLEWARE
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
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/*****************************************************************
 * LOGIN ROUTE (FIXED — SINGLE ROUTE ONLY)
 *****************************************************************/
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  console.log('LOGIN ATTEMPT:', username);

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
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
 * S3 CLIENT
 *****************************************************************/
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim()
  }
});

/*****************************************************************
 * S3 CONNECTION TEST (ON START)
 *****************************************************************/
(async () => {
  try {
    await s3.send(
      new HeadBucketCommand({
        Bucket: process.env.S3_BUCKET_NAME
      })
    );
    console.log('✅ S3 CONNECTED SUCCESSFULLY');
  } catch (err) {
    console.error('❌ S3 CONNECTION FAILED:', err.name, err.message);
  }
})();

/*****************************************************************
 * LIST AUDIO FILES (JWT + FILTERS)
 *****************************************************************/
app.get('/api/audios', auth, async (req, res) => {
  try {
    const agentFilter = req.query.agent?.toLowerCase();
    const dateFilter = req.query.date; // yyyy-mm-dd

    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
      MaxKeys: 1000
    });

    const data = await s3.send(command);
    if (!data.Contents) return res.json([]);

    const files = data.Contents
      .filter(o => o.Key && o.Key.endsWith('.mp3'))
      .filter(o => {
        const key = o.Key.toLowerCase();
        if (agentFilter && !key.includes(`agent-${agentFilter}`)) return false;
        if (dateFilter && !key.startsWith(dateFilter)) return false;
        return true;
      })
      .map(o => ({
        key: o.Key,
        url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${encodeURIComponent(o.Key)}`
      }));

    res.json(files);
  } catch (err) {
    console.error('S3 LIST ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

/*****************************************************************
 * ROOT & FALLBACK ROUTES
 *****************************************************************/
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

/*****************************************************************
 * START SERVER
 *****************************************************************/
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});

