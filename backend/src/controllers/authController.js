const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { runTransaction, get, seedDefaultPipelineStages } = require("../database/db");

// Simple ID generator helper
const generateId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/signup
 * Transactionally creates an Organization and initial Admin User.
 */
const signup = async (req, res) => {
  try {
    const { name, email, password, organizationName } = req.body;

    // 1. Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (!email || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({ message: "A valid email address is required" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    if (!organizationName || !organizationName.trim()) {
      return res.status(400).json({ message: "Organization name is required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanOrgName = organizationName.trim();

    // 2. Check for duplicate email
    const existingUser = await get("SELECT id FROM users WHERE email = ?", [cleanEmail]);
    if (existingUser) {
      return res.status(400).json({ message: "An account with this email already exists" });
    }

    // 3. Hash password with bcryptjs
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // 4. Generate Unique IDs
    const orgId = generateId("org");
    const userId = generateId("user");

    // 5. Execute creation within a strict database transaction
    await runTransaction(async (executor) => {
      // Step A: Insert Organization
      await executor.run(
        "INSERT INTO organizations (id, name, created_at) VALUES (?, ?, ?)",
        [orgId, cleanOrgName, new Date().toISOString()]
      );

      // Step B: Insert User associated with the Organization
      await executor.run(
        "INSERT INTO users (id, organization_id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, orgId, cleanName, cleanEmail, passwordHash, "admin", new Date().toISOString()]
      );

      // Step C: Seed default pipeline stages for the new Organization
      await seedDefaultPipelineStages(orgId, executor);
    });

    // 6. Generate JWT with explicit 24-hour expiration
    const token = jwt.sign(
      {
        userId,
        email: cleanEmail,
        organizationId: orgId,
        role: "admin"
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 7. Return response (never return password or hash)
    return res.status(201).json({
      message: "Organization and user account created successfully",
      token,
      user: {
        id: userId,
        name: cleanName,
        email: cleanEmail,
        role: "admin",
        organizationId: orgId,
        organizationName: cleanOrgName
      }
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Server error during registration. Please try again." });
  }
};

/**
 * POST /api/auth/login
 * Validates credentials, issues JWT token, and returns user identity.
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validation
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Query user joined with organization
    const user = await get(
      `SELECT u.id, u.organization_id, u.name, u.email, u.password_hash, u.role, o.name AS organization_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = ?`,
      [cleanEmail]
    );

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 3. Verify password against hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 4. Generate JWT with explicit 24-hour expiration
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        organizationId: user.organization_id,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // 5. Return response (never return password or hash)
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name
      }
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login. Please try again." });
  }
};

/**
 * GET /api/auth/me
 * Returns authenticated user profile using token decoded in authMiddleware.
 */
const getMe = async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const user = await get(
      `SELECT u.id, u.organization_id, u.name, u.email, u.role, u.created_at, o.name AS organization_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = ?`,
      [userId]
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error("GetMe error:", error);
    return res.status(500).json({ message: "Server error retrieving user profile." });
  }
};

module.exports = {
  signup,
  login,
  getMe
};
