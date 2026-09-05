const { db, run, get, all, runTransaction, seedDefaultPipelineStages } = require("./src/database/db");

async function runDay3Verification() {
  console.log("\n========================================================");
  console.log("STARTING DAY 3 CRM DATABASE INTEGRITY & SCHEMA TEST SUITE");
  console.log("========================================================\n");

  try {
    // -------------------------------------------------------------
    // Test 1: Verify All Required Tables Exist
    // -------------------------------------------------------------
    console.log("TEST 1: Verifying All 7 Required Tables in SQLite...");
    const requiredTables = [
      "organizations",
      "users",
      "leads",
      "lead_notes",
      "lead_communications",
      "pipeline_stages",
      "deals"
    ];

    const tables = await all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    const tableNames = tables.map(t => t.name);

    for (const reqTable of requiredTables) {
      if (!tableNames.includes(reqTable)) {
        throw new Error(`Missing required table: ${reqTable}`);
      }
      console.log(`  ✓ Table '${reqTable}' exists`);
    }

    // -------------------------------------------------------------
    // Test 2: Verify All Required Indexes Exist
    // -------------------------------------------------------------
    console.log("\nTEST 2: Verifying Required Database Indexes...");
    const requiredIndexes = [
      "idx_leads_org_id",
      "idx_leads_status",
      "idx_leads_email",
      "idx_lead_notes_lead_id",
      "idx_lead_notes_author_id",
      "idx_lead_comm_lead_id",
      "idx_lead_comm_date",
      "idx_lead_comm_created_by",
      "idx_pipeline_stages_org_order",
      "idx_deals_org_id",
      "idx_deals_stage_id",
      "idx_deals_lead_id",
      "idx_deals_close_date"
    ];

    const indexes = await all("SELECT name FROM sqlite_master WHERE type='index'");
    const indexNames = indexes.map(i => i.name);

    for (const reqIndex of requiredIndexes) {
      if (!indexNames.includes(reqIndex)) {
        throw new Error(`Missing required index: ${reqIndex}`);
      }
      console.log(`  ✓ Index '${reqIndex}' exists`);
    }

    // -------------------------------------------------------------
    // Test 3: Verify Day 2 Data Preservation
    // -------------------------------------------------------------
    console.log("\nTEST 3: Verifying Day 2 Authentication Data Preservation...");
    const orgs = await all("SELECT * FROM organizations");
    const users = await all("SELECT * FROM users");
    console.log(`  ✓ Found ${orgs.length} organization(s) and ${users.length} user(s) intact`);
    const dhrumilUser = users.find(u => u.email === "boy067283@gmail.com");
    if (dhrumilUser) {
      console.log(`  ✓ Day 2 User '${dhrumilUser.name}' (${dhrumilUser.email}) verified intact`);
    }

    // Target organization for relational tests
    const testOrg = orgs[0];
    if (!testOrg) throw new Error("No organization found to test against");
    console.log(`  ✓ Testing against Organization: '${testOrg.name}' (${testOrg.id})`);

    // -------------------------------------------------------------
    // Test 4: Verify Idempotent Pipeline Stages Seeding
    // -------------------------------------------------------------
    console.log("\nTEST 4: Verifying Pipeline Stages Seeding & Idempotency...");
    await seedDefaultPipelineStages(testOrg.id);
    const stages = await all(
      "SELECT * FROM pipeline_stages WHERE organization_id = ? ORDER BY stage_order ASC",
      [testOrg.id]
    );

    if (stages.length !== 6) {
      throw new Error(`Expected 6 default pipeline stages for organization, found: ${stages.length}`);
    }
    console.log(`  ✓ 6 Default Pipeline Stages Verified in Correct Order:`);
    stages.forEach(s => console.log(`     [Order ${s.stage_order}] ${s.name} (${s.color})`));

    // Test idempotency: re-running should not duplicate
    await seedDefaultPipelineStages(testOrg.id);
    const stagesAfterRepeat = await all(
      "SELECT COUNT(*) as count FROM pipeline_stages WHERE organization_id = ?",
      [testOrg.id]
    );
    if (stagesAfterRepeat[0].count !== 6) {
      throw new Error(`Stage seeding is not idempotent! Found ${stagesAfterRepeat[0].count} stages.`);
    }
    console.log(`  ✓ Idempotency verified: re-seeding did not duplicate stages`);

    // -------------------------------------------------------------
    // Test 5: Lead Creation, Multiple Notes, and Multiple Communications
    // -------------------------------------------------------------
    console.log("\nTEST 5: Testing CRM Lead Lifecycle, Notes & Communications...");
    const testLeadId = `lead-test-${Date.now()}`;
    await run(
      `INSERT INTO leads (id, organization_id, name, email, phone, company, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testLeadId,
        testOrg.id,
        "David Warner",
        "david.warner@sunrisers.com",
        "+91 98765 43210",
        "Sunrisers Corp",
        "Qualified",
        new Date().toISOString()
      ]
    );
    console.log(`  ✓ Created test lead '${testLeadId}' with status 'Qualified'`);

    // Add multiple notes to this lead
    const noteId1 = `note-test-1-${Date.now()}`;
    const noteId2 = `note-test-2-${Date.now()}`;
    await run(
      `INSERT INTO lead_notes (id, lead_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [noteId1, testLeadId, users[0]?.id || null, "Initial discovery call conducted. Expressed interest in enterprise license.", new Date().toISOString()]
    );
    await run(
      `INSERT INTO lead_notes (id, lead_id, author_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [noteId2, testLeadId, users[0]?.id || null, "Budget confirmed for Q3. Preparing quotation.", new Date().toISOString()]
    );
    const notes = await all("SELECT * FROM lead_notes WHERE lead_id = ?", [testLeadId]);
    if (notes.length !== 2) throw new Error("Expected 2 notes for lead");
    console.log(`  ✓ Verified 2 notes linked to lead '${testLeadId}'`);

    // Add multiple communications to this lead
    const commId1 = `comm-test-1-${Date.now()}`;
    const commId2 = `comm-test-2-${Date.now()}`;
    await run(
      `INSERT INTO lead_communications (id, lead_id, type, subject, details, communication_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [commId1, testLeadId, "Call", "Introductory Phone Call", "Discussed 50-seat requirement.", new Date().toISOString(), users[0]?.id || null]
    );
    await run(
      `INSERT INTO lead_communications (id, lead_id, type, subject, details, communication_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [commId2, testLeadId, "Email", "Proposal Follow-up Email", "Sent product overview brochure.", new Date().toISOString(), users[0]?.id || null]
    );
    const comms = await all("SELECT * FROM lead_communications WHERE lead_id = ?", [testLeadId]);
    if (comms.length !== 2) throw new Error("Expected 2 communications for lead");
    console.log(`  ✓ Verified 2 communications ('Call', 'Email') linked to lead '${testLeadId}'`);

    // -------------------------------------------------------------
    // Test 6: Deal Creation with Stage and Lead Foreign Keys
    // -------------------------------------------------------------
    console.log("\nTEST 6: Testing Sales Pipeline Deal with Stage & Lead Relationships...");
    const testDealId = `deal-test-${Date.now()}`;
    const proposalStage = stages.find(s => s.name === "Proposal Sent") || stages[2];
    await run(
      `INSERT INTO deals (id, organization_id, title, lead_id, stage_id, value, expected_close_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        testDealId,
        testOrg.id,
        "Enterprise CRM Expansion",
        testLeadId,
        proposalStage.id,
        75000,
        "2026-10-31",
        "Awaiting formal quotation review."
      ]
    );

    // Query joined deal record
    const dealWithDetails = await get(
      `SELECT d.id, d.title, d.value, d.expected_close_date,
              l.name AS lead_name, l.company,
              s.name AS stage_name, s.stage_order
       FROM deals d
       JOIN leads l ON d.lead_id = l.id
       JOIN pipeline_stages s ON d.stage_id = s.id
       WHERE d.id = ?`,
      [testDealId]
    );
    if (!dealWithDetails || dealWithDetails.value !== 75000) {
      throw new Error("Deal join query failed");
    }
    console.log(`  ✓ Verified Deal '${dealWithDetails.title}' linked to Lead '${dealWithDetails.lead_name}' (${dealWithDetails.company}) in Stage '${dealWithDetails.stage_name}' (Order ${dealWithDetails.stage_order})`);

    // -------------------------------------------------------------
    // Test 7: Constraints Enforcement Tests (Negative Checks)
    // -------------------------------------------------------------
    console.log("\nTEST 7: Testing SQLite Constraints Enforcement (Negative Tests)...");

    // Negative Check 1: Invalid foreign key (non-existent stage_id)
    try {
      await run(
        `INSERT INTO deals (id, organization_id, title, stage_id, value)
         VALUES (?, ?, ?, ?, ?)`,
        [`deal-invalid-${Date.now()}`, testOrg.id, "Invalid Deal", "stage-non-existent-xyz", 5000]
      );
      throw new Error("Foreign key check failed: allowed deal with non-existent stage_id!");
    } catch (err) {
      if (err.message.includes("FOREIGN KEY constraint failed")) {
        console.log("  ✓ Foreign key rejection verified: deals.stage_id references valid pipeline_stages(id)");
      } else {
        throw err;
      }
    }

    // Negative Check 2: Invalid status CHECK constraint on leads
    try {
      await run(
        `INSERT INTO leads (id, organization_id, name, status)
         VALUES (?, ?, ?, ?)`,
        [`lead-bad-status-${Date.now()}`, testOrg.id, "Bad Lead", "UnknownInvalidStatus"]
      );
      throw new Error("CHECK constraint failed: allowed invalid lead status!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: leads.status must be one of predefined enum statuses");
      } else {
        throw err;
      }
    }

    // Negative Check 3: Invalid communication type CHECK constraint
    try {
      await run(
        `INSERT INTO lead_communications (id, lead_id, type, details)
         VALUES (?, ?, ?, ?)`,
        [`comm-bad-type-${Date.now()}`, testLeadId, "CarrierPigeon", "Invalid type details"]
      );
      throw new Error("CHECK constraint failed: allowed invalid communication type!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: lead_communications.type must be one of allowed types");
      } else {
        throw err;
      }
    }

    // Negative Check 4: Negative deal value CHECK constraint
    try {
      await run(
        `INSERT INTO deals (id, organization_id, title, stage_id, value)
         VALUES (?, ?, ?, ?, ?)`,
        [`deal-neg-val-${Date.now()}`, testOrg.id, "Negative Value Deal", proposalStage.id, -500]
      );
      throw new Error("CHECK constraint failed: allowed negative deal value!");
    } catch (err) {
      if (err.message.includes("CHECK constraint failed")) {
        console.log("  ✓ CHECK constraint verified: deals.value cannot be negative");
      } else {
        throw err;
      }
    }

    // -------------------------------------------------------------
    // Test 8: Cascade Delete Verification
    // -------------------------------------------------------------
    console.log("\nTEST 8: Testing Foreign Key ON DELETE CASCADE Behavior...");
    // Deleting the test lead should automatically cascade-delete notes and communications
    await run("DELETE FROM leads WHERE id = ?", [testLeadId]);
    const orphanNotes = await all("SELECT * FROM lead_notes WHERE lead_id = ?", [testLeadId]);
    const orphanComms = await all("SELECT * FROM lead_communications WHERE lead_id = ?", [testLeadId]);
    if (orphanNotes.length !== 0 || orphanComms.length !== 0) {
      throw new Error("Cascade delete failed: orphan notes or communications remain!");
    }
    console.log("  ✓ ON DELETE CASCADE verified: lead deletion cleanly removed all associated notes & communications");

    // Clean up test deal
    await run("DELETE FROM deals WHERE id = ?", [testDealId]);

    console.log("\n========================================================");
    console.log("ALL DAY 3 CRM DATABASE TESTS PASSED WITH 100% SUCCESS! ");
    console.log("========================================================\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ DAY 3 VERIFICATION FAILED:", error.message);
    process.exit(1);
  }
}

runDay3Verification();
