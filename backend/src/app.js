const express = require("express");
const cors = require("cors");

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

module.exports = app;