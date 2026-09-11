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
        `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, contact_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, orgId, c.name, c.email, c.phone, c.company, c.notes, "Active", c.type, c.createdAt, c.createdAt]
      );
      await run(
        `UPDATE customers SET contact_type = ? WHERE id = ?`,
        [c.type, c.id]
      );
      await run(
        `INSERT OR IGNORE INTO leads (id, organization_id, name, email, phone, company, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, orgId, c.name, c.email, c.phone, c.company, c.type === "lead" ? c.status : "Active", c.createdAt, c.createdAt]
      );
    }

    // 1.1 Mirror all existing leads into customers table so quotation & ticket foreign keys succeed
    const allDbLeads = await all("SELECT id, organization_id, name, email, phone, company, status, created_at FROM leads");
    for (const l of allDbLeads) {
      await run(
        `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, contact_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, null, 'Active', 'lead', ?, ?)`,
        [l.id, l.organization_id || orgId, l.name, l.email || null, l.phone || null, l.company || null, l.created_at, l.created_at]
      );
      if (l.id !== "cust-1" && l.id !== "cust-2" && l.status !== "Converted") {
        await run(`UPDATE customers SET contact_type = 'lead' WHERE id = ?`, [l.id]);
      }
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

      const leadMap = new Map();
      for (const l of dbLeads) {
        leadMap.set(l.id, l);
      }

      const combined = [];
      const seenIds = new Set();

      for (const cu of dbCustomers) {
        seenIds.add(cu.id);
        const l = leadMap.get(cu.id);
        const isLead =
          cu.contact_type === "lead" ||
          (!cu.contact_type && l && cu.id !== "cust-1" && cu.id !== "cust-2" && l.status !== "Converted");

        if (isLead && l) {
          combined.push({
            id: cu.id,
            name: l.name || cu.name,
            email: l.email || cu.email || "",
            phone: l.phone || cu.phone || "",
            company: l.company || cu.company || "",
            type: "lead",
            status: l.status || "New",
            notes: l.note || cu.address || "",
            createdAt: l.created_at || cu.created_at || new Date().toISOString()
          });
        } else {
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

  async getAll({ search = "", type = "", status = "", organizationId = null } = {}) {
    await ensureDatabaseSeeded();
    let dbCustomers;
    let dbLeads;

    if (organizationId) {
      dbCustomers = await all("SELECT * FROM customers WHERE organization_id = ? ORDER BY created_at DESC", [organizationId]);
      dbLeads = await all(
        `SELECT l.*, (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as note
         FROM leads l
         WHERE l.organization_id = ?
         ORDER BY l.created_at DESC`,
        [organizationId]
      );
    } else {
      await this.syncFromDatabase();
      dbCustomers = await all("SELECT * FROM customers ORDER BY created_at DESC");
      dbLeads = await all(
        `SELECT l.*, (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as note
         FROM leads l
         ORDER BY l.created_at DESC`
      );
    }

    const leadMap = new Map();
    for (const l of dbLeads) {
      leadMap.set(l.id, l);
    }

    const combined = [];
    const seenIds = new Set();

    for (const cu of dbCustomers) {
      seenIds.add(cu.id);
      const l = leadMap.get(cu.id);
      const isLead =
        cu.contact_type === "lead" ||
        (!cu.contact_type && l && cu.id !== "cust-1" && cu.id !== "cust-2" && l.status !== "Converted");

      if (isLead && l) {
        combined.push({
          id: cu.id,
          name: l.name || cu.name,
          email: l.email || cu.email || "",
          phone: l.phone || cu.phone || "",
          company: l.company || cu.company || "",
          type: "lead",
          status: l.status || "New",
          notes: l.note || cu.address || "",
          createdAt: l.created_at || cu.created_at || new Date().toISOString()
        });
      } else {
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
    }

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

    let result = combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
    if (!organizationId) {
      customers = result;
    }
    return result;
  },

  async getById(id, organizationId = null) {
    await ensureDatabaseSeeded();
    let custSql = "SELECT * FROM customers WHERE id = ?";
    let custParams = [id];
    let leadSql = `SELECT l.*, (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as note FROM leads l WHERE l.id = ?`;
    let leadParams = [id];

    if (organizationId) {
      custSql += " AND organization_id = ?";
      custParams.push(organizationId);
      leadSql += " AND l.organization_id = ?";
      leadParams.push(organizationId);
    }

    const cust = await get(custSql, custParams);
    const lead = await get(leadSql, leadParams);

    if (!cust && !lead) return null;

    const isLead =
      (cust && cust.contact_type === "lead") ||
      (!cust && lead) ||
      (cust && !cust.contact_type && lead && id !== "cust-1" && id !== "cust-2" && lead.status !== "Converted");

    if (isLead && lead) {
      return {
        id: lead.id,
        name: lead.name || (cust ? cust.name : ""),
        email: lead.email || (cust ? cust.email : "") || "",
        phone: lead.phone || (cust ? cust.phone : "") || "",
        company: lead.company || (cust ? cust.company : "") || "",
        type: "lead",
        status: lead.status || "New",
        notes: lead.note || (cust ? cust.address : "") || "",
        createdAt: lead.created_at || (cust ? cust.created_at : new Date().toISOString())
      };
    }

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
  },

  async create(data) {
    await ensureDatabaseSeeded();
    let orgId = data.organizationId;
    if (!orgId) {
      const org = await get("SELECT id FROM organizations LIMIT 1");
      orgId = org ? org.id : "org-mtnwl7km-s2wh5";
    }

    const newId = generateId("cust");
    const now = new Date().toISOString();
    const isCustomer = data.type === "customer";

    if (isCustomer) {
      const status = ["Active", "Inactive", "Pending", "Archived"].includes(data.status)
        ? data.status
        : "Active";
      await run(
        `INSERT INTO customers (id, organization_id, name, email, phone, company, address, status, contact_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'customer', ?, ?)`,
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
      // Mirror to customers table with contact_type = 'lead' so quotation/ticket foreign keys succeed
      await run(
        `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, contact_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Active', 'lead', ?, ?)`,
        [newId, orgId, data.name.trim(), data.email ? data.email.trim() : null, data.phone || null, data.company || null, data.notes || null, now, now]
      );
      if (data.notes && data.notes.trim()) {
        await run(
          `INSERT INTO lead_notes (id, lead_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [generateId("note"), newId, data.notes.trim(), now, now]
        );
      }
    }

    await this.syncFromDatabase();
    return await this.getById(newId, orgId);
  },

  async update(id, data, organizationId = null) {
    await ensureDatabaseSeeded();
    const existing = await this.getById(id, organizationId);
    if (!existing) return null;

    const now = new Date().toISOString();
    const targetType = data.type || existing.type;

    if (targetType === "customer") {
      let custSql = `UPDATE customers SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           address = COALESCE(?, address),
           status = COALESCE(?, status),
           contact_type = 'customer',
           updated_at = ?
         WHERE id = ?`;
      let custParams = [data.name, data.email, data.phone, data.company, data.notes, data.status, now, id];
      if (organizationId) {
        custSql += " AND organization_id = ?";
        custParams.push(organizationId);
      }
      await run(custSql, custParams);

      let leadSql = `UPDATE leads SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           status = 'Converted',
           updated_at = ?
         WHERE id = ?`;
      let leadParams = [data.name, data.email, data.phone, data.company, now, id];
      if (organizationId) {
        leadSql += " AND organization_id = ?";
        leadParams.push(organizationId);
      }
      await run(leadSql, leadParams);
    } else {
      let leadSql = `UPDATE leads SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           status = COALESCE(?, status),
           updated_at = ?
         WHERE id = ?`;
      let leadParams = [data.name, data.email, data.phone, data.company, data.status, now, id];
      if (organizationId) {
        leadSql += " AND organization_id = ?";
        leadParams.push(organizationId);
      }
      await run(leadSql, leadParams);

      let custSql = `UPDATE customers SET 
           name = COALESCE(?, name),
           email = COALESCE(?, email),
           phone = COALESCE(?, phone),
           company = COALESCE(?, company),
           address = COALESCE(?, address),
           contact_type = 'lead',
           updated_at = ?
         WHERE id = ?`;
      let custParams = [data.name, data.email, data.phone, data.company, data.notes, now, id];
      if (organizationId) {
        custSql += " AND organization_id = ?";
        custParams.push(organizationId);
      }
      await run(custSql, custParams);

      if (data.notes && data.notes.trim()) {
        await run(
          `INSERT INTO lead_notes (id, lead_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
          [generateId("note"), id, data.notes.trim(), now, now]
        );
      }
    }

    await this.syncFromDatabase();
    return await this.getById(id, organizationId);
  },

  async delete(id, organizationId = null) {
    await ensureDatabaseSeeded();
    const existing = await this.getById(id, organizationId);
    if (!existing) return false;

    let custSql = "DELETE FROM customers WHERE id = ?";
    let custParams = [id];
    let leadSql = "DELETE FROM leads WHERE id = ?";
    let leadParams = [id];

    if (organizationId) {
      custSql += " AND organization_id = ?";
      custParams.push(organizationId);
      leadSql += " AND organization_id = ?";
      leadParams.push(organizationId);
    }

    const resCust = await run(custSql, custParams);
    const resLead = await run(leadSql, leadParams);
    const deleted = (resCust.changes > 0) || (resLead.changes > 0);
    await this.syncFromDatabase();
    return deleted;
  }
};

// -------------------------------------------------------------
// 2. Sales Pipeline (Deals) Storage Interface
// -------------------------------------------------------------
const dealStoreModule = require("./dealStore");

const dealStore = {
  async syncFromDatabase() {
    return dealStoreModule.getAll();
  },

  async getAll(params = {}) {
    return dealStoreModule.getAll(params);
  },

  async getPaginated(params = {}) {
    return dealStoreModule.getPaginated(params);
  },

  async getById(id, organizationId = null) {
    return dealStoreModule.getById(id, organizationId);
  },

  async create(data) {
    return dealStoreModule.create(data);
  },

  async update(id, data, organizationId = null) {
    return dealStoreModule.update(id, data, organizationId);
  },

  async updateStage(id, stageInput, organizationId = null, userId = null) {
    return dealStoreModule.updateStage(id, stageInput, organizationId, userId);
  },

  async getHistory(dealId, organizationId = null) {
    return dealStoreModule.getHistory(dealId, organizationId);
  },

  async delete(id, organizationId = null) {
    return dealStoreModule.delete(id, organizationId);
  },

  async getStats(organizationId = null) {
    return dealStoreModule.getStats(organizationId);
  }
};


// -------------------------------------------------------------
// 3. Quotation Storage & Calculation Interface (Day 8 Service)
// -------------------------------------------------------------
const quotationStore = require("./quotationStore");

// -------------------------------------------------------------
// 4. Support Ticket Storage Interface (Day 9 Dedicated Service)
// -------------------------------------------------------------
const ticketStore = require("./ticketStore");


// -------------------------------------------------------------
// 5. Executive Dashboard Aggregation Store
// -------------------------------------------------------------
const dashboardStore = {
  async getSummary(organizationId = null) {
    await ensureDatabaseSeeded();

    const allCusts = await customerStore.getAll({ organizationId });
    const totalLeads = allCusts.filter(c => c.type === "lead").length;
    const totalCustomers = allCusts.filter(c => c.type === "customer").length;

    const pipelineStats = await dealStore.getStats(organizationId);

    const allQuotes = await quotationStore.getAll({ organizationId });
    const totalQuotations = allQuotes.length;
    const acceptedQuotationsValue = allQuotes
      .filter(q => q.status === "Accepted")
      .reduce((sum, q) => sum + q.grandTotal, 0);
    const pendingQuotationsValue = allQuotes
      .filter(q => q.status === "Sent" || q.status === "Draft")
      .reduce((sum, q) => sum + q.grandTotal, 0);

    const allTickets = await ticketStore.getAll({ organizationId });
    const openTickets = allTickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
    const urgentTickets = allTickets.filter(t => t.priority === "Urgent" || t.priority === "High").length;

    const allDeals = await dealStore.getAll({ organizationId });

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
