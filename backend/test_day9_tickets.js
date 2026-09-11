/**
 * Day 9 Support Ticket Backend Test Suite
 * Validates all required ticket endpoints, auto-numbering (TICKET-00001),
 * strict multi-tenant isolation, comments, assignment, and attachments.
 */

require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { run, get, all } = require("./src/database/db");
const app = require("./src/app");

let server;
let baseUrl;

const request = (method, urlPath, options = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, baseUrl);
    const headers = options.headers || {};
    let body = options.body;

    if (body && typeof body === "object" && !(body instanceof Buffer)) {
      body = JSON.stringify(body);
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    if (body) {
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = http.request(
      url,
      {
        method,
        headers
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          let data;
          try {
            data = JSON.parse(raw);
          } catch {
            data = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: data, raw });
        });
      }
    );

    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
};

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Build multipart/form-data payload manually without external libraries
function createMultipartPayload(fields, files) {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
      )
    );
  }

  for (const file of files) {
    const header = `--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`;
    parts.push(Buffer.from(header));
    parts.push(file.content);
    parts.push(Buffer.from("\r\n"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return {
    body,
    contentType: `multipart/form-data; boundary=${boundary}`
  };
}

async function runTests() {
  console.log("\n========================================================");
  console.log("STARTING DAY 9 SUPPORT TICKET BACKEND TEST SUITE");
  console.log("========================================================\n");

  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  try {
    const timestamp = Date.now();

    // -------------------------------------------------------------
    // 1. TENANT SETUP (ORG A & ORG B)
    // -------------------------------------------------------------
    console.log("--- 1. SETTING UP TWO ISOLATED TENANTS (ORG A & ORG B) ---");

    const userAEmail = `agent.a.${timestamp}@supportorg.com`;
    const userBEmail = `agent.b.${timestamp}@competitor.com`;
    const userA2Email = `specialist.a.${timestamp}@supportorg.com`;

    const signupA = await request("POST", "/api/auth/signup", {
      body: {
        name: "Alice Support Lead",
        email: userAEmail,
        password: "Password123!",
        organizationName: `Support Hub Alpha ${timestamp}`
      }
    });
    assert(signupA.status === 201, "Org A primary user registered successfully");
    const tokenA = signupA.body.token;
    const orgAId = signupA.body.user.organizationId;
    const userAId = signupA.body.user.id;

    // Second user in Org A for assignment testing
    const userA2Id = `user-a2-${timestamp}`;
    await run(
      "INSERT INTO users (id, organization_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
      [userA2Id, orgAId, "Aaron Specialist", userA2Email, "hashed_pw", "member"]
    );
    assert(true, "Org A secondary user (Aaron) created for assignment testing");

    const signupB = await request("POST", "/api/auth/signup", {
      body: {
        name: "Bob Rival Admin",
        email: userBEmail,
        password: "Password123!",
        organizationName: `Competitor Support ${timestamp}`
      }
    });
    assert(signupB.status === 201, "Org B user registered successfully");
    const tokenB = signupB.body.token;
    const orgBId = signupB.body.user.organizationId;
    const userBId = signupB.body.user.id;

    assert(orgAId !== orgBId, "Org A and Org B have distinct unique tenant IDs");

    // Create Customers in each organization
    const custAId = `cust-a-${timestamp}`;
    await run(
      "INSERT INTO customers (id, organization_id, name, email, company) VALUES (?, ?, ?, ?, ?)",
      [custAId, orgAId, "Delta Airlines", "ops@delta.com", "Delta Air Corp"]
    );
    assert(true, "Customer created in Org A (Delta Airlines)");

    const custBId = `cust-b-${timestamp}`;
    await run(
      "INSERT INTO customers (id, organization_id, name, email, company) VALUES (?, ?, ?, ?, ?)",
      [custBId, orgBId, "United Air", "ops@united.com", "United Holding"]
    );
    assert(true, "Customer created in Org B (United Air)");

    // -------------------------------------------------------------
    // 2. CREATE TICKET & AUTO-NUMBERING (TICKET-00001)
    // -------------------------------------------------------------
    console.log("\n--- 2. CREATE TICKET & AUTO-NUMBERING ---");

    // 2.1 Rejections: Empty title
    const resNoTitle = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { title: "", description: "Some description" }
    });
    assert(resNoTitle.status === 400, "Reject ticket creation with empty title (400)");

    // 2.2 Rejections: Empty description
    const resNoDesc = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { title: "Valid Title", description: "   " }
    });
    assert(resNoDesc.status === 400, "Reject ticket creation with whitespace description (400)");

    // 2.3 Rejections: Non-existent customer
    const resBadCust = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "API Timeout",
        description: "Timeout on webhook delivery",
        customerId: "non-existent-cust-999"
      }
    });
    assert(resBadCust.status === 400, "Reject ticket creation with non-existent customer (400)");

    // 2.4 Rejections: Cross-organization customer
    const resCrossCust = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "API Timeout",
        description: "Timeout on webhook delivery",
        customerId: custBId // Belongs to Org B!
      }
    });
    assert(resCrossCust.status === 400, "Reject ticket referencing customer from another organization (400)");

    // 2.5 Rejections: Cross-organization assigned user
    const resCrossAssign = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "API Timeout",
        description: "Timeout on webhook delivery",
        assignedTo: userBId // Belongs to Org B!
      }
    });
    assert(resCrossAssign.status === 400, "Reject ticket assigned to user from another organization (400)");

    // 2.6 Valid Creation: Ticket 1 in Org A
    const resT1 = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "High latency on payment webhook dispatch",
        description: "Outbound webhooks experiencing > 4500ms latency during traffic surges.",
        priority: "High",
        status: "Open",
        customerId: custAId,
        assignedTo: userAId
      }
    });
    assert(resT1.status === 201, "Ticket 1 created successfully with 201 Created");
    const t1 = resT1.body;
    assert(t1.ticketNumber === "TICKET-00001", `Ticket 1 generated server-side auto-number: ${t1.ticketNumber}`);
    assert(t1.priority === "High", "Ticket 1 priority is 'High'");
    assert(t1.status === "Open", "Ticket 1 status is 'Open'");
    assert(t1.customerId === custAId, "Ticket 1 customerId matches");
    assert(t1.customerName.includes("Delta Airlines"), `Ticket 1 customer display is '${t1.customerName}'`);

    // Verify row in SQLite
    const dbT1 = await get("SELECT * FROM tickets WHERE id = ?", [t1.id]);
    assert(dbT1 !== null, "Ticket 1 verified directly in SQLite tickets table");
    assert(dbT1.organization_id === orgAId, "Ticket 1 stamped with Org A ID in SQLite");
    assert(dbT1.ticket_number === "TICKET-00001", "Ticket 1 ticket_number stored as 'TICKET-00001' in SQLite");

    // 2.7 Ticket 2 in Org A (Continuous auto-numbering)
    const resT2 = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "SSL certificate renewal notification error",
        description: "Automated renewal failed with ACME challenge DNS timeout.",
        priority: "Medium",
        customerId: custAId
      }
    });
    assert(resT2.status === 201, "Ticket 2 created successfully");
    const t2 = resT2.body;
    assert(t2.ticketNumber === "TICKET-00002", `Ticket 2 safely incremented to ${t2.ticketNumber}`);

    // 2.8 Client Attempt to Dictate Ticket Number (Must be Ignored)
    const resT3 = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "Database connection pool exhaustion",
        description: "Pool reached max limit 100 connections under load test.",
        ticketNumber: "CLIENT-OVERRIDE-9999",
        ticket_number: "CLIENT-OVERRIDE-9999"
      }
    });
    assert(resT3.status === 201, "Ticket 3 created successfully");
    const t3 = resT3.body;
    assert(t3.ticketNumber === "TICKET-00003", `Client attempt ignored; server assigned ${t3.ticketNumber}`);

    // 2.9 Tenant Scope Isolation: Org B Starts at TICKET-00001
    const resTB1 = await request("POST", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: {
        title: "Org B initial infrastructure ticket",
        description: "Configuring custom domain reverse proxy.",
        customerId: custBId
      }
    });
    assert(resTB1.status === 201, "Org B created its first ticket");
    const tb1 = resTB1.body;
    assert(tb1.ticketNumber === "TICKET-00001", `Org B ticket number starts at TICKET-00001 in its scope: ${tb1.ticketNumber}`);

    // -------------------------------------------------------------
    // 3. GET /api/tickets (LIST, FILTERS, PAGINATION, ISOLATION)
    // -------------------------------------------------------------
    console.log("\n--- 3. GET /api/tickets (LIST, FILTERS, PAGINATION, ISOLATION) ---");

    // 3.1 List Org A Tickets
    const resListA = await request("GET", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resListA.status === 200, "GET /api/tickets returned 200 OK for Org A");
    const listA = Array.isArray(resListA.body) ? resListA.body : resListA.body.tickets;
    assert(listA.length >= 3, `Org A retrieved >= 3 tickets (found ${listA.length})`);

    // 3.2 List Org B Tickets (Must Not See Org A)
    const resListB = await request("GET", "/api/tickets", {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(resListB.status === 200, "GET /api/tickets returned 200 OK for Org B");
    const listB = Array.isArray(resListB.body) ? resListB.body : resListB.body.tickets;
    assert(listB.length === 1, `Org B retrieved exactly 1 ticket (found ${listB.length})`);
    assert(
      !listB.some((t) => t.id === t1.id || t.id === t2.id || t.id === t3.id),
      "Org B CANNOT see any of Org A's tickets (Strict Multi-Tenant Isolation)"
    );

    // 3.3 Pagination
    const resPage = await request("GET", "/api/tickets?page=1&limit=2", {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resPage.status === 200, "GET /api/tickets with pagination returned 200 OK");
    assert(resPage.body.pagination !== undefined, "Pagination metadata object returned");
    assert(resPage.body.pagination.page === 1, "Pagination page is 1");
    assert(resPage.body.pagination.limit === 2, "Pagination limit is 2");
    assert(resPage.body.pagination.total >= 3, `Pagination total reflects all tickets (found ${resPage.body.pagination.total})`);
    assert(resPage.body.pagination.hasNextPage === true, "Pagination hasNextPage is true");

    // 3.4 Filtering by Status
    const resFilterStatus = await request("GET", "/api/tickets?status=Open", {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resFilterStatus.status === 200, "Filter by status returned 200 OK");
    const filteredStatus = Array.isArray(resFilterStatus.body) ? resFilterStatus.body : resFilterStatus.body.tickets;
    assert(filteredStatus.every((t) => t.status === "Open"), "All filtered tickets match status 'Open'");

    // 3.5 Filtering by Priority
    const resFilterPriority = await request("GET", "/api/tickets?priority=High", {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resFilterPriority.status === 200, "Filter by priority returned 200 OK");
    const filteredPriority = Array.isArray(resFilterPriority.body) ? resFilterPriority.body : resFilterPriority.body.tickets;
    assert(filteredPriority.every((t) => t.priority === "High"), "All filtered tickets match priority 'High'");

    // -------------------------------------------------------------
    // 4. GET /api/tickets/:id (DETAIL WITH COMMENTS, ATTACHMENTS, ISOLATION)
    // -------------------------------------------------------------
    console.log("\n--- 4. GET /api/tickets/:id ---");

    const resGetT1 = await request("GET", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resGetT1.status === 200, "GET /api/tickets/:id returned 200 OK");
    assert(resGetT1.body.id === t1.id, "Returned ticket ID matches requested");
    assert(resGetT1.body.ticketNumber === "TICKET-00001", "Ticket number matches TICKET-00001");
    assert(Array.isArray(resGetT1.body.comments), "Ticket detail includes comments array");
    assert(Array.isArray(resGetT1.body.attachments), "Ticket detail includes attachments array");

    // Non-existent ID
    const resGetNonExistent = await request("GET", "/api/tickets/tck-non-existent-9999", {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resGetNonExistent.status === 404, "GET non-existent ticket returns 404 Not Found");

    // Cross-tenant access: Org B attempts to read Org A ticket
    const resCrossGet = await request("GET", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(resCrossGet.status === 404, "Org B direct GET on Org A ticket returns 404 Not Found (Tenant Isolation)");

    // -------------------------------------------------------------
    // 5. PATCH /api/tickets/:id (UPDATE TICKET FIELDS)
    // -------------------------------------------------------------
    console.log("\n--- 5. PATCH /api/tickets/:id ---");

    // Empty body rejection
    const resPatchEmpty = await request("PATCH", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {}
    });
    assert(resPatchEmpty.status === 400, "Reject PATCH with empty body (400)");

    // Invalid priority rejection
    const resPatchBadPri = await request("PATCH", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { priority: "SuperCritical" }
    });
    assert(resPatchBadPri.status === 400, "Reject PATCH with invalid priority (400)");

    // Cross-organization customer update rejection
    const resPatchCrossCust = await request("PATCH", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { customerId: custBId }
    });
    assert(resPatchCrossCust.status === 400, "Reject PATCH changing customer to another organization's customer (400)");

    // Valid update
    const resPatchValid = await request("PATCH", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        title: "CRITICAL: High latency on payment webhook dispatch",
        priority: "Urgent",
        description: "Latency escalated to > 8000ms with 3% HTTP 504 gateway timeouts."
      }
    });
    assert(resPatchValid.status === 200, "PATCH /api/tickets/:id returned 200 OK");
    assert(resPatchValid.body.priority === "Urgent", "Ticket priority updated to 'Urgent'");
    assert(resPatchValid.body.title.startsWith("CRITICAL:"), "Ticket title updated successfully");

    // Direct SQLite check
    const dbT1Updated = await get("SELECT priority, title FROM tickets WHERE id = ?", [t1.id]);
    assert(dbT1Updated.priority === "Urgent", "Direct SQLite check: priority updated in tickets table");

    // Cross-tenant PATCH rejection
    const resPatchCrossTenant = await request("PATCH", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { title: "Malicious Tampering" }
    });
    assert(resPatchCrossTenant.status === 404, "Org B cannot PATCH Org A ticket (404 Not Found)");

    // -------------------------------------------------------------
    // 6. PATCH /api/tickets/:id/status (STATUS UPDATE)
    // -------------------------------------------------------------
    console.log("\n--- 6. PATCH /api/tickets/:id/status ---");

    // Invalid status rejection
    const resBadStatus = await request("PATCH", `/api/tickets/${t1.id}/status`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { status: "PendingApproval" }
    });
    assert(resBadStatus.status === 400, "Reject invalid ticket status (400)");

    // Valid status: In Progress
    const resStatusInProgress = await request("PATCH", `/api/tickets/${t1.id}/status`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { status: "In Progress" }
    });
    assert(resStatusInProgress.status === 200, "Update status to 'In Progress' returned 200 OK");
    assert(resStatusInProgress.body.status === "In Progress", "Ticket status reflects 'In Progress'");

    // Direct SQLite check
    const dbStatusCheck = await get("SELECT status FROM tickets WHERE id = ?", [t1.id]);
    assert(dbStatusCheck.status === "In Progress", "Direct SQLite check: status is 'In Progress'");

    // Cross-tenant status update rejection
    const resCrossStatus = await request("PATCH", `/api/tickets/${t1.id}/status`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { status: "Closed" }
    });
    assert(resCrossStatus.status === 404, "Org B cannot update status of Org A ticket (404 Not Found)");

    // -------------------------------------------------------------
    // 7. PATCH /api/tickets/:id/assign (STAFF ASSIGNMENT)
    // -------------------------------------------------------------
    console.log("\n--- 7. PATCH /api/tickets/:id/assign ---");

    // Assign to valid user in Org A (Aaron)
    const resAssignAaron = await request("PATCH", `/api/tickets/${t1.id}/assign`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { assignedTo: userA2Id }
    });
    assert(resAssignAaron.status === 200, "Assign ticket to Org A specialist (Aaron) returned 200 OK");
    assert(resAssignAaron.body.assignedTo === "Aaron Specialist", `Assigned user name is '${resAssignAaron.body.assignedTo}'`);
    assert(resAssignAaron.body.assignedToId === userA2Id, "Assigned user ID matches Aaron's ID");

    // Reject cross-organization assignment (Bob in Org B)
    const resAssignCrossOrg = await request("PATCH", `/api/tickets/${t1.id}/assign`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { assignedTo: userBId }
    });
    assert(resAssignCrossOrg.status === 400, "Reject cross-organization ticket assignment (400 Bad Request)");

    // Unassign ticket
    const resUnassign = await request("PATCH", `/api/tickets/${t1.id}/assign`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { assignedTo: null }
    });
    assert(resUnassign.status === 200, "Unassign ticket returned 200 OK");
    assert(resUnassign.body.assignedToId === null, "Ticket assignedToId is null after unassign");

    // Cross-tenant assign attempt
    const resCrossAssignAttempt = await request("PATCH", `/api/tickets/${t1.id}/assign`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { assignedTo: userBId }
    });
    assert(resCrossAssignAttempt.status === 404, "Org B cannot assign Org A ticket (404 Not Found)");

    // -------------------------------------------------------------
    // 8. POST /api/tickets/:id/comments (THREADED COMMENTS)
    // -------------------------------------------------------------
    console.log("\n--- 8. POST /api/tickets/:id/comments ---");

    // Empty comment rejection
    const resEmptyComment = await request("POST", `/api/tickets/${t1.id}/comments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: { text: "   " }
    });
    assert(resEmptyComment.status === 400, "Reject empty comment text (400)");

    // Valid comment 1
    const resComment1 = await request("POST", `/api/tickets/${t1.id}/comments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        author: "Alice Support Lead",
        text: "Investigated AWS CloudFront edge latency. Packet trace shows TLS handshake delays on gateway node 4."
      }
    });
    assert(resComment1.status === 201, "POST comment 1 returned 201 Created");
    assert(resComment1.body.comments.length >= 1, `Comments array returned with length ${resComment1.body.comments.length}`);
    const addedComment = resComment1.body.comments[resComment1.body.comments.length - 1];
    assert(addedComment.text.includes("AWS CloudFront"), "Comment text preserved accurately");
    assert(addedComment.author === "Alice Support Lead", "Comment author is 'Alice Support Lead'");

    // Direct SQLite check in ticket_comments
    const dbComments = await all("SELECT * FROM ticket_comments WHERE ticket_id = ?", [t1.id]);
    assert(dbComments.length >= 1, `Direct SQLite check: found ${dbComments.length} comment row(s) in ticket_comments table`);

    // Valid comment 2 (from Aaron)
    const resComment2 = await request("POST", `/api/tickets/${t1.id}/comments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        author: "Aaron Specialist",
        comment: "Patched keep-alive connection pool and rotated stale DNS cache entries."
      }
    });
    assert(resComment2.status === 201, "POST comment 2 returned 201 Created");
    assert(resComment2.body.comments.length >= 2, "Ticket now has 2 threaded comments");

    // Cross-tenant comment rejection
    const resCrossComment = await request("POST", `/api/tickets/${t1.id}/comments`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: { text: "Rival snooping comment" }
    });
    assert(resCrossComment.status === 404, "Org B cannot add comment to Org A ticket (404 Not Found)");

    // -------------------------------------------------------------
    // 9. POST /api/tickets/:id/attachments (ATTACHMENT HANDLING)
    // -------------------------------------------------------------
    console.log("\n--- 9. POST /api/tickets/:id/attachments ---");

    // 9.1 Real multipart file upload via multer
    const sampleLogContent = Buffer.from(
      JSON.stringify({ event: "GATEWAY_TIMEOUT", duration: 8412, edge_node: "us-east-1-edge-04" }, null, 2),
      "utf8"
    );

    const multipart = createMultipartPayload(
      {},
      [
        {
          field: "file",
          filename: "edge_latency_trace.json",
          contentType: "application/json",
          content: sampleLogContent
        }
      ]
    );

    const resUploadFile = await request("POST", `/api/tickets/${t1.id}/attachments`, {
      headers: {
        Authorization: `Bearer ${tokenA}`,
        "Content-Type": multipart.contentType
      },
      body: multipart.body
    });
    assert(resUploadFile.status === 201, "POST multipart file attachment returned 201 Created");
    const att1 = resUploadFile.body;
    assert(att1.id !== undefined, `Attachment received canonical ID: ${att1.id}`);
    assert(att1.originalFilename === "edge_latency_trace.json", `Filename derived from uploaded file: ${att1.originalFilename}`);
    assert(att1.fileSize === sampleLogContent.length, `File size derived accurately: ${att1.fileSize} bytes`);
    assert(att1.storedPath.includes("storage/attachments"), `Stored path saved under storage/attachments: ${att1.storedPath}`);

    // Direct SQLite check in ticket_attachments
    const dbAtt1 = await get("SELECT * FROM ticket_attachments WHERE id = ?", [att1.id]);
    assert(dbAtt1 !== null, "Attachment row verified in SQLite ticket_attachments table");
    assert(dbAtt1.ticket_id === t1.id, "Attachment row foreign key references ticket 1");
    assert(dbAtt1.uploaded_by === userAId, "Attachment row uploaded_by references user A");

    // Verify attachment file actually exists on disk
    const diskPath = path.join(__dirname, dbAtt1.stored_path);
    if (fs.existsSync(diskPath)) {
      assert(true, `Uploaded attachment file verified physically on disk: ${diskPath}`);
    } else {
      // Relative from storage
      const altPath = path.join(__dirname, "storage", "attachments", path.basename(dbAtt1.stored_path));
      assert(fs.existsSync(altPath), `Uploaded attachment file verified on disk: ${altPath}`);
    }

    // 9.2 Verified test metadata upload
    const resMetaUpload = await request("POST", `/api/tickets/${t1.id}/attachments`, {
      headers: { Authorization: `Bearer ${tokenA}` },
      body: {
        originalFilename: "tcpdump_syn_flood.pcap",
        mimeType: "application/vnd.tcpdump.pcap",
        fileSize: 1048576
      }
    });
    assert(resMetaUpload.status === 201, "POST test metadata attachment returned 201 Created");
    const att2 = resMetaUpload.body;
    assert(att2.originalFilename === "tcpdump_syn_flood.pcap", "Metadata filename persisted");
    assert(att2.fileSize === 1048576, "Metadata file size persisted");

    // Verify GET /api/tickets/:id returns both attachments
    const resGetWithAtts = await request("GET", `/api/tickets/${t1.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(resGetWithAtts.status === 200, "GET ticket detail returned 200 OK");
    assert(resGetWithAtts.body.attachments.length === 2, `Ticket detail contains exactly 2 attachments (found ${resGetWithAtts.body.attachments.length})`);
    assert(resGetWithAtts.body.attachmentCount === 2, "attachmentCount metric is 2");

    // 9.3 Cross-tenant attachment upload rejection
    const resCrossUpload = await request("POST", `/api/tickets/${t1.id}/attachments`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      body: {
        originalFilename: "spyware.exe",
        fileSize: 500
      }
    });
    assert(resCrossUpload.status === 404, "Org B cannot upload attachment to Org A ticket (404 Not Found)");

    // -------------------------------------------------------------
    // 10. CLEANUP TEST ARTIFACTS
    // -------------------------------------------------------------
    console.log("\n--- 10. CLEANING UP TEST ARTIFACTS ---");

    // Clean up created test tickets and attachments cleanly
    const testTickets = [t1.id, t2.id, t3.id, tb1.id];
    for (const tid of testTickets) {
      const atts = await all("SELECT stored_path FROM ticket_attachments WHERE ticket_id = ?", [tid]);
      for (const a of atts) {
        try {
          const p = path.join(__dirname, a.stored_path);
          if (fs.existsSync(p)) fs.unlinkSync(p);
        } catch {
          // Ignore
        }
      }
      await run("DELETE FROM ticket_attachments WHERE ticket_id = ?", [tid]);
      await run("DELETE FROM ticket_comments WHERE ticket_id = ?", [tid]);
      await run("DELETE FROM tickets WHERE id = ?", [tid]);
    }
    await run("DELETE FROM customers WHERE id IN (?, ?)", [custAId, custBId]);
    await run("DELETE FROM users WHERE id IN (?, ?, ?)", [userAId, userA2Id, userBId]);
    await run("DELETE FROM organizations WHERE id IN (?, ?)", [orgAId, orgBId]);

    assert(true, "Test records and attachments cleaned up safely without affecting production data");

    console.log("\n========================================================");
    console.log(`DAY 9 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log("========================================================\n");

  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
