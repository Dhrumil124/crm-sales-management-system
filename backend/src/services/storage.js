/**
 * [DATABASE-BACKED SERVICE LAYER]
 *
 * Authoritative source of truth: SQLite database (crm.sqlite).
 * In-memory arrays serve as a read mirror that is always synchronized
 * from SQLite and never overrides persisted database state.
 */

const {
  run,
  get,
  all,
  runTransaction,
  generateId,
  calculateQuotationTotals
} = require("../database/db");

// Canonical stage mapping tables between Frontend short names and SQLite stage names
const STAGE_SHORT_TO_DB = {
  lead: "Lead In",
  "lead in": "Lead In",
  contacted: "Contact Made",
  "contact made": "Contact Made",
  proposal: "Proposal Sent",
  "proposal sent": "Proposal Sent",
  negotiation: "Negotiation",
  won: "Closed Won",
  "closed won": "Closed Won",
  lost: "Closed Lost",
  "closed lost": "Closed Lost"
};

const STAGE_DB_TO_SHORT = {
  "Lead In": "Lead",
  "Contact Made": "Contacted",
  "Proposal Sent": "Proposal",
  Negotiation: "Negotiation",
  "Closed Won": "Won",
  "Closed Lost": "Lost"
};

// Normalized helper
const normalizeStageName = (stage) => {
  const s = String(stage || "").toLowerCase().trim();
  return STAGE_SHORT_TO_DB[s] || stage;
};

const normalizeShortStage = (stage) => {
  if (!stage) return "Lead";
  const dbName = STAGE_SHORT_TO_DB[String(stage).toLowerCase().trim()] || stage;
  return STAGE_DB_TO_SHORT[dbName] || "Lead";
};

// Formats display string so contact name is always visible
const formatCustomerDisplay = (name, company) => {
  const n = (name || "").trim();
  const c = (company || "").trim();
  if (n && c && n.toLowerCase() !== c.toLowerCase()) {
    return `${n} (${c})`;
  }
  return n || c || "";
};

// In-memory mirrors
let customers = [];
let deals = [];
let quotations = [];
let tickets = [];

let isDbInitialized = false;

/**
 * Ensures initial default data exists in SQLite without overriding
 * any user-modified stages, values, or custom records.
 */
async function ensureDatabaseSeeded() {
  if (isDbInitialized) return;
  try {
    const orgs = await all("SELECT id FROM organizations LIMIT 1");
    if (!orgs || orgs.length === 0) return;
    const orgId = orgs[0].id;

    // 1. Initial CRM contacts
    const initialContacts = [
      {
        id: "cust-1",
        name: "John Miller",
        email: "john.miller@apextech.com",
        phone: "+1 (555) 234-5678",
        company: "Apex Tech Solutions",
        type: "customer",
        status: "Active",
        notes: "Enterprise account with 50+ licenses.",
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "cust-2",
        name: "Sarah Chen",
        email: "sarah.chen@innovateai.io",
        phone: "+1 (555) 345-6789",
        company: "Innovate AI",
        type: "customer",
        status: "Active",
        notes: "Key contact for annual platform renewal.",
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "cust-3",
        name: "Marcus Vance",
        email: "m.vance@vanceresources.org",
        phone: "+1 (555) 456-7890",
        company: "Vance Global",
        type: "lead",
        status: "Qualified",
        notes: "Demo delivered last Thursday. Decision expected by end of month.",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "cust-4",
        name: "Elena Rostova",
        email: "elena@nordicdesign.co",
        phone: "+1 (555) 567-8901",
        company: "Nordic Design Studio",
        type: "lead",
        status: "New",
        notes: "Inbound inquiry from website contact form.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const c of initialContacts) {
      await run(
        `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, orgId, c.name, c.email, c.phone, c.company, c.notes, "Active", c.createdAt, c.createdAt]
      );
      await run(
        `INSERT OR IGNORE INTO leads (id, organization_id, name, email, phone, company, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, orgId, c.name, c.email, c.phone, c.company, c.type === "lead" ? c.status : "Active", c.createdAt, c.createdAt]
      );
    }

    // 1.1 Mirror all existing leads into customers table (status: 'Active') so quotation & ticket foreign keys succeed
    const allDbLeads = await all("SELECT id, organization_id, name, email, phone, company, created_at FROM leads");
    for (const l of allDbLeads) {
      await run(
        `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, null, 'Active', ?, ?)`,
        [l.id, l.organization_id || orgId, l.name, l.email || null, l.phone || null, l.company || null, l.created_at, l.created_at]
      );
    }

    // 2. Ensure default pipeline stages exist
    const dbStages = await all(
      "SELECT id, name FROM pipeline_stages WHERE organization_id = ? ORDER BY stage_order ASC",
      [orgId]
    );

    // 3. Initial deals in SQLite (do NOT overwrite stage if deal already exists in DB!)
    const initialDeals = [
      {
        id: "deal-1",
        title: "Enterprise CRM Licensing Expansion",
        customerId: "cust-1",
        value: 45000,
        stage: "Negotiation",
        expectedCloseDate: "2026-09-30",
        notes: "Final contract under legal review for 50 additional user seats.",
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "deal-2",
        title: "AI Integration Workflow Suite",
        customerId: "cust-2",
        value: 28000,
        stage: "Proposal Sent",
        expectedCloseDate: "2026-10-15",
        notes: "Custom quotation sent detailing API throughput and SLA guarantees.",
        createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "deal-3",
        title: "Resource Management Platform Pilot",
        customerId: "cust-3",
        value: 18500,
        stage: "Contact Made",
        expectedCloseDate: "2026-11-01",
        notes: "Discovery call completed. Preparing custom demo scenario.",
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "deal-4",
        title: "Creative Workflow Automation",
        customerId: "cust-4",
        value: 9200,
        stage: "Lead In",
        expectedCloseDate: "2026-11-15",
        notes: "Initial requirements gathering scheduled for next week.",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "deal-5",
        title: "Security & Compliance Add-on",
        customerId: "cust-1",
        value: 12000,
        stage: "Closed Won",
        expectedCloseDate: "2026-08-25",
        notes: "Annual compliance package signed and activated.",
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const d of initialDeals) {
      const exists = await get("SELECT id FROM deals WHERE id = ?", [d.id]);
      if (!exists) {
        const norm = normalizeStageName(d.stage);
        const stageObj = dbStages.find(s => s.name.toLowerCase() === norm.toLowerCase()) || dbStages[0];
        if (stageObj) {
          await run(
            `INSERT INTO deals (id, organization_id, title, lead_id, stage_id, value, expected_close_date, notes, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [d.id, orgId, d.title, d.customerId, stageObj.id, d.value, d.expectedCloseDate, d.notes, d.createdAt, d.createdAt]
          );
        }
      }
    }

    // 4. Initial quotations in SQLite
    const initialQuotes = [
      {
        id: "quote-demo-001",
        quoteNumber: "QT-1001",
        customerId: "cust-1",
        items: [
          { description: "Enterprise Platform License (Annual)", quantity: 50, unitPrice: 800, taxRate: 10, lineTotal: 40000 },
          { description: "Dedicated Technical Account Support", quantity: 1, unitPrice: 5000, taxRate: 10, lineTotal: 5000 }
        ],
        subtotal: 45000,
        taxTotal: 4500,
        grandTotal: 49500,
        status: "Accepted",
        issueDate: "2026-09-01",
        validUntil: "2026-09-30",
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "quote-2",
        quoteNumber: "QT-1002",
        customerId: "cust-2",
        items: [
          { description: "Custom AI Pipeline Deployment", quantity: 1, unitPrice: 20000, taxRate: 10, lineTotal: 20000 },
          { description: "Developer API Integration (Tier 2)", quantity: 1, unitPrice: 8000, taxRate: 10, lineTotal: 8000 }
        ],
        subtotal: 28000,
        taxTotal: 2800,
        grandTotal: 30800,
        status: "Draft",
        issueDate: "2026-09-02",
        validUntil: "2026-10-02",
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "quote-3",
        quoteNumber: "QT-1003",
        customerId: "cust-1",
        items: [
          { description: "Compliance & Security Module", quantity: 1, unitPrice: 12000, taxRate: 10, lineTotal: 12000 }
        ],
        subtotal: 12000,
        taxTotal: 1200,
        grandTotal: 13200,
        status: "Accepted",
        issueDate: "2026-08-15",
        validUntil: "2026-09-15",
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const q of initialQuotes) {
      const exists = await get("SELECT id FROM quotations WHERE id = ? OR quote_number = ?", [q.id, q.quoteNumber]);
      if (!exists) {
        await run(
          `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [q.id, orgId, q.quoteNumber, q.customerId, q.issueDate, q.validUntil, q.status, q.subtotal, q.taxTotal, q.grandTotal, q.createdAt, q.createdAt]
        );
        for (const itm of q.items) {
          const itmId = generateId("item");
          const itmTax = Number((itm.lineTotal * (itm.taxRate / 100)).toFixed(2));
          await run(
            `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [itmId, q.id, itm.description, itm.quantity, itm.unitPrice, itm.taxRate, itmTax, itm.lineTotal, q.createdAt]
          );
        }
      }
    }

    // 5. Initial tickets in SQLite
    const initialTickets = [
      {
        id: "tck-demo-001",
        ticketNumber: "TCK-1001",
        customerId: "cust-1",
        title: "SSO SAML authentication intermittent timeout",
        description: "Our users experienced two login timeouts this morning when authenticating via Okta SSO.",
        priority: "High",
        status: "In Progress",
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "tck-2",
        ticketNumber: "TCK-1002",
        customerId: "cust-2",
        title: "Rate limit increase request for production webhook endpoints",
        description: "Requesting rate limit increase from 60 req/min to 300 req/min ahead of our upcoming launch.",
        priority: "Medium",
        status: "Open",
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "tck-3",
        ticketNumber: "TCK-1003",
        customerId: "cust-1",
        title: "Billing receipt discrepancy for August compliance invoice",
        description: "The VAT registration number was truncated on the printed PDF receipt.",
        priority: "Low",
        status: "Resolved",
        createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
      }
    ];

    for (const t of initialTickets) {
      const exists = await get("SELECT id FROM tickets WHERE id = ? OR ticket_number = ?", [t.id, t.ticketNumber]);
      if (!exists) {
        await run(
          `INSERT INTO tickets (id, organization_id, ticket_number, customer_id, title, description, priority, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [t.id, orgId, t.ticketNumber, t.customerId, t.title, t.description, t.priority, t.status, t.createdAt, t.createdAt]
        );
      }
    }

    isDbInitialized = true;
  } catch (err) {
    console.error("ensureDatabaseSeeded error:", err);
  }
}

// Automatically seed on initial load
setTimeout(ensureDatabaseSeeded, 150);

// -------------------------------------------------------------
// 1. CRM (Customers & Leads) Storage Interface
// -------------------------------------------------------------
const customerStore = {
  async syncFromDatabase() {
    await ensureDatabaseSeeded();
    try {
      const dbCustomers = await all("SELECT * FROM customers ORDER BY created_at DESC");
      const dbLeads = await all(
        `SELECT l.*, (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as note
         FROM leads l
         ORDER BY l.created_at DESC`
      );

      const combined = [];
      const seenIds = new Set();

      // Add customers
      for (const cu of dbCustomers) {
        seenIds.add(cu.id);
        combined.push({
          id: cu.id,
          name: cu.name,
          email: cu.email || "",
          phone: cu.phone || "",
          company: cu.company || "",
          type: "customer",
          status: cu.status || "Active",
          notes: cu.address || "",
          createdAt: cu.created_at || new Date().toISOString()
        });
      }

      // Add leads that aren't already represented as customers
      for (const l of dbLeads) {
        if (!seenIds.has(l.id)) {
          seenIds.add(l.id);
          combined.push({
            id: l.id,
            name: l.name,
            email: l.email || "",
            phone: l.phone || "",
            company: l.company || "",
            type: "lead",
            status: l.status || "New",
            notes: l.note || "",
            createdAt: l.created_at || new Date().toISOString()
          });
        }
      }

      customers = combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } catch (err) {
      console.error("customerStore.syncFromDatabase error:", err);
    }
  },

  async getAll({ search = "", type = "", status = "" } = {}) {
    await this.syncFromDatabase();
    let result = [...customers];
    if (type) {
      result = result.filter(c => c.type.toLowerCase() === type.toLowerCase());
    }
    if (status) {
      result = result.filter(c => c.status.toLowerCase() === status.toLowerCase());
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.company.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      );
    }
    return result;
  },

  async getById(id) {
    await ensureDatabaseSeeded();
    const cust = await get("SELECT * FROM customers WHERE id = ?", [id]);
    if (cust) {
      return {
        id: cust.id,
        name: cust.name,
        email: cust.email || "",
        phone: cust.phone || "",
        company: cust.company || "",
        type: "customer",
        status: cust.status || "Active",
        notes: cust.address || "",
        createdAt: cust.created_at
      };
    }
    const lead = await get(
      `SELECT l.*, (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as note
       FROM leads l WHERE l.id = ?`,
      [id]
    );
    if (lead) {
      return {
        id: lead.id,
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        company: lead.company || "",
        type: "lead",
        status: lead.status || "New",
        notes: lead.note || "",
        createdAt: lead.created_at
      };
    }
    return null;
  },

  async create(data) {
    await ensureDatabaseSeeded();
    const org = await get("SELECT id FROM organizations LIMIT 1");
    const orgId = org ? org.id : "org-mtnwl7km-s2wh5";

    const newId = generateId("cust");
    const now = new Date().toISOString();
    const isCustomer = data.type === "customer";

    if (isCustomer) {
      const status = ["Active", "Inactive", "Pending", "Archived"].includes(data.status)
        ? data.status
        : "Active";
      await run(
        `INSERT INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, orgId, data.name.trim(), data.email ? data.email.trim() : null, data.phone || null, data.company || null, data.notes || null, status, now, now]
      );
    } else {
      const status = ["New", "Contacted", "Qualified", "Lost", "Active", "Inactive", "Converted"].includes(data.status)
        ? data.status
        : "New";
      await run(
        `INSERT INTO leads (id, organization_id, name, email, phone, company, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, orgId, data.name.trim(), data.email ? data.email.trim() : null, data.phone || null, data.company || null, status, now, now]
      );
      // Mirror to customers table so quotation/ticket foreign keys succeed
      await run(
        `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newId, orgId, data.name.trim(), data.email ? data.email.trim() : null, data.phone || null, data.company || null, data.notes || null, "Active", now, now]
      );
      if (data.notes && data.notes.trim()) {
        await run(
          `INSERT INTO lead_notes (id, lead_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [generateId("note"), newId, data.notes.trim(), now, now]
        );
      }
    }

    await this.syncFromDatabase();
    return await this.getById(newId);
  },

  async update(id, data) {
    await ensureDatabaseSeeded();
    const existing = await this.getById(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    if (existing.type === "customer") {
      await run(
        `UPDATE customers SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           address = COALESCE(?, address),
           status = COALESCE(?, status),
           updated_at = ?
         WHERE id = ?`,
        [data.name, data.email, data.phone, data.company, data.notes, data.status, now, id]
      );
    } else {
      await run(
        `UPDATE leads SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           status = COALESCE(?, status),
           updated_at = ?
         WHERE id = ?`,
        [data.name, data.email, data.phone, data.company, data.status, now, id]
      );
      // Keep customer mirror updated
      await run(
        `UPDATE customers SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           updated_at = ?
         WHERE id = ?`,
        [data.name, data.email, data.phone, data.company, now, id]
      );
    }

    await this.syncFromDatabase();
    return await this.getById(id);
  },

  async delete(id) {
    await ensureDatabaseSeeded();
    const resCust = await run("DELETE FROM customers WHERE id = ?", [id]);
    const resLead = await run("DELETE FROM leads WHERE id = ?", [id]);
    const deleted = (resCust.changes > 0) || (resLead.changes > 0);
    await this.syncFromDatabase();
    return deleted;
  }
};

// -------------------------------------------------------------
// 2. Sales Pipeline (Deals) Storage Interface
// -------------------------------------------------------------
const dealStore = {
  async syncFromDatabase() {
    await ensureDatabaseSeeded();
    try {
      const dbDeals = await all(`
        SELECT d.*, 
               COALESCE(c.name, l.name, '') as client_name,
               COALESCE(c.company, l.company, '') as client_company,
               s.name as stage_name
        FROM deals d
        LEFT JOIN customers c ON d.lead_id = c.id
        LEFT JOIN leads l ON d.lead_id = l.id
        LEFT JOIN pipeline_stages s ON d.stage_id = s.id
        ORDER BY d.created_at DESC
      `);

      deals = dbDeals.map(d => ({
        id: d.id,
        title: d.title,
        customerId: d.lead_id || "",
        customerName: formatCustomerDisplay(d.client_name, d.client_company),
        value: Number(d.value) || 0,
        stage: d.stage_name || "Lead In",
        expectedCloseDate: d.expected_close_date || "",
        notes: d.notes || "",
        createdAt: d.created_at,
        updatedAt: d.updated_at
      }));
    } catch (err) {
      console.error("dealStore.syncFromDatabase error:", err);
    }
  },

  async getAll({ stage = "", customerId = "" } = {}) {
    await ensureDatabaseSeeded();
    let query = `
      SELECT d.*, 
             COALESCE(c.name, l.name, '') as client_name,
             COALESCE(c.company, l.company, '') as client_company,
             s.name as stage_name
      FROM deals d
      LEFT JOIN customers c ON d.lead_id = c.id
      LEFT JOIN leads l ON d.lead_id = l.id
      LEFT JOIN pipeline_stages s ON d.stage_id = s.id
      WHERE 1=1
    `;
    const params = [];

    if (stage) {
      const normDb = normalizeStageName(stage);
      query += ` AND (LOWER(s.name) = LOWER(?) OR LOWER(s.name) = LOWER(?))`;
      params.push(normDb, stage);
    }
    if (customerId) {
      query += ` AND d.lead_id = ?`;
      params.push(customerId);
    }
    query += ` ORDER BY d.created_at DESC`;

    const dbDeals = await all(query, params);
    const result = dbDeals.map(d => ({
      id: d.id,
      title: d.title,
      customerId: d.lead_id || "",
      customerName: formatCustomerDisplay(d.client_name, d.client_company),
      value: Number(d.value) || 0,
      stage: d.stage_name || "Lead In",
      expectedCloseDate: d.expected_close_date || "",
      notes: d.notes || "",
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));

    deals = result;
    return result;
  },

  async getById(id) {
    await ensureDatabaseSeeded();
    const row = await get(
      `SELECT d.*, 
              COALESCE(c.name, l.name, '') as client_name,
              COALESCE(c.company, l.company, '') as client_company,
              s.name as stage_name
       FROM deals d
       LEFT JOIN customers c ON d.lead_id = c.id
       LEFT JOIN leads l ON d.lead_id = l.id
       LEFT JOIN pipeline_stages s ON d.stage_id = s.id
       WHERE d.id = ?`,
      [id]
    );
    if (!row) return null;
    return {
      id: row.id,
      title: row.title,
      customerId: row.lead_id || "",
      customerName: formatCustomerDisplay(row.client_name, row.client_company),
      value: Number(row.value) || 0,
      stage: row.stage_name || "Lead In",
      expectedCloseDate: row.expected_close_date || "",
      notes: row.notes || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  async create(data) {
    await ensureDatabaseSeeded();
    const org = await get("SELECT id FROM organizations LIMIT 1");
    const orgId = org ? org.id : "org-mtnwl7km-s2wh5";

    const normStage = normalizeStageName(data.stage || "Lead");
    const stages = await all("SELECT id, name FROM pipeline_stages WHERE organization_id = ?", [orgId]);
    const matchedStage = stages.find(s =>
      s.name.toLowerCase() === normStage.toLowerCase() ||
      s.name.toLowerCase() === String(data.stage || "").toLowerCase()
    ) || stages[0];

    if (!matchedStage) {
      throw new Error(`Invalid deal stage: ${data.stage}`);
    }

    let customerId = data.customerId || null;
    if (customerId) {
      // Ensure customer exists in leads table (deals table references leads(id))
      const lead = await get("SELECT id FROM leads WHERE id = ?", [customerId]);
      if (!lead) {
        const cust = await get("SELECT * FROM customers WHERE id = ?", [customerId]);
        if (cust) {
          await run(
            `INSERT OR IGNORE INTO leads (id, organization_id, name, email, phone, company, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Qualified')`,
            [cust.id, orgId, cust.name, cust.email, cust.phone, cust.company]
          );
        } else {
          customerId = null;
        }
      }
    }

    const newDealId = generateId("deal");
    const now = new Date().toISOString();

    await run(
      `INSERT INTO deals (id, organization_id, title, lead_id, stage_id, value, expected_close_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newDealId,
        orgId,
        data.title.trim(),
        customerId,
        matchedStage.id,
        Number(data.value) || 0,
        data.expectedCloseDate || null,
        data.notes ? data.notes.trim() : null,
        now,
        now
      ]
    );

    await this.syncFromDatabase();
    return await this.getById(newDealId);
  },

  async update(id, data) {
    await ensureDatabaseSeeded();
    const existing = await get("SELECT id, organization_id, stage_id FROM deals WHERE id = ?", [id]);
    if (!existing) return null;

    let stageId = existing.stage_id;
    if (data.stage) {
      const norm = normalizeStageName(data.stage);
      const stageRow = await get(
        "SELECT id FROM pipeline_stages WHERE (LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?)) AND organization_id = ? LIMIT 1",
        [norm, data.stage, existing.organization_id]
      ) || await get(
        "SELECT id FROM pipeline_stages WHERE LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1",
        [norm, data.stage]
      );
      if (!stageRow) {
        throw new Error(`Invalid stage "${data.stage}"`);
      }
      stageId = stageRow.id;
    }

    const now = new Date().toISOString();
    await run(
      `UPDATE deals SET
         title = COALESCE(?, title),
         value = COALESCE(?, value),
         expected_close_date = COALESCE(?, expected_close_date),
         notes = COALESCE(?, notes),
         stage_id = ?,
         updated_at = ?
       WHERE id = ?`,
      [data.title, data.value !== undefined ? Number(data.value) : null, data.expectedCloseDate, data.notes, stageId, now, id]
    );

    await this.syncFromDatabase();
    return await this.getById(id);
  },

  async updateStage(id, stageInput) {
    await ensureDatabaseSeeded();
    const dealRow = await get("SELECT id, organization_id FROM deals WHERE id = ?", [id]);
    if (!dealRow) {
      return null;
    }

    const normalizedDbName = normalizeStageName(stageInput);
    const stageRow = await get(
      "SELECT id, name FROM pipeline_stages WHERE (LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?)) AND organization_id = ? LIMIT 1",
      [normalizedDbName, stageInput, dealRow.organization_id]
    ) || await get(
      "SELECT id, name FROM pipeline_stages WHERE LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1",
      [normalizedDbName, stageInput]
    );

    if (!stageRow) {
      throw new Error(`Invalid stage: "${stageInput}". No matching pipeline stage found.`);
    }

    const now = new Date().toISOString();
    const updateResult = await run(
      "UPDATE deals SET stage_id = ?, updated_at = ? WHERE id = ?",
      [stageRow.id, now, id]
    );

    if (!updateResult || updateResult.changes === 0) {
      throw new Error(`Failed to update deal ${id} stage in SQLite.`);
    }

    await this.syncFromDatabase();
    return await this.getById(id);
  },

  async delete(id) {
    await ensureDatabaseSeeded();
    const res = await run("DELETE FROM deals WHERE id = ?", [id]);
    const success = res.changes > 0;
    await this.syncFromDatabase();
    return success;
  },

  async getStats() {
    const allDeals = await this.getAll();
    const stages = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];
    const statsByStage = {};
    stages.forEach(s => {
      statsByStage[s] = { count: 0, totalValue: 0 };
    });

    let totalActiveValue = 0;
    let totalWonValue = 0;

    allDeals.forEach(d => {
      const shortStage = normalizeShortStage(d.stage);
      if (statsByStage[shortStage]) {
        statsByStage[shortStage].count += 1;
        statsByStage[shortStage].totalValue += Number(d.value) || 0;
      }
      if (shortStage === "Won") {
        totalWonValue += Number(d.value) || 0;
      } else if (shortStage !== "Lost") {
        totalActiveValue += Number(d.value) || 0;
      }
    });

    return {
      totalDeals: allDeals.length,
      totalActiveValue,
      totalWonValue,
      byStage: statsByStage
    };
  }
};

// -------------------------------------------------------------
// 3. Quotation Storage & Calculation Interface
// -------------------------------------------------------------
const quotationStore = {
  async syncFromDatabase() {
    await ensureDatabaseSeeded();
    try {
      const dbQuotes = await all(`
        SELECT q.*, 
               c.name as cust_name,
               c.company as cust_company
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
        ORDER BY q.created_at DESC
      `);

      const result = [];
      for (const q of dbQuotes) {
        const items = await all(
          "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY rowid ASC",
          [q.id]
        );
        result.push({
          id: q.id,
          quoteNumber: q.quote_number,
          customerId: q.customer_id,
          customerName: formatCustomerDisplay(q.cust_name, q.cust_company),
          items: items.map(i => ({
            id: i.id,
            description: i.description,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unit_price),
            taxRate: Number(i.tax_rate),
            taxAmount: Number(i.tax_amount),
            lineTotal: Number(i.line_total)
          })),
          subtotal: Number(q.subtotal),
          taxTotal: Number(q.tax_total),
          grandTotal: Number(q.grand_total),
          status: q.status,
          issueDate: q.issue_date,
          validUntil: q.valid_until,
          notes: q.notes || "",
          createdAt: q.created_at,
          updatedAt: q.updated_at
        });
      }

      quotations = result;
    } catch (err) {
      console.error("quotationStore.syncFromDatabase error:", err);
    }
  },

  async getAll({ status = "", customerId = "" } = {}) {
    await ensureDatabaseSeeded();
    let query = `
      SELECT q.*, 
             c.name as cust_name,
             c.company as cust_company
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += " AND LOWER(q.status) = LOWER(?)";
      params.push(status);
    }
    if (customerId) {
      query += " AND q.customer_id = ?";
      params.push(customerId);
    }
    query += " ORDER BY q.created_at DESC";

    const dbQuotes = await all(query, params);
    const result = [];
    for (const q of dbQuotes) {
      const items = await all(
        "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY rowid ASC",
        [q.id]
      );
      result.push({
        id: q.id,
        quoteNumber: q.quote_number,
        customerId: q.customer_id,
        customerName: formatCustomerDisplay(q.cust_name, q.cust_company),
        items: items.map(i => ({
          id: i.id,
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price),
          taxRate: Number(i.tax_rate),
          taxAmount: Number(i.tax_amount),
          lineTotal: Number(i.line_total)
        })),
        subtotal: Number(q.subtotal),
        taxTotal: Number(q.tax_total),
        grandTotal: Number(q.grand_total),
        status: q.status,
        issueDate: q.issue_date,
        validUntil: q.valid_until,
        notes: q.notes || "",
        createdAt: q.created_at,
        updatedAt: q.updated_at
      });
    }

    quotations = result;
    return result;
  },

  async getById(id) {
    await ensureDatabaseSeeded();
    // Resolve by canonical id or fallback by quote_number
    let q = await get(
      `SELECT q.*, 
              c.name as cust_name,
              c.company as cust_company
       FROM quotations q
       LEFT JOIN customers c ON q.customer_id = c.id
       WHERE q.id = ?`,
      [id]
    );

    if (!q) {
      q = await get(
        `SELECT q.*, 
                c.name as cust_name,
                c.company as cust_company
         FROM quotations q
         LEFT JOIN customers c ON q.customer_id = c.id
         WHERE q.quote_number = ?`,
        [id]
      );
    }

    if (!q) return null;

    const items = await all(
      "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY rowid ASC",
      [q.id]
    );

    return {
      id: q.id,
      quoteNumber: q.quote_number,
      customerId: q.customer_id,
      customerName: formatCustomerDisplay(q.cust_name, q.cust_company),
      items: items.map(i => ({
        id: i.id,
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unit_price),
        taxRate: Number(i.tax_rate),
        taxAmount: Number(i.tax_amount),
        lineTotal: Number(i.line_total)
      })),
      subtotal: Number(q.subtotal),
      taxTotal: Number(q.tax_total),
      grandTotal: Number(q.grand_total),
      status: q.status,
      issueDate: q.issue_date,
      validUntil: q.valid_until,
      notes: q.notes || "",
      createdAt: q.created_at,
      updatedAt: q.updated_at
    };
  },

  async create(data) {
    await ensureDatabaseSeeded();

    // 1. Customer validation (Never silently pick an unrelated customer)
    if (!data.customerId || !String(data.customerId).trim()) {
      throw new Error("A valid client must be selected for the quotation.");
    }

    let customer = await get("SELECT * FROM customers WHERE id = ?", [data.customerId]);
    if (!customer) {
      // Check if ID is in leads table and bridge it to customers
      const lead = await get("SELECT * FROM leads WHERE id = ?", [data.customerId]);
      if (lead) {
        await run(
          `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, null, 'Active', datetime('now'), datetime('now'))`,
          [lead.id, lead.organization_id, lead.name, lead.email, lead.phone, lead.company]
        );
        customer = await get("SELECT * FROM customers WHERE id = ?", [data.customerId]);
      }
    }

    if (!customer) {
      throw new Error(`Client with ID "${data.customerId}" does not exist in the database.`);
    }

    const orgId = customer.organization_id;

    // 2. Validate items and calculate financial totals
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error("At least one quotation line item is required.");
    }

    const { items: validatedItems, subtotal, taxTotal, grandTotal } = calculateQuotationTotals(data.items);

    // 3. Generate sequential organization-aware quote number
    const maxQuote = await get(
      "SELECT quote_number FROM quotations WHERE organization_id = ? ORDER BY rowid DESC LIMIT 1",
      [orgId]
    );
    let quoteSeq = 1001;
    if (maxQuote && maxQuote.quote_number) {
      const match = maxQuote.quote_number.match(/\d+/);
      if (match) {
        quoteSeq = parseInt(match[0], 10) + 1;
      }
    }
    const quoteNumber = `QT-${quoteSeq}`;
    const quoteId = generateId("quote");
    const now = new Date().toISOString();
    const status = ["Draft", "Sent", "Accepted", "Declined"].includes(data.status)
      ? data.status
      : "Draft";

    const issueDate = data.issueDate || now.split("T")[0];
    const validUntil = data.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // 4. Atomic Transaction: Insert quotation + all items together
    await runTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quoteId,
          orgId,
          quoteNumber,
          customer.id,
          issueDate,
          validUntil,
          status,
          subtotal,
          taxTotal,
          grandTotal,
          data.notes ? data.notes.trim() : null,
          now,
          now
        ]
      );

      for (const itm of validatedItems) {
        const itemId = generateId("qitem");
        await tx.run(
          `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            quoteId,
            itm.description,
            itm.quantity,
            itm.unit_price,
            itm.tax_rate,
            itm.tax_amount,
            itm.line_total,
            now
          ]
        );
      }
    });

    await this.syncFromDatabase();
    return await this.getById(quoteId);
  },

  async updateStatus(id, status) {
    await ensureDatabaseSeeded();
    if (!["Draft", "Sent", "Accepted", "Declined"].includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be Draft, Sent, Accepted, or Declined.`);
    }

    // Resolve canonical SQLite ID
    let quote = await get("SELECT id FROM quotations WHERE id = ?", [id]);
    if (!quote) {
      quote = await get("SELECT id FROM quotations WHERE quote_number = ?", [id]);
    }
    if (!quote) {
      return null;
    }

    const now = new Date().toISOString();
    const updateRes = await run(
      "UPDATE quotations SET status = ?, updated_at = ? WHERE id = ?",
      [status, now, quote.id]
    );

    if (!updateRes || updateRes.changes === 0) {
      throw new Error(`Failed to update quotation ${id} status in SQLite.`);
    }

    await this.syncFromDatabase();
    return await this.getById(quote.id);
  },

  async delete(id) {
    await ensureDatabaseSeeded();
    let quote = await get("SELECT id FROM quotations WHERE id = ?", [id]);
    if (!quote) {
      quote = await get("SELECT id FROM quotations WHERE quote_number = ?", [id]);
    }
    if (!quote) return false;

    await runTransaction(async (tx) => {
      await tx.run("DELETE FROM quotation_items WHERE quotation_id = ?", [quote.id]);
      await tx.run("DELETE FROM quotations WHERE id = ?", [quote.id]);
    });

    await this.syncFromDatabase();
    return true;
  }
};

// -------------------------------------------------------------
// 4. Support Ticket Storage Interface
// -------------------------------------------------------------
const ticketStore = {
  async syncFromDatabase() {
    await ensureDatabaseSeeded();
    try {
      const dbTickets = await all(`
        SELECT t.*, 
               c.name as cust_name,
               c.company as cust_company,
               COALESCE(u.name, 'Support Team') as assigned_name
        FROM tickets t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN users u ON t.assigned_to = u.id
        ORDER BY t.created_at DESC
      `);

      const result = [];
      for (const t of dbTickets) {
        const comments = await all(
          `SELECT tc.*, COALESCE(u.name, 'Staff') as author_name
           FROM ticket_comments tc
           LEFT JOIN users u ON tc.user_id = u.id
           WHERE tc.ticket_id = ?
           ORDER BY tc.created_at ASC`,
          [t.id]
        );
        result.push({
          id: t.id,
          ticketNumber: t.ticket_number,
          customerId: t.customer_id || "",
          customerName: formatCustomerDisplay(t.cust_name, t.cust_company),
          title: t.title,
          description: t.description,
          priority: t.priority,
          status: t.status,
          assignedTo: t.assigned_name || "Support Team",
          comments: comments.map(c => ({
            id: c.id,
            author: c.author_name || "Staff",
            text: c.comment,
            createdAt: c.created_at
          })),
          createdAt: t.created_at,
          updatedAt: t.updated_at
        });
      }

      tickets = result;
    } catch (err) {
      console.error("ticketStore.syncFromDatabase error:", err);
    }
  },

  async getAll({ status = "", priority = "", customerId = "" } = {}) {
    await ensureDatabaseSeeded();
    let query = `
      SELECT t.*, 
             c.name as cust_name,
             c.company as cust_company,
             COALESCE(u.name, 'Support Team') as assigned_name
      FROM tickets t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      query += " AND LOWER(t.status) = LOWER(?)";
      params.push(status);
    }
    if (priority) {
      query += " AND LOWER(t.priority) = LOWER(?)";
      params.push(priority);
    }
    if (customerId) {
      query += " AND t.customer_id = ?";
      params.push(customerId);
    }
    query += " ORDER BY t.created_at DESC";

    const dbTickets = await all(query, params);
    const result = [];
    for (const t of dbTickets) {
      const comments = await all(
        `SELECT tc.*, COALESCE(u.name, 'Staff') as author_name
         FROM ticket_comments tc
         LEFT JOIN users u ON tc.user_id = u.id
         WHERE tc.ticket_id = ?
         ORDER BY tc.created_at ASC`,
        [t.id]
      );
      result.push({
        id: t.id,
        ticketNumber: t.ticket_number,
        customerId: t.customer_id || "",
        customerName: formatCustomerDisplay(t.cust_name, t.cust_company),
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: t.status,
        assignedTo: t.assigned_name || "Support Team",
        comments: comments.map(c => ({
          id: c.id,
          author: c.author_name || "Staff",
          text: c.comment,
          createdAt: c.created_at
        })),
        createdAt: t.created_at,
        updatedAt: t.updated_at
      });
    }

    tickets = result;
    return result;
  },

  async getById(id) {
    await ensureDatabaseSeeded();
    let t = await get(
      `SELECT t.*, 
              c.name as cust_name,
              c.company as cust_company,
              COALESCE(u.name, 'Support Team') as assigned_name
       FROM tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = ?`,
      [id]
    );

    if (!t) {
      t = await get(
        `SELECT t.*, 
                c.name as cust_name,
                c.company as cust_company,
                COALESCE(u.name, 'Support Team') as assigned_name
         FROM tickets t
         LEFT JOIN customers c ON t.customer_id = c.id
         LEFT JOIN users u ON t.assigned_to = u.id
         WHERE t.ticket_number = ?`,
        [id]
      );
    }

    if (!t) return null;

    const comments = await all(
      `SELECT tc.*, COALESCE(u.name, 'Staff') as author_name
       FROM ticket_comments tc
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = ?
       ORDER BY tc.created_at ASC`,
      [t.id]
    );

    return {
      id: t.id,
      ticketNumber: t.ticket_number,
      customerId: t.customer_id || "",
      customerName: formatCustomerDisplay(t.cust_name, t.cust_company),
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: t.status,
      assignedTo: t.assigned_name || "Support Team",
      comments: comments.map(c => ({
        id: c.id,
        author: c.author_name || "Staff",
        text: c.comment,
        createdAt: c.created_at
      })),
      createdAt: t.created_at,
      updatedAt: t.updated_at
    };
  },

  async create(data) {
    await ensureDatabaseSeeded();
    const org = await get("SELECT id FROM organizations LIMIT 1");
    const orgId = org ? org.id : "org-mtnwl7km-s2wh5";

    let validCustomerId = null;
    if (data.customerId) {
      const cust = await get("SELECT id FROM customers WHERE id = ?", [data.customerId]);
      if (cust) {
        validCustomerId = cust.id;
      } else {
        const lead = await get("SELECT * FROM leads WHERE id = ?", [data.customerId]);
        if (lead) {
          await run(
            `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
            [lead.id, orgId, lead.name, lead.email, lead.phone, lead.company]
          );
          validCustomerId = lead.id;
        }
      }
    }

    let assignedUserId = null;
    if (data.assignedTo && data.assignedTo !== "Unassigned" && data.assignedTo !== "Support Team") {
      const user = await get("SELECT id FROM users WHERE name = ? OR id = ? LIMIT 1", [data.assignedTo, data.assignedTo]);
      if (user) {
        assignedUserId = user.id;
      }
    }

    const maxTicket = await get("SELECT ticket_number FROM tickets WHERE organization_id = ? ORDER BY rowid DESC LIMIT 1", [orgId]);
    let ticketSeq = 1001;
    if (maxTicket && maxTicket.ticket_number) {
      const match = maxTicket.ticket_number.match(/\d+/);
      if (match) {
        ticketSeq = parseInt(match[0], 10) + 1;
      }
    }

    const ticketNumber = `TCK-${ticketSeq}`;
    const ticketId = generateId("tck");
    const now = new Date().toISOString();
    const priority = ["Low", "Medium", "High", "Urgent"].includes(data.priority) ? data.priority : "Medium";
    const status = ["Open", "In Progress", "Waiting", "Resolved", "Closed"].includes(data.status) ? data.status : "Open";

    await run(
      `INSERT INTO tickets (id, organization_id, ticket_number, customer_id, title, description, priority, status, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketId,
        orgId,
        ticketNumber,
        validCustomerId,
        data.title.trim(),
        data.description.trim(),
        priority,
        status,
        assignedUserId,
        now,
        now
      ]
    );

    await this.syncFromDatabase();
    return await this.getById(ticketId);
  },

  async updateStatus(id, status) {
    await ensureDatabaseSeeded();
    if (!["Open", "In Progress", "Waiting", "Resolved", "Closed"].includes(status)) {
      throw new Error(`Invalid ticket status: ${status}`);
    }

    let ticket = await get("SELECT id FROM tickets WHERE id = ?", [id]);
    if (!ticket) {
      ticket = await get("SELECT id FROM tickets WHERE ticket_number = ?", [id]);
    }
    if (!ticket) return null;

    const now = new Date().toISOString();
    const res = await run("UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?", [status, now, ticket.id]);
    if (!res || res.changes === 0) {
      throw new Error(`Failed to update ticket ${id} status in SQLite.`);
    }

    await this.syncFromDatabase();
    return await this.getById(ticket.id);
  },

  async update(id, data) {
    await ensureDatabaseSeeded();
    let ticket = await get("SELECT id FROM tickets WHERE id = ?", [id]);
    if (!ticket) ticket = await get("SELECT id FROM tickets WHERE ticket_number = ?", [id]);
    if (!ticket) return null;

    const now = new Date().toISOString();
    await run(
      `UPDATE tickets SET
         title = COALESCE(?, title),
         description = COALESCE(?, description),
         priority = COALESCE(?, priority),
         status = COALESCE(?, status),
         updated_at = ?
       WHERE id = ?`,
      [data.title, data.description, data.priority, data.status, now, ticket.id]
    );

    await this.syncFromDatabase();
    return await this.getById(ticket.id);
  },

  async addComment(id, { author = "Staff", text }) {
    await ensureDatabaseSeeded();
    let ticket = await get("SELECT id FROM tickets WHERE id = ?", [id]);
    if (!ticket) ticket = await get("SELECT id FROM tickets WHERE ticket_number = ?", [id]);
    if (!ticket) return null;

    const user = await get("SELECT id FROM users WHERE name = ? LIMIT 1", [author]);
    const userId = user ? user.id : null;
    const commentId = generateId("comm");
    const now = new Date().toISOString();

    await run(
      `INSERT INTO ticket_comments (id, ticket_id, user_id, comment, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [commentId, ticket.id, userId, text.trim(), now]
    );

    await this.syncFromDatabase();
    return await this.getById(ticket.id);
  },

  async delete(id) {
    await ensureDatabaseSeeded();
    let ticket = await get("SELECT id FROM tickets WHERE id = ?", [id]);
    if (!ticket) ticket = await get("SELECT id FROM tickets WHERE ticket_number = ?", [id]);
    if (!ticket) return false;

    await runTransaction(async (tx) => {
      await tx.run("DELETE FROM ticket_attachments WHERE ticket_id = ?", [ticket.id]);
      await tx.run("DELETE FROM ticket_comments WHERE ticket_id = ?", [ticket.id]);
      await tx.run("DELETE FROM tickets WHERE id = ?", [ticket.id]);
    });

    await this.syncFromDatabase();
    return true;
  }
};

// -------------------------------------------------------------
// 5. Executive Dashboard Aggregation Store
// -------------------------------------------------------------
const dashboardStore = {
  async getSummary() {
    await ensureDatabaseSeeded();

    const allCusts = await customerStore.getAll();
    const totalLeads = allCusts.filter(c => c.type === "lead").length;
    const totalCustomers = allCusts.filter(c => c.type === "customer").length;

    const pipelineStats = await dealStore.getStats();

    const allQuotes = await quotationStore.getAll();
    const totalQuotations = allQuotes.length;
    const acceptedQuotationsValue = allQuotes
      .filter(q => q.status === "Accepted")
      .reduce((sum, q) => sum + q.grandTotal, 0);
    const pendingQuotationsValue = allQuotes
      .filter(q => q.status === "Sent" || q.status === "Draft")
      .reduce((sum, q) => sum + q.grandTotal, 0);

    const allTickets = await ticketStore.getAll();
    const openTickets = allTickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
    const urgentTickets = allTickets.filter(t => t.priority === "Urgent" || t.priority === "High").length;

    const allDeals = await dealStore.getAll();

    // Recent activity feed across the 4 modules
    const activities = [
      ...allCusts.map(c => ({
        type: "crm",
        title: `${c.type === "lead" ? "New Lead Created" : "Customer Record Added"}: ${c.name} (${c.company})`,
        timestamp: c.createdAt
      })),
      ...allDeals.map(d => ({
        type: "pipeline",
        title: `Deal Stage: "${d.title}" is in ${d.stage} (₹${d.value.toLocaleString("en-IN")})`,
        timestamp: d.createdAt
      })),
      ...allQuotes.map(q => ({
        type: "quotation",
        title: `Quotation ${q.quoteNumber} (${q.status}) for ${q.customerName}: ₹${q.grandTotal.toLocaleString("en-IN")}`,
        timestamp: q.createdAt
      })),
      ...allTickets.map(t => ({
        type: "ticket",
        title: `Ticket ${t.ticketNumber} [${t.priority}]: ${t.title}`,
        timestamp: t.createdAt
      }))
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    return {
      kpis: {
        totalLeads,
        totalCustomers,
        activeDealsCount: allDeals.filter(d => d.stage !== "Closed Won" && d.stage !== "Won" && d.stage !== "Closed Lost" && d.stage !== "Lost").length,
        pipelineActiveValue: pipelineStats.totalActiveValue,
        wonDealsValue: pipelineStats.totalWonValue,
        totalQuotations,
        pendingQuotationsValue,
        acceptedQuotationsValue,
        openTickets,
        urgentTickets
      },
      pipelineByStage: pipelineStats.byStage,
      recentActivities: activities
    };
  }
};

module.exports = {
  customerStore,
  dealStore,
  quotationStore,
  ticketStore,
  dashboardStore,
  normalizeStageName,
  normalizeShortStage,
  STAGE_SHORT_TO_DB,
  STAGE_DB_TO_SHORT
};
