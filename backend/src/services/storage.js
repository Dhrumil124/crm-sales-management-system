/**
 * [TEMPORARY PRE-DATABASE STORE]
 * 
 * IMPORTANT ARCHITECTURAL NOTE:
 * This in-memory store serves as an isolated service layer to facilitate full CRUD,
 * business logic, calculations, and frontend connectivity during the pre-database phase.
 * It strictly implements async repository signatures to ensure that when the database phase
 * begins (e.g. PostgreSQL, MongoDB, Prisma), swapping this file with real database queries
 * will require ZERO modifications to routes, controllers, or frontend components.
 */

// Initial seed data for pre-database demonstration and testing
let customers = [
  {
    id: "cust-1",
    name: "John Miller",
    email: "john.miller@apextech.com",
    phone: "+1 (555) 234-5678",
    company: "Apex Tech Solutions",
    type: "customer",
    status: "Active",
    notes: "Enterprise account with 50+ licenses. Interested in expanding to cloud services.",
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

let deals = [
  {
    id: "deal-1",
    title: "Enterprise CRM Licensing Expansion",
    customerId: "cust-1",
    customerName: "Apex Tech Solutions",
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
    customerName: "Innovate AI",
    value: 28000,
    stage: "Proposal",
    expectedCloseDate: "2026-10-15",
    notes: "Custom quotation sent detailing API throughput and SLA guarantees.",
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "deal-3",
    title: "Resource Management Platform Pilot",
    customerId: "cust-3",
    customerName: "Vance Global",
    value: 18500,
    stage: "Contacted",
    expectedCloseDate: "2026-11-01",
    notes: "Discovery call completed. Preparing custom demo scenario.",
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "deal-4",
    title: "Creative Workflow Automation",
    customerId: "cust-4",
    customerName: "Nordic Design Studio",
    value: 9200,
    stage: "Lead",
    expectedCloseDate: "2026-11-15",
    notes: "Initial requirements gathering scheduled for next week.",
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "deal-5",
    title: "Security & Compliance Add-on",
    customerId: "cust-1",
    customerName: "Apex Tech Solutions",
    value: 12000,
    stage: "Won",
    expectedCloseDate: "2026-08-25",
    notes: "Annual compliance package signed and activated.",
    createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
  }
];

let quotations = [
  {
    id: "quote-1",
    quoteNumber: "QT-1001",
    customerId: "cust-1",
    customerName: "Apex Tech Solutions",
    items: [
      { description: "Enterprise Platform License (Annual)", quantity: 50, unitPrice: 800, taxRate: 10, lineTotal: 40000 },
      { description: "Dedicated Technical Account Support", quantity: 1, unitPrice: 5000, taxRate: 10, lineTotal: 5000 }
    ],
    subtotal: 45000,
    taxTotal: 4500,
    grandTotal: 49500,
    status: "Sent",
    issueDate: "2026-09-01",
    validUntil: "2026-09-30",
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "quote-2",
    quoteNumber: "QT-1002",
    customerId: "cust-2",
    customerName: "Innovate AI",
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
    customerName: "Apex Tech Solutions",
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

let tickets = [
  {
    id: "tck-1",
    ticketNumber: "TCK-1001",
    customerId: "cust-1",
    customerName: "Apex Tech Solutions",
    title: "SSO SAML authentication intermittent timeout",
    description: "Our users experienced two login timeouts this morning when authenticating via Okta SSO.",
    priority: "High",
    status: "In Progress",
    assignedTo: "Support Team (DevOps)",
    comments: [
      {
        id: "comm-1",
        author: "Support Team",
        text: "Investigating the authentication logs. Identified a 200ms latency spike in the identity token exchange.",
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "tck-2",
    ticketNumber: "TCK-1002",
    customerId: "cust-2",
    customerName: "Innovate AI",
    title: "Rate limit increase request for production webhook endpoints",
    description: "Requesting rate limit increase from 60 req/min to 300 req/min ahead of our upcoming launch.",
    priority: "Medium",
    status: "Open",
    assignedTo: "Alex Johnson",
    comments: [],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
  },
  {
    id: "tck-3",
    ticketNumber: "TCK-1003",
    customerId: "cust-1",
    customerName: "Apex Tech Solutions",
    title: "Billing receipt discrepancy for August compliance invoice",
    description: "The VAT registration number was truncated on the printed PDF receipt.",
    priority: "Low",
    status: "Resolved",
    assignedTo: "Finance Support",
    comments: [
      {
        id: "comm-2",
        author: "Finance Support",
        text: "Regenerated the official receipt with full tax credentials and emailed it directly to accounts payable.",
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      }
    ],
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
  }
];

// Helper to generate IDs
const generateId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
let nextQuoteNumber = 1004;
let nextTicketNumber = 1004;

// -------------------------------------------------------------
// CRM (Customers & Leads) Storage Interface
// -------------------------------------------------------------
const customerStore = {
  async syncFromDatabase() {
    try {
      const { all } = require("../database/db");
      const dbLeads = await all(
        "SELECT l.*, (SELECT content FROM lead_notes WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as note FROM leads l"
      );
      const dbCustomers = await all("SELECT * FROM customers");

      // Merge database leads into customers list if not already present
      for (const l of dbLeads) {
        const exists = customers.some(
          c => c.id === l.id || (c.email && c.email.toLowerCase() === (l.email || "").toLowerCase() && c.name.toLowerCase() === (l.name || "").toLowerCase())
        );
        if (!exists) {
          customers.push({
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

      // Merge database customers into customers list if not already present
      for (const cu of dbCustomers) {
        const exists = customers.some(
          c => c.id === cu.id || (c.email && c.email.toLowerCase() === (cu.email || "").toLowerCase() && c.name.toLowerCase() === (cu.name || "").toLowerCase())
        );
        if (!exists) {
          customers.push({
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
    } catch {
      // Gracefully continue with in-memory store if DB is initializing
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
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getById(id) {
    await this.syncFromDatabase();
    return customers.find(c => c.id === id) || null;
  },

  async create(data) {
    const newCustomer = {
      id: generateId("cust"),
      name: data.name,
      email: data.email,
      phone: data.phone || "",
      company: data.company || "",
      type: data.type === "customer" ? "customer" : "lead",
      status: data.status || (data.type === "customer" ? "Active" : "New"),
      notes: data.notes || "",
      createdAt: new Date().toISOString()
    };
    customers.unshift(newCustomer);

    // Persist to SQLite database so it never vanishes on server restart
    try {
      const { run, all } = require("../database/db");
      const org = await all("SELECT id FROM organizations LIMIT 1");
      const orgId = org[0]?.id || "org-mtnwl7km-s2wh5";

      if (newCustomer.type === "lead") {
        await run(
          `INSERT INTO leads (id, organization_id, name, email, phone, company, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCustomer.id,
            orgId,
            newCustomer.name,
            newCustomer.email,
            newCustomer.phone,
            newCustomer.company,
            newCustomer.status,
            newCustomer.createdAt,
            newCustomer.createdAt
          ]
        );
        if (newCustomer.notes) {
          await run(
            `INSERT INTO lead_notes (id, lead_id, content, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [`note-${Date.now()}`, newCustomer.id, newCustomer.notes, newCustomer.createdAt, newCustomer.createdAt]
          );
        }
      } else {
        await run(
          `INSERT INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newCustomer.id,
            orgId,
            newCustomer.name,
            newCustomer.email,
            newCustomer.phone,
            newCustomer.company,
            newCustomer.notes,
            newCustomer.status,
            newCustomer.createdAt,
            newCustomer.createdAt
          ]
        );
      }
    } catch {
      // Gracefully proceed if DB write is deferred
    }

    return newCustomer;
  },

  async update(id, data) {
    await this.syncFromDatabase();
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) return null;

    customers[index] = {
      ...customers[index],
      ...data,
      id: customers[index].id, // protect ID
      createdAt: customers[index].createdAt // preserve creation date
    };

    // Update SQLite database
    try {
      const { run } = require("../database/db");
      const updated = customers[index];
      await run(
        `UPDATE leads SET name = ?, email = ?, phone = ?, company = ?, status = ?, updated_at = ? WHERE id = ?`,
        [updated.name, updated.email, updated.phone, updated.company, updated.status, new Date().toISOString(), id]
      );
      await run(
        `UPDATE customers SET name = ?, email = ?, phone = ?, company = ?, status = ?, updated_at = ? WHERE id = ?`,
        [updated.name, updated.email, updated.phone, updated.company, updated.status, new Date().toISOString(), id]
      );
    } catch {}

    return customers[index];
  },

  async delete(id) {
    await this.syncFromDatabase();
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) return false;
    customers.splice(index, 1);

    // Delete from SQLite database
    try {
      const { run } = require("../database/db");
      await run("DELETE FROM leads WHERE id = ?", [id]);
      await run("DELETE FROM customers WHERE id = ?", [id]);
    } catch {}

    return true;
  }
};

// -------------------------------------------------------------
// Sales Pipeline (Deals) Storage Interface
// -------------------------------------------------------------
const dealStore = {
  async syncFromDatabase() {
    try {
      const { all } = require("../database/db");
      const dbDeals = await all(`
        SELECT d.*, l.name as lead_name, l.company as lead_company, s.name as stage_name
        FROM deals d
        LEFT JOIN leads l ON d.lead_id = l.id
        LEFT JOIN pipeline_stages s ON d.stage_id = s.id
      `);
      for (const d of dbDeals) {
        const exists = deals.some(deal => deal.id === d.id);
        if (!exists) {
          deals.push({
            id: d.id,
            title: d.title,
            customerId: d.lead_id || "",
            customerName: d.lead_company || d.lead_name || "",
            value: Number(d.value) || 0,
            stage: d.stage_name || "Lead",
            expectedCloseDate: d.expected_close_date || "",
            notes: d.notes || "",
            createdAt: d.created_at || new Date().toISOString()
          });
        }
      }
    } catch {}
  },

  async getAll({ stage = "", customerId = "" } = {}) {
    await this.syncFromDatabase();
    let result = [...deals];
    if (stage) {
      result = result.filter(d => d.stage.toLowerCase() === stage.toLowerCase());
    }
    if (customerId) {
      result = result.filter(d => d.customerId === customerId);
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getById(id) {
    await this.syncFromDatabase();
    return deals.find(d => d.id === id) || null;
  },

  async create(data) {
    // Resolve customer name if customerId is provided
    let customerName = data.customerName || "";
    if (data.customerId && !customerName) {
      const customer = await customerStore.getById(data.customerId);
      if (customer) {
        customerName = customer.company || customer.name;
      }
    }

    const newDeal = {
      id: generateId("deal"),
      title: data.title,
      customerId: data.customerId || "",
      customerName: customerName,
      value: Number(data.value) || 0,
      stage: data.stage || "Lead",
      expectedCloseDate: data.expectedCloseDate || "",
      notes: data.notes || "",
      createdAt: new Date().toISOString()
    };
    deals.unshift(newDeal);

    // Persist to SQLite deals table
    try {
      const { run, all } = require("../database/db");
      const org = await all("SELECT id FROM organizations LIMIT 1");
      const orgId = org[0]?.id || "org-mtnwl7km-s2wh5";
      const stages = await all("SELECT id, name FROM pipeline_stages WHERE organization_id = ? ORDER BY stage_order ASC", [orgId]);
      const matchedStage = stages.find(s => s.name.toLowerCase() === (newDeal.stage || "lead").toLowerCase()) || stages[0];

      if (matchedStage) {
        await run(
          `INSERT INTO deals (id, organization_id, title, lead_id, stage_id, value, expected_close_date, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newDeal.id, orgId, newDeal.title, newDeal.customerId || null, matchedStage.id, newDeal.value, newDeal.expectedCloseDate || null, newDeal.notes, newDeal.createdAt, newDeal.createdAt]
        );
      }
    } catch {}

    return newDeal;
  },

  async update(id, data) {
    await this.syncFromDatabase();
    const index = deals.findIndex(d => d.id === id);
    if (index === -1) return null;

    if (data.value !== undefined) {
      data.value = Number(data.value) || 0;
    }

    deals[index] = {
      ...deals[index],
      ...data,
      id: deals[index].id,
      createdAt: deals[index].createdAt
    };

    try {
      const { run } = require("../database/db");
      await run(
        `UPDATE deals SET title = ?, value = ?, expected_close_date = ?, notes = ?, updated_at = ? WHERE id = ?`,
        [deals[index].title, deals[index].value, deals[index].expectedCloseDate, deals[index].notes, new Date().toISOString(), id]
      );
    } catch {}

    return deals[index];
  },

  async updateStage(id, stage) {
    await this.syncFromDatabase();
    const index = deals.findIndex(d => d.id === id);
    if (index === -1) return null;
    deals[index].stage = stage;

    try {
      const { run, all } = require("../database/db");
      const stages = await all("SELECT id, name FROM pipeline_stages");
      const matched = stages.find(s => s.name.toLowerCase() === stage.toLowerCase());
      if (matched) {
        await run(`UPDATE deals SET stage_id = ?, updated_at = ? WHERE id = ?`, [matched.id, new Date().toISOString(), id]);
      }
    } catch {}

    return deals[index];
  },

  async delete(id) {
    await this.syncFromDatabase();
    const index = deals.findIndex(d => d.id === id);
    if (index === -1) return false;
    deals.splice(index, 1);

    try {
      const { run } = require("../database/db");
      await run("DELETE FROM deals WHERE id = ?", [id]);
    } catch {}

    return true;
  },

  async getStats() {
    await this.syncFromDatabase();
    const stages = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];
    const statsByStage = {};
    stages.forEach(s => {
      statsByStage[s] = { count: 0, totalValue: 0 };
    });

    let totalActiveValue = 0;
    let totalWonValue = 0;

    deals.forEach(d => {
      const s = d.stage;
      if (statsByStage[s]) {
        statsByStage[s].count += 1;
        statsByStage[s].totalValue += d.value;
      }
      if (s === "Won") {
        totalWonValue += d.value;
      } else if (s !== "Lost") {
        totalActiveValue += d.value;
      }
    });

    return {
      totalDeals: deals.length,
      totalActiveValue,
      totalWonValue,
      byStage: statsByStage
    };
  }
};

// -------------------------------------------------------------
// Quotation Storage & Calculation Interface
// -------------------------------------------------------------
const quotationStore = {
  async syncFromDatabase() {
    try {
      const { all } = require("../database/db");
      const dbQuotes = await all(`
        SELECT q.*, c.name as cust_name, c.company as cust_company
        FROM quotations q
        LEFT JOIN customers c ON q.customer_id = c.id
      `);
      for (const q of dbQuotes) {
        const exists = quotations.some(quote => quote.id === q.id || quote.quoteNumber === q.quote_number);
        if (!exists) {
          const items = await all("SELECT * FROM quotation_items WHERE quotation_id = ?", [q.id]);
          quotations.push({
            id: q.id,
            quoteNumber: q.quote_number,
            customerId: q.customer_id,
            customerName: q.cust_company || q.cust_name || "",
            items: items.map(i => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unit_price,
              taxRate: i.tax_rate,
              lineTotal: i.line_total
            })),
            subtotal: q.subtotal,
            taxTotal: q.tax_total,
            grandTotal: q.grand_total,
            status: q.status,
            issueDate: q.issue_date,
            validUntil: q.valid_until,
            createdAt: q.created_at || new Date().toISOString()
          });
        }
      }
    } catch {}
  },

  async getAll({ status = "", customerId = "" } = {}) {
    await this.syncFromDatabase();
    let result = [...quotations];
    if (status) {
      result = result.filter(q => q.status.toLowerCase() === status.toLowerCase());
    }
    if (customerId) {
      result = result.filter(q => q.customerId === customerId);
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getById(id) {
    await this.syncFromDatabase();
    return quotations.find(q => q.id === id) || null;
  },

  calculateTotals(items = []) {
    let subtotal = 0;
    let taxTotal = 0;

    const validatedItems = items.map(item => {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Math.max(0, Number(item.unitPrice) || 0);
      const taxRate = Math.max(0, Number(item.taxRate) || 0);

      const lineTotal = Number((qty * price).toFixed(2));
      const lineTax = Number((lineTotal * (taxRate / 100)).toFixed(2));

      subtotal += lineTotal;
      taxTotal += lineTax;

      return {
        description: String(item.description || "").trim(),
        quantity: qty,
        unitPrice: price,
        taxRate: taxRate,
        lineTotal: lineTotal
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
  },

  async create(data) {
    let customerName = data.customerName || "";
    if (data.customerId && !customerName) {
      const customer = await customerStore.getById(data.customerId);
      if (customer) {
        customerName = customer.company || customer.name;
      }
    }

    const { items, subtotal, taxTotal, grandTotal } = this.calculateTotals(data.items);

    const newQuotation = {
      id: generateId("quote"),
      quoteNumber: `QT-${nextQuoteNumber++}`,
      customerId: data.customerId || "",
      customerName: customerName,
      items,
      subtotal,
      taxTotal,
      grandTotal,
      status: data.status || "Draft",
      issueDate: data.issueDate || new Date().toISOString().split("T")[0],
      validUntil: data.validUntil || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      createdAt: new Date().toISOString()
    };

    quotations.unshift(newQuotation);

    // Persist to SQLite quotations & quotation_items tables
    try {
      const { run, all } = require("../database/db");
      const org = await all("SELECT id FROM organizations LIMIT 1");
      const orgId = org[0]?.id || "org-mtnwl7km-s2wh5";

      await run(
        `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newQuotation.id, orgId, newQuotation.quoteNumber, newQuotation.customerId, newQuotation.issueDate, newQuotation.validUntil, newQuotation.status, subtotal, taxTotal, grandTotal, newQuotation.createdAt, newQuotation.createdAt]
      );

      for (const itm of items) {
        const itmId = generateId("item");
        const itmTax = Number((itm.lineTotal * (itm.taxRate / 100)).toFixed(2));
        await run(
          `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [itmId, newQuotation.id, itm.description, itm.quantity, itm.unitPrice, itm.taxRate, itmTax, itm.lineTotal, newQuotation.createdAt]
        );
      }
    } catch {}

    return newQuotation;
  },

  async updateStatus(id, status) {
    await this.syncFromDatabase();
    const index = quotations.findIndex(q => q.id === id);
    if (index === -1) return null;
    quotations[index].status = status;

    try {
      const { run } = require("../database/db");
      await run(`UPDATE quotations SET status = ?, updated_at = ? WHERE id = ?`, [status, new Date().toISOString(), id]);
    } catch {}

    return quotations[index];
  },

  async delete(id) {
    await this.syncFromDatabase();
    const index = quotations.findIndex(q => q.id === id);
    if (index === -1) return false;
    quotations.splice(index, 1);

    try {
      const { run } = require("../database/db");
      await run(`DELETE FROM quotations WHERE id = ?`, [id]);
    } catch {}

    return true;
  }
};

// -------------------------------------------------------------
// Support Ticket Storage Interface
// -------------------------------------------------------------
const ticketStore = {
  async syncFromDatabase() {
    try {
      const { all } = require("../database/db");
      const dbTickets = await all(`
        SELECT t.*, c.name as cust_name, c.company as cust_company, u.name as user_name
        FROM tickets t
        LEFT JOIN customers c ON t.customer_id = c.id
        LEFT JOIN users u ON t.assigned_to = u.id
      `);
      for (const t of dbTickets) {
        const exists = tickets.some(tck => tck.id === t.id || tck.ticketNumber === t.ticket_number);
        if (!exists) {
          const comments = await all(
            "SELECT tc.*, u.name as author_name FROM ticket_comments tc LEFT JOIN users u ON tc.user_id = u.id WHERE tc.ticket_id = ?",
            [t.id]
          );
          tickets.push({
            id: t.id,
            ticketNumber: t.ticket_number,
            customerId: t.customer_id,
            customerName: t.cust_company || t.cust_name || "",
            title: t.title,
            description: t.description,
            priority: t.priority,
            status: t.status,
            assignedTo: t.user_name || "Support Team",
            comments: comments.map(c => ({
              id: c.id,
              author: c.author_name || "Staff",
              text: c.comment,
              createdAt: c.created_at
            })),
            createdAt: t.created_at || new Date().toISOString()
          });
        }
      }
    } catch {}
  },

  async getAll({ status = "", priority = "", customerId = "" } = {}) {
    await this.syncFromDatabase();
    let result = [...tickets];
    if (status) {
      result = result.filter(t => t.status.toLowerCase() === status.toLowerCase());
    }
    if (priority) {
      result = result.filter(t => t.priority.toLowerCase() === priority.toLowerCase());
    }
    if (customerId) {
      result = result.filter(t => t.customerId === customerId);
    }
    return result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getById(id) {
    await this.syncFromDatabase();
    return tickets.find(t => t.id === id) || null;
  },

  async create(data) {
    let customerName = data.customerName || "";
    if (data.customerId && !customerName) {
      const customer = await customerStore.getById(data.customerId);
      if (customer) {
        customerName = customer.company || customer.name;
      }
    }

    const newTicket = {
      id: generateId("tck"),
      ticketNumber: `TCK-${nextTicketNumber++}`,
      customerId: data.customerId || "",
      customerName: customerName,
      title: String(data.title || "").trim(),
      description: String(data.description || "").trim(),
      priority: data.priority || "Medium",
      status: data.status || "Open",
      assignedTo: String(data.assignedTo || "Unassigned").trim(),
      comments: [],
      createdAt: new Date().toISOString()
    };

    tickets.unshift(newTicket);

    // Persist to SQLite tickets table
    try {
      const { run, all } = require("../database/db");
      const org = await all("SELECT id FROM organizations LIMIT 1");
      const orgId = org[0]?.id || "org-mtnwl7km-s2wh5";

      await run(
        `INSERT INTO tickets (id, organization_id, ticket_number, customer_id, title, description, priority, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newTicket.id, orgId, newTicket.ticketNumber, newTicket.customerId || null, newTicket.title, newTicket.description, newTicket.priority, newTicket.status, newTicket.createdAt, newTicket.createdAt]
      );
    } catch {}

    return newTicket;
  },

  async updateStatus(id, status) {
    await this.syncFromDatabase();
    const index = tickets.findIndex(t => t.id === id);
    if (index === -1) return null;
    tickets[index].status = status;

    try {
      const { run } = require("../database/db");
      await run(`UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?`, [status, new Date().toISOString(), id]);
    } catch {}

    return tickets[index];
  },

  async addComment(id, { author = "Staff", text }) {
    await this.syncFromDatabase();
    const index = tickets.findIndex(t => t.id === id);
    if (index === -1) return null;

    const newComment = {
      id: generateId("comm"),
      author: String(author || "Staff").trim(),
      text: String(text || "").trim(),
      createdAt: new Date().toISOString()
    };

    tickets[index].comments.push(newComment);

    try {
      const { run } = require("../database/db");
      await run(
        `INSERT INTO ticket_comments (id, ticket_id, comment, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [newComment.id, id, newComment.text, newComment.createdAt, newComment.createdAt]
      );
    } catch {}

    return tickets[index];
  },

  async delete(id) {
    await this.syncFromDatabase();
    const index = tickets.findIndex(t => t.id === id);
    if (index === -1) return false;
    tickets.splice(index, 1);

    try {
      const { run } = require("../database/db");
      await run(`DELETE FROM tickets WHERE id = ?`, [id]);
    } catch {}

    return true;
  }
};

// -------------------------------------------------------------
// Executive Dashboard Aggregation Store
// -------------------------------------------------------------
const dashboardStore = {
  async getSummary() {
    const totalLeads = customers.filter(c => c.type === "lead").length;
    const totalCustomers = customers.filter(c => c.type === "customer").length;

    const pipelineStats = await dealStore.getStats();

    const totalQuotations = quotations.length;
    const acceptedQuotationsValue = quotations
      .filter(q => q.status === "Accepted")
      .reduce((sum, q) => sum + q.grandTotal, 0);
    const pendingQuotationsValue = quotations
      .filter(q => q.status === "Sent" || q.status === "Draft")
      .reduce((sum, q) => sum + q.grandTotal, 0);

    const openTickets = tickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
    const urgentTickets = tickets.filter(t => t.priority === "Urgent" || t.priority === "High").length;

    // Recent activity feed across the 4 modules
    const activities = [
      ...customers.map(c => ({
        type: "crm",
        title: `${c.type === "lead" ? "New Lead Created" : "Customer Record Added"}: ${c.name} (${c.company})`,
        timestamp: c.createdAt
      })),
      ...deals.map(d => ({
        type: "pipeline",
        title: `Deal Stage: "${d.title}" is in ${d.stage} (₹${d.value.toLocaleString("en-IN")})`,
        timestamp: d.createdAt
      })),
      ...quotations.map(q => ({
        type: "quotation",
        title: `Quotation ${q.quoteNumber} (${q.status}) for ${q.customerName}: ₹${q.grandTotal.toLocaleString("en-IN")}`,
        timestamp: q.createdAt
      })),
      ...tickets.map(t => ({
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
        activeDealsCount: deals.filter(d => d.stage !== "Won" && d.stage !== "Lost").length,
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
  dashboardStore
};
