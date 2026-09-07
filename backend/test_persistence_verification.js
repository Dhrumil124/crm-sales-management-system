const { run, get, all } = require("./src/database/db");
const {
  dealStore,
  quotationStore,
  ticketStore,
  customerStore
} = require("./src/services/storage");

async function runPersistenceTests() {
  console.log("\n========================================================");
  console.log("STARTING FULL SQLITE PERSISTENCE VERIFICATION TEST SUITE");
  console.log("========================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // PART 1: DEAL / KANBAN PERSISTENCE
    // -------------------------------------------------------------
    console.log("--- PART 1: DEAL STAGE PERSISTENCE ---");

    // 1.1 Read deal-1
    const dealBefore = await dealStore.getById("deal-1");
    assert(dealBefore !== null, "deal-1 found in database");

    // 1.2 Move deal-1 to 'Won'
    console.log("  Moving deal-1 stage to 'Won'...");
    const updatedDeal = await dealStore.updateStage("deal-1", "Won");
    assert(
      updatedDeal && (updatedDeal.stage === "Closed Won" || updatedDeal.stage === "Won"),
      `dealStore.updateStage returned stage: ${updatedDeal?.stage}`
    );

    // 1.3 Verify directly in SQLite deals table
    const dbDealWon = await get(
      `SELECT d.id, d.stage_id, s.name as stage_name 
       FROM deals d 
       JOIN pipeline_stages s ON d.stage_id = s.id 
       WHERE d.id = 'deal-1'`
    );
    assert(dbDealWon && dbDealWon.stage_name === "Closed Won", `SQLite deals.stage_id maps directly to '${dbDealWon?.stage_name}'`);

    // 1.4 Test non-existent deal returns null / 404
    const nonExistent = await dealStore.updateStage("non-existent-id-999", "Won");
    assert(nonExistent === null, "Updating non-existent deal returned null (404 behavior)");

    // 1.5 Test invalid stage is rejected
    let invalidStageCaught = false;
    try {
      await dealStore.updateStage("deal-1", "CompletelyFakeStageXYZ");
    } catch (e) {
      invalidStageCaught = true;
    }
    assert(invalidStageCaught, "Invalid stage input correctly threw an error");

    // 1.6 Verify KPI stats mapping
    const stats = await dealStore.getStats();
    assert(stats.byStage["Won"] && stats.byStage["Won"].count >= 1, `KPI correctly mapped Closed Won to Won (count: ${stats.byStage["Won"].count})`);
    assert(stats.totalWonValue >= 45000, `KPI totalWonValue reflects the deal value: ₹${stats.totalWonValue}`);

    // -------------------------------------------------------------
    // PART 2: QUOTATION PERSISTENCE & TRANSACTIONS
    // -------------------------------------------------------------
    console.log("\n--- PART 2: QUOTATION PERSISTENCE ---");

    // 2.1 Customer validation: Empty/invalid customer rejected
    let emptyCustomerRejected = false;
    try {
      await quotationStore.create({
        customerId: "",
        items: [{ description: "Test Item", quantity: 1, unitPrice: 100, taxRate: 10 }]
      });
    } catch (e) {
      emptyCustomerRejected = true;
    }
    assert(emptyCustomerRejected, "Quotation creation without valid customer rejected");

    // 2.2 Create new quotation with multiple items
    const newQuote = await quotationStore.create({
      customerId: "cust-1",
      items: [
        { description: "Enterprise Cloud Hosting", quantity: 2, unitPrice: 15000, taxRate: 18 },
        { description: "DevOps Consulting Hours", quantity: 10, unitPrice: 2500, taxRate: 18 }
      ],
      status: "Draft",
      notes: "Annual infrastructure expansion proposal"
    });

    assert(newQuote && newQuote.id, `Created quotation in SQLite with canonical ID: ${newQuote?.id}`);
    assert(newQuote.items.length === 2, `Quotation returned with ${newQuote.items.length} items`);
    assert(newQuote.subtotal === 55000, `Calculated subtotal: ₹${newQuote.subtotal}`);
    assert(newQuote.grandTotal === 64900, `Calculated grand total (with 18% tax): ₹${newQuote.grandTotal}`);

    // 2.3 Verify directly in SQLite quotations and quotation_items
    const dbQuote = await get("SELECT * FROM quotations WHERE id = ?", [newQuote.id]);
    assert(dbQuote !== null, `Direct SQLite check: quotation row found (grand_total: ${dbQuote?.grand_total})`);

    const dbItems = await all("SELECT * FROM quotation_items WHERE quotation_id = ?", [newQuote.id]);
    assert(dbItems.length === 2, `Direct SQLite check: ${dbItems.length} line items linked via foreign key`);

    // 2.4 Status lifecycle: Draft -> Sent -> Accepted -> Declined
    console.log("  Testing status update lifecycle...");
    const sentQuote = await quotationStore.updateStatus(newQuote.id, "Sent");
    assert(sentQuote && sentQuote.status === "Sent", "Status updated to 'Sent'");
    const dbSent = await get("SELECT status FROM quotations WHERE id = ?", [newQuote.id]);
    assert(dbSent && dbSent.status === "Sent", "Direct SQLite check: status is 'Sent'");

    const acceptedQuote = await quotationStore.updateStatus(newQuote.id, "Accepted");
    assert(acceptedQuote && acceptedQuote.status === "Accepted", "Status updated to 'Accepted'");
    const dbAccepted = await get("SELECT status FROM quotations WHERE id = ?", [newQuote.id]);
    assert(dbAccepted && dbAccepted.status === "Accepted", "Direct SQLite check: status is 'Accepted'");

    const declinedQuote = await quotationStore.updateStatus(newQuote.id, "Declined");
    assert(declinedQuote && declinedQuote.status === "Declined", "Status updated to 'Declined'");
    const dbDeclined = await get("SELECT status FROM quotations WHERE id = ?", [newQuote.id]);
    assert(dbDeclined && dbDeclined.status === "Declined", "Direct SQLite check: status is 'Declined'");

    // 2.5 Verify compatibility lookup on existing quotes (quote-demo-001)
    const quoteDemoUpdated = await quotationStore.updateStatus("QT-1001", "Accepted");
    assert(quoteDemoUpdated !== null, "Compatibility lookup on QT-1001 resolved canonical SQLite quote");

    // -------------------------------------------------------------
    // PART 3: SUPPORT TICKET PERSISTENCE
    // -------------------------------------------------------------
    console.log("\n--- PART 3: SUPPORT TICKET PERSISTENCE ---");

    // 3.1 Create new support ticket
    const newTicket = await ticketStore.create({
      customerId: "cust-2",
      title: "API Gateway rate limit spikes during batch processing",
      description: "Observed HTTP 429 errors when sending batch sync requests exceeding 120 req/sec.",
      priority: "High",
      status: "Open",
      assignedTo: "Support Team"
    });

    assert(newTicket && newTicket.id, `Created support ticket with canonical ID: ${newTicket?.id} (${newTicket?.ticketNumber})`);

    // 3.2 Verify directly in SQLite tickets table
    const dbTicket = await get("SELECT * FROM tickets WHERE id = ?", [newTicket.id]);
    assert(dbTicket !== null && dbTicket.title === newTicket.title, "Direct SQLite check: ticket row verified in tickets table");

    // 3.3 Change ticket status
    const inProgressTicket = await ticketStore.updateStatus(newTicket.id, "In Progress");
    assert(inProgressTicket && inProgressTicket.status === "In Progress", "Ticket status updated to 'In Progress'");
    const dbTckStatus = await get("SELECT status FROM tickets WHERE id = ?", [newTicket.id]);
    assert(dbTckStatus && dbTckStatus.status === "In Progress", "Direct SQLite check: status is 'In Progress'");

    // 3.4 Add comment and verify ticket_comments
    const commentedTicket = await ticketStore.addComment(newTicket.id, {
      author: "DevOps Engineer",
      text: "Investigated gateway throughput; adjusted token bucket capacity to 200 req/sec."
    });
    assert(commentedTicket.comments.length >= 1, "Comment returned in ticket timeline");

    const dbComments = await all("SELECT * FROM ticket_comments WHERE ticket_id = ?", [newTicket.id]);
    assert(dbComments.length >= 1, `Direct SQLite check: comment verified in ticket_comments table (${dbComments[0].comment})`);

    // -------------------------------------------------------------
    // PART 4: CUSTOMER PERSISTENCE
    // -------------------------------------------------------------
    console.log("\n--- PART 4: CUSTOMER & CRM PERSISTENCE ---");

    const newContact = await customerStore.create({
      name: "Rohan Sharma",
      email: "rohan.sharma@tatasolutions.in",
      phone: "+91 98765 43210",
      company: "Tata Consultancy Services",
      type: "customer",
      status: "Active",
      notes: "Enterprise cloud transformation initiative"
    });
    assert(newContact && newContact.id, `Customer created with ID: ${newContact?.id}`);

    const dbCustCheck = await get("SELECT * FROM customers WHERE id = ?", [newContact.id]);
    assert(dbCustCheck !== null && dbCustCheck.name === "Rohan Sharma", "Direct SQLite check: Customer verified in customers table");

    // Verify contact can now be assigned to a new quotation
    const quoteForNewCust = await quotationStore.create({
      customerId: newContact.id,
      items: [{ description: "Consulting Retainer", quantity: 1, unitPrice: 20000, taxRate: 18 }],
      status: "Draft"
    });
    assert(quoteForNewCust !== null, `Quotation successfully created for new customer ${newContact.id} without foreign key error`);

    // Clean up temporary quote
    await quotationStore.delete(quoteForNewCust.id);

    console.log("\n========================================================");
    console.log(`PERSISTENCE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("========================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runPersistenceTests();
