const express = require("express");
const multer = require("multer");
const AWS = require("aws-sdk");

const app = express();
app.use(express.json());

/* ===== TOKEN AUTH ===== */
app.use((req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || auth !== `Bearer ${process.env.CLIENT_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* ===== MULTER (MEMORY) ===== */
const upload = multer({ storage: multer.memoryStorage() });

/* ===== AWS S3 CONFIG ===== */
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/* ===== ROUTES ===== */
app.get("/", (req, res) => {
  res.json({ status: "Service running" });
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `recordings/${Date.now()}-${req.file.originalname}`,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    const result = await s3.upload(params).promise();

    res.json({
      success: true,
      fileUrl: result.Location,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ===== START SERVER ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Server running on port", PORT)
);
