const express = require("express");
const AWS = require("aws-sdk");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   AWS S3 CONFIG
========================= */
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const BUCKET = process.env.S3_BUCKET;

/* =========================
   BASIC LOGIN (MULTI CLIENT)
========================= */
const USERS = {
  client1: "password123",
  client2: "password456"
};

app.use(express.json());
app.use(express.static("public"));

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] === password) {
    return res.json({ success: true });
  }
  res.status(401).json({ success: false });
});

/* =========================
   LIST RECORDINGS
========================= */
app.get("/recordings", async (req, res) => {
  const { date, agent } = req.query;

  let prefix = "";
  if (date) prefix += date;
  if (agent) prefix += `_agent_${agent}`;

  const params = {
    Bucket: BUCKET,
    Prefix: prefix
  };

  try {
    const data = await s3.listObjectsV2(params).promise();

    const files = data.Contents.map(obj => {
      const key = obj.Key;
      const parts = key.split("_");

      return {
        key,
        date: parts[0],
        agent: parts[2],
        duration: parts[4]?.replace(".mp3", ""),
        url: s3.getSignedUrl("getObject", {
          Bucket: BUCKET,
          Key: key,
          Expires: 3600
        })
      };
    });

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

