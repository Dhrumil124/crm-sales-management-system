require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const { get, all, run } = require("./src/database/db");

const PORT = 5088; // Dedicated port for Day 8 quotation tests

const makeRequest = (options, postData = null) => {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const rawBuffer = Buffer.concat(chunks);
        const contentType = res.headers["content-type"] || "";

        if (contentType.includes("application/pdf")) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            buffer: rawBuffer,
            isPdf: rawBuffer.slice(0, 4).toString() === "%PDF"
          });
        } else {
          const bodyStr = rawBuffer.toString("utf8");
          try {
            const json = bodyStr ? JSON.parse(bodyStr) : {};
            resolve({ status: res.statusCode, headers: res.headers, data: json });
          } catch {
            resolve({ status: res.statusCode, headers: res.headers, data: bodyStr });
          }
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

async function runDay8QuotationTests() {
  console.log("\n========================================================");
  console.log("STARTING DAY 8 QUOTATION BACKEND & PDF GENERATION TEST SUITE");
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

  const runTs = Date.now();
  let orgAId = null;
  let orgBId = null;
  let tokenA = null;
  let tokenB = null;
  let custAId = null;
  let custBId = null;

  try {
    // -------------------------------------------------------------
    // STEP 1: SETUP TWO DISTINCT TENANTS & CUSTOMERS
    // -------------------------------------------------------------
    console.log("--- 1. SETTING UP TWO ISOLATED TENANTS (ORG A & ORG B) ---");

    const signupA = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/auth/signup", method: "POST", headers: { "Content-Type": "application/json" } },
      { name: "OrgA Admin", email: `admin-d8-a-${runTs}@test.com`, password: "Password123!", organizationName: "Alpha Global Tech" }
    );
    assert(signupA.status === 201 && signupA.data.token, "Org A registered successfully");
    tokenA = signupA.data.token;
    orgAId = signupA.data.user.organizationId;

    const signupB = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/auth/signup", method: "POST", headers: { "Content-Type": "application/json" } },
      { name: "OrgB Admin", email: `admin-d8-b-${runTs}@test.com`, password: "Password123!", organizationName: "Beta Solutions Ltd" }
    );
    assert(signupB.status === 201 && signupB.data.token, "Org B registered successfully");
    tokenB = signupB.data.token;
    orgBId = signupB.data.user.organizationId;

    assert(orgAId !== orgBId, "Org A and Org B have distinct unique tenant IDs");

    // Create Customer in Org A
    const custARes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/crm/customers", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { name: "Apex Global Client", email: `client-a-${runTs}@apex.com`, phone: "+1-555-1001", company: "Apex Technologies", address: "100 Innovation Way" }
    );
    assert(custARes.status === 201 && custARes.data.id, "Customer created in Org A");
    custAId = custARes.data.id;

    // Create Customer in Org B
    const custBRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/crm/customers", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` } },
      { name: "Omega Systems Client", email: `client-b-${runTs}@omega.com`, phone: "+1-555-2002", company: "Omega Corp", address: "200 Enterprise Blvd" }
    );
    assert(custBRes.status === 201 && custBRes.data.id, "Customer created in Org B");
    custBId = custBRes.data.id;

    // -------------------------------------------------------------
    // STEP 2: CREATE QUOTATION & AUTO-NUMBERING (AUTO-XXXXX)
    // -------------------------------------------------------------
    console.log("\n--- 2. CREATE QUOTATION & AUTO-NUMBERING ---");

    // 2.1 Validation: Missing customer
    const missCustRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { items: [{ description: "Cloud Setup", quantity: 1, unitPrice: 5000 }] }
    );
    assert(missCustRes.status === 400, "Reject quotation creation with missing customerId (400)");

    // 2.2 Validation: Whitespace customer
    const emptyCustRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { customerId: "   ", items: [{ description: "Cloud Setup", quantity: 1, unitPrice: 5000 }] }
    );
    assert(emptyCustRes.status === 400, "Reject quotation creation with whitespace customerId (400)");

    // 2.3 Validation: Non-existent customer
    const nonCustRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { customerId: "cust-non-existent-99999", items: [{ description: "Cloud Setup", quantity: 1, unitPrice: 5000 }] }
    );
    assert(nonCustRes.status === 400, "Reject quotation with non-existent customer (400)");

    // 2.4 Validation: Cross-organization customer reference
    const crossCustRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` } },
      { customerId: custAId, items: [{ description: "Consulting", quantity: 1, unitPrice: 2000 }] }
    );
    assert(crossCustRes.status === 400, "Reject quotation referencing another organization's customer (400)");

    // 2.5 Validation: Invalid item numbers
    const negQtyRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { customerId: custAId, items: [{ description: "Hardware", quantity: -2, unitPrice: 500 }] }
    );
    assert(negQtyRes.status === 400, "Reject quotation creation with negative quantity (400)");

    const negPriceRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { customerId: custAId, items: [{ description: "Hardware", quantity: 1, unitPrice: -100 }] }
    );
    assert(negPriceRes.status === 400, "Reject quotation creation with negative unit price (400)");

    // 2.6 Successful Creation 1: Auto-numbering AUTO-00001
    const createRes1 = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      {
        customerId: custAId,
        items: [
          { description: "Enterprise Cloud Subscription", quantity: 2, unitPrice: 15000, taxRate: 18 }
        ],
        notes: "Standard terms apply. Net 30 payment."
      }
    );
    assert(createRes1.status === 201 && createRes1.data.id, "Quotation 1 created successfully with 201");
    const quote1 = createRes1.data;
    assert(/^AUTO-\d{5}$/.test(quote1.quoteNumber), `Quote 1 generated with AUTO-XXXXX format: ${quote1.quoteNumber}`);
    assert(quote1.quoteNumber === "AUTO-00001", `Quote 1 sequence starts at AUTO-00001: ${quote1.quoteNumber}`);
    assert(quote1.subtotal === 30000, `Quote 1 subtotal is correct (2 * 15000 = 30000): ${quote1.subtotal}`);
    assert(quote1.taxTotal === 5400, `Quote 1 taxTotal is correct (18% of 30000 = 5400): ${quote1.taxTotal}`);
    assert(quote1.grandTotal === 35400, `Quote 1 grandTotal is correct (30000 + 5400 = 35400): ${quote1.grandTotal}`);

    // Verify Quote 1 directly in SQLite
    const dbQuote1 = await get("SELECT * FROM quotations WHERE id = ?", [quote1.id]);
    assert(dbQuote1 !== null, "Quotation 1 row verified directly in SQLite quotations table");
    assert(dbQuote1.organization_id === orgAId, "Quotation 1 in SQLite stamped with Org A ID");
    assert(dbQuote1.quote_number === "AUTO-00001", "Quotation 1 quote_number persisted in SQLite as AUTO-00001");
    assert(Number(dbQuote1.grand_total) === 35400, "Quotation 1 grand_total matches in SQLite");

    // 2.7 Numbering Continuity: Create Quotation 2 (Must be AUTO-00002, continuing safely)
    const createRes2 = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      {
        customerId: custAId,
        items: [
          { description: "Annual Maintenance Agreement", quantity: 1, unitPrice: 20000, taxRate: 10 }
        ]
      }
    );
    assert(createRes2.status === 201 && createRes2.data.id, "Quotation 2 created successfully");
    const quote2 = createRes2.data;
    assert(quote2.quoteNumber === "AUTO-00002", `Numbering safely continued from SQLite to AUTO-00002: ${quote2.quoteNumber}`);

    // Create Quotation 3 for Org A
    const createRes3 = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      {
        customerId: custAId,
        items: [
          { description: "Consulting Hours", quantity: 10, unitPrice: 1500, taxRate: 0 }
        ]
      }
    );
    assert(createRes3.status === 201 && createRes3.data.quoteNumber === "AUTO-00003", `Quotation 3 safely received AUTO-00003: ${createRes3.data.quoteNumber}`);

    // 2.8 Client cannot dictate quoteNumber (Server overrides / controls quote numbering)
    const clientNumberRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      {
        customerId: custAId,
        quoteNumber: "CUSTOM-99999", // Client attempts to override
        items: [{ description: "Test Item", quantity: 1, unitPrice: 1000 }]
      }
    );
    assert(clientNumberRes.status === 201, "Quotation created with client payload");
    assert(clientNumberRes.data.quoteNumber === "AUTO-00004", `Server-side auto-numbering maintained (AUTO-00004) despite client attempt: ${clientNumberRes.data.quoteNumber}`);

    // 2.9 Tenant Isolation in Auto-Numbering (Org B starts its own safe AUTO-00001 sequence)
    const orgBQuoteRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` } },
      {
        customerId: custBId,
        items: [{ description: "Omega Server License", quantity: 1, unitPrice: 40000, taxRate: 18 }]
      }
    );
    assert(orgBQuoteRes.status === 201, "Org B created quotation");
    assert(orgBQuoteRes.data.quoteNumber === "AUTO-00001", `Org B quotation starts at AUTO-00001 in its tenant scope: ${orgBQuoteRes.data.quoteNumber}`);

    // -------------------------------------------------------------
    // STEP 3: ADD QUOTATION ITEM (POST /api/quotations/:id/items)
    // -------------------------------------------------------------
    console.log("\n--- 3. ADD QUOTATION ITEM & RECALCULATE TOTALS ---");

    // 3.1 Non-existent quotation ID returns 404
    const nonQuoteItemRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations/quote-non-existent-999/items", method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { description: "Extra Item", quantity: 1, unitPrice: 500 }
    );
    assert(nonQuoteItemRes.status === 404, "Adding item to non-existent quotation returns 404");

    // 3.2 Cross-organization quotation rejection
    const crossQuoteItemRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/items`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` } },
      { description: "Malicious Item", quantity: 1, unitPrice: 500 }
    );
    assert(crossQuoteItemRes.status === 404, "Org B cannot add item to Org A's quotation (404 Not Found)");

    // 3.3 Validation: Missing / empty description
    const emptyDescItem = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/items`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { description: "   ", quantity: 1, unitPrice: 500 }
    );
    assert(emptyDescItem.status === 400, "Reject adding item with empty description (400)");

    // 3.4 Validation: Quantity <= 0
    const zeroQtyItem = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/items`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { description: "Hardware", quantity: 0, unitPrice: 500 }
    );
    assert(zeroQtyItem.status === 400, "Reject adding item with quantity 0 (400)");

    // 3.5 Validation: Negative unit price
    const negPriceItem = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/items`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { description: "Hardware", quantity: 1, unitPrice: -50 }
    );
    assert(negPriceItem.status === 400, "Reject adding item with negative price (400)");

    // 3.6 Successful Item Addition
    // Quote 1 currently has subtotal: 30000, tax: 5400, grandTotal: 35400.
    // Adding 1 item: Qty: 2, UnitPrice: 5000, TaxRate: 10%
    // New item lineTotal: 10000, item taxAmount: 1000
    // Expected new subtotal: 40000, new taxTotal: 6400, new grandTotal: 46400
    const addItemRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/items`, method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { description: "Premium SLA Support 24/7", quantity: 2, unitPrice: 5000, taxRate: 10 }
    );
    assert(addItemRes.status === 201, "POST /api/quotations/:id/items succeeded with 201 Created");
    assert(addItemRes.data.id, "Added item has generated ID");
    assert(addItemRes.data.lineTotal === 10000, `Added item lineTotal is 10000: ${addItemRes.data.lineTotal}`);
    assert(addItemRes.data.taxAmount === 1000, `Added item taxAmount is 1000: ${addItemRes.data.taxAmount}`);

    // Verify in SQLite quotation_items
    const dbItems = await all("SELECT * FROM quotation_items WHERE quotation_id = ?", [quote1.id]);
    assert(dbItems.length === 2, `Direct SQLite check: 2 items linked to quotation (found ${dbItems.length})`);

    // Verify updated totals in SQLite quotations
    const dbQuoteUpdated = await get("SELECT subtotal, tax_total, grand_total FROM quotations WHERE id = ?", [quote1.id]);
    assert(Number(dbQuoteUpdated.subtotal) === 40000, `Direct SQLite check: subtotal updated to ₹40000 (actual: ${dbQuoteUpdated.subtotal})`);
    assert(Number(dbQuoteUpdated.tax_total) === 6400, `Direct SQLite check: tax_total updated to ₹6400 (actual: ${dbQuoteUpdated.tax_total})`);
    assert(Number(dbQuoteUpdated.grand_total) === 46400, `Direct SQLite check: grand_total updated to ₹46400 (actual: ${dbQuoteUpdated.grand_total})`);

    // -------------------------------------------------------------
    // STEP 4: GET /api/quotations & TENANT ISOLATION
    // -------------------------------------------------------------
    console.log("\n--- 4. GET /api/quotations (LIST, FILTERS, PAGINATION, ISOLATION) ---");

    // 4.1 Org A list quotations
    const orgAQuotes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(orgAQuotes.status === 200, "GET /api/quotations returned 200 OK");
    const quoteList = Array.isArray(orgAQuotes.data) ? orgAQuotes.data : orgAQuotes.data.quotations;
    assert(quoteList.length >= 4, `Org A retrieved >= 4 quotations (found ${quoteList.length})`);

    // 4.2 Multi-tenant isolation: Org B list quotations
    const orgBQuotes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations", method: "GET", headers: { Authorization: `Bearer ${tokenB}` } }
    );
    assert(orgBQuotes.status === 200, "Org B list quotations returned 200 OK");
    const orgBList = Array.isArray(orgBQuotes.data) ? orgBQuotes.data : orgBQuotes.data.quotations;
    const leakFound = orgBList.some((q) => q.id === quote1.id || q.organizationId === orgAId);
    assert(!leakFound, "Org B CANNOT see any of Org A's quotations (Strict Multi-Tenant Isolation)");

    // 4.3 Pagination test
    const pageRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations?page=1&limit=2", method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(pageRes.status === 200, "GET /api/quotations with pagination returned 200 OK");
    const pData = pageRes.data;
    assert(pData.quotations && pData.quotations.length === 2, `Page 1 contains exactly 2 quotations (limit=2)`);
    assert(pData.pagination && pData.pagination.total >= 4, `Pagination metadata reflects total >= 4`);
    assert(pData.pagination.page === 1, "Pagination page is 1");
    assert(pData.pagination.limit === 2, "Pagination limit is 2");
    assert(pData.pagination.hasNextPage === true, "Pagination hasNextPage is true");

    // 4.4 Status filter test
    const filterRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations?status=draft", method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(filterRes.status === 200, "Filter by status returned 200 OK");
    const fList = Array.isArray(filterRes.data) ? filterRes.data : filterRes.data.quotations;
    assert(fList.every((q) => q.status.toLowerCase() === "draft"), "All filtered quotations match status 'Draft'");

    // -------------------------------------------------------------
    // STEP 5: GET /api/quotations/:id
    // -------------------------------------------------------------
    console.log("\n--- 5. GET /api/quotations/:id (DETAIL WITH ITEMS & CUSTOMER) ---");

    // 5.1 Successful retrieval with full relations
    const getQuoteRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(getQuoteRes.status === 200, "GET /api/quotations/:id returned 200 OK");
    const qDetail = getQuoteRes.data;
    assert(qDetail.id === quote1.id, "Returned quotation ID matches requested");
    assert(qDetail.quoteNumber === "AUTO-00001", "Quote number matches AUTO-00001");
    assert(qDetail.items && qDetail.items.length === 2, `Quotation detail includes 2 line items`);
    assert(qDetail.customerName && qDetail.customerName.includes("Apex"), `Quotation includes customer display: ${qDetail.customerName}`);
    assert(qDetail.subtotal === 40000, `Quotation detail subtotal is 40000`);
    assert(qDetail.grandTotal === 46400, `Quotation detail grandTotal is 46400`);

    // 5.2 Non-existent quotation ID returns 404
    const nonExistentDetail = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations/quote-not-found-8888", method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(nonExistentDetail.status === 404, "GET non-existent quotation returns 404");

    // 5.3 Cross-organization GET returns 404
    const crossGetDetail = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "GET", headers: { Authorization: `Bearer ${tokenB}` } }
    );
    assert(crossGetDetail.status === 404, "Org B direct GET on Org A's quotation returns 404 Not Found");

    // -------------------------------------------------------------
    // STEP 6: PATCH /api/quotations/:id & DISCOUNT RECALCULATION
    // -------------------------------------------------------------
    console.log("\n--- 6. PATCH /api/quotations/:id & DISCOUNT ENGINE ---");

    // 6.1 Validation: Reject empty update body
    const emptyPatchRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      {}
    );
    assert(emptyPatchRes.status === 400, "Reject PATCH with empty body (400)");

    // 6.2 Validation: Reject invalid status
    const invStatusRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { status: "NotAValidStatus" }
    );
    assert(invStatusRes.status === 400, "Reject PATCH with invalid status (400)");

    // 6.3 Validation: Reject negative discount
    const negDiscRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { discount: -500 }
    );
    assert(negDiscRes.status === 400, "Reject PATCH with negative discount (400)");

    // 6.4 Cross-organization PATCH returns 404
    const crossPatchRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` } },
      { notes: "Hacked by Org B" }
    );
    assert(crossPatchRes.status === 404, "Org B cannot PATCH Org A's quotation (404 Not Found)");

    // 6.5 Cross-organization Customer Change Rejection
    const crossCustPatchRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { customerId: custBId } // Cust B belongs to Org B
    );
    assert(crossCustPatchRes.status === 400, "Reject updating customerId to customer from another organization (400)");

    // 6.6 Successful PATCH: Update discount & notes
    // Subtotal: 40000, Tax: 6400, Discount: 2400 => GrandTotal: 40000 + 6400 - 2400 = 44000
    const validPatchRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      {
        discount: 2400,
        notes: "Corporate partner discount of ₹2400 applied. Valid for 45 days.",
        status: "Sent"
      }
    );
    assert(validPatchRes.status === 200, "PATCH quotation returned 200 OK");
    const patchedQuote = validPatchRes.data;
    assert(patchedQuote.discount === 2400, `Discount verified in response: ₹${patchedQuote.discount}`);
    assert(patchedQuote.grandTotal === 44000, `Grand total correctly recalculated with discount (40000 + 6400 - 2400 = 44000): ${patchedQuote.grandTotal}`);
    assert(patchedQuote.status === "Sent", "Quotation status updated to 'Sent'");

    // Verify directly in SQLite
    const dbPatched = await get("SELECT discount, grand_total, status, notes FROM quotations WHERE id = ?", [quote1.id]);
    assert(Number(dbPatched.discount) === 2400, `Direct SQLite check: discount persisted as ₹2400 (actual: ${dbPatched.discount})`);
    assert(Number(dbPatched.grand_total) === 44000, `Direct SQLite check: grand_total persisted as ₹44000 (actual: ${dbPatched.grand_total})`);
    assert(dbPatched.status === "Sent", "Direct SQLite check: status persisted as 'Sent'");

    // 6.7 Preserved Legacy Endpoint: PATCH /api/quotations/:id/status
    const legacyStatusRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/status`, method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` } },
      { status: "Accepted" }
    );
    assert(legacyStatusRes.status === 200, "Preserved PATCH /api/quotations/:id/status returned 200 OK");
    assert(legacyStatusRes.data.status === "Accepted", "Quotation status updated to 'Accepted'");

    // -------------------------------------------------------------
    // STEP 7: QUOTATION PDF GENERATION (GET /api/quotations/:id/pdf)
    // -------------------------------------------------------------
    console.log("\n--- 7. QUOTATION PDF GENERATION ---");

    // 7.1 Non-existent quotation returns 404
    const nonPdfRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations/quote-not-exist-555/pdf", method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(nonPdfRes.status === 404, "PDF generation for non-existent quotation returns 404");

    // 7.2 Cross-organization PDF access returns 404
    const crossPdfRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/pdf`, method: "GET", headers: { Authorization: `Bearer ${tokenB}` } }
    );
    assert(crossPdfRes.status === 404, "Org B cannot generate PDF for Org A's quotation (404 Not Found)");

    // 7.3 Successful PDF Generation
    const pdfRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/pdf`, method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(pdfRes.status === 200, "GET /api/quotations/:id/pdf returned 200 OK");
    assert(pdfRes.headers["content-type"] === "application/pdf", `Content-Type is 'application/pdf': ${pdfRes.headers["content-type"]}`);
    assert(pdfRes.isPdf === true, "Response payload starts with '%PDF' magic header");
    assert(pdfRes.buffer && pdfRes.buffer.length > 500, `PDF generated with substantive binary length: ${pdfRes.buffer?.length} bytes`);
    assert(pdfRes.headers["content-disposition"] && pdfRes.headers["content-disposition"].includes("AUTO-00001"), `Content-Disposition header includes quotation number: ${pdfRes.headers["content-disposition"]}`);

    // 7.4 Convenience alias: GET /api/quotations/:id/download
    const aliasPdfRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote1.id}/download`, method: "GET", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(aliasPdfRes.status === 200 && aliasPdfRes.isPdf === true, "Alias /api/quotations/:id/download also returns valid PDF");

    // -------------------------------------------------------------
    // STEP 8: DELETE QUOTATION & SQLITE CASCADING
    // -------------------------------------------------------------
    console.log("\n--- 8. DELETE QUOTATION & SQLITE CASCADING ---");

    // 8.1 Non-existent quotation delete returns 404
    const nonDelRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: "/api/quotations/quote-not-exist-777", method: "DELETE", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(nonDelRes.status === 404, "Deleting non-existent quotation returns 404");

    // 8.2 Cross-organization delete returns 404
    const crossDelRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote2.id}`, method: "DELETE", headers: { Authorization: `Bearer ${tokenB}` } }
    );
    assert(crossDelRes.status === 404, "Org B cannot delete Org A's quotation (404 Not Found)");

    // 8.3 Successful Deletion of Quote 2
    const delRes = await makeRequest(
      { hostname: "localhost", port: PORT, path: `/api/quotations/${quote2.id}`, method: "DELETE", headers: { Authorization: `Bearer ${tokenA}` } }
    );
    assert(delRes.status === 200, "DELETE /api/quotations/:id returned 200 OK");

    // Verify Quote 2 is removed from SQLite
    const dbQuote2Check = await get("SELECT id FROM quotations WHERE id = ?", [quote2.id]);
    assert(dbQuote2Check === null, "Quotation 2 verified removed from SQLite quotations table");

    // Verify linked line items are cascaded/deleted
    const dbQuote2Items = await all("SELECT id FROM quotation_items WHERE quotation_id = ?", [quote2.id]);
    assert(dbQuote2Items.length === 0, "Quotation 2 line items confirmed deleted from SQLite quotation_items");

    // -------------------------------------------------------------
    // STEP 9: CLEANUP OF TEST ARTIFACTS
    // -------------------------------------------------------------
    console.log("\n--- 9. CLEANING UP TEST ARTIFACTS ---");

    // Clean up created quotes for Org A & B
    const cleanupQuotes = [quote1.id, createRes3.data.id, clientNumberRes.data.id, orgBQuoteRes.data.id];
    for (const qId of cleanupQuotes) {
      await run("DELETE FROM quotation_items WHERE quotation_id = ?", [qId]);
      await run("DELETE FROM quotations WHERE id = ?", [qId]);
    }

    // Clean up customers
    await run("DELETE FROM customers WHERE id IN (?, ?)", [custAId, custBId]);

    // Clean up test users & orgs
    await run("DELETE FROM users WHERE organization_id IN (?, ?)", [orgAId, orgBId]);
    await run("DELETE FROM organizations WHERE id IN (?, ?)", [orgAId, orgBId]);

    assert(true, "Test artifacts cleaned up successfully without affecting existing records");

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log("\n========================================================");
  console.log(`DAY 8 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("========================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runDay8QuotationTests().catch((err) => {
  console.error("Test execution encountered an unhandled error:", err);
  process.exit(1);
});
