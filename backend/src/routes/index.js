const express = require("express");
const crmRoutes = require("./crmRoutes");
const pipelineRoutes = require("./pipelineRoutes");
const quotationRoutes = require("./quotationRoutes");
const ticketRoutes = require("./ticketRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const apiRoutes = require("./apiRoutes");
const authRoutes = require("./authRoutes");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Preserved test (/test) and protected-test (/protected-test) endpoints
router.use("/", apiRoutes);

// Authentication Routes (/api/auth/signup, /api/auth/login, /api/auth/me)
router.use("/auth", authRoutes);

// Core 4 Business Modules (Protected with JWT authMiddleware)
router.use("/crm", authMiddleware, crmRoutes);
router.use("/pipeline", authMiddleware, pipelineRoutes);
router.use("/quotations", authMiddleware, quotationRoutes);
router.use("/tickets", authMiddleware, ticketRoutes);

// UI Overview Dashboard Support (Protected with JWT authMiddleware)
router.use("/dashboard", authMiddleware, dashboardRoutes);

module.exports = router;

