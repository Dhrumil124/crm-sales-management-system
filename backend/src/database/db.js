const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Database file path inside backend/src/database/
const dbPath = path.join(__dirname, "crm.sqlite");

// Initialize SQLite database instance
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Failed to connect to SQLite database:", err.message);
  } else {
    // Enable Foreign Key constraint support
    db.run("PRAGMA foreign_keys = ON;");
  }
});

// Default pipeline stages definition for CRM Sales Pipeline
const DEFAULT_PIPELINE_STAGES = [
  { name: "Lead In", stage_order: 1, color: "border-t-blue-500" },
  { name: "Contact Made", stage_order: 2, color: "border-t-indigo-500" },
  { name: "Proposal Sent", stage_order: 3, color: "border-t-purple-500" },
  { name: "Negotiation", stage_order: 4, color: "border-t-amber-500" },
  { name: "Closed Won", stage_order: 5, color: "border-t-emerald-500" },
  { name: "Closed Lost", stage_order: 6, color: "border-t-rose-500" }
];

// Helper to generate unique IDs consistent with project conventions
const generateId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

// Initialize All Day 2 and Day 3 Tables & Indexes
db.serialize(() => {
  // -------------------------------------------------------------
  // Day 2 Tables: Organizations & Users (Preserved Intact)
  // -------------------------------------------------------------
  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // -------------------------------------------------------------
  // Day 3 Tables: CRM Leads, Lead Notes, Lead Communications
  // -------------------------------------------------------------

  // 1. Leads Table
  db.run(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Lost', 'Active', 'Inactive', 'Converted')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // 2. Lead Notes Table
  db.run(`
    CREATE TABLE IF NOT EXISTS lead_notes (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      author_id TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 3. Lead Communications Table
  db.run(`
    CREATE TABLE IF NOT EXISTS lead_communications (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('Email', 'Call', 'Meeting', 'Note', 'SMS', 'WhatsApp', 'Other')),
      subject TEXT,
      details TEXT NOT NULL,
      communication_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // -------------------------------------------------------------
  // Day 3 Tables: Sales Pipeline Stages & Deals
  // -------------------------------------------------------------

  // 4. Pipeline Stages Table
  db.run(`
    CREATE TABLE IF NOT EXISTS pipeline_stages (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      stage_order INTEGER NOT NULL,
      color TEXT DEFAULT 'border-t-indigo-500',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      UNIQUE (organization_id, stage_order),
      UNIQUE (organization_id, name)
    )
  `);

  // 5. Deals Table
  db.run(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      lead_id TEXT,
      stage_id TEXT NOT NULL,
      value NUMERIC NOT NULL DEFAULT 0 CHECK (value >= 0),
      expected_close_date TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
      FOREIGN KEY (stage_id) REFERENCES pipeline_stages(id) ON DELETE RESTRICT
    )
  `);

  // -------------------------------------------------------------
  // Day 3 Indexes: Foreign Keys, Searching, Filtering, and Sorting
  // -------------------------------------------------------------
  // Leads indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_org_id ON leads(organization_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email)`);

  // Lead Notes indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id ON lead_notes(lead_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lead_notes_author_id ON lead_notes(author_id)`);

  // Lead Communications indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_lead_comm_lead_id ON lead_communications(lead_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lead_comm_date ON lead_communications(communication_date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lead_comm_created_by ON lead_communications(created_by)`);

  // Pipeline Stages indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_pipeline_stages_org_order ON pipeline_stages(organization_id, stage_order)`);

  // Deals indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_deals_org_id ON deals(organization_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deals_stage_id ON deals(stage_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_deals_close_date ON deals(expected_close_date)`);
});

/**
 * Promise-based query helpers for async/await usage
 */
const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
};

const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

/**
 * Executes a sequence of queries within a strict database transaction.
 * If any error is thrown, the entire transaction is rolled back.
 */
const runTransaction = async (callback) => {
  await run("BEGIN TRANSACTION");
  try {
    const result = await callback({ run, get, all });
    await run("COMMIT");
    return result;
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
};

/**
 * Idempotently seeds default pipeline stages for an organization if none exist.
 */
const seedDefaultPipelineStages = async (orgId, executor = null) => {
  const queryRun = executor && executor.run ? executor.run : run;
  const queryAll = executor && executor.all ? executor.all : all;

  const existing = await queryAll(
    "SELECT id FROM pipeline_stages WHERE organization_id = ?",
    [orgId]
  );

  if (existing.length === 0) {
    for (const stage of DEFAULT_PIPELINE_STAGES) {
      const stageId = generateId("stage");
      await queryRun(
        `INSERT INTO pipeline_stages (id, organization_id, name, stage_order, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          stageId,
          orgId,
          stage.name,
          stage.stage_order,
          stage.color,
          new Date().toISOString(),
          new Date().toISOString()
        ]
      );
    }
  }
};

// Automatically ensure existing organizations have default stages on startup
const autoSeedExistingOrganizations = async () => {
  try {
    const orgs = await all("SELECT id FROM organizations");
    for (const org of orgs) {
      await seedDefaultPipelineStages(org.id);
    }
  } catch (err) {
    // Gracefully handle if tables are currently completing serialization
  }
};

setTimeout(autoSeedExistingOrganizations, 300);

module.exports = {
  db,
  run,
  get,
  all,
  runTransaction,
  seedDefaultPipelineStages,
  DEFAULT_PIPELINE_STAGES,
  generateId
};
