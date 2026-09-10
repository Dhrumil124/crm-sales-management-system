/**
 * Day 6 Lead Management & Lead Notes Test Suite
 * Validates Lead CRUD, Validation, Pagination, Notes, Staff Assignment, SQLite Persistence, and Multi-Tenant Isolation.
 */

const { db, run, get, all } = require("./src/database/db");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const API_BASE = "http://localhost:5000/api";
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function request(endpoint, options = {}, token = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    // raw response
  }
  return { status: res.status, ok: res.ok, data };
}

async function runDay6Tests() {
  console.log("\n========================================================");
  console.log("STARTING DAY 6 LEAD MANAGEMENT & LEAD NOTES TEST SUITE");
  console.log("========================================================\n");

  const timestamp = Date.now();

  try {
    // -------------------------------------------------------------
    // SETUP: Register Two Distinct Tenant Organizations (Org A & Org B)
    // -------------------------------------------------------------
    console.log("--- 1. SETTING UP TWO ISOLATED TENANT ORGANIZATIONS ---");

    const orgASignup = await request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "Alice Recruiter",
        email: `alice-leads-${timestamp}@alpha.com`,
        password: "Password123!",
        organizationName: `Alpha Global Leads ${timestamp}`
      })
    });
    assert(orgASignup.status === 201, "Org A registered successfully");
    const tokenA = orgASignup.data.token;
    const userA = orgASignup.data.user;
    const orgAId = userA.organizationId;

    // Create a secondary staff user in Org A for assignment testing
    const staffAId = `user-staffA-${timestamp}`;
    await run(
      `INSERT INTO users (id, organization_id, name, email, password_hash, role, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffAId, orgAId, "Staff Alex", `alex-${timestamp}@alpha.com`, "dummy_hash", "user", new Date().toISOString()]
    );
    assert(true, "Staff member created within Org A for assignment test");

    const orgBSignup = await request("/auth/signup", {
      method: "POST",
      body: JSON.stringify({
        name: "Bob Competitor",
        email: `bob-leads-${timestamp}@beta.com`,
        password: "Password123!",
        organizationName: `Beta Leads Corp ${timestamp}`
      })
    });
    assert(orgBSignup.status === 201, "Org B registered successfully");
    const tokenB = orgBSignup.data.token;
    const userB = orgBSignup.data.user;
    const orgBId = userB.organizationId;

    assert(orgAId !== orgBId, "Org A and Org B have distinct unique tenant IDs");

    // -------------------------------------------------------------
    // TEST 2: Input Validation Tests on Lead Creation
    // -------------------------------------------------------------
    console.log("\n--- 2. TESTING INPUT VALIDATION ON LEAD CREATION ---");

    // Missing Name
    const resNoName = await request("/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        email: "noname@example.com"
      })
    }, tokenA);
    assert(resNoName.status === 400, "Reject Lead creation with missing name (400)");

    // Empty Name
    const resEmptyName = await request("/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "   ",
        email: "emptyname@example.com"
      })
    }, tokenA);
    assert(resEmptyName.status === 400, "Reject Lead creation with empty name string (400)");

    // Invalid Email
    const resInvalidEmail = await request("/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Lead",
        email: "not-an-email"
      })
    }, tokenA);
    assert(resInvalidEmail.status === 400, "Reject Lead creation with invalid email format (400)");

    // Invalid Status
    const resInvalidStatus = await request("/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Lead",
        status: "RandomStatus"
      })
    }, tokenA);
    assert(resInvalidStatus.status === 400, "Reject Lead creation with unallowed status enum (400)");

    // -------------------------------------------------------------
    // TEST 3: Create Lead Success & SQLite Persistence
    // -------------------------------------------------------------
    console.log("\n--- 3. CREATE LEAD SUCCESS & PERSISTENCE ---");

    const lead1Payload = {
      name: "Arthur Dent",
      email: "arthur@hitchhiker.org",
      phone: "+44 20 7946 0919",
      company: "Megadodo Publications",
      status: "New"
    };

    const resLead1 = await request("/crm/leads", {
      method: "POST",
      body: JSON.stringify(lead1Payload)
    }, tokenA);

    assert(resLead1.status === 201, "Lead created successfully with 201 Created");
    assert(resLead1.data && resLead1.data.id, "Lead returned with generated ID");
    assert(resLead1.data.name === "Arthur Dent", "Lead name matches payload");
    assert(resLead1.data.status === "New", "Lead status matches payload");
    const lead1Id = resLead1.data.id;

    // Verify directly in SQLite
    const sqliteLead1 = await get("SELECT * FROM leads WHERE id = ?", [lead1Id]);
    assert(sqliteLead1 !== null, "Lead row verified directly in SQLite leads table");
    assert(sqliteLead1.organization_id === orgAId, "Lead row in SQLite correctly stamped with Org A ID");
    assert(sqliteLead1.name === "Arthur Dent", "Lead name in SQLite matches");

    // Create additional leads in Org A for pagination testing
    const lead2Res = await request("/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Ford Prefect",
        email: "ford@betelgeuse.com",
        company: "Sub-Etha Sens-O-Matic",
        status: "Contacted"
      })
    }, tokenA);
    assert(lead2Res.status === 201, "Lead 2 created for Org A");
    const lead2Id = lead2Res.data.id;

    const lead3Res = await request("/crm/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Trillian Astra",
        email: "trillian@heartofgold.space",
        company: "Zaphod Industries",
        status: "Qualified"
      })
    }, tokenA);
    assert(lead3Res.status === 201, "Lead 3 created for Org A");
    const lead3Id = lead3Res.data.id;

    // -------------------------------------------------------------
    // TEST 4: Get Leads with Pagination & Filters
    // -------------------------------------------------------------
    console.log("\n--- 4. GET LEADS WITH PAGINATION & METADATA ---");

    // Invalid pagination parameters rejection
    const resBadPage = await request("/crm/leads?page=0", {}, tokenA);
    assert(resBadPage.status === 400, "Reject invalid page parameter <= 0 (400)");

    const resBadLimit = await request("/crm/leads?limit=500", {}, tokenA);
    assert(resBadLimit.status === 400, "Reject invalid limit parameter > 100 (400)");

    // Page 1 with limit 2
    const resP1 = await request("/crm/leads?page=1&limit=2", {}, tokenA);
    assert(resP1.status === 200, "Get leads with pagination returned 200 OK");
    assert(Array.isArray(resP1.data.leads), "Response contains leads array");
    assert(resP1.data.leads.length === 2, "Page 1 contains exactly 2 leads as requested by limit=2");
    assert(resP1.data.pagination && resP1.data.pagination.total >= 3, "Pagination metadata reflects total count >= 3");
    assert(resP1.data.pagination.page === 1, "Pagination metadata reflects current page 1");
    assert(resP1.data.pagination.limit === 2, "Pagination metadata reflects limit 2");
    assert(resP1.data.pagination.totalPages >= 2, "Pagination metadata reflects totalPages >= 2");
    assert(resP1.data.pagination.hasNextPage === true, "hasNextPage is true on page 1");

    // Filter by status
    const resFilter = await request("/crm/leads?status=Qualified", {}, tokenA);
    assert(resFilter.status === 200, "Filter by status returned 200 OK");
    assert(resFilter.data.leads.every(l => l.status === "Qualified"), "All returned leads match requested status 'Qualified'");

    // -------------------------------------------------------------
    // TEST 5: Get Lead by ID
    // -------------------------------------------------------------
    console.log("\n--- 5. GET LEAD BY ID ---");

    const resGet1 = await request(`/crm/leads/${lead1Id}`, {}, tokenA);
    assert(resGet1.status === 200, "Get lead by ID returned 200 OK");
    assert(resGet1.data.id === lead1Id, "Returned lead ID matches requested ID");

    const resGetNonExistent = await request("/crm/leads/lead-non-existent-9999", {}, tokenA);
    assert(resGetNonExistent.status === 404, "Get non-existent lead returns 404 Not Found");

    // -------------------------------------------------------------
    // TEST 6: Update Lead
    // -------------------------------------------------------------
    console.log("\n--- 6. UPDATE LEAD ---");

    // Empty update rejected
    const resEmptyUpdate = await request(`/crm/leads/${lead1Id}`, {
      method: "PATCH",
      body: JSON.stringify({})
    }, tokenA);
    assert(resEmptyUpdate.status === 400, "Reject empty update body (400)");

    // Invalid status update rejected
    const resBadStatusUpdate = await request(`/crm/leads/${lead1Id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "BogusStatus" })
    }, tokenA);
    assert(resBadStatusUpdate.status === 400, "Reject update with invalid status (400)");

    // Valid update
    const resUpdate = await request(`/crm/leads/${lead1Id}`, {
      method: "PATCH",
      body: JSON.stringify({
        company: "Megadodo Galactic Media",
        status: "Contacted"
      })
    }, tokenA);
    assert(resUpdate.status === 200, "Lead update returned 200 OK");
    assert(resUpdate.data.company === "Megadodo Galactic Media", "Updated company reflected in API response");
    assert(resUpdate.data.status === "Contacted", "Updated status reflected in API response");

    // Verify in SQLite
    const sqliteUpdated = await get("SELECT company, status FROM leads WHERE id = ?", [lead1Id]);
    assert(sqliteUpdated.company === "Megadodo Galactic Media", "Updated company verified in SQLite");
    assert(sqliteUpdated.status === "Contacted", "Updated status verified in SQLite");

    // -------------------------------------------------------------
    // TEST 7: Assign Lead (Same-Org vs Cross-Org)
    // -------------------------------------------------------------
    console.log("\n--- 7. LEAD ASSIGNMENT ---");

    // Missing assignedTo rejected
    const resAssignEmpty = await request(`/crm/leads/${lead1Id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({})
    }, tokenA);
    assert(resAssignEmpty.status === 400, "Reject assignment with missing target user (400)");

    // Assigning user from DIFFERENT organization rejected
    const resAssignCrossOrg = await request(`/crm/leads/${lead1Id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: userB.id })
    }, tokenA);
    assert(resAssignCrossOrg.status === 400, "Reject assigning lead to user from another organization (400)");

    // Assigning non-existent user rejected
    const resAssignNonExistent = await request(`/crm/leads/${lead1Id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: "user-phantom-9999" })
    }, tokenA);
    assert(resAssignNonExistent.status === 400, "Reject assigning lead to non-existent user (400)");

    // Assigning to user in SAME organization succeeds
    const resAssignValid = await request(`/crm/leads/${lead1Id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: staffAId })
    }, tokenA);
    assert(resAssignValid.status === 200, "Assign lead to same-org user returned 200 OK");
    assert(resAssignValid.data.assignedTo && resAssignValid.data.assignedTo.id === staffAId, "Assigned user reflected in API response");

    // Verify in SQLite
    const sqliteAssigned = await get("SELECT assigned_to FROM leads WHERE id = ?", [lead1Id]);
    assert(sqliteAssigned.assigned_to === staffAId, "assigned_to column in SQLite reflects target user ID");

    // -------------------------------------------------------------
    // TEST 8: Lead Notes Lifecycle
    // -------------------------------------------------------------
    console.log("\n--- 8. LEAD NOTES (CREATE & RETRIEVE) ---");

    // Empty note content rejected
    const resBadNote = await request(`/crm/leads/${lead1Id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content: "   " })
    }, tokenA);
    assert(resBadNote.status === 400, "Reject empty note content (400)");

    // Note for non-existent lead rejected
    const resNoteNonExistent = await request("/crm/leads/lead-non-existent-9999/notes", {
      method: "POST",
      body: JSON.stringify({ content: "Sample note" })
    }, tokenA);
    assert(resNoteNonExistent.status === 404, "Reject adding note to non-existent lead (404)");

    // Valid note creation
    const resNote1 = await request(`/crm/leads/${lead1Id}/notes`, {
      method: "POST",
      body: JSON.stringify({
        content: "Spoke with Arthur regarding towel inventory supply chains."
      })
    }, tokenA);
    assert(resNote1.status === 201, "Add lead note returned 201 Created");
    assert(resNote1.data && resNote1.data.content.includes("Arthur"), "Note content matches");
    assert(resNote1.data.author && resNote1.data.author.id === userA.id, "Note author correctly linked to authenticated user");
    const note1Id = resNote1.data.id;

    // Verify directly in SQLite lead_notes table
    const sqliteNote = await get("SELECT * FROM lead_notes WHERE id = ?", [note1Id]);
    assert(sqliteNote !== null, "Note row verified in SQLite lead_notes table");
    assert(sqliteNote.lead_id === lead1Id, "Note is linked to lead in SQLite");
    assert(sqliteNote.author_id === userA.id, "Note author_id matches in SQLite");

    // Add a second note
    await request(`/crm/leads/${lead1Id}/notes`, {
      method: "POST",
      body: JSON.stringify({
        content: "Follow-up meeting scheduled for next Tuesday."
      })
    }, tokenA);

    // Retrieve notes for lead
    const resGetNotes = await request(`/crm/leads/${lead1Id}/notes`, {}, tokenA);
    assert(resGetNotes.status === 200, "Get lead notes returned 200 OK");
    assert(Array.isArray(resGetNotes.data) && resGetNotes.data.length === 2, "Retrieved exactly 2 notes for the lead");

    // -------------------------------------------------------------
    // TEST 9: Multi-Tenant Isolation (Org B CANNOT access Org A's Lead)
    // -------------------------------------------------------------
    console.log("\n--- 9. MULTI-TENANT ISOLATION (ORG B vs ORG A) ---");

    // Org B cannot see Org A's leads in list
    const resBList = await request("/crm/leads", {}, tokenB);
    assert(resBList.status === 200, "Org B list leads succeeded (200)");
    assert(resBList.data.leads.length === 0, "Org B sees 0 leads (cannot see Org A's leads)");

    // Org B direct GET returns 404
    const resBGet = await request(`/crm/leads/${lead1Id}`, {}, tokenB);
    assert(resBGet.status === 404, "Org B cannot GET Org A's lead by ID (404 Not Found)");

    // Org B direct PATCH returns 404
    const resBPatch = await request(`/crm/leads/${lead1Id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "Hacked by Org B" })
    }, tokenB);
    assert(resBPatch.status === 404, "Org B cannot PATCH Org A's lead (404 Not Found)");

    // Org B direct DELETE returns 404
    const resBDelete = await request(`/crm/leads/${lead1Id}`, {
      method: "DELETE"
    }, tokenB);
    assert(resBDelete.status === 404, "Org B cannot DELETE Org A's lead (404 Not Found)");

    // Org B cannot post note to Org A's lead
    const resBAddNote = await request(`/crm/leads/${lead1Id}/notes`, {
      method: "POST",
      body: JSON.stringify({ content: "Malicious note" })
    }, tokenB);
    assert(resBAddNote.status === 404, "Org B cannot add note to Org A's lead (404 Not Found)");

    // Org B cannot get notes for Org A's lead
    const resBGetNotes = await request(`/crm/leads/${lead1Id}/notes`, {}, tokenB);
    assert(resBGetNotes.status === 404, "Org B cannot get notes for Org A's lead (404 Not Found)");

    // Org B cannot assign Org A's lead
    const resBAssign = await request(`/crm/leads/${lead1Id}/assign`, {
      method: "PATCH",
      body: JSON.stringify({ assignedTo: userB.id })
    }, tokenB);
    assert(resBAssign.status === 404, "Org B cannot assign Org A's lead (404 Not Found)");

    // -------------------------------------------------------------
    // TEST 10: Delete Lead & Cascading Deletion of Notes
    // -------------------------------------------------------------
    console.log("\n--- 10. DELETE LEAD & CASCADING DELETION ---");

    const resDelete = await request(`/crm/leads/${lead1Id}`, {
      method: "DELETE"
    }, tokenA);
    assert(resDelete.status === 200, "Org A deleted lead1 successfully (200 OK)");

    // Verify lead row removed from SQLite
    const sqliteCheckLead = await get("SELECT id FROM leads WHERE id = ?", [lead1Id]);
    assert(sqliteCheckLead === null, "Lead row confirmed deleted from SQLite");

    // Verify linked notes were cascade-deleted by SQLite foreign key ON DELETE CASCADE
    const sqliteCheckNotes = await all("SELECT id FROM lead_notes WHERE lead_id = ?", [lead1Id]);
    assert(sqliteCheckNotes.length === 0, "Linked notes in lead_notes cascade-deleted automatically in SQLite");

    // Deleting already deleted lead returns 404
    const resDeleteAgain = await request(`/crm/leads/${lead1Id}`, {
      method: "DELETE"
    }, tokenA);
    assert(resDeleteAgain.status === 404, "Deleting non-existent lead returns 404 Not Found");

    // -------------------------------------------------------------
    // CLEANUP TEST ARTIFACTS
    // -------------------------------------------------------------
    console.log("\n--- 11. CLEANING UP TEST ARTIFACTS ---");
    await run("DELETE FROM leads WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM users WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM organizations WHERE id IN (?, ?)", [orgAId, orgBId]);
    console.log("  ✓ Test artifacts cleaned up successfully");

    console.log("\n========================================================");
    console.log(`DAY 6 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("========================================================\n");

  } catch (error) {
    console.error("\nUnexpected error during Day 6 test execution:", error);
    process.exit(1);
  }
}

runDay6Tests().then(() => {
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
});
