const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* -------------------- BASIC SETUP -------------------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* -------------------- TOKEN SECURITY -------------------- */
app.use((req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || auth !== `Bearer ${process.env.CLIENT_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

/* -------------------- UPLOAD CONFIG -------------------- */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* -------------------- ROUTES -------------------- */

// Health check
app.get("/", (req, res) => {
  res.json({ status: "Audio service running" });
});

// Upload audio
app.post("/upload", upload.single("audio"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  res.json({
    message: "Upload successful",
    filename: req.file.filename
  });
});

// List uploaded files (admin / client)
app.get("/recordings", (req, res) => {
  const files = fs.readdirSync(uploadDir);
  res.json(files);
});

// Stream audio file
app.get("/recordings/:file", (req, res) => {
  const filePath = path.join(uploadDir, req.params.file);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("Content-Type", "audio/mpeg");
  fs.createReadStream(filePath).pipe(res);
});

/* -------------------- START SERVER -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
