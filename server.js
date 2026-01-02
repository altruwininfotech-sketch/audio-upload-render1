import express from "express";
import AWS from "aws-sdk";
import path from "path";

const app = express();
const PORT = process.env.PORT || 3000;

// -------- AWS S3 CONFIG --------
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

// -------- STATIC FILES --------
app.use(express.static("public"));

// -------- ROOT ROUTE --------
app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

// -------- FETCH AUDIO LIST --------
app.get("/api/audios", async (req, res) => {
  try {
    const data = await s3
      .listObjectsV2({
        Bucket: BUCKET_NAME
      })
      .promise();

    const files = data.Contents.map(file => ({
      name: file.Key,
      url: `https://${BUCKET_NAME}.s3.amazonaws.com/${file.Key}`,
      date: file.LastModified
    }));

    res.json(files);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------- START SERVER --------
app.listen(PORT, () => {
  console.log("S3 Audio Dashboard is running successfully 🚀");
});

