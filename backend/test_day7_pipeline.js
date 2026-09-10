require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const { get, all, run } = require("./src/database/db");

const PORT = 5075; // Dedicated test port for Day 7

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: body });
        }
      });
    });

    req.on("error", (err) => reject(err));

    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
};

async function runDay7PipelineTests() {
  console.log("\n========================================================");
  console.log("STARTING DAY 7 PIPELINE BACKEND & AUDIT HISTORY TEST SUITE");
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

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));

  const runTimestamp = Date.now();
  let orgAId = null;
  let orgBId = null;
  let tokenA = null;
  let tokenB = null;
  let userAId = null;

  let custAId = null;
  let custBId = null;

  let deal1Id = null;
  let deal2Id = null;
  let deal3Id = null;
  let deal4Id = null;

  try {
    // -----------------------------------------------------------------
    // 1. SETTING UP TWO ISOLATED TENANT ORGANIZATIONS
    // -----------------------------------------------------------------
    console.log("--- 1. SETTING UP TWO ISOLATED TENANT ORGANIZATIONS ---");

    const signupA = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/auth/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      {
        name: "Admin Org A",
        email: `orgA_d7_${runTimestamp}@test.com`,
        password: "Password123!",
        organizationName: `Org A Pipeline Test ${runTimestamp}`
      }
    );
    assert(signupA.status === 201 && signupA.data.token, "Org A registered successfully with JWT");
    tokenA = signupA.data.token;
    orgAId = signupA.data.user.organizationId;
    userAId = signupA.data.user.id;

    const signupB = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/auth/signup",
        method: "POST",
        headers: { "Content-Type": "application/json" }
      },
      {
        name: "Admin Org B",
        email: `orgB_d7_${runTimestamp}@test.com`,
        password: "Password123!",
        organizationName: `Org B Pipeline Test ${runTimestamp}`
      }
    );
    assert(signupB.status === 201 && signupB.data.token, "Org B registered successfully with JWT");
    tokenB = signupB.data.token;
    orgBId = signupB.data.user.organizationId;

    assert(orgAId && orgBId && orgAId !== orgBId, "Org A and Org B have distinct unique tenant IDs");

    // Create client in Org A
    const custResA = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/crm/customers",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      {
        name: "Alpha Client",
        company: "Alpha Corp",
        email: `alpha_${runTimestamp}@test.com`
      }
    );
    assert(custResA.status === 201 && custResA.data.id, "Customer created in Org A");
    custAId = custResA.data.id;

    // Create client in Org B
    const custResB = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/crm/customers",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` }
      },
      {
        name: "Beta Client",
        company: "Beta Corp",
        email: `beta_${runTimestamp}@test.com`
      }
    );
    assert(custResB.status === 201 && custResB.data.id, "Customer created in Org B");
    custBId = custResB.data.id;

    // -----------------------------------------------------------------
    // 2. TESTING INPUT VALIDATION & CROSS-TENANT INTEGRITY ON CREATE DEAL
    // -----------------------------------------------------------------
    console.log("\n--- 2. TESTING INPUT VALIDATION ON POST /api/pipeline/deals ---");

    // Missing title
    const errTitle = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { value: 10000 }
    );
    assert(errTitle.status === 400, "Reject deal creation with missing title (400)");

    // Empty title
    const errEmptyTitle = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { title: "   ", value: 10000 }
    );
    assert(errEmptyTitle.status === 400, "Reject deal creation with whitespace-only title (400)");

    // Negative value
    const errNegVal = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { title: "Negative Deal", value: -500 }
    );
    assert(errNegVal.status === 400, "Reject deal creation with negative value (400)");

    // Cross-tenant reference rejection: Org A creating deal with Org B customer
    const errCrossTenant = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      {
        title: "Cross Tenant Deal",
        customerId: custBId,
        value: 15000
      }
    );
    assert(
      errCrossTenant.status === 400 || errCrossTenant.status === 404,
      "Reject deal referencing another organization's customer (400/404)"
    );

    // -----------------------------------------------------------------
    // 3. CREATE DEALS SUCCESS & SQLITE PERSISTENCE
    // -----------------------------------------------------------------
    console.log("\n--- 3. CREATE DEALS SUCCESS & SQLITE PERSISTENCE ---");

    // Deal 1: Lead In
    const createDeal1 = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      {
        title: "Alpha Cloud Modernization",
        customerId: custAId,
        value: 25000,
        stage: "Lead In",
        expectedCloseDate: "2026-10-15",
        notes: "Initial discovery call scheduled"
      }
    );
    assert(createDeal1.status === 201, "Deal 1 created with 201 Created");
    assert(createDeal1.data.id && createDeal1.data.id.startsWith("deal-"), "Deal 1 has generated deal ID");
    assert(createDeal1.data.value === 25000, "Deal 1 value is 25000");
    deal1Id = createDeal1.data.id;

    // Verify Deal 1 row directly in SQLite
    const dealRow = await get("SELECT * FROM deals WHERE id = ?", [deal1Id]);
    assert(dealRow !== null, "Deal 1 persisted in SQLite deals table");
    assert(dealRow.organization_id === orgAId, "Deal 1 in SQLite correctly stamped with Org A ID");
    assert(Number(dealRow.value) === 25000, "Deal 1 value in SQLite matches 25000");
    assert(dealRow.title === "Alpha Cloud Modernization", "Deal 1 title in SQLite matches");

    // Deal 2: Proposal Sent
    const createDeal2 = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      {
        title: "Alpha Security Suite Expansion",
        customerId: custAId,
        value: 50000,
        stage: "Proposal Sent"
      }
    );
    assert(createDeal2.status === 201, "Deal 2 created with Proposal Sent stage");
    deal2Id = createDeal2.data.id;

    // Deal 3: Closed Won
    const createDeal3 = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      {
        title: "Alpha Dedicated Support Contract",
        customerId: custAId,
        value: 75000,
        stage: "Closed Won"
      }
    );
    assert(createDeal3.status === 201, "Deal 3 created with Closed Won stage");
    deal3Id = createDeal3.data.id;

    // Deal 4: Closed Lost
    const createDeal4 = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals",
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      {
        title: "Alpha Legacy Migration",
        value: 12000,
        stage: "Closed Lost"
      }
    );
    assert(createDeal4.status === 201, "Deal 4 created with Closed Lost stage");
    deal4Id = createDeal4.data.id;

    // -----------------------------------------------------------------
    // 4. GET /api/pipeline/deals WITH PAGINATION & FILTERING
    // -----------------------------------------------------------------
    console.log("\n--- 4. GET /api/pipeline/deals WITH PAGINATION & FILTERING ---");

    // Invalid page parameter
    const errPage = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals?page=0",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(errPage.status === 400, "Reject invalid page parameter <= 0 (400)");

    // Invalid limit parameter
    const errLimit = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals?limit=200",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(errLimit.status === 400, "Reject limit parameter > 100 (400)");

    // Valid pagination request: page=1, limit=2
    const paginated1 = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals?page=1&limit=2",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(paginated1.status === 200, "Get deals with pagination returned 200 OK");
    assert(Array.isArray(paginated1.data.deals), "Response contains deals array");
    assert(paginated1.data.deals.length === 2, "Page 1 contains exactly 2 deals as requested by limit=2");
    assert(paginated1.data.pagination.total >= 4, "Pagination metadata reflects total count >= 4");
    assert(paginated1.data.pagination.page === 1, "Pagination metadata reflects current page 1");
    assert(paginated1.data.pagination.limit === 2, "Pagination metadata reflects limit 2");
    assert(paginated1.data.pagination.totalPages >= 2, "Pagination metadata reflects totalPages >= 2");
    assert(paginated1.data.pagination.hasNextPage === true, "hasNextPage is true on page 1");

    // Page 2 request: page=2, limit=2
    const paginated2 = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals?page=2&limit=2",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(paginated2.status === 200, "Page 2 returned 200 OK");
    assert(paginated2.data.pagination.page === 2, "Pagination metadata reflects current page 2");
    assert(paginated2.data.pagination.hasPrevPage === true, "hasPrevPage is true on page 2");

    // Filtering by stage
    const filterStage = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals?stage=Proposal%20Sent",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(filterStage.status === 200, "Filter by stage returned 200 OK");
    assert(filterStage.data.deals.length >= 1, "Filter by stage returned at least 1 deal");
    const allMatchStage = filterStage.data.deals.every((d) => d.stage === "Proposal Sent");
    assert(allMatchStage, "All filtered deals match requested stage 'Proposal Sent'");

    // Filtering by search
    const filterSearch = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals?search=Modernization",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(filterSearch.status === 200, "Search by deal title keyword returned 200 OK");
    assert(
      filterSearch.data.deals.some((d) => d.id === deal1Id),
      "Search results include Deal 1 (Alpha Cloud Modernization)"
    );

    // Multi-tenant isolation: Org B queries deals
    const orgBDeals = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(orgBDeals.status === 200, "Org B fetch deals returned 200 OK");
    assert(orgBDeals.data.deals.length === 0, "Org B sees 0 deals (cannot see Org A's deals)");

    // -----------------------------------------------------------------
    // 5. PATCH /api/pipeline/deals/:id/stage & DEAL STAGE HISTORY
    // -----------------------------------------------------------------
    console.log("\n--- 5. PATCH /api/pipeline/deals/:id/stage & DEAL HISTORY ---");

    // Rejection on missing stage
    const errNoStage = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: `/api/pipeline/deals/${deal1Id}/stage`,
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      {}
    );
    assert(errNoStage.status === 400, "Reject stage movement with missing stage body (400)");

    // Rejection on invalid stage
    const errFakeStage = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: `/api/pipeline/deals/${deal1Id}/stage`,
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { stage: "TotallyFakeNonExistentStage" }
    );
    assert(errFakeStage.status === 400, "Reject stage movement to non-existent stage (400)");

    // Rejection on non-existent deal ID
    const errNotFoundDeal = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: "/api/pipeline/deals/fake-deal-id-9999/stage",
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { stage: "Negotiation" }
    );
    assert(errNotFoundDeal.status === 404, "Reject stage movement on non-existent deal (404)");

    // Cross-tenant protection: Org B attempts to patch Org A's deal
    const errCrossPatch = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: `/api/pipeline/deals/${deal1Id}/stage`,
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` }
      },
      { stage: "Negotiation" }
    );
    assert(errCrossPatch.status === 404, "Org B cannot move Org A's deal (404 Not Found)");

    // Successful stage transition: Move Deal 1 to Negotiation
    const move1 = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: `/api/pipeline/deals/${deal1Id}/stage`,
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { stage: "Negotiation" }
    );
    assert(move1.status === 200, "Move deal stage returned 200 OK");
    assert(move1.data.stage === "Negotiation", "Deal stage in response is 'Negotiation'");

    // Verify in SQLite deals table
    const deal1Updated = await get(
      `SELECT d.*, s.name as stage_name
       FROM deals d
       LEFT JOIN pipeline_stages s ON d.stage_id = s.id
       WHERE d.id = ?`,
      [deal1Id]
    );
    assert(deal1Updated.stage_name === "Negotiation", "SQLite deals table reflects updated stage 'Negotiation'");

    // Verify deal history record in deal_stage_history table
    const historyRows1 = await all(
      "SELECT * FROM deal_stage_history WHERE deal_id = ? ORDER BY created_at ASC",
      [deal1Id]
    );
    assert(historyRows1.length === 1, "Exactly 1 deal history record created in SQLite");
    assert(historyRows1[0].from_stage_name === "Lead In", "History from_stage_name is 'Lead In'");
    assert(historyRows1[0].to_stage_name === "Negotiation", "History to_stage_name is 'Negotiation'");
    assert(historyRows1[0].organization_id === orgAId, "History record stamped with Org A ID");
    assert(historyRows1[0].user_id === userAId, "History record stamped with acting user ID");

    // Same-stage transition test: moving to same stage must NOT create duplicate history
    const moveSame = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: `/api/pipeline/deals/${deal1Id}/stage`,
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { stage: "Negotiation" }
    );
    assert(moveSame.status === 200, "Same-stage move returns 200 OK");
    const historyRowsSame = await all(
      "SELECT * FROM deal_stage_history WHERE deal_id = ?",
      [deal1Id]
    );
    assert(
      historyRowsSame.length === 1,
      "No duplicate history record created when moving to the same stage"
    );

    // Second valid transition: Move Deal 1 from Negotiation to Closed Won
    const move2 = await makeRequest(
      {
        hostname: "localhost",
        port: PORT,
        path: `/api/pipeline/deals/${deal1Id}/stage`,
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` }
      },
      { stage: "Closed Won" }
    );
    assert(move2.status === 200, "Second stage move to 'Closed Won' returned 200 OK");

    const historyRows2 = await all(
      "SELECT * FROM deal_stage_history WHERE deal_id = ? ORDER BY created_at ASC",
      [deal1Id]
    );
    assert(historyRows2.length === 2, "Second history record successfully created in SQLite");
    assert(historyRows2[1].from_stage_name === "Negotiation", "Second history from_stage is 'Negotiation'");
    assert(historyRows2[1].to_stage_name === "Closed Won", "Second history to_stage is 'Closed Won'");

    // Query deal history endpoint
    const historyRes = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: `/api/pipeline/deals/${deal1Id}/history`,
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(historyRes.status === 200, "GET /api/pipeline/deals/:id/history returned 200 OK");
    assert(Array.isArray(historyRes.data.history), "History response contains history array");
    assert(historyRes.data.history.length === 2, "Retrieved 2 history entries via API");

    // -----------------------------------------------------------------
    // 6. GET /api/pipeline/stats
    // -----------------------------------------------------------------
    console.log("\n--- 6. GET /api/pipeline/stats & TENANT ISOLATION ---");

    const statsA = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/stats",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(statsA.status === 200, "GET /api/pipeline/stats returned 200 OK");
    assert(statsA.data.totalDeals >= 4, "Stats totalDeals reflects created deals (>= 4)");
    assert(statsA.data.totalWonValue >= 100000, "Stats totalWonValue reflects Deal 3 + Deal 1 (>= 100000)");
    assert(statsA.data.stageCounts["Closed Won"] >= 2, "stageCounts for Closed Won reflects 2 won deals");
    assert(typeof statsA.data.winRate === "number", "winRate is calculated as a numeric percentage");

    // Test backward compatible alias /deals/stats
    const statsAlias = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/deals/stats",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(statsAlias.status === 200, "GET /api/pipeline/deals/stats (alias) returned 200 OK");
    assert(statsAlias.data.totalDeals === statsA.data.totalDeals, "Alias stats match canonical /stats");

    // Multi-tenant isolation: Org B queries stats
    const statsB = await makeRequest({
      hostname: "localhost",
      port: PORT,
      path: "/api/pipeline/stats",
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(statsB.status === 200, "Org B get stats returned 200 OK");
    assert(statsB.data.totalDeals === 0, "Org B totalDeals is 0 (isolated from Org A)");
    assert(statsB.data.totalValue === 0, "Org B totalValue is 0");

    // -----------------------------------------------------------------
    // 7. CLEANUP OF TEST ARTIFACTS
    // -----------------------------------------------------------------
    console.log("\n--- 7. CLEANING UP TEST ARTIFACTS ---");
    await run("DELETE FROM deal_stage_history WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM deals WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM customers WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM leads WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM users WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM organizations WHERE id IN (?, ?)", [orgAId, orgBId]);
    assert(true, "Test artifacts cleaned up successfully");

  } catch (err) {
    console.error("TEST SUITE RUNTIME ERROR:", err);
    failed++;
  } finally {
    server.close();
  }

  console.log("\n========================================================");
  console.log(`DAY 7 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDay7PipelineTests();
