require("dotenv").config();
const http = require("http");
const app = require("./src/app");
const { get, all } = require("./src/database/db");

const PORT = 5055; // Use dedicated test port

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

async function runTests() {
  console.log("\n==========================================");
  console.log("STARTING BACKEND AUTHENTICATION TEST SUITE");
  console.log("==========================================\n");

  const server = app.listen(PORT, async () => {
    try {
      let authToken = "";

      // Test 1: Public Test Endpoint
      console.log("TEST 1: GET /api/test (Public)");
      const res1 = await makeRequest({
        hostname: "localhost",
        port: PORT,
        path: "/api/test",
        method: "GET"
      });
      console.log(`-> Status: ${res1.status}, Message: "${res1.data.message}"`);
      if (res1.status !== 200) throw new Error("Public test failed");

      // Test 2: Protected Route without Token
      console.log("\nTEST 2: GET /api/crm/customers (Protected without token)");
      const res2 = await makeRequest({
        hostname: "localhost",
        port: PORT,
        path: "/api/crm/customers",
        method: "GET"
      });
      console.log(`-> Status: ${res2.status}, Message: "${res2.data.message}"`);
      if (res2.status !== 401) throw new Error("Route should have returned 401");

      // Test 3: Valid Signup
      console.log("\nTEST 3: POST /api/auth/signup (Valid Registration)");
      const testEmail = `admin-${Date.now()}@acme.com`;
      const res3 = await makeRequest(
        {
          hostname: "localhost",
          port: PORT,
          path: "/api/auth/signup",
          method: "POST",
          headers: { "Content-Type": "application/json" }
        },
        {
          name: "Alice Smith",
          email: testEmail,
          password: "SuperSecretPassword123!",
          organizationName: "Acme Enterprises Inc."
        }
      );
      console.log(`-> Status: ${res3.status}`);
      console.log(`-> User created: ${res3.data.user?.name} (${res3.data.user?.email})`);
      console.log(`-> Organization: ${res3.data.user?.organizationName}`);
      console.log(`-> Token received: ${res3.data.token ? "YES (Valid JWT string)" : "NO"}`);
      if (res3.status !== 201 || !res3.data.token) throw new Error("Signup failed");
      authToken = res3.data.token;

      // Test 4: Duplicate Email Signup Prevention
      console.log("\nTEST 4: POST /api/auth/signup (Duplicate Email Check)");
      const res4 = await makeRequest(
        {
          hostname: "localhost",
          port: PORT,
          path: "/api/auth/signup",
          method: "POST",
          headers: { "Content-Type": "application/json" }
        },
        {
          name: "Alice Duplicate",
          email: testEmail, // same email
          password: "AnotherPassword123!",
          organizationName: "Another Company"
        }
      );
      console.log(`-> Status: ${res4.status}, Error Message: "${res4.data.message}"`);
      if (res4.status !== 400) throw new Error("Duplicate email check failed");

      // Test 5: Login with Valid Credentials
      console.log("\nTEST 5: POST /api/auth/login (Valid Credentials)");
      const res5 = await makeRequest(
        {
          hostname: "localhost",
          port: PORT,
          path: "/api/auth/login",
          method: "POST",
          headers: { "Content-Type": "application/json" }
        },
        {
          email: testEmail,
          password: "SuperSecretPassword123!"
        }
      );
      console.log(`-> Status: ${res5.status}, Message: "${res5.data.message}"`);
      console.log(`-> Authenticated User: ${res5.data.user?.name}`);
      if (res5.status !== 200 || !res5.data.token) throw new Error("Login failed");

      // Test 6: Login with Incorrect Password
      console.log("\nTEST 6: POST /api/auth/login (Wrong Password)");
      const res6 = await makeRequest(
        {
          hostname: "localhost",
          port: PORT,
          path: "/api/auth/login",
          method: "POST",
          headers: { "Content-Type": "application/json" }
        },
        {
          email: testEmail,
          password: "WrongPassword!!!"
        }
      );
      console.log(`-> Status: ${res6.status}, Message: "${res6.data.message}"`);
      if (res6.status !== 401) throw new Error("Wrong password check failed");

      // Test 7: GET /api/auth/me (Protected User Profile)
      console.log("\nTEST 7: GET /api/auth/me (Current Session Rehydration)");
      const res7 = await makeRequest({
        hostname: "localhost",
        port: PORT,
        path: "/api/auth/me",
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      console.log(`-> Status: ${res7.status}`);
      console.log(`-> Profile User: ${res7.data.user?.name}, Org: ${res7.data.user?.organizationName}`);
      if (res7.status !== 200) throw new Error("GetMe failed");

      // Test 8: Access Day 1 Business Module with Token
      console.log("\nTEST 8: GET /api/crm/customers (Day 1 Module with Bearer Token)");
      const res8 = await makeRequest({
        hostname: "localhost",
        port: PORT,
        path: "/api/crm/customers",
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      console.log(`-> Status: ${res8.status}`);
      console.log(`-> Customer records returned: ${Array.isArray(res8.data) ? res8.data.length : 0}`);
      if (res8.status !== 200 || !Array.isArray(res8.data)) throw new Error("CRM fetch failed");

      // Test 9: Access Day 1 Dashboard with Token
      console.log("\nTEST 9: GET /api/dashboard/summary (Day 1 Dashboard with Bearer Token)");
      const res9 = await makeRequest({
        hostname: "localhost",
        port: PORT,
        path: "/api/dashboard/summary",
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      console.log(`-> Status: ${res9.status}`);
      console.log(`-> Dashboard KPIs: Total Leads = ${res9.data.kpis?.totalLeads}, Total Customers = ${res9.data.kpis?.totalCustomers}`);
      if (res9.status !== 200 || !res9.data.kpis) throw new Error("Dashboard fetch failed");

      // Test 10: Verify Database Integrity
      console.log("\nTEST 10: Verify SQLite Database Records");
      const orgCount = await get("SELECT COUNT(*) as count FROM organizations");
      const userCount = await get("SELECT COUNT(*) as count FROM users");
      console.log(`-> Organizations in SQLite: ${orgCount.count}`);
      console.log(`-> Users in SQLite: ${userCount.count}`);
      if (orgCount.count < 1 || userCount.count < 1) throw new Error("Database verification failed");

      console.log("\n==========================================");
      console.log("ALL 10 BACKEND TESTS PASSED SUCCESSFULLY! ");
      console.log("==========================================\n");
    } catch (err) {
      console.error("\nTEST SUITE FAILED:", err);
      process.exitCode = 1;
    } finally {
      server.close();
      process.exit();
    }
  });
}

runTests();
