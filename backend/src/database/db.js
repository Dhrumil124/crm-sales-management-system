const sqlite3 = require("sqlite3");
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

  // Safe non-destructive check for assigned_to column on leads
  db.all("PRAGMA table_info(leads)", (err, columns) => {
    if (!err && columns && !columns.some(col => col.name === "assigned_to")) {
      db.run("ALTER TABLE leads ADD COLUMN assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL", () => {
        db.run("CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)");
      });
    } else {
      db.run("CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to)");
    }
  });

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

  // -------------------------------------------------------------
  // Day 4 Tables: Customers, Quotations, Quotation Items, Tickets,
  //               Ticket Comments, Ticket Attachments, Payments
  // -------------------------------------------------------------

  // 1. Customers Table (Organization-Aware CRM Client Entities)
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      address TEXT,
      status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive', 'Pending', 'Archived')),
      contact_type TEXT NOT NULL DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
    )
  `);

  // Migration for existing tables: add contact_type column if not present
  db.run(`ALTER TABLE customers ADD COLUMN contact_type TEXT DEFAULT 'customer'`, () => {});


  // 2. Quotations Table (Organization-Aware Unique Quotes with Financial Totals)
  db.run(`
    CREATE TABLE IF NOT EXISTS quotations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      quote_number TEXT NOT NULL,
      customer_id TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Sent', 'Accepted', 'Declined')),
      subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
      tax_total NUMERIC NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
      grand_total NUMERIC NOT NULL DEFAULT 0 CHECK (grand_total >= 0),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      UNIQUE (organization_id, quote_number)
    )
  `);

  // 3. Quotation Items Table (Line Items with Validated Rates, Quantities & Cascading)
  db.run(`
    CREATE TABLE IF NOT EXISTS quotation_items (
      id TEXT PRIMARY KEY,
      quotation_id TEXT NOT NULL,
      description TEXT NOT NULL,
      quantity NUMERIC NOT NULL CHECK (quantity > 0),
      unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
      tax_rate NUMERIC NOT NULL DEFAULT 0 CHECK (tax_rate >= 0),
      tax_amount NUMERIC NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
      line_total NUMERIC NOT NULL DEFAULT 0 CHECK (line_total >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
    )
  `);

  // 4. Tickets Table (Organization-Aware Support Tickets with Staff Assignment)
  db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      ticket_number TEXT NOT NULL,
      customer_id TEXT,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
      status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Waiting', 'Resolved', 'Closed')),
      assigned_to TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE (organization_id, ticket_number)
    )
  `);

  // 5. Ticket Comments Table (Discussion Threading with Cascading Ticket Removal)
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_comments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      user_id TEXT,
      comment TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 6. Ticket Attachments Table (Metadata-Only File Attachment Tracking)
  db.run(`
    CREATE TABLE IF NOT EXISTS ticket_attachments (
      id TEXT PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      comment_id TEXT,
      uploaded_by TEXT,
      original_filename TEXT NOT NULL,
      stored_path TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER NOT NULL CHECK (file_size >= 0),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES ticket_comments(id) ON DELETE SET NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // 7. Payments Table (Quotation & Customer Payment Tracking with Multi-payment Support)
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      quotation_id TEXT,
      customer_id TEXT,
      amount NUMERIC NOT NULL CHECK (amount > 0),
      payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      payment_method TEXT NOT NULL CHECK (payment_method IN ('Credit Card', 'Bank Transfer', 'Cash', 'Cheque', 'UPI', 'PayPal', 'Other')),
      payment_status TEXT NOT NULL DEFAULT 'Completed' CHECK (payment_status IN ('Pending', 'Completed', 'Failed', 'Refunded')),
      reference_number TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    )
  `);

  // -------------------------------------------------------------
  // Day 4 Indexes: Performance, Foreign Keys, Status, and Filtering
  // -------------------------------------------------------------
  // Customers indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_customers_org_id ON customers(organization_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email)`);

  // Quotations indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_quotations_org_id ON quotations(organization_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_quotations_customer_id ON quotations(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_quotations_status ON quotations(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_quotations_issue_date ON quotations(issue_date)`);

  // Quotation Items indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_quotation_items_quote_id ON quotation_items(quotation_id)`);

  // Tickets indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_org_id ON tickets(organization_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to)`);

  // Ticket Comments indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON ticket_comments(user_id)`);

  // Ticket Attachments indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket_id ON ticket_attachments(ticket_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_attachments_comment_id ON ticket_attachments(comment_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_ticket_attachments_uploaded_by ON ticket_attachments(uploaded_by)`);

  // Payments indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(organization_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_quote_id ON payments(quotation_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date)`);
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

/**
 * Server-side validated calculator for quotation line items and financial totals
 */
const calculateQuotationTotals = (items = []) => {
  let subtotal = 0;
  let taxTotal = 0;

  const validatedItems = items.map((item) => {
    const qty = Math.max(0.0001, Number(item.quantity) || 1);
    const price = Math.max(0, Number(item.unit_price ?? item.unitPrice) || 0);
    const taxRate = Math.max(0, Number(item.tax_rate ?? item.taxRate) || 0);

    const lineTotal = Number((qty * price).toFixed(2));
    const taxAmount = Number((lineTotal * (taxRate / 100)).toFixed(2));

    subtotal += lineTotal;
    taxTotal += taxAmount;

    return {
      description: String(item.description || "").trim(),
      quantity: qty,
      unit_price: price,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      line_total: lineTotal
    };
  });

  subtotal = Number(subtotal.toFixed(2));
  taxTotal = Number(taxTotal.toFixed(2));
  const grandTotal = Number((subtotal + taxTotal).toFixed(2));

  return {
    items: validatedItems,
    subtotal,
    taxTotal,
    grandTotal
  };
};

module.exports = {
  db,
  run,
  get,
  all,
  runTransaction,
  seedDefaultPipelineStages,
  DEFAULT_PIPELINE_STAGES,
  generateId,
  calculateQuotationTotals
};
