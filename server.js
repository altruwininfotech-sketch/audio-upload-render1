/*****************************************************************
 * LOAD ENV — MUST BE FIRST
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
  JWT_SECRET: !!process.env.JWT_SECRET
});

/*****************************************************************
 * JWT AUTH MIDDLEWARE
 *****************************************************************/
function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = header.split(" ")[1];

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/*****************************************************************
 * LOGIN ROUTE (FIXED — SINGLE ROUTE ONLY)
 *****************************************************************/
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  console.log("LOGIN ATTEMPT:", { username, password });

  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
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
 * S3 CONNECTION TEST
 *****************************************************************/
(async () => {
  try {
    await s3.send(new HeadBucketCommand({
      Bucket: process.env.S3_BUCKET_NAME
    }));
    console.log('✅ S3 CONNECTED');
  } catch (err) {
    console.error('❌ S3 ERROR:', err.message);
  }
})();

/*****************************************************************
 * LIST AUDIO FILES
 *****************************************************************/
app.get('/api/audios', auth, async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
      MaxKeys: 1000
    });

    const data = await s3.send(command);

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
 * FALLBACK → LOGIN PAGE
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

