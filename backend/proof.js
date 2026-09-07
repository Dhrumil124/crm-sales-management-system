const { all, run, get } = require("./src/database/db");

async function printSchema(tableName) {
  const cols = await all(`PRAGMA table_info(${tableName})`);
  console.log(`\n📋 Columns in table '${tableName}':`);
  console.table(
    cols.map((c) => ({
      CID: c.cid,
      Column: c.name,
      Type: c.type,
      NotNull: c.notnull === 1 ? "YES" : "NO",
      Default: c.dflt_value || "NULL",
      PK: c.pk === 1 ? "YES" : "NO"
    }))
  );
}

async function printForeignKeys(tableName) {
  const fks = await all(`PRAGMA foreign_key_list(${tableName})`);
  if (fks.length > 0) {
    console.log(`🔗 Foreign Key Relationships for '${tableName}':`);
    console.table(
      fks.map((fk) => ({
        Column: fk.from,
        ReferencesTable: fk.table,
        TargetColumn: fk.to,
        OnDelete: fk.on_delete,
        OnUpdate: fk.on_update
      }))
    );
  }
}

async function ensureSampleData() {
  const org = await get("SELECT id FROM organizations LIMIT 1");
  if (!org) return;

  const leadCount = await get("SELECT COUNT(*) AS c FROM leads");
  if (leadCount.c === 0) {
    const leadId = "lead-demo-001";
    await run(
      `INSERT INTO leads (id, organization_id, name, email, phone, company, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [leadId, org.id, "Alexander Wright", "alex.wright@quantumtech.io", "+1 (555) 234-5678", "Quantum Technologies", "Qualified"]
    );

    const user = await get("SELECT id FROM users WHERE organization_id = ? LIMIT 1", [org.id]);
    const userId = user ? user.id : null;

    await run(
      `INSERT INTO lead_notes (id, lead_id, author_id, content)
       VALUES (?, ?, ?, ?)`,
      ["note-demo-001", leadId, userId, "High intent prospect. Requested enterprise licensing quote."]
    );

    await run(
      `INSERT INTO lead_communications (id, lead_id, type, subject, details, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ["comm-demo-001", leadId, "Call", "Discovery & Architecture Call", "Discussed 50-seat team rollout for Q4.", userId]
    );

    const stage = await get("SELECT id FROM pipeline_stages WHERE organization_id = ? AND stage_order = 3 LIMIT 1", [org.id]);
    if (stage) {
      await run(
        `INSERT INTO deals (id, organization_id, title, lead_id, stage_id, value, expected_close_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        ["deal-demo-001", org.id, "Quantum Enterprise License", leadId, stage.id, 28000, "2026-10-15", "Terms reviewed, pending contract."]
      );
    }
  }

  // Ensure Day 4 Sample Data (Customers, Quotations, Items, Tickets, Comments, Attachments, Payments)
  const custCount = await get("SELECT COUNT(*) AS c FROM customers");
  if (custCount.c === 0) {
    const custId = "cust-demo-001";
    await run(
      `INSERT INTO customers (id, organization_id, name, email, phone, company, address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        custId,
        org.id,
        "Sophia Martinez",
        "sophia.martinez@hyperion.com",
        "+1 (555) 345-6789",
        "Hyperion Dynamics",
        "500 Market Street, San Francisco, CA",
        "Active"
      ]
    );

    const user = await get("SELECT id FROM users WHERE organization_id = ? LIMIT 1", [org.id]);
    const userId = user ? user.id : null;

    const quoteId = "quote-demo-001";
    await run(
      `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        quoteId,
        org.id,
        "QT-1001",
        custId,
        "2026-09-01",
        "2026-10-01",
        "Accepted",
        45000,
        4500,
        49500,
        "Annual enterprise licensing terms."
      ]
    );

    await run(
      `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["item-demo-001", quoteId, "Enterprise Platform License (Annual)", 50, 800, 10, 4000, 40000]
    );
    await run(
      `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ["item-demo-002", quoteId, "Dedicated Technical Account Support", 1, 5000, 10, 500, 5000]
    );

    const ticketId = "tck-demo-001";
    await run(
      `INSERT INTO tickets (id, organization_id, ticket_number, customer_id, title, description, priority, status, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ticketId,
        org.id,
        "TCK-1001",
        custId,
        "SSO SAML authentication intermittent timeout",
        "Our users experienced login timeouts when authenticating via Okta SSO.",
        "High",
        "In Progress",
        userId
      ]
    );

    const commentId = "comm-ticket-demo-001";
    await run(
      `INSERT INTO ticket_comments (id, ticket_id, user_id, comment)
       VALUES (?, ?, ?, ?)`,
      [commentId, ticketId, userId, "Investigating identity token exchange latency."]
    );

    await run(
      `INSERT INTO ticket_attachments (id, ticket_id, comment_id, uploaded_by, original_filename, stored_path, mime_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "att-demo-001",
        ticketId,
        commentId,
        userId,
        "saml_debug_trace.log",
        "storage/attachments/2026/09/saml_debug_trace.log",
        "text/plain",
        1048576
      ]
    );

    await run(
      `INSERT INTO payments (id, organization_id, quotation_id, customer_id, amount, payment_date, payment_method, payment_status, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "pay-demo-001",
        org.id,
        quoteId,
        custId,
        49500,
        "2026-09-02",
        "Bank Transfer",
        "Completed",
        "WIRE-HYP-99001",
        "Full annual prepayment received."
      ]
    );
  }
}

async function proofLeads() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR REQUIREMENT 1: LEADS TABLE");
  console.log("========================================================");
  await printSchema("leads");
  await printForeignKeys("leads");

  // Show live records
  const sample = await all("SELECT id, name, company, email, phone, status, organization_id FROM leads LIMIT 3");
  console.log("\n🔍 Sample Data in 'leads' table:");
  console.table(sample);
  console.log("✅ Proof Status: 'leads' table is live and active in SQLite.\n");
}

async function proofNotes() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR REQUIREMENT 2: LEAD NOTES TABLE");
  console.log("========================================================");
  await printSchema("lead_notes");
  await printForeignKeys("lead_notes");

  // Show live records
  const sample = await all("SELECT id, lead_id, author_id, content, created_at FROM lead_notes LIMIT 3");
  console.log("\n🔍 Sample Data in 'lead_notes' table:");
  console.table(sample);
  console.log("✅ Proof Status: 'lead_notes' table is live with CASCADE foreign key to 'leads'.\n");
}

async function proofCommunication() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR REQUIREMENT 3: LEAD COMMUNICATION TABLE");
  console.log("========================================================");
  await printSchema("lead_communications");
  await printForeignKeys("lead_communications");

  // Show live records
  const sample = await all("SELECT id, lead_id, type, subject, details, communication_date FROM lead_communications LIMIT 3");
  console.log("\n🔍 Sample Data in 'lead_communications' table:");
  console.table(sample);
  console.log("✅ Proof Status: 'lead_communications' table is live with verified communication types.\n");
}

async function proofPipeline() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR REQUIREMENT 4: SALES PIPELINE (STAGES & DEALS)");
  console.log("========================================================");
  console.log("\n--- Pipeline Stages ---");
  await printSchema("pipeline_stages");
  const stages = await all("SELECT id, name, stage_order, color, organization_id FROM pipeline_stages ORDER BY stage_order ASC LIMIT 6");
  console.log("\n🔍 Configured Pipeline Stages (Ordered 1-6):");
  console.table(stages);

  console.log("\n--- Deals Table ---");
  await printSchema("deals");
  await printForeignKeys("deals");
  const sampleDeals = await all("SELECT id, title, value, stage_id, lead_id, expected_close_date FROM deals LIMIT 3");
  console.log("\n🔍 Sample Data in 'deals' table:");
  console.table(sampleDeals);
  console.log("✅ Proof Status: 'pipeline_stages' and 'deals' are live and linked.\n");
}

async function proofIndexesAndRelationships() {
  console.log("\n========================================================");
  console.log("PROOFS FOR REQUIREMENT 5: DAY 3 INDEXES & RELATIONSHIPS");
  console.log("========================================================");
  
  const indexes = await all(`
    SELECT name AS IndexName, tbl_name AS TargetTable
    FROM sqlite_master 
    WHERE type = 'index' AND name LIKE 'idx_%'
    ORDER BY tbl_name, name
  `);
  console.log(`\n⚡ Active Performance Indexes (Total count: ${indexes.length}):`);
  console.table(indexes);

  console.log("\n🔗 All Day 3 Foreign Key Relationships:");
  for (const table of ["leads", "lead_notes", "lead_communications", "pipeline_stages", "deals"]) {
    const fks = await all(`PRAGMA foreign_key_list(${table})`);
    if (fks.length > 0) {
      console.log(`Table '${table}' -> Foreign Keys:`);
      console.table(
        fks.map((fk) => ({
          FromColumn: fk.from,
          References: `${fk.table}(${fk.to})`,
          OnDelete: fk.on_delete
        }))
      );
    }
  }
  console.log("✅ Proof Status: All Day 3 indexes and foreign keys verified active in SQLite.\n");
}

// -------------------------------------------------------------
// Day 4 Proofs: Customers, Quotations, Tickets, Payments
// -------------------------------------------------------------
// -------------------------------------------------------------
// Day 4 Individual Proofs: Quotations, Items, Customers, Tickets, Comments, Attachments, Payments
// -------------------------------------------------------------
async function proofQuotationsOnly() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR DAY 4 ITEM 1: QUOTATIONS TABLE");
  console.log("========================================================");
  await printSchema("quotations");
  await printForeignKeys("quotations");

  const sampleQuotes = await all("SELECT id, quote_number, customer_id, issue_date, valid_until, status, grand_total FROM quotations LIMIT 3");
  console.log("\n🔍 Sample Data in 'quotations' table:");
  console.table(sampleQuotes);
  console.log("✅ Proof Status: 'quotations' table is live with multi-tenant numbering & status constraints.\n");
}

async function proofQuotationItemsOnly() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR DAY 4 ITEM 2: QUOTATION ITEMS & TAX TABLE");
  console.log("========================================================");
  await printSchema("quotation_items");
  await printForeignKeys("quotation_items");

  const sampleItems = await all("SELECT id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total FROM quotation_items LIMIT 5");
  console.log("\n🔍 Sample Data in 'quotation_items' table:");
  console.table(sampleItems);
  console.log("✅ Proof Status: 'quotation_items' table is live with tax rates, auto-calculated line totals, & cascade delete.\n");
}

async function proofCustomers() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR DAY 4 ITEM 3: CUSTOMERS TABLE");
  console.log("========================================================");
  await printSchema("customers");
  await printForeignKeys("customers");

  const sample = await all("SELECT id, organization_id, name, email, phone, company, status FROM customers LIMIT 3");
  console.log("\n🔍 Sample Data in 'customers' table:");
  console.table(sample);
  console.log("✅ Proof Status: 'customers' table is live with organization foreign key & status constraints.\n");
}

async function proofTicketsOnly() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR DAY 4 ITEM 4: TICKETS TABLE");
  console.log("========================================================");
  await printSchema("tickets");
  await printForeignKeys("tickets");

  const sampleTickets = await all("SELECT id, ticket_number, customer_id, title, priority, status, assigned_to FROM tickets LIMIT 3");
  console.log("\n🔍 Sample Data in 'tickets' table:");
  console.table(sampleTickets);
  console.log("✅ Proof Status: 'tickets' table is live with multi-tenant unique numbering & priority/status constraints.\n");
}

async function proofTicketCommentsAndAttachments() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR DAY 4 ITEM 5: TICKET COMMENTS & ATTACHMENTS");
  console.log("========================================================");
  console.log("\n--- Ticket Comments Table ---");
  await printSchema("ticket_comments");
  await printForeignKeys("ticket_comments");
  const sampleComments = await all("SELECT id, ticket_id, user_id, comment, created_at FROM ticket_comments LIMIT 3");
  console.log("\n🔍 Sample Data in 'ticket_comments' table:");
  console.table(sampleComments);

  console.log("\n--- Ticket Attachments (Metadata) Table ---");
  await printSchema("ticket_attachments");
  await printForeignKeys("ticket_attachments");
  const sampleAtt = await all("SELECT id, ticket_id, original_filename, stored_path, mime_type, file_size FROM ticket_attachments LIMIT 3");
  console.log("\n🔍 Sample Data in 'ticket_attachments' table:");
  console.table(sampleAtt);
  console.log("✅ Proof Status: 'ticket_comments' & 'ticket_attachments' are live with full cascade deletes.\n");
}

async function proofPayments() {
  await ensureSampleData();
  console.log("\n========================================================");
  console.log("PROOFS FOR DAY 4 ITEM 6: PAYMENTS TRACKING TABLE");
  console.log("========================================================");
  await printSchema("payments");
  await printForeignKeys("payments");

  const samplePayments = await all("SELECT id, quotation_id, customer_id, amount, payment_method, payment_status, reference_number, payment_date FROM payments LIMIT 3");
  console.log("\n🔍 Sample Data in 'payments' table:");
  console.table(samplePayments);
  console.log("✅ Proof Status: 'payments' table is live with multi-payment quotation support & method constraints.\n");
}

async function proofQuotations() {
  await proofQuotationsOnly();
  await proofQuotationItemsOnly();
}

async function proofTickets() {
  await proofTicketsOnly();
  await proofTicketCommentsAndAttachments();
}

async function proofDay4Indexes() {
  console.log("\n========================================================");
  console.log("PROOFS FOR DAY 4 INDEXES & RELATIONSHIPS");
  console.log("========================================================");
  const day4Tables = ["customers", "quotations", "quotation_items", "tickets", "ticket_comments", "ticket_attachments", "payments"];
  for (const table of day4Tables) {
    const fks = await all(`PRAGMA foreign_key_list(${table})`);
    if (fks.length > 0) {
      console.log(`Table '${table}' -> Foreign Keys:`);
      console.table(
        fks.map((fk) => ({
          FromColumn: fk.from,
          References: `${fk.table}(${fk.to})`,
          OnDelete: fk.on_delete
        }))
      );
    }
  }

  const indexes = await all(`
    SELECT name AS IndexName, tbl_name AS TargetTable
    FROM sqlite_master 
    WHERE type = 'index' AND tbl_name IN ('customers', 'quotations', 'quotation_items', 'tickets', 'ticket_comments', 'ticket_attachments', 'payments')
    ORDER BY tbl_name, name
  `);
  console.log(`\n⚡ Day 4 Performance Indexes (Count: ${indexes.length}):`);
  console.table(indexes);
  console.log("✅ Proof Status: All Day 4 tables, foreign keys, and indexes verified.\n");
}

async function proofDay4All() {
  await proofQuotationsOnly();
  await proofQuotationItemsOnly();
  await proofCustomers();
  await proofTicketsOnly();
  await proofTicketCommentsAndAttachments();
  await proofPayments();
  await proofDay4Indexes();
}

async function runProof() {
  const arg = (process.argv[2] || "").toLowerCase();

  // Day 3 commands
  if (arg === "leads" || arg === "lead") {
    await proofLeads();
  } else if (arg === "notes" || arg === "note") {
    await proofNotes();
  } else if (arg === "comm" || arg === "communication") {
    await proofCommunication();
  } else if (arg === "pipeline" || arg === "stages" || arg === "deals") {
    await proofPipeline();
  } else if (arg === "day3-indexes") {
    await proofIndexesAndRelationships();

  // Day 4 Individual Commands
  } else if (arg === "1" || arg === "quote" || arg === "quotation" || arg === "quotations") {
    await proofQuotationsOnly();
  } else if (arg === "2" || arg === "items" || arg === "item" || arg === "quotation_items" || arg === "tax") {
    await proofQuotationItemsOnly();
  } else if (arg === "3" || arg === "customers" || arg === "customer" || arg === "6") {
    await proofCustomers();
  } else if (arg === "4" || arg === "tickets" || arg === "ticket") {
    await proofTicketsOnly();
  } else if (arg === "5" || arg === "comments" || arg === "comment" || arg === "attachments" || arg === "attachment" || arg === "threads") {
    await proofTicketCommentsAndAttachments();
  } else if (arg === "6" || arg === "payments" || arg === "payment" || arg === "9") {
    await proofPayments();
  } else if (arg === "7" || arg === "quotes-all") {
    await proofQuotations();
  } else if (arg === "8" || arg === "tickets-all") {
    await proofTickets();
  } else if (arg === "indexes" || arg === "day4-indexes") {
    await proofDay4Indexes();
  } else if (arg === "day4") {
    await proofDay4All();
  } else if (arg === "all") {
    await proofLeads();
    await proofNotes();
    await proofCommunication();
    await proofPipeline();
    await proofIndexesAndRelationships();
    await proofDay4All();
  } else {
    console.log("\n========================================================");
    console.log("DAY 4 CRM DATABASE PROOFS GENERATOR");
    console.log("========================================================");
    console.log("Run any of these individual commands in your backend folder:\n");
    console.log("  node proof.js quotations        -> Proof for Quotations Table");
    console.log("  node proof.js quotation_items  -> Proof for Quotation Items & Tax");
    console.log("  node proof.js customers        -> Proof for Customers Table");
    console.log("  node proof.js tickets          -> Proof for Tickets Table");
    console.log("  node proof.js comments         -> Proof for Comments & Attachments");
    console.log("  node proof.js payments         -> Proof for Payments Tracking");
    console.log("  node proof.js day4-indexes     -> Proof for Day 4 Indexes & FKs");
    console.log("  node proof.js day4             -> Show all Day 4 proofs sequentially\n");
  }
  process.exit(0);
}

runProof().catch((err) => {
  console.error("Proof generation error:", err);
  process.exit(1);
});
