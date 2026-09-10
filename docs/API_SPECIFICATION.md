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

## 5. Sales Pipeline Routes

### 5.1 List All Deals
- **Endpoint:** `GET /api/pipeline/deals`
- **Auth Required:** Yes
- **Query Parameters (Optional):**
  - `stage`: Filter by stage name
  - `search`: Filter by deal title or client name
- **Response (200 OK):**
```json
[
  {
    "id": "deal-1",
    "title": "Enterprise CRM Licensing Expansion",
    "client": "John Miller",
    "company": "Apex Tech Solutions",
    "customerId": "cust-1",
    "value": 45000,
    "stage": "Closed Won",
    "probability": 100,
    "expectedCloseDate": "2026-09-15",
    "priority": "High",
    "notes": "Contract signed for 50 additional user seats."
  }
]
```

### 5.2 Get Deal Pipeline Statistics
- **Endpoint:** `GET /api/pipeline/deals/stats`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "totalDeals": 7,
  "totalValue": 190700,
  "avgDealValue": 27242.86,
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
  "wonCount": 2,
  "wonValue": 73000,
  "winRate": 28.57,
  "totalActiveValue": 117700
}
```

### 5.3 Get Deal by ID
- **Endpoint:** `GET /api/pipeline/deals/:id`
- **Auth Required:** Yes
- **Response (200 OK):** Returns single deal object.

### 5.4 Create Deal
- **Endpoint:** `POST /api/pipeline/deals`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "title": "Cloud Infrastructure Expansion",
  "client": "John Miller",
  "company": "Apex Tech Solutions",
  "customerId": "cust-1",
  "value": 35000,
  "stage": "Proposal Sent",
  "probability": 60,
  "expectedCloseDate": "2026-10-15",
  "priority": "High",
  "notes": "Proposal pending executive review."
}
```
- **Response (201 Created):** Returns created deal object.

### 5.5 Update Deal Full Details
- **Endpoint:** `PUT /api/pipeline/deals/:id`
- **Auth Required:** Yes
- **Request Body:** Partial or complete deal fields.
- **Response (200 OK):** Returns updated deal object.

### 5.6 Update Deal Kanban Stage
- **Endpoint:** `PATCH /api/pipeline/deals/:id/stage`
- **Auth Required:** Yes
- **Description:** Used by Kanban drag-and-drop workflow. Automatically normalizes aliases (e.g. `Won` -> `Closed Won`, `Lost` -> `Closed Lost`).
- **Request Body:**
```json
{
  "stage": "Won"
}
```
- **Response (200 OK):** Returns updated deal object with new stage and probability.

### 5.7 Delete Deal
- **Endpoint:** `DELETE /api/pipeline/deals/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "message": "Deal deleted successfully"
}
```

---

## 6. Quotation Management Routes

### 6.1 List All Quotations
- **Endpoint:** `GET /api/quotations`
- **Auth Required:** Yes
- **Query Parameters (Optional):**
  - `status`: Filter by status (`Draft`, `Sent`, `Accepted`, `Declined`)
  - `customerId`: Filter by customer ID
- **Response (200 OK):**
```json
[
  {
    "id": "quote-1",
    "quoteNumber": "QT-1001",
    "customerId": "cust-1",
    "customerName": "John Miller",
    "company": "Apex Tech Solutions",
    "customerEmail": "john.miller@apextech.com",
    "issueDate": "2026-08-20",
    "validUntil": "2026-09-20",
    "status": "Accepted",
    "subtotal": 45000,
    "taxRate": 18,
    "taxTotal": 8100,
    "grandTotal": 53100,
    "notes": "Payment terms: Net 30 days.",
    "items": [
      {
        "id": "qi-1",
        "description": "Enterprise Platform Licenses (Annual)",
        "quantity": 50,
        "unitPrice": 900,
        "total": 45000
      }
    ]
  }
]
```

### 6.2 Calculate Quotation Preview (Pre-save Tax & Total Engine)
- **Endpoint:** `POST /api/quotations/preview`
- **Auth Required:** Yes
- **Description:** Real-time preview computation utility without persisting to SQLite.
- **Request Body:**
```json
{
  "items": [
    { "quantity": 2, "unitPrice": 25000, "taxRate": 18 },
    { "quantity": 1, "unitPrice": 10000, "taxRate": 18 }
  ]
}
```
- **Response (200 OK):**
```json
{
  "subtotal": 60000,
  "taxTotal": 10800,
  "grandTotal": 70800,
  "items": [ ... ]
}
```

### 6.3 Get Quotation Details by ID
- **Endpoint:** `GET /api/quotations/:id`
- **Auth Required:** Yes
- **Response (200 OK):** Returns single quotation object with line items.

### 6.4 Create Quotation
- **Endpoint:** `POST /api/quotations`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "customerId": "cust-1",
  "quoteNumber": "QT-1006",
  "issueDate": "2026-09-10",
  "validUntil": "2026-10-10",
  "notes": "Valid for 30 days",
  "items": [
    {
      "description": "Cloud Hosting & Architecture Setup",
      "quantity": 1,
      "unitPrice": 50000,
      "taxRate": 18
    }
  ]
}
```
- **Response (201 Created):** Returns created quotation object.

### 6.5 Update Quotation Status
- **Endpoint:** `PATCH /api/quotations/:id/status`
- **Auth Required:** Yes
- **Request Body:**
```json
{
  "status": "Accepted"
}
```
- **Supported Statuses:** `Draft`, `Sent`, `Accepted`, `Declined`
- **Response (200 OK):** Returns updated quotation object.

### 6.6 Delete Quotation
- **Endpoint:** `DELETE /api/quotations/:id`
- **Auth Required:** Yes
- **Response (200 OK):**
```json
{
  "message": "Quotation deleted successfully"
}
```

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
