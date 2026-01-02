require("dotenv").config();
const express = require("express");
const AWS = require("aws-sdk");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------------- MIDDLEWARE ---------------- */
app.use(express.json());
app.use(express.static("public"));

/* ---------------- AWS CONFIG ---------------- */
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

/* ---------------- DEMO USERS (MULTI-CLIENT READY) ---------------- */
const users = [
  {
    username: "clientA",
    passwordHash: bcrypt.hashSync("password123", 10),
    prefix: "clientA/"
  }
];

/* ---------------- AUTH MIDDLEWARE ---------------- */
function auth(req, res, next) {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Invalid token" });
  }
}

/* ---------------- LOGIN ---------------- */
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ success: false });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ success: false });

  const token = jwt.sign(
    { prefix: user.prefix },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );

  res.json({ success: true, token });
});

/* ---------------- LIST FILES ---------------- */
app.get("/files", auth, async (req, res) => {
  const { agent, date } = req.query;

  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: req.user.prefix
  };

  const data = await s3.listObjectsV2(params).promise();
  let files = data.Contents.map(obj => obj.Key);

  if (agent) files = files.filter(f => f.includes(`agent_${agent}_`));
  if (date) files = files.filter(f => f.startsWith(`${req.user.prefix}${date}`));

  res.json(files);
});

/* ---------------- FILTER DATA (AGENT + DATE) ---------------- */
app.get("/filters", auth, async (req, res) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Prefix: req.user.prefix
  };

  const data = await s3.listObjectsV2(params).promise();

  const agents = new Set();
  const dates = new Set();

  data.Contents.forEach(obj => {
    const file = obj.Key.replace(req.user.prefix, "");
    const parts = file.split("_");

    if (parts.length >= 3) {
      dates.add(parts[0]);
      agents.add(parts[2]);
    }
  });

  res.json({
    agents: Array.from(agents).sort(),
    dates: Array.from(dates).sort()
  });
});

/* ---------------- SIGNED URL ---------------- */
app.get("/play", auth, (req, res) => {
  const { key } = req.query;

  const url = s3.getSignedUrl("getObject", {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Expires: 300
  });

  res.json({ url });
});

/* ---------------- ROOT ---------------- */
app.use(express.static("public"));

/* ---------------- START ---------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

