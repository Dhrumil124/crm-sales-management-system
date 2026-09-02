const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Public test endpoint
router.get("/test", (req, res) => {
  res.json({
    message: "API is working!"
  });
});

// Protected test endpoint (requires valid JWT in Authorization header)
router.get("/protected-test", authMiddleware, (req, res) => {
  res.json({
    message: "You accessed a protected route!",
    user: req.user
  });
});

module.exports = router;
