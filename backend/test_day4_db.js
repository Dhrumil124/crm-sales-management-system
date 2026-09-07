const { db, run, get, all, runTransaction, calculateQuotationTotals } = require("./src/database/db");

async function runDay4Verification() {
  console.log("\n==================================================================");
  console.log("STARTING DAY 4 QUOTATION, TICKETS & PAYMENTS DATABASE TEST SUITE");
  console.log("==================================================================\n");

  try {
    // -------------------------------------------------------------
    // Test 1: Verify All 14 Database Tables Exist (Day 2 + Day 3 + Day 4)
    // -------------------------------------------------------------
    console.log("TEST 1: Verifying All 14 Required Tables in SQLite...");
    const day2Tables = ["organizations", "users"];
    const day3Tables = ["leads", "lead_notes", "lead_communications", "pipeline_stages", "deals"];
    const day4Tables = [
      "customers",
      "quotations",
      "quotation_items",
      "tickets",
      "ticket_comments",
      "ticket_attachments",
      "payments"
    ];
    const allExpectedTables = [...day2Tables, ...day3Tables, ...day4Tables];

    const tables = await all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = tables.map((t) => t.name);

    for (const reqTable of allExpectedTables) {
      if (!tableNames.includes(reqTable)) {
        throw new Error(`Missing required table: ${reqTable}`);
      }
      console.log(`  ✓ Table '${reqTable}' verified active`);
    }

    // -------------------------------------------------------------
    // Test 2: Verify Foreign Keys Pragmas
    // -------------------------------------------------------------
    console.log("\nTEST 2: Verifying Foreign Key Constraint Enforcement...");
    const fkStatus = await get("PRAGMA foreign_keys");
    if (!fkStatus || fkStatus.foreign_keys !== 1) {
      throw new Error("SQLite foreign keys are not enabled!");
    }
    console.log("  ✓ PRAGMA foreign_keys = 1 (Enforced)");

    // -------------------------------------------------------------
    // Test 3: Verify All Day 4 Indexes Exist
    // -------------------------------------------------------------
    console.log("\nTEST 3: Verifying Day 4 Performance & Relational Indexes...");
    const requiredDay4Indexes = [
      "idx_customers_org_id",
      "idx_customers_status",
      "idx_customers_email",
      "idx_quotations_org_id",
      "idx_quotations_customer_id",
      "idx_quotations_status",
      "idx_quotations_issue_date",
      "idx_quotation_items_quote_id",
      "idx_tickets_org_id",
      "idx_tickets_customer_id",
      "idx_tickets_status",
      "idx_tickets_priority",
      "idx_tickets_assigned_to",
      "idx_ticket_comments_ticket_id",
      "idx_ticket_comments_user_id",
      "idx_ticket_attachments_ticket_id",
      "idx_ticket_attachments_comment_id",
      "idx_ticket_attachments_uploaded_by",
      "idx_payments_org_id",
      "idx_payments_quote_id",
      "idx_payments_customer_id",
      "idx_payments_status",
      "idx_payments_date"
    ];

    const indexes = await all("SELECT name FROM sqlite_master WHERE type='index'");
    const indexNames = indexes.map((i) => i.name);

    for (const reqIndex of requiredDay4Indexes) {
      if (!indexNames.includes(reqIndex)) {
        throw new Error(`Missing required Day 4 index: ${reqIndex}`);
      }
      console.log(`  ✓ Index '${reqIndex}' verified`);
    }

    // -------------------------------------------------------------
    // Test 4: Verify Existing Organizations and Users Intact
    // -------------------------------------------------------------
    console.log("\nTEST 4: Verifying Existing Data Preservation...");
    const orgs = await all("SELECT * FROM organizations");
    const users = await all("SELECT * FROM users");
    if (orgs.length === 0 || users.length === 0) {
      throw new Error("Existing organizations or users were lost!");
    }
    const testOrg = orgs[0];
    const testUser = users.find((u) => u.organization_id === testOrg.id) || users[0];
    console.log(`  ✓ Testing against Organization '${testOrg.name}' (${testOrg.id}) and User '${testUser.name}'`);

    // Create a secondary org to test organization isolation and multi-tenant unique numbering
    const secondOrgId = `org-second-${Date.now()}`;
    await run("INSERT INTO organizations (id, name) VALUES (?, ?)", [secondOrgId, "Second Org Global"]);
    console.log(`  ✓ Created auxiliary organization for multi-tenant isolation tests`);

    // -------------------------------------------------------------
    // Test 5: Customer Lifecycle & Schema Verification
    // -------------------------------------------------------------
    console.log("\nTEST 5: Testing Customers Table & Operations...");
    const testCustomerId = `cust-test-${Date.now()}`;
    await run(
      `INSERT INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testCustomerId,
        testOrg.id,
        "Acme Apex Client",
        "billing@apextech.com",
        "+1 555 123 4567",
        "Apex Tech Solutions",
        "100 Innovation Way, Suite 400, Austin, TX",
        "Active",
        new Date().toISOString(),
        new Date().toISOString()
      ]
    );

    const customerRow = await get("SELECT * FROM customers WHERE id = ?", [testCustomerId]);
    if (!customerRow || customerRow.company !== "Apex Tech Solutions") {
      throw new Error("Failed to insert or retrieve customer record");
    }
    console.log(`  ✓ Customer '${customerRow.name}' (${customerRow.company}) created successfully`);

    // -------------------------------------------------------------
    // Test 6: Quotations, Quotation Items & Calculation Engine
    // -------------------------------------------------------------
    console.log("\nTEST 6: Testing Quotations, Line Items & Server Calculation Engine...");
    const rawItems = [
      { description: "Enterprise Cloud Subscription (Annual)", quantity: 10, unit_price: 1200, tax_rate: 18 },
      { description: "Dedicated Technical Support SLA Tier 1", quantity: 1, unit_price: 5000, tax_rate: 18 },
      { description: "API Integration & Onboarding Service", quantity: 2, unit_price: 2500, tax_rate: 12 }
    ];

    const totals = calculateQuotationTotals(rawItems);
    console.log(`  ✓ Server calculated totals: Subtotal=${totals.subtotal}, TaxTotal=${totals.taxTotal}, GrandTotal=${totals.grandTotal}`);
    if (totals.subtotal !== 22000 || totals.taxTotal !== 3660 || totals.grandTotal !== 25660) {
      throw new Error(`Mathematical total mismatch! Calculated: ${JSON.stringify(totals)}`);
    }

    const testQuoteId = `quote-test-${Date.now()}`;
    const quoteNumber = `QT-${Date.now().toString().slice(-4)}`;
    await run(
      `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testQuoteId,
        testOrg.id,
        quoteNumber,
        testCustomerId,
        "2026-09-07",
        "2026-10-07",
        "Draft",
        totals.subtotal,
        totals.taxTotal,
        totals.grandTotal,
        "Standard Net-30 enterprise payment terms apply."
      ]
    );

    // Insert quotation line items
    for (const item of totals.items) {
      const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      await run(
        `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, testQuoteId, item.description, item.quantity, item.unit_price, item.tax_rate, item.tax_amount, item.line_total]
      );
    }

    const quoteWithItems = await all(
      `SELECT q.id, q.quote_number, q.grand_total, qi.description, qi.quantity, qi.unit_price, qi.line_total
       FROM quotations q
       JOIN quotation_items qi ON q.id = qi.quotation_id
       WHERE q.id = ?`,
      [testQuoteId]
    );
    if (quoteWithItems.length !== 3) {
      throw new Error(`Expected 3 quotation line items, found ${quoteWithItems.length}`);
    }
    console.log(`  ✓ Quotation '${quoteNumber}' created with 3 line items linked via foreign key`);

    // -------------------------------------------------------------
    // Test 7: Multi-Tenant Organization-Aware Numbering Isolation
    // -------------------------------------------------------------
    console.log("\nTEST 7: Testing Organization-Aware Unique Numbering...");
    // Same quoteNumber in the SAME organization should fail UNIQUE constraint
    let duplicateRejected = false;
    try {
      await run(
        `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`quote-dup-${Date.now()}`, testOrg.id, quoteNumber, testCustomerId, "2026-09-07", "2026-10-07", "Draft", 100, 10, 110]
      );
    } catch (err) {
      if (err.message.includes("UNIQUE constraint failed")) {
        duplicateRejected = true;
      } else {
        throw err;
      }
    }
    if (!duplicateRejected) {
      throw new Error("Duplicate quote number in the SAME organization was not rejected!");
    }
    console.log("  ✓ Duplicate quote number in the SAME organization rejected by UNIQUE(organization_id, quote_number)");

    // Customer in second org
    const secondCustId = `cust-second-${Date.now()}`;
    await run("INSERT INTO customers (id, organization_id, name) VALUES (?, ?, ?)", [secondCustId, secondOrgId, "Other Org Customer"]);

    // Same quoteNumber in a DIFFERENT organization should succeed
    const crossOrgQuoteId = `quote-diff-org-${Date.now()}`;
    await run(
      `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crossOrgQuoteId, secondOrgId, quoteNumber, secondCustId, "2026-09-07", "2026-10-07", "Draft", 200, 20, 220]
    );
    console.log("  ✓ Same quote number in a DIFFERENT organization succeeded (Organization Isolation verified)");

    // -------------------------------------------------------------
    // Test 8: Tickets, Threaded Comments & File Attachment Metadata
    // -------------------------------------------------------------
    console.log("\nTEST 8: Testing Support Tickets, Comments & Attachment Metadata...");
    const testTicketId = `tck-test-${Date.now()}`;
    const ticketNumber = `TCK-${Date.now().toString().slice(-4)}`;

    await run(
      `INSERT INTO tickets (id, organization_id, ticket_number, customer_id, title, description, priority, status, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testTicketId,
        testOrg.id,
        ticketNumber,
        testCustomerId,
        "High latency on WebSocket streaming feed",
        "Customer reported WebSocket ping timeout exceeding 5000ms during peak market hours.",
        "High",
        "Open",
        testUser.id
      ]
    );

    // Add Ticket Comment
    const commentId1 = `comm-test-1-${Date.now()}`;
    await run(
      `INSERT INTO ticket_comments (id, ticket_id, user_id, comment)
       VALUES (?, ?, ?, ?)`,
      [commentId1, testTicketId, testUser.id, "Investigating connection logs. Suspected edge routing congestion."]
    );

    // Add Ticket Attachment (Metadata-Only)
    const attachmentId1 = `att-test-1-${Date.now()}`;
    await run(
      `INSERT INTO ticket_attachments (id, ticket_id, comment_id, uploaded_by, original_filename, stored_path, mime_type, file_size)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachmentId1,
        testTicketId,
        commentId1,
        testUser.id,
        "latency_trace_log.json",
        "storage/attachments/2026/09/latency_trace_log_uuid123.json",
        "application/json",
        245760
      ]
    );

    const ticketDetails = await get(
      `SELECT t.id, t.ticket_number, t.title, t.priority, t.status,
              c.name AS customer_name, u.name AS assigned_user,
              (SELECT COUNT(*) FROM ticket_comments WHERE ticket_id = t.id) AS comment_count,
              (SELECT COUNT(*) FROM ticket_attachments WHERE ticket_id = t.id) AS attachment_count
       FROM tickets t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN users u ON t.assigned_to = u.id
       WHERE t.id = ?`,
      [testTicketId]
    );

    if (!ticketDetails || ticketDetails.comment_count !== 1 || ticketDetails.attachment_count !== 1) {
      throw new Error("Failed to verify ticket details with joined comments and attachments");
    }
    console.log(`  ✓ Ticket '${ticketDetails.ticket_number}' verified with 1 comment and 1 metadata attachment`);

    // -------------------------------------------------------------
    // Test 9: Payments Tracking (Multiple Payments against Quotation)
    // -------------------------------------------------------------
    console.log("\nTEST 9: Testing Payment Tracking Linked to Quotation & Customer...");
    const paymentId1 = `pay-test-1-${Date.now()}`;
    const paymentId2 = `pay-test-2-${Date.now()}`;

    // Payment 1: Deposit / Partial Payment
    await run(
      `INSERT INTO payments (id, organization_id, quotation_id, customer_id, amount, payment_date, payment_method, payment_status, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId1,
        testOrg.id,
        testQuoteId,
        testCustomerId,
        15000,
        "2026-09-08",
        "Bank Transfer",
        "Completed",
        "TXN-WIRE-998811",
        "Initial 50% advance wire deposit received"
      ]
    );

    // Payment 2: Remaining Balance
    await run(
      `INSERT INTO payments (id, organization_id, quotation_id, customer_id, amount, payment_date, payment_method, payment_status, reference_number, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        paymentId2,
        testOrg.id,
        testQuoteId,
        testCustomerId,
        10660,
        "2026-09-09",
        "Credit Card",
        "Completed",
        "TXN-CC-445566",
        "Final settlement transaction"
      ]
    );

    const paymentRecords = await all(
      `SELECT p.id, p.amount, p.payment_method, p.payment_status, q.quote_number
       FROM payments p
       JOIN quotations q ON p.quotation_id = q.id
       WHERE p.quotation_id = ?`,
      [testQuoteId]
    );
    if (paymentRecords.length !== 2) {
      throw new Error(`Expected 2 payments recorded against quotation, found ${paymentRecords.length}`);
    }
    const totalPaid = paymentRecords.reduce((sum, p) => sum + p.amount, 0);
    console.log(`  ✓ 2 payments totaling ₹${totalPaid} recorded against Quotation '${paymentRecords[0].quote_number}'`);

    // -------------------------------------------------------------
    // Test 10: Strict CHECK Constraint Enforcement (Negative Tests)
    // -------------------------------------------------------------
    console.log("\nTEST 10: Testing Database CHECK Constraints Enforcement (Negative Tests)...");

    // Check 1: Negative quotation subtotal
    try {
      await run(
        `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, grand_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [`quote-neg-${Date.now()}`, testOrg.id, `QT-NEG-1`, testCustomerId, "2026-09-07", "2026-10-07", "Draft", -500, 0, 500]
      );
      throw new Error("CHECK failed: allowed negative quotation subtotal!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: quotations.subtotal cannot be negative");
      } else throw err;
    }

    // Check 2: Invalid quotation status
    try {
      await run(
        `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`quote-inv-st-${Date.now()}`, testOrg.id, `QT-INV-ST`, testCustomerId, "2026-09-07", "2026-10-07", "InvalidStatus"]
      );
      throw new Error("CHECK failed: allowed invalid quotation status!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: quotations.status must be Draft, Sent, Accepted, or Declined");
      } else throw err;
    }

    // Check 3: Quotation item zero/negative quantity
    try {
      await run(
        `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [`item-bad-qty-${Date.now()}`, testQuoteId, "Zero qty item", 0, 500]
      );
      throw new Error("CHECK failed: allowed quotation item with quantity 0!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: quotation_items.quantity must be > 0");
      } else throw err;
    }

    // Check 4: Quotation item negative unit price
    try {
      await run(
        `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [`item-bad-price-${Date.now()}`, testQuoteId, "Negative price item", 1, -100]
      );
      throw new Error("CHECK failed: allowed quotation item with negative price!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: quotation_items.unit_price cannot be negative");
      } else throw err;
    }

    // Check 5: Invalid ticket priority
    try {
      await run(
        `INSERT INTO tickets (id, organization_id, ticket_number, title, description, priority)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`tck-bad-pri-${Date.now()}`, testOrg.id, `TCK-BAD-PRI`, "Bad priority ticket", "Desc", "UltraMegaExtreme"]
      );
      throw new Error("CHECK failed: allowed invalid ticket priority!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: tickets.priority must be Low, Medium, High, or Urgent");
      } else throw err;
    }

    // Check 6: Invalid ticket status
    try {
      await run(
        `INSERT INTO tickets (id, organization_id, ticket_number, title, description, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`tck-bad-st-${Date.now()}`, testOrg.id, `TCK-BAD-ST`, "Bad status ticket", "Desc", "WaitingForGodot"]
      );
      throw new Error("CHECK failed: allowed invalid ticket status!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: tickets.status must be Open, In Progress, Waiting, Resolved, or Closed");
      } else throw err;
    }

    // Check 7: Negative payment amount
    try {
      await run(
        `INSERT INTO payments (id, organization_id, quotation_id, amount, payment_method)
         VALUES (?, ?, ?, ?, ?)`,
        [`pay-neg-${Date.now()}`, testOrg.id, testQuoteId, -1500, "Credit Card"]
      );
      throw new Error("CHECK failed: allowed negative payment amount!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: payments.amount must be > 0");
      } else throw err;
    }

    // Check 8: Invalid payment method
    try {
      await run(
        `INSERT INTO payments (id, organization_id, quotation_id, amount, payment_method)
         VALUES (?, ?, ?, ?, ?)`,
        [`pay-bad-meth-${Date.now()}`, testOrg.id, testQuoteId, 100, "CarrierPigeonBarter"]
      );
      throw new Error("CHECK failed: allowed invalid payment method!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: payments.payment_method restricted to allowed list");
      } else throw err;
    }

    // -------------------------------------------------------------
    // Test 11: Foreign Key Rejection (Negative Tests)
    // -------------------------------------------------------------
    console.log("\nTEST 11: Testing Foreign Key Reference Rejection (Negative Tests)...");

    // Invalid customer in quotation
    try {
      await run(
        `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [`quote-bad-cust-${Date.now()}`, testOrg.id, `QT-BAD-CUST`, "cust-nonexistent-999", "2026-09-07", "2026-10-07"]
      );
      throw new Error("Foreign key failed: allowed quotation with non-existent customer_id!");
    } catch (err) {
      if (err.message.includes("FOREIGN KEY constraint failed")) {
        console.log("  ✓ Foreign key rejection verified: quotations.customer_id -> customers(id)");
      } else throw err;
    }

    // Invalid quotation in quotation_items
    try {
      await run(
        `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [`item-bad-quote-${Date.now()}`, "quote-nonexistent-888", "Orphan item", 1, 100]
      );
      throw new Error("Foreign key failed: allowed item with non-existent quotation_id!");
    } catch (err) {
      if (err.message.includes("FOREIGN KEY constraint failed")) {
        console.log("  ✓ Foreign key rejection verified: quotation_items.quotation_id -> quotations(id)");
      } else throw err;
    }

    // Invalid ticket in ticket_comments
    try {
      await run(
        `INSERT INTO ticket_comments (id, ticket_id, comment)
         VALUES (?, ?, ?)`,
        [`comm-bad-ticket-${Date.now()}`, "ticket-nonexistent-777", "Orphan comment"]
      );
      throw new Error("Foreign key failed: allowed comment with non-existent ticket_id!");
    } catch (err) {
      if (err.message.includes("FOREIGN KEY constraint failed")) {
        console.log("  ✓ Foreign key rejection verified: ticket_comments.ticket_id -> tickets(id)");
      } else throw err;
    }

    // -------------------------------------------------------------
    // Test 12: Foreign Key ON DELETE CASCADE & SET NULL Behavior
    // -------------------------------------------------------------
    console.log("\nTEST 12: Testing ON DELETE CASCADE & SET NULL Lifecycle Behavior...");

    // 12a. Deleting a quotation cascades to quotation_items & payments
    await run("DELETE FROM quotations WHERE id = ?", [testQuoteId]);
    const orphanItems = await all("SELECT * FROM quotation_items WHERE quotation_id = ?", [testQuoteId]);
    const orphanPayments = await all("SELECT * FROM payments WHERE quotation_id = ?", [testQuoteId]);
    if (orphanItems.length !== 0 || orphanPayments.length !== 0) {
      throw new Error("Quotation cascade delete failed: orphan items or payments remain!");
    }
    console.log("  ✓ ON DELETE CASCADE verified: deleting quotation removed associated items and payments");

    // 12b. Deleting a ticket cascades to comments & attachments
    await run("DELETE FROM tickets WHERE id = ?", [testTicketId]);
    const orphanComments = await all("SELECT * FROM ticket_comments WHERE ticket_id = ?", [testTicketId]);
    const orphanAttachments = await all("SELECT * FROM ticket_attachments WHERE ticket_id = ?", [testTicketId]);
    if (orphanComments.length !== 0 || orphanAttachments.length !== 0) {
      throw new Error("Ticket cascade delete failed: orphan comments or attachments remain!");
    }
    console.log("  ✓ ON DELETE CASCADE verified: deleting ticket removed associated comments and attachments");

    // 12c. SET NULL behavior: user deletion sets ticket assigned_to to null
    const tempUserId = `user-temp-${Date.now()}`;
    await run(
      `INSERT INTO users (id, organization_id, name, email, password_hash)
       VALUES (?, ?, ?, ?, ?)`,
      [tempUserId, testOrg.id, "Temporary Specialist", `temp-${Date.now()}@acme.com`, "hash123"]
    );

    const tempTicketId = `tck-setnull-${Date.now()}`;
    await run(
      `INSERT INTO tickets (id, organization_id, ticket_number, customer_id, title, description, assigned_to)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [tempTicketId, testOrg.id, `TCK-SN-${Date.now().toString().slice(-4)}`, testCustomerId, "Temporary Ticket", "Desc", tempUserId]
    );

    // Delete the temporary user
    await run("DELETE FROM users WHERE id = ?", [tempUserId]);
    const ticketAfterUserDelete = await get("SELECT assigned_to FROM tickets WHERE id = ?", [tempTicketId]);
    if (ticketAfterUserDelete.assigned_to !== null) {
      throw new Error(`Expected tickets.assigned_to to be NULL after user deletion, found: ${ticketAfterUserDelete.assigned_to}`);
    }
    console.log("  ✓ ON DELETE SET NULL verified: deleting user set ticket.assigned_to to NULL");

    // Clean up temp ticket & customer & second org
    await run("DELETE FROM tickets WHERE id = ?", [tempTicketId]);
    await run("DELETE FROM customers WHERE id = ?", [testCustomerId]);
    await run("DELETE FROM organizations WHERE id = ?", [secondOrgId]);

    // -------------------------------------------------------------
    // Test 13: Strict Transaction Rollback Verification
    // -------------------------------------------------------------
    console.log("\nTEST 13: Testing Atomic Database Transaction Rollback...");
    let rollbackSuccess = false;
    const rollbackCustId = `cust-rollback-${Date.now()}`;

    try {
      await runTransaction(async (tx) => {
        await tx.run(
          `INSERT INTO customers (id, organization_id, name, email) VALUES (?, ?, ?, ?)`,
          [rollbackCustId, testOrg.id, "Rollback Customer", "rollback@acme.com"]
        );
        // Force an error inside transaction (invalid status CHECK violation)
        await tx.run(
          `INSERT INTO customers (id, organization_id, name, status) VALUES (?, ?, ?, ?)`,
          [`cust-err-${Date.now()}`, testOrg.id, "Failing Customer", "InvalidStatus"]
        );
      });
    } catch {
      rollbackSuccess = true;
    }

    if (!rollbackSuccess) {
      throw new Error("Transaction did not throw on error!");
    }
    const rollbackRecord = await get("SELECT * FROM customers WHERE id = ?", [rollbackCustId]);
    if (rollbackRecord !== null) {
      throw new Error("Transaction rollback failed: uncommitted customer record still exists!");
    }
    console.log("  ✓ Atomic runTransaction verified: error rolled back entire operation without partial writes");

    console.log("\n==================================================================");
    console.log("ALL DAY 4 DATABASE FOUNDATION TESTS PASSED WITH 100% SUCCESS! ");
    console.log("==================================================================\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ DAY 4 VERIFICATION FAILED:", error.message);
    process.exit(1);
  }
}

runDay4Verification();
