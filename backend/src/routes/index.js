const express = require("express");
const crmRoutes = require("./crmRoutes");
const pipelineRoutes = require("./pipelineRoutes");
const quotationRoutes = require("./quotationRoutes");
const ticketRoutes = require("./ticketRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const apiRoutes = require("./apiRoutes");

const router = express.Router();

// Preserved test and protected-test endpoints
router.use("/", apiRoutes);

// Core 4 Business Modules
router.use("/crm", crmRoutes);
router.use("/pipeline", pipelineRoutes);
router.use("/quotations", quotationRoutes);
router.use("/tickets", ticketRoutes);

// UI Overview Dashboard Support
router.use("/dashboard", dashboardRoutes);

module.exports = router;
