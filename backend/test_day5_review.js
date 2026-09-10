require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const { get, all } = require("./src/database/db");

const PORT = 5065; // Dedicated test port for Day 5 review

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

async function runDay5ReviewTests() {
  console.log("\n========================================================");
  console.log("STARTING DAY 5 REVIEW & MULTI-TENANT ISOLATION TEST SUITE");
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

  const server = app.listen(PORT, async () => {
    try {
      // ------------------------------------------------------------------
      // STEP 1: AUTHENTICATION & MULTI-TENANT SETUP
      // ------------------------------------------------------------------
      console.log("--- 1. REGISTERING TWO DISTINCT ORGANIZATIONS ---");

      const timestamp = Date.now();
      const orgAEmail = `orgA-${timestamp}@acme.com`;
      const orgBEmail = `orgB-${timestamp}@globex.com`;

      const regA = await makeRequest(
        { hostname: "localhost", port: PORT, path: "/api/auth/signup", method: "POST", headers: { "Content-Type": "application/json" } },
        { name: "Alice Admin", email: orgAEmail, password: "password123", organizationName: "Organization Alpha" }
      );
      assert(regA.status === 201 && regA.data.token, "Org A registered successfully with JWT");
      const tokenA = regA.data.token;
      const orgAId = regA.data.user.organizationId;

      const regB = await makeRequest(
        { hostname: "localhost", port: PORT, path: "/api/auth/signup", method: "POST", headers: { "Content-Type": "application/json" } },
        { name: "Bob Admin", email: orgBEmail, password: "password123", organizationName: "Organization Beta" }
      );
      assert(regB.status === 201 && regB.data.token, "Org B registered successfully with JWT");
      const tokenB = regB.data.token;
      const orgBId = regB.data.user.organizationId;

      assert(orgAId !== orgBId, "Organizations have distinct unique IDs");

      // ------------------------------------------------------------------
      // STEP 2: ORG A CREATES RECORDS (CRM, DEAL, QUOTE, TICKET)
      // ------------------------------------------------------------------
      console.log("\n--- 2. ORG A CREATES CRM, DEAL, QUOTE, AND TICKET ---");

      // 2.1 CRM Customer
      const custRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: "/api/crm/customers", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        { name: "Alpha Client Corp", email: "contact@alphaclient.com", company: "Alpha Client", type: "customer", status: "Active" }
      );
      assert(custRes.status === 201 && custRes.data.id, `Org A created customer (${custRes.data.name})`);
      const custAId = custRes.data.id;

      // 2.2 Deal
      const dealRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: "/api/pipeline/deals", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        { title: "Alpha Enterprise Expansion", customerId: custAId, value: 85000, stage: "Negotiation", notes: "High value expansion contract" }
      );
      assert(dealRes.status === 201 && dealRes.data.id, `Org A created deal (${dealRes.data.title}) in Negotiation`);
      const dealAId = dealRes.data.id;

      // 2.3 Quotation
      const quoteRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        {
          customerId: custAId,
          items: [
            { description: "Platform License", quantity: 5, unitPrice: 10000, taxRate: 18 }
          ],
          status: "Draft"
        }
      );
      assert(quoteRes.status === 201 && quoteRes.data.id, `Org A created quotation (${quoteRes.data.quoteNumber})`);
      const quoteAId = quoteRes.data.id;

      // 2.4 Ticket
      const ticketRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: "/api/tickets", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        { title: "Network Latency Report", description: "Packet loss observed on primary router", priority: "High", customerId: custAId }
      );
      assert(ticketRes.status === 201 && ticketRes.data.id, `Org A created ticket (${ticketRes.data.ticketNumber})`);
      const ticketAId = ticketRes.data.id;

      // ------------------------------------------------------------------
      // STEP 3: STRICT MULTI-TENANT ISOLATION VERIFICATION (ORG B PERSPECTIVE)
      // ------------------------------------------------------------------
      console.log("\n--- 3. VERIFYING ORG B CANNOT ACCESS ORG A RECORDS ---");

      // 3.1 Org B queries customers
      const orgBCustomers = await makeRequest({
        hostname: "localhost", port: PORT, path: "/api/crm/customers", method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(orgBCustomers.status === 200, "Org B fetch customers succeeded with 200");
      const bCustFound = orgBCustomers.data.find(c => c.id === custAId);
      assert(!bCustFound, "Org B CANNOT see Org A's customer in customer list");

      // 3.2 Org B queries deals
      const orgBDeals = await makeRequest({
        hostname: "localhost", port: PORT, path: "/api/pipeline/deals", method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(orgBDeals.status === 200, "Org B fetch deals succeeded with 200");
      const bDealFound = orgBDeals.data.find(d => d.id === dealAId);
      assert(!bDealFound, "Org B CANNOT see Org A's deal in deals list");

      // 3.3 Org B queries quotations
      const orgBQuotes = await makeRequest({
        hostname: "localhost", port: PORT, path: "/api/quotations", method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(orgBQuotes.status === 200, "Org B fetch quotations succeeded with 200");
      const bQuoteFound = orgBQuotes.data.find(q => q.id === quoteAId);
      assert(!bQuoteFound, "Org B CANNOT see Org A's quotation in quotations list");

      // 3.4 Org B queries tickets
      const orgBTickets = await makeRequest({
        hostname: "localhost", port: PORT, path: "/api/tickets", method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(orgBTickets.status === 200, "Org B fetch tickets succeeded with 200");
      const bTicketFound = orgBTickets.data.find(t => t.id === ticketAId);
      assert(!bTicketFound, "Org B CANNOT see Org A's ticket in tickets list");

      // 3.5 Org B direct ID lookups should return 404
      const orgBGetDeal = await makeRequest({
        hostname: "localhost", port: PORT, path: `/api/pipeline/deals/${dealAId}`, method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(orgBGetDeal.status === 404, "Org B direct GET on Org A deal returns 404 Not Found");

      const orgBGetQuote = await makeRequest({
        hostname: "localhost", port: PORT, path: `/api/quotations/${quoteAId}`, method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(orgBGetQuote.status === 404, "Org B direct GET on Org A quotation returns 404 Not Found");

      const orgBGetTicket = await makeRequest({
        hostname: "localhost", port: PORT, path: `/api/tickets/${ticketAId}`, method: "GET",
        headers: { Authorization: `Bearer ${tokenB}` }
      });
      assert(orgBGetTicket.status === 404, "Org B direct GET on Org A ticket returns 404 Not Found");

      // 3.6 Org B trying to create quotation referencing Org A's customer rejected
      const orgBCrossQuote = await makeRequest(
        { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` } },
        { customerId: custAId, items: [{ description: "Unauthorized Line Item", quantity: 1, unitPrice: 500, taxRate: 18 }] }
      );
      assert(orgBCrossQuote.status === 400, "Org B creating quotation for Org A's client rejected with 400");

      // ------------------------------------------------------------------
      // STEP 4: DEAL STAGE PERSISTENCE (Negotiation -> Closed Won & Closed Lost)
      // ------------------------------------------------------------------
      console.log("\n--- 4. DEAL STAGE PERSISTENCE VERIFICATION ---");

      // 4.1 Negotiation -> Closed Won
      console.log("  Transitioning deal to 'Won' / 'Closed Won'...");
      const wonRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: `/api/pipeline/deals/${dealAId}/stage`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        { stage: "Won" }
      );
      assert(wonRes.status === 200, "API stage transition to 'Won' succeeded");
      assert(wonRes.data.stage === "Closed Won" || wonRes.data.stage === "Won", `Returned stage: ${wonRes.data.stage}`);

      // Verify directly in SQLite
      const dbDealWon = await get(
        `SELECT d.id, s.name as stage_name FROM deals d JOIN pipeline_stages s ON d.stage_id = s.id WHERE d.id = ?`,
        [dealAId]
      );
      assert(dbDealWon && dbDealWon.stage_name === "Closed Won", `SQLite deals row reflects stage 'Closed Won' directly`);

      // 4.2 Move to 'Closed Lost'
      console.log("  Transitioning deal to 'Lost' / 'Closed Lost'...");
      const lostRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: `/api/pipeline/deals/${dealAId}/stage`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        { stage: "Lost" }
      );
      assert(lostRes.status === 200, "API stage transition to 'Lost' succeeded");

      // Verify directly in SQLite
      const dbDealLost = await get(
        `SELECT d.id, s.name as stage_name FROM deals d JOIN pipeline_stages s ON d.stage_id = s.id WHERE d.id = ?`,
        [dealAId]
      );
      assert(dbDealLost && dbDealLost.stage_name === "Closed Lost", `SQLite deals row reflects stage 'Closed Lost' directly`);

      // ------------------------------------------------------------------
      // STEP 5: QUOTATION LIFECYCLE & STATUS PERSISTENCE
      // ------------------------------------------------------------------
      console.log("\n--- 5. QUOTATION LIFECYCLE & STATUS PERSISTENCE ---");

      // Test statuses: Sent, Accepted, Declined
      const statuses = ["Sent", "Accepted", "Declined"];
      for (const st of statuses) {
        const updateStRes = await makeRequest(
          { hostname: "localhost", port: PORT, path: `/api/quotations/${quoteAId}/status`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
          { status: st }
        );
        assert(updateStRes.status === 200 && updateStRes.data.status === st, `API updated quotation status to '${st}'`);

        // Check directly in SQLite
        const dbQuote = await get("SELECT id, status FROM quotations WHERE id = ?", [quoteAId]);
        assert(dbQuote && dbQuote.status === st, `SQLite quotations table persisted status '${st}'`);
      }

      // Check financial totals in SQLite
      const dbQuoteTotals = await get("SELECT subtotal, tax_total, grand_total FROM quotations WHERE id = ?", [quoteAId]);
      assert(Number(dbQuoteTotals.subtotal) === 50000, `Quotation subtotal verified in SQLite: ₹${dbQuoteTotals.subtotal}`);
      assert(Number(dbQuoteTotals.tax_total) === 9000, `Quotation tax_total verified in SQLite (18%): ₹${dbQuoteTotals.tax_total}`);
      assert(Number(dbQuoteTotals.grand_total) === 59000, `Quotation grand_total verified in SQLite: ₹${dbQuoteTotals.grand_total}`);

      // ------------------------------------------------------------------
      // STEP 6: SUPPORT TICKET COMMENTS & STATUS PERSISTENCE
      // ------------------------------------------------------------------
      console.log("\n--- 6. SUPPORT TICKET STATUS & COMMENTS PERSISTENCE ---");

      // 6.1 Status transition: Open -> In Progress
      const tckStatusRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: `/api/tickets/${ticketAId}/status`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        { status: "In Progress" }
      );
      assert(tckStatusRes.status === 200 && tckStatusRes.data.status === "In Progress", "API updated ticket status to 'In Progress'");

      const dbTicket = await get("SELECT id, status, priority FROM tickets WHERE id = ?", [ticketAId]);
      assert(dbTicket && dbTicket.status === "In Progress", "SQLite tickets table persisted status 'In Progress'");

      // 6.2 Add Comment
      const commentRes = await makeRequest(
        { hostname: "localhost", port: PORT, path: `/api/tickets/${ticketAId}/comments`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
        { author: "Alice Admin", text: "Traceroute completed; upstream BGP convergence resolved." }
      );
      assert(commentRes.status === 201 && commentRes.data.comments?.length > 0, "API added comment to ticket timeline");

      const dbComment = await get(
        "SELECT id, comment, user_id FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1",
        [ticketAId]
      );
      assert(dbComment && dbComment.comment.includes("Traceroute completed"), "SQLite ticket_comments persisted comment text");

      // ------------------------------------------------------------------
      // STEP 7: CLEANUP OF TEST ARTIFACTS
      // ------------------------------------------------------------------
      console.log("\n--- 7. CLEANUP OF TEST ARTIFACTS ---");
      await makeRequest({ hostname: "localhost", port: PORT, path: `/api/tickets/${ticketAId}`, method: "DELETE", headers: { Authorization: `Bearer ${tokenA}` } });
      await makeRequest({ hostname: "localhost", port: PORT, path: `/api/quotations/${quoteAId}`, method: "DELETE", headers: { Authorization: `Bearer ${tokenA}` } });
      await makeRequest({ hostname: "localhost", port: PORT, path: `/api/pipeline/deals/${dealAId}`, method: "DELETE", headers: { Authorization: `Bearer ${tokenA}` } });
      await makeRequest({ hostname: "localhost", port: PORT, path: `/api/crm/customers/${custAId}`, method: "DELETE", headers: { Authorization: `Bearer ${tokenA}` } });

      console.log("\n========================================================");
      console.log(`DAY 5 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
      console.log("========================================================\n");

      if (failed > 0) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error("\nTEST SUITE RUNTIME ERROR:", err);
      process.exitCode = 1;
    } finally {
      server.close();
    }
  });
}

runDay5ReviewTests();
