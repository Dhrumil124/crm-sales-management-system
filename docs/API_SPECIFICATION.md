# CRM, Sales Pipeline, Quotation & Support Tickets — API Specification

**Version:** 1.0 (Days 1–4 Finalized)  
**Base URL:** `http://localhost:5000/api`  
**Authentication Scheme:** Bearer JWT token (`Authorization: Bearer <token>`)  
**Tenant Isolation:** Enforced via `organizationId` from verified JWT token. All authenticated endpoints strictly scope records to the requesting user's organization (`req.user.organizationId`).

---

## Table of Contents
1. [General Headers & Conventions](#general-headers--conventions)
2. [Utility & Health Routes](#utility--health-routes)
3. [Authentication Routes](#authentication-routes)
4. [CRM (Customer Management) Routes](#crm-customer-management-routes)
5. [Sales Pipeline Routes](#sales-pipeline-routes)
6. [Quotation Management Routes](#quotation-management-routes)
7. [Support Ticket Routes](#support-ticket-routes)
8. [Executive Dashboard Routes](#executive-dashboard-routes)

---

## 1. General Headers & Conventions

### Request Headers
- `Content-Type: application/json` (Required for POST, PUT, PATCH requests with JSON bodies)
- `Authorization: Bearer <jwt_token>` (Required for all protected endpoints)

### Standard Error Response
```json
{
  "message": "Error description message",
  "error": "Detailed error string (optional)"
}
```

### Common Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource successfully created.
- `400 Bad Request`: Validation failure or missing required fields.
- `401 Unauthorized`: Missing or invalid JWT token, or missing organization context.
- `404 Not Found`: Resource not found or belongs to another tenant.
- `500 Internal Server Error`: Server or database failure.

---

## 2. Utility & Health Routes

### 2.1 Public API Health Check
- **Endpoint:** `GET /api/test`
- **Auth Required:** No
- **Description:** Verifies that the API server is operational.
- **Response (200 OK):**
```json
{
  "message": "API is working!"
}
```

### 2.2 Protected Token Verification Check
- **Endpoint:** `GET /api/protected-test`
- **Auth Required:** Yes (`Bearer <token>`)
- **Description:** Verifies that JWT token authentication middleware is functional.
- **Response (200 OK):**
```json
{
  "message": "You accessed a protected route!",
  "user": {
    "userId": "usr_99182312",
    "email": "user@example.com",
    "role": "admin",
    "organizationId": "org_77182912"
  }
}
```

---

## 3. Authentication Routes

### 3.1 Organization & Admin Registration
- **Endpoint:** `POST /api/auth/signup`
- **Auth Required:** No
- **Description:** Creates a new tenant organization, provisions its 6 default pipeline stages, registers the initial administrator user, and returns an auth token.
- **Request Body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123!",
  "organizationName": "Acme Technologies"
}
```
- **Response (201 Created):**
```json
{
  "message": "Organization and user account created successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "user-xxx",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "admin",
    "organizationId": "org-xxx",
    "organizationName": "Acme Technologies"
  }
}
```

### 3.2 User Login
- **Endpoint:** `POST /api/auth/login`
- **Auth Required:** No
- **Description:** Authenticates user credentials and returns a scoped JWT token.
- **Request Body:**
```json
{
  "email": "jane@example.com",
  "password": "Password123!"
}
```
- **Response (200 OK):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "user-xxx",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "admin",
    "organizationId": "org-xxx",
    "organizationName": "Acme Technologies"
  }
}
```

### 3.3 Current User & Organization Profile
- **Endpoint:** `GET /api/auth/me`
- **Auth Required:** Yes (`Bearer <token>`)
- **Description:** Returns the authenticated user profile along with organization metadata.
- **Response (200 OK):**
```json
{
  "user": {
    "id": "user-xxx",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "admin",
    "organizationId": "org-xxx",
    "organizationName": "Acme Technologies",
    "createdAt": "2026-09-05T04:49:17.208Z"
  }
}
```

---

## 4. CRM (Customer Management) Routes

All CRM endpoints are scoped to the authenticated user's `organizationId`.

### 4.1 List All Customers
- **Endpoint:** `GET /api/crm/customers`
- **Auth Required:** Yes
- **Query Parameters (Optional):**
  - `search`: Filter by name, company, email, or phone
  - `type`: Filter by contact type (`customer`, `lead`)
  - `status`: Filter by status (`Active`, `Inactive`, `Pending`, `Archived`)
- **Response (200 OK):**
```json
[
  {
    "id": "cust-1",
    "name": "John Miller",
    "email": "john.miller@apextech.com",
    "phone": "+1 (555) 234-5678",
    "company": "Apex Tech Solutions",
    "type": "customer",
    "status": "Active",
    "notes": "Enterprise account with 50+ licenses.",
    "createdAt": "2026-08-08T07:12:24.242Z"
  }
]
```

### 4.2 Get Customer Details by ID
- **Endpoint:** `GET /api/crm/customers/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "id": "cust-1",
  "name": "John Miller",
  "email": "john.miller@apextech.com",
  "phone": "+1 (555) 234-5678",
  "company": "Apex Tech Solutions",
  "type": "customer",
  "status": "Active",
  "notes": "Enterprise account with 50+ licenses.",
  "createdAt": "2026-08-08T07:12:24.242Z"
}
```

### 4.3 Create Customer
- **Endpoint:** `POST /api/crm/customers`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "name": "Bob Vance",
  "email": "bob@vance.com",
  "phone": "+1 555 123 4567",
  "company": "Vance Refrigeration",
  "type": "customer",
  "status": "Active",
  "notes": "Commercial refrigeration vendor"
}
```
- **Response (201 Created):**
```json
{
  "id": "cust-xxx",
  "name": "Bob Vance",
  "email": "bob@vance.com",
  "phone": "+1 555 123 4567",
  "company": "Vance Refrigeration",
  "type": "customer",
  "status": "Active",
  "notes": "Commercial refrigeration vendor",
  "createdAt": "2026-09-10T10:00:00.000Z"
}
```

### 4.4 Update Customer
- **Endpoint:** `PUT /api/crm/customers/:id`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "name": "Bob Vance",
  "status": "Active",
  "notes": "Updated account notes"
}
```
- **Response (200 OK):** Returns updated customer object.

### 4.5 Delete Customer
- **Endpoint:** `DELETE /api/crm/customers/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "message": "Customer deleted successfully"
}
```

---

## 4.B Lead Management Routes

All Lead endpoints are scoped to the authenticated user's `organizationId`.

### 4.6 Create Lead
- **Endpoint:** `POST /api/crm/leads`
- **Auth Required:** Yes
- **Description:** Creates a new prospective lead in the organization with status defaulting to `New`.
- **Request Body:**
```json
{
  "name": "Sarah Connor",
  "email": "sarah@cyberdyne.io",
  "phone": "+1 555 987 6543",
  "company": "Cyberdyne Systems",
  "status": "New"
}
```
- **Response (201 Created):**
```json
{
  "id": "lead-xxx",
  "organizationId": "org-xxx",
  "name": "Sarah Connor",
  "email": "sarah@cyberdyne.io",
  "phone": "+1 555 987 6543",
  "company": "Cyberdyne Systems",
  "status": "New",
  "assignedTo": null,
  "createdAt": "2026-09-10T12:00:00.000Z",
  "updatedAt": "2026-09-10T12:00:00.000Z"
}
```

### 4.7 List Leads with Pagination
- **Endpoint:** `GET /api/crm/leads`
- **Auth Required:** Yes
- **Query Parameters (Optional):**
  - `page`: Page number (integer >= 1, default: `1`)
  - `limit`: Items per page (integer 1-100, default: `10`)
  - `status`: Filter by status (`New`, `Contacted`, `Qualified`, `Lost`, `Active`, `Inactive`, `Converted`)
  - `search`: Search query matching name, company, email, or phone
- **Response (200 OK):**
```json
{
  "leads": [
    {
      "id": "lead-xxx",
      "organizationId": "org-xxx",
      "name": "Sarah Connor",
      "email": "sarah@cyberdyne.io",
      "phone": "+1 555 987 6543",
      "company": "Cyberdyne Systems",
      "status": "New",
      "assignedTo": null,
      "createdAt": "2026-09-10T12:00:00.000Z",
      "updatedAt": "2026-09-10T12:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### 4.8 Get Lead by ID
- **Endpoint:** `GET /api/crm/leads/:id`
- **Auth Required:** Yes
- **Response (200 OK):** Returns single lead record with assigned user details if present.
- **Error Response (404 Not Found):** If lead does not exist or belongs to another tenant.

### 4.9 Update Lead
- **Endpoint:** `PATCH /api/crm/leads/:id`
- **Auth Required:** Yes
- **Request Body:** Partial lead fields to update:
```json
{
  "status": "Contacted",
  "company": "Cyberdyne Global"
}
```
- **Response (200 OK):** Returns updated lead object.

### 4.10 Delete Lead
- **Endpoint:** `DELETE /api/crm/leads/:id`
- **Auth Required:** Yes
- **Description:** Deletes the lead. Linked records in `lead_notes` and `lead_communications` cascade delete automatically.
- **Response (200 OK):**
```json
{
  "message": "Lead deleted successfully",
  "id": "lead-xxx"
}
```

### 4.11 Add Lead Note
- **Endpoint:** `POST /api/crm/leads/:id/notes`
- **Auth Required:** Yes
- **Description:** Appends a note to the lead's history, automatically linking the authenticated user as author.
- **Request Body:**
```json
{
  "content": "Initial introductory call completed. Client interested in AI integration."
}
```
- **Response (201 Created):**
```json
{
  "id": "lnote-xxx",
  "leadId": "lead-xxx",
  "author": {
    "id": "user-xxx",
    "name": "Dhrumil Patel",
    "email": "boy067283@gmail.com"
  },
  "content": "Initial introductory call completed. Client interested in AI integration.",
  "createdAt": "2026-09-10T12:05:00.000Z",
  "updatedAt": "2026-09-10T12:05:00.000Z"
}
```

### 4.12 Get Lead Notes
- **Endpoint:** `GET /api/crm/leads/:id/notes`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
[
  {
    "id": "lnote-xxx",
    "leadId": "lead-xxx",
    "author": {
      "id": "user-xxx",
      "name": "Dhrumil Patel",
      "email": "boy067283@gmail.com"
    },
    "content": "Initial introductory call completed.",
    "createdAt": "2026-09-10T12:05:00.000Z",
    "updatedAt": "2026-09-10T12:05:00.000Z"
  }
]
```

### 4.13 Assign Lead to Staff
- **Endpoint:** `PATCH /api/crm/leads/:id/assign`
- **Auth Required:** Yes
- **Description:** Assigns the lead to a staff member belonging to the same tenant organization. Cross-tenant assignment is strictly rejected.
- **Request Body:**
```json
{
  "assignedTo": "user-xxx"
}
```
- **Response (200 OK):** Returns updated lead object with populated `assignedTo` object:
```json
{
  "id": "lead-xxx",
  "name": "Sarah Connor",
  "status": "New",
  "assignedTo": {
    "id": "user-xxx",
    "name": "Dhrumil Patel",
    "email": "boy067283@gmail.com"
  },
  "updatedAt": "2026-09-10T12:10:00.000Z"
}
```

---

## 5. Sales Pipeline Routes

### 5.1 List All Deals (Paginated & Filtered)
- **Endpoint:** `GET /api/pipeline/deals`
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Query Parameters (Optional):**
  - `page`: Page number (integer >= 1, default `1`)
  - `limit`: Records per page (integer 1 to 100, default `20`)
  - `stage`: Filter by stage name, alias, or stage ID
  - `search`: Case-insensitive search on title, client name, or company
  - `customerId`: Filter by customer/lead ID
- **Response (200 OK):**
```json
{
  "deals": [
    {
      "id": "deal-1",
      "organizationId": "org-mtnwupyk-lujdx",
      "title": "Enterprise CRM Licensing Expansion",
      "customerId": "cust-1",
      "customerName": "John Miller (Apex Tech Solutions)",
      "client": "John Miller",
      "company": "Apex Tech Solutions",
      "value": 45000,
      "stageId": "stage-mto8z2jg-dnzfm",
      "stage": "Closed Won",
      "stageOrder": 5,
      "stageColor": "border-t-emerald-500",
      "expectedCloseDate": "2026-09-15",
      "notes": "Contract signed for 50 additional user seats.",
      "createdAt": "2026-09-08T10:00:00.000Z",
      "updatedAt": "2026-09-10T09:30:00.000Z"
    }
  ],
  "pagination": {
    "total": 7,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### 5.2 Get Deal Pipeline Statistics
- **Endpoint:** `GET /api/pipeline/stats` (also supports `GET /api/pipeline/deals/stats`)
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Response (200 OK):**
```json
{
  "totalDeals": 7,
  "totalValue": 190700,
  "totalActiveValue": 117700,
  "totalWonValue": 73000,
  "totalLostValue": 0,
  "stageCounts": {
    "Lead In": 1,
    "Contact Made": 2,
    "Proposal Sent": 1,
    "Negotiation": 1,
    "Closed Won": 2,
    "Closed Lost": 0
  },
  "stageValues": {
    "Lead In": 8500,
    "Contact Made": 41200,
    "Proposal Sent": 50000,
    "Negotiation": 18000,
    "Closed Won": 73000,
    "Closed Lost": 0
  },
  "byStage": {
    "Lead": { "count": 1, "totalValue": 8500 },
    "Contacted": { "count": 2, "totalValue": 41200 },
    "Proposal": { "count": 1, "totalValue": 50000 },
    "Negotiation": { "count": 1, "totalValue": 18000 },
    "Won": { "count": 2, "totalValue": 73000 },
    "Lost": { "count": 0, "totalValue": 0 }
  },
  "winRate": 100,
  "avgDealValue": 27242.86
}
```

### 5.3 Get Deal by ID
- **Endpoint:** `GET /api/pipeline/deals/:id`
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Response (200 OK):** Returns single formatted deal object.

### 5.4 Create Deal
- **Endpoint:** `POST /api/pipeline/deals`
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Validation Rules:**
  - `title`: Required non-empty string (max 255 chars).
  - `value`: Optional non-negative numeric (defaults to `0`).
  - `customerId`: Optional. Must belong to the authenticated organization (cross-tenant reference returns 400).
  - `stage`: Optional stage name or ID. Defaults to the first pipeline stage.
  - `expectedCloseDate`: Optional date string.
  - `notes`: Optional string (max 4000 chars).
- **Request Body:**
```json
{
  "title": "Cloud Infrastructure Expansion",
  "customerId": "cust-1",
  "value": 35000,
  "stage": "Proposal Sent",
  "expectedCloseDate": "2026-10-15",
  "notes": "Proposal pending executive review."
}
```
- **Response (201 Created):** Returns created deal object.

### 5.5 Update Deal Full Details
- **Endpoint:** `PUT /api/pipeline/deals/:id`
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Request Body:** Partial or complete deal fields.
- **Response (200 OK):** Returns updated deal object.

### 5.6 Update Deal Kanban Stage & Audit History
- **Endpoint:** `PATCH /api/pipeline/deals/:id/stage`
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Description:** Updates `deals.stage_id` and records an atomic audit history record in `deal_stage_history`. If moving to the current stage, skips duplicate history record creation.
- **Request Body:**
```json
{
  "stage": "Closed Won"
}
```
- **Response (200 OK):** Returns updated deal object with new stage.

### 5.7 Get Deal Stage Movement History
- **Endpoint:** `GET /api/pipeline/deals/:id/history`
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Response (200 OK):**
```json
{
  "history": [
    {
      "id": "dhist-mtv8t-12345",
      "dealId": "deal-1",
      "fromStage": {
        "id": "stage-4",
        "name": "Negotiation"
      },
      "toStage": {
        "id": "stage-5",
        "name": "Closed Won"
      },
      "user": {
        "id": "user-1",
        "name": "Admin User",
        "email": "admin@example.com"
      },
      "createdAt": "2026-09-10T10:00:00.000Z"
    }
  ]
}
```

### 5.8 Delete Deal
- **Endpoint:** `DELETE /api/pipeline/deals/:id`
- **Auth Required:** Yes (scoped to `req.user.organizationId`)
- **Response (200 OK):**
```json
{
  "message": "Deal deleted successfully",
  "id": "deal-1"
}
```

---

## 6. Quotation Management Routes (Day 8 Backend)

All quotation endpoints require JWT Bearer authentication and are strictly isolated by `req.user.organizationId`. SQLite is the single source of truth; financial totals and auto-numbering are safely computed and persisted server-side.

### 6.1 List All Quotations
- **Endpoint:** `GET /api/quotations`
- **Auth Required:** Yes (`Bearer <JWT>`)
- **Query Parameters (Optional):**
  - `page`: Page number (integer >= 1)
  - `limit`: Items per page (integer 1..100)
  - `status`: Filter by status (`Draft`, `Sent`, `Accepted`, `Declined`)
  - `customerId`: Filter by customer ID
  - `search`: Case-insensitive search on quotation number, customer name, company, or notes
- **Response (200 OK - Paginated):**
```json
{
  "quotations": [
    {
      "id": "quote-mtwh414a-8uh1j",
      "quoteNumber": "AUTO-00001",
      "customerId": "cust-1",
      "customerName": "John Miller (Apex Tech Solutions)",
      "customerEmail": "john.miller@apextech.com",
      "customerCompany": "Apex Tech Solutions",
      "items": [
        {
          "id": "qitem-1",
          "quotationId": "quote-mtwh414a-8uh1j",
          "description": "Enterprise Cloud Subscription",
          "quantity": 2,
          "unitPrice": 15000,
          "taxRate": 18,
          "taxAmount": 5400,
          "lineTotal": 30000,
          "createdAt": "2026-09-11T10:00:00.000Z"
        }
      ],
      "subtotal": 30000,
      "taxTotal": 5400,
      "discount": 0,
      "grandTotal": 35400,
      "status": "Draft",
      "issueDate": "2026-09-11",
      "validUntil": "2026-10-11",
      "notes": "Standard payment terms.",
      "organizationId": "org-xxx",
      "createdAt": "2026-09-11T10:00:00.000Z",
      "updatedAt": "2026-09-11T10:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPrevPage": false
  }
}
```

### 6.2 Create Quotation
- **Endpoint:** `POST /api/quotations`
- **Auth Required:** Yes (`Bearer <JWT>`)
- **Quotation Numbering:** Automatically generated server-side in `AUTO-00001`, `AUTO-00002` format based on existing persisted quotations for the tenant organization. Client-supplied numbers cannot override server generation.
- **Request Body:**
```json
{
  "customerId": "cust-1",
  "issueDate": "2026-09-11",
  "validUntil": "2026-10-11",
  "status": "Draft",
  "discount": 0,
  "notes": "Net 30 terms.",
  "items": [
    {
      "description": "Enterprise Cloud Architecture",
      "quantity": 2,
      "unitPrice": 15000,
      "taxRate": 18
    }
  ]
}
```
- **Response (201 Created):** Returns the full persisted quotation record with generated `AUTO-XXXXX` quote number, line items, and financial totals.

### 6.3 Add Quotation Item
- **Endpoint:** `POST /api/quotations/:id/items`
- **Auth Required:** Yes (`Bearer <JWT>`)
- **Description:** Adds a line item to an existing quotation, persists in SQLite, and atomically recalculates quotation subtotal, tax_total, and grand_total.
- **Request Body:**
```json
{
  "description": "24/7 Dedicated Support SLA",
  "quantity": 1,
  "unitPrice": 5000,
  "taxRate": 10
}
```
- **Response (201 Created):**
```json
{
  "message": "Quotation item added successfully",
  "id": "qitem-mtwh8xyz",
  "quotationId": "quote-mtwh414a-8uh1j",
  "description": "24/7 Dedicated Support SLA",
  "quantity": 1,
  "unitPrice": 5000,
  "taxRate": 10,
  "taxAmount": 500,
  "lineTotal": 5000,
  "item": { ... },
  "quotation": { ... }
}
```

### 6.4 Get Quotation Details by ID
- **Endpoint:** `GET /api/quotations/:id`
- **Auth Required:** Yes (`Bearer <JWT>`)
- **Tenant Security:** Strictly restricted to user's organization; returns 404 for cross-tenant access.
- **Response (200 OK):** Returns single quotation object with populated `items` array and customer details.

### 6.5 Update Quotation
- **Endpoint:** `PATCH /api/quotations/:id`
- **Auth Required:** Yes (`Bearer <JWT>`)
- **Updatable Fields:** `customerId`, `status`, `validUntil`, `issueDate`, `notes`, `discount`.
- **Validation:** If `customerId` changes, it is verified to belong to the authenticated user's organization. `discount` must be >= 0. Recalculates `grand_total = Math.max(0, subtotal + tax_total - discount)`.
- **Request Body:**
```json
{
  "status": "Sent",
  "discount": 1500,
  "notes": "Client discount of ₹1500 applied."
}
```
- **Response (200 OK):** Returns fresh updated quotation from SQLite.

### 6.6 Delete Quotation
- **Endpoint:** `DELETE /api/quotations/:id`
- **Auth Required:** Yes (`Bearer <JWT>`)
- **Description:** Deletes the quotation and cascades deletion of its line items in an atomic SQLite transaction.
- **Response (200 OK):**
```json
{
  "message": "Quotation deleted successfully",
  "id": "quote-xxx"
}
```

### 6.7 Quotation PDF Generation
- **Endpoint:** `GET /api/quotations/:id/pdf` (Alias: `GET /api/quotations/:id/download`)
- **Auth Required:** Yes (`Bearer <JWT>`)
- **Description:** Streams a PDF document rendered directly from SQLite data using `pdfkit`. Includes organization header, quotation metadata, customer billing details, itemized table, and financial totals block.
- **Response Headers:**
  - `Content-Type: application/pdf`
  - `Content-Disposition: inline; filename="quotation-AUTO-00001.pdf"`
- **Response Body:** Binary PDF payload.

### 6.8 Legacy & Utility Endpoints (Preserved)
- **`PATCH /api/quotations/:id/status`**: Updates quotation status (`Draft`, `Sent`, `Accepted`, `Declined`).
- **`POST /api/quotations/preview`**: Pre-save calculation utility without writing to SQLite. Accepts `{ items: [...], discount: 0 }` and returns `{ items, subtotal, taxTotal, discount, grandTotal }`.

---

## 7. Support Ticket Routes

### 7.1 List All Tickets
- **Endpoint:** `GET /api/tickets`
- **Auth Required:** Yes
- **Query Parameters (Optional):**
  - `status`: Filter by status (`Open`, `In Progress`, `Waiting`, `Resolved`, `Closed`)
  - `priority`: Filter by priority (`Low`, `Medium`, `High`, `Urgent`)
  - `customerId`: Filter by customer ID
- **Response (200 OK):**
```json
[
  {
    "id": "tck-1",
    "ticketNumber": "TCK-1001",
    "customerId": "cust-1",
    "customerName": "John Miller",
    "company": "Apex Tech Solutions",
    "title": "SSO SAML authentication intermittent timeout",
    "description": "Users reporting intermittent 504 gateway timeout when logging in via Okta SSO.",
    "priority": "High",
    "status": "In Progress",
    "assignedTo": "Support Team",
    "createdAt": "2026-09-04T12:00:00.000Z"
  }
]
```

### 7.2 Get Ticket Details with Discussion Timeline
- **Endpoint:** `GET /api/tickets/:id`
- **Auth Required:** Yes
- **Response (200 OK):** Returns ticket object with embedded `comments` array.

### 7.3 Create Ticket
- **Endpoint:** `POST /api/tickets`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "customerId": "cust-1",
  "title": "Rate limit increase for webhooks",
  "description": "Need increase from 60 req/min to 300 req/min",
  "priority": "Medium"
}
```
- **Response (201 Created):** Returns created ticket object.

### 7.4 Update Ticket Status
- **Endpoint:** `PATCH /api/tickets/:id/status`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "status": "Resolved"
}
```
- **Supported Statuses:** `Open`, `In Progress`, `Waiting`, `Resolved`, `Closed`
- **Response (200 OK):** Returns updated ticket object.

### 7.5 Add Ticket Comment / Timeline Entry
- **Endpoint:** `POST /api/tickets/:id/comments`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "author": "Dhrumil Patel",
  "text": "Investigated gateway throughput; adjusted token bucket capacity to 200 req/sec."
}
```
- **Response (201 Created):** Returns updated ticket object with the new comment included in `comments`.

### 7.6 Delete Ticket
- **Endpoint:** `DELETE /api/tickets/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "message": "Ticket deleted successfully"
}
```

---

## 8. Executive Dashboard Routes

### 8.1 Executive Summary
- **Endpoint:** `GET /api/dashboard/summary`
- **Auth Required:** Yes
- **Description:** Aggregates real-time tenant KPIs across all 4 operational modules.
- **Response (200 OK):**
```json
{
  "kpis": {
    "totalLeads": 2,
    "totalCustomers": 3,
    "activeDealsCount": 5,
    "pipelineActiveValue": 117700,
    "wonDealsValue": 73000,
    "totalQuotations": 5,
    "pendingQuotationsValue": 76700,
    "acceptedQuotationsValue": 93500,
    "openTickets": 3,
    "urgentTickets": 3
  },
  "pipelineStats": { ... },
  "recentActivity": [
    {
      "type": "crm",
      "title": "Customer Record Added: Dhrumil Patel (Camel-Communication)",
      "timestamp": "2026-09-07T10:14:57.724Z"
    }
  ]
}
```
