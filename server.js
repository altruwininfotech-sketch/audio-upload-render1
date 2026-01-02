const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// ✅ VERY IMPORTANT
// This serves public/index.html automatically on "/"
app.use(express.static(path.join(__dirname, "public")));

// Health check API (optional)
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", service: "Audio Dashboard Backend" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
