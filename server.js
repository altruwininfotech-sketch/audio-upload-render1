import express from "express";
import jwt from "jsonwebtoken";
import cors from "cors";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));
app.get("/", (req, res) => {
  res.redirect("/login.html");
});
const PORT = process.env.PORT || 3000;

/* ---------------- AWS S3 ---------------- */
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

/* ---------------- AUTH ---------------- */
const USERS = [
  { username: "client1", password: "password123" },
];

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/* ---------------- ROUTES ---------------- */

// Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = USERS.find(
    u => u.username === username && u.password === password
  );

  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign({ username }, process.env.JWT_SECRET, {
    expiresIn: "8h",
  });

  res.json({ token });
});

// List Audios (PROTECTED)
app.get("/api/audios", authMiddleware, async (req, res) => {
  try {
    const command = new ListObjectsV2Command({
      Bucket: process.env.S3_BUCKET_NAME,
    });

    const data = await s3.send(command);

    const files = (data.Contents || [])
      .filter(obj => obj.Key.endsWith(".mp3"))
      .map(obj => ({
        name: obj.Key,
        url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${obj.Key}`,
        date: obj.LastModified,
        agent: obj.Key.split("_agent-")[1]?.split("_")[0] || "Unknown",
      }));

    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to load recordings" });
  }
});

// Root redirect
app.get("/", (_, res) => res.redirect("/login.html"));

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);

