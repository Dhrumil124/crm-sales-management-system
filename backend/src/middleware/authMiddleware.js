const jwt = require("jsonwebtoken");
const { run, seedDefaultPipelineStages } = require("../database/db");

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Authentication token is required"
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      message: "Invalid authentication format"
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Self-healing database persistence for ephemeral cloud hosting (Render):
    // If the container was restarted or redeployed, automatically ensure the
    // organization, user account, and pipeline stages exist in the SQLite database
    // so foreign key constraints never fail on any subsequent request.
    const organizationId = decoded.organizationId;
    const userId = decoded.userId || decoded.id;
    const email = decoded.email;
    const role = decoded.role || "admin";
    const now = new Date().toISOString();

    if (organizationId) {
      await run(
        "INSERT OR IGNORE INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
        [organizationId, "Workspace", now]
      );
      await seedDefaultPipelineStages(organizationId);

      if (userId) {
        await run(
          `INSERT OR IGNORE INTO users (id, organization_id, name, email, password_hash, role, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            organizationId,
            email ? email.split("@")[0] : "Admin User",
            email || `${userId}@workspace.local`,
            "$2b$10$placeholderDummyHashForSelfHealingSessionUser",
            role,
            now
          ]
        );
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired authentication token"
    });
  }
};

module.exports = authMiddleware;