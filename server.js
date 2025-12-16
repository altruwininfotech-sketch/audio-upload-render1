const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===== TOKEN AUTH (NO LOGIN, NO PASSWORD) ===== */
app.use((req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || auth !== `Bearer ${process.env.CLIENT_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/* ===== UPLOAD SETUP ===== */
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });

/* ===== ROUTES ===== */
app.get("/", (req, res) => {
  res.json({ status: "Service running" });
});

app.post("/upload", upload.single("audio"), (req, res) => {
  res.json({ message: "Uploaded", file: req.file.filename });
});

app.get("/recordings", (req, res) => {
  res.json(fs.readdirSync(uploadDir));
});

app.get("/recordings/:file", (req, res) => {
  const filePath = path.join(uploadDir, req.params.file);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "Not found" });

  res.setHeader("Content-Type", "audio/mpeg");
  fs.createReadStream(filePath).pipe(res);
});

/* ===== START ===== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log("Server running on port", PORT)
);
