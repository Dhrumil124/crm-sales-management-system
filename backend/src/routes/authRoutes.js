const express = require("express");
const authController = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Public Routes
router.post("/signup", authController.signup);
router.post("/login", authController.login);

// Protected Route (verifies current JWT and returns user + org profile)
router.get("/me", authMiddleware, authController.getMe);

module.exports = router;
