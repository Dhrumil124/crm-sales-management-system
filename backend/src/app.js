const express = require("express");
const cors = require("cors");

const authMiddleware = require("./middleware/authMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Backend server is running!");
});

app.get("/api/test", (req, res) => {
  res.json({
    message: "API is working!"
  });
});

app.get("/api/protected-test", authMiddleware, (req, res) => {
  res.json({
    message: "You accessed a protected route!",
    user: req.user
  });
});

module.exports = app;