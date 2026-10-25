const express = require("express");
const cors = require("cors");
const compression = require("compression");
const path = require("path");

const routes = require("./routes");

// Non-enumerable backward-compatibility helper: allows callers expecting array responses to safely call .find on { deals: [...] }
if (!Object.prototype.find) {
  Object.defineProperty(Object.prototype, "find", {
    value: function(predicate) {
      if (Array.isArray(this.deals)) {
        return this.deals.find(predicate);
      }
      return undefined;
    },
    configurable: true,
    writable: true,
    enumerable: false
  });
}

const app = express();

// Support CORS for local development across any port (e.g. 5173, 5174, 5175...) and production Vercel frontend
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(",").map((o) => o.trim()) 
  : null;

app.use(cors({
  origin: function (origin, callback) {
    // Allow non-browser requests (e.g., Postman, mobile, server-to-server, Vite proxy)
    if (!origin) return callback(null, true);

    // If explicit CLIENT_URL whitelist matches
    if (allowedOrigins && allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Automatically allow any localhost or 127.0.0.1 port for smooth simultaneous multi-project presentations
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    // If no CLIENT_URL configured, allow origin
    if (!allowedOrigins) {
      return callback(null, true);
    }

    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true
}));

// Compress all HTTP responses for lag-free performance across the internet
app.use(compression());
app.use(express.json());

// Serve static uploaded attachments if accessed directly
const uploadDir = process.env.STORAGE_DIR 
  ? path.join(process.env.STORAGE_DIR, "attachments")
  : path.join(__dirname, "../storage/attachments");
app.use("/storage/attachments", express.static(uploadDir));

// Root and Health Check endpoints for Render & UptimeRobot monitoring
app.get("/", (req, res) => {
  res.send("Backend server is running!");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "crm-sales-management-system", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "healthy", service: "crm-sales-management-system", timestamp: new Date().toISOString() });
});

app.use("/api", routes);

module.exports = app;