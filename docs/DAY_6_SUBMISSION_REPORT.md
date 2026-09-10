# Day 6 Submission Report: Lead Management & Lead Notes

**Project Name:** CRM, Sales Pipeline, Quotation & Support Tickets System  
**Organization:** Camel Communication  
**Lead Developer:** Dhrumil Patel  
**Date:** September 10, 2026  
**Milestone:** Day 6 — Lead Management & Lead Notes  
**Repository:** `https://github.com/Dhrumil124/crm-sales-management-system`  
**Latest Commit Hash:** `0355d31`

---

## 1. Executive Summary

On Day 6, the **Lead Management & Lead Notes** module was designed, implemented, tested, and pushed to production on the `main` branch. 

All features were built strictly on top of the existing SQLite database architecture, JWT authentication system, and multi-tenant isolation structure. Zero existing data from Days 1–5 was deleted, modified, or reset.

### Deliverables Completed:
1. **Lead Database Model & Safe Schema Migration:** Preserved the existing `leads` and `lead_notes` tables in SQLite; safely added the `assigned_to` column with foreign keys and performance indexes.
2. **Input Validation Middleware:** Built robust middleware validating required fields, string lengths, email formats, status enums, note lengths, and pagination limits.
3. **Core Lead CRUD Endpoints:**
   - `POST /api/crm/leads` — Create Lead.
   - `GET /api/crm/leads` — List Leads with pagination (`page`, `limit`) and pagination metadata.
   - `GET /api/crm/leads/:id` — Get Lead by ID with assigned staff details.
   - `PATCH /api/crm/leads/:id` — Partial Lead update.
   - `DELETE /api/crm/leads/:id` — Delete Lead with cascading note removal.
4. **Lead Management Features:**
   - `POST /api/crm/leads/:id/notes` — Add threaded note linked to authenticated author.
   - `GET /api/crm/leads/:id/notes` — Retrieve notes in chronological order.
   - `PATCH /api/crm/leads/:id/assign` — Assign lead to staff within the same organization.
5. **Quality Assurance & Testing:**
   - Automated Day 6 test suite: **67/67 Passed (100%)**.
   - Regression suites for Days 1–5: **100% Passed**.
   - Multi-tenant boundary isolation verified: Org B cannot view, update, delete, note, or assign Org A's leads.

---

## 2. Lead Model & Database Architecture

### 2.1 Schema Preservation & Migration
The existing SQLite database file (`backend/src/database/crm.sqlite`) remains the authoritative source of truth. 
* To support lead assignment without altering working data, a safe, non-destructive migration was applied:
  ```sql
  ALTER TABLE leads ADD COLUMN assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL;
  CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
  ```
* Database foreign keys (`PRAGMA foreign_keys = ON;`) enforce cascading deletion: when a lead is deleted, all attached entries in `lead_notes` are automatically cleaned up.

### 2.2 Table Specifications

| Table | Column | Type | Constraints | Description |
|---|---|---|---|---|
| `leads` | `id` | TEXT | PRIMARY KEY | Unique ID (e.g. `lead-xxx`) |
| | `organization_id` | TEXT | NOT NULL, FK $\rightarrow$ `organizations(id)` | Tenant boundary |
| | `name` | TEXT | NOT NULL | Lead contact name (1–100 chars) |
| | `email` | TEXT | NULLABLE | Contact email |
| | `phone` | TEXT | NULLABLE | Phone number |
| | `company` | TEXT | NULLABLE | Organization/Company name |
| | `status` | TEXT | NOT NULL, DEFAULT `'New'` | Enum: `New`, `Contacted`, `Qualified`, `Lost`, `Active`, `Inactive`, `Converted` |
| | `assigned_to` | TEXT | NULLABLE, FK $\rightarrow$ `users(id)` | Assigned sales representative |
| | `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Creation timestamp |
| | `updated_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Last updated timestamp |
| `lead_notes` | `id` | TEXT | PRIMARY KEY | Unique ID (e.g. `lnote-xxx`) |
| | `lead_id` | TEXT | NOT NULL, FK $\rightarrow$ `leads(id)` ON DELETE CASCADE | Target lead |
| | `author_id` | TEXT | NULLABLE, FK $\rightarrow$ `users(id)` ON DELETE SET NULL | Author user identity |
| | `content` | TEXT | NOT NULL | Note text content (1–2000 chars) |
| | `created_at` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Timestamp of note |

---

## 3. Input Validation Middleware

* **Implementation File:** `backend/src/middleware/leadValidation.js`
* Rejects bad or malformed payloads before they reach the database, preventing corrupt data and providing clean, descriptive error messages.

| Validation Function | Target Endpoint | Validation Rules Enforced |
|---|---|---|
| `validateCreateLead` | `POST /api/crm/leads` | • `name`: Required, non-empty, string, max 100 characters.<br>• `email`: Optional; if provided must match valid RFC email regex.<br>• `status`: Must be one of the 7 allowed database enums.<br>• `phone` / `company`: Max 30 and 100 characters. |
| `validateUpdateLead` | `PATCH /api/crm/leads/:id` | • Body cannot be empty `{}`.<br>• Fields validated for format and length if present in update. |
| `validateLeadId` | All `/:id` routes | • Verifies ID parameter is present and valid string format. |
| `validateLeadPagination`| `GET /api/crm/leads` | • `page`: Must be positive integer $\ge 1$.<br>• `limit`: Must be integer between 1 and 100. |
| `validateAddLeadNote` | `POST /api/crm/leads/:id/notes` | • `content`: Required, non-empty string, max 2000 characters. |
| `validateAssignLead` | `PATCH /api/crm/leads/:id/assign` | • `assignedTo`: Required non-empty string referencing user ID. |

---

## 4. API Endpoints Specification & Verification

### 4.1 Core Lead CRUD Endpoints

#### 1. Create Lead: `POST /api/crm/leads`
* **Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
* **Request Payload:**
  ```json
  {
    "name": "Bruce Wayne",
    "email": "bruce@wayne.com",
    "phone": "+1 555 123 4567",
    "company": "Wayne Enterprises",
    "status": "New"
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "id": "lead-xxx",
    "organizationId": "org-mtnwupyk-lujdx",
    "name": "Bruce Wayne",
    "email": "bruce@wayne.com",
    "phone": "+1 555 123 4567",
    "company": "Wayne Enterprises",
    "status": "New",
    "assignedTo": null,
    "createdAt": "2026-09-10T12:00:00.000Z",
    "updatedAt": "2026-09-10T12:00:00.000Z"
  }
  ```

#### 2. Get Leads with Pagination: `GET /api/crm/leads`
* **Query Parameters:** `?page=1&limit=5&status=Qualified`
* **Success Response (200 OK):**
  ```json
  {
    "leads": [ ... ],
    "pagination": {
      "total": 5,
      "page": 1,
      "limit": 5,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```

#### 3. Get Lead by ID: `GET /api/crm/leads/:id`
* **Success Response (200 OK):** Returns single lead with populated `assignedTo` object if assigned.
* **Error Response (404 Not Found):** Returns 404 if lead does not exist or belongs to another organization.

#### 4. Update Lead: `PATCH /api/crm/leads/:id`
* **Request Payload:**
  ```json
  {
    "status": "Contacted",
    "company": "Wayne Global Industries"
  }
  ```
* **Success Response (200 OK):** Returns updated lead object reflecting only modified fields.

#### 5. Delete Lead: `DELETE /api/crm/leads/:id`
* **Success Response (200 OK):**
  ```json
  {
    "message": "Lead deleted successfully",
    "id": "lead-xxx"
  }
  ```
* **Cascading Guarantee:** All linked notes in `lead_notes` automatically deleted by SQLite foreign key constraint.

---

### 4.2 Lead Management Features (Notes & Staff Assignment)

#### 6. Add Lead Note: `POST /api/crm/leads/:id/notes`
* **Request Payload:**
  ```json
  {
    "content": "Conducted initial discovery call. Client interested in AI workflow integration."
  }
  ```
* **Success Response (201 Created):**
  ```json
  {
    "id": "lnote-xxx",
    "leadId": "lead-xxx",
    "author": {
      "id": "user-mtnwupyk-ju4o4",
      "name": "Dhrumil Patel",
      "email": "boy067283@gmail.com"
    },
    "content": "Conducted initial discovery call. Client interested in AI workflow integration.",
    "createdAt": "2026-09-10T12:05:00.000Z",
    "updatedAt": "2026-09-10T12:05:00.000Z"
  }
  ```

#### 7. Get Lead Notes: `GET /api/crm/leads/:id/notes`
* **Success Response (200 OK):** Returns array of notes ordered with the newest notes first.

#### 8. Assign Lead: `PATCH /api/crm/leads/:id/assign`
* **Security Rule:** Validates that target user exists and belongs to the **same tenant organization**. Cross-tenant assignment returns `400 Bad Request`.
* **Request Payload:**
  ```json
  {
    "assignedTo": "user-mtnwupyk-ju4o4"
  }
  ```
* **Success Response (200 OK):** Returns lead with populated `assignedTo: { id, name, email }`.

---

## 5. Security & Multi-Tenant Boundary Verification

* **Authentication:** All 8 endpoints are protected by `authMiddleware.js`. Missing or invalid tokens return `401 Unauthorized`.
* **Tenant Isolation:** Enforced on every single database query via `req.user.organizationId`.
* **Cross-Tenant Test Scenarios (Org A vs Org B):**
  * Org B querying `GET /api/crm/leads` receives **0 results** for Org A's leads.
  * Org B direct requests to `GET`, `PATCH`, `DELETE`, `POST /notes`, `GET /notes`, or `PATCH /assign` against Org A's lead return `404 Not Found`.
  * Attempting to assign a staff member from Org B to Org A's lead is rejected with `400 Bad Request`.

---

## 6. Testing & Quality Assurance Summary

### 6.1 Test Execution Matrix

| Test Suite | Command | Cases | Result |
|---|---|:---:|:---:|
| **Day 6 Lead Management** | `node test_day6_leads.js` | 67 | **67 Passed, 0 Failed (100%)** |
| Auth & JWT Suite | `node test_auth.js` | 10 | **10 Passed, 0 Failed (100%)** |
| Day 3 CRM DB Suite | `node test_crm_db.js` | 8 | **8 Passed, 0 Failed (100%)** |
| Day 4 Quotation & Ticket DB | `node test_day4_db.js` | 13 | **13 Passed, 0 Failed (100%)** |
| Persistence Verification | `node test_persistence_verification.js` | 32 | **32 Passed, 0 Failed (100%)** |
| Day 5 Isolation & Review | `node test_day5_review.js` | 37 | **37 Passed, 0 Failed (100%)** |
| **Frontend Production Build** | `npm run build` | — | **Built cleanly in 494ms** |

---

## 7. Proof Checklist for Submission

Attach the following screenshots in your Word document to accompany this report:

### 📷 Proof 1: Get Leads with Pagination (`GET /api/crm/leads`)
* **What to capture:** Postman screenshot showing `GET http://localhost:5000/api/crm/leads` returning `Status: 200 OK` with the `leads` array and the `pagination` object (`total: 5, page: 1, limit: 10`).

### 📷 Proof 2: Create a Lead (`POST /api/crm/leads`)
* **What to capture:** Postman screenshot showing `POST http://localhost:5000/api/crm/leads` with JSON body (`name`, `email`, `company`) returning `Status: 201 Created` with the generated lead record.

### 📷 Proof 3: Add Note to Lead (`POST /api/crm/leads/:id/notes`)
* **What to capture:** Postman screenshot showing `POST /api/crm/leads/<id>/notes` with `{ "content": "..." }` returning `Status: 201 Created` with author details attached.

### 📷 Proof 4: Assign Lead (`PATCH /api/crm/leads/:id/assign`)
* **What to capture:** Postman screenshot showing `PATCH /api/crm/leads/<id>/assign` with `{ "assignedTo": "<userId>" }` returning `Status: 200 OK` with the assigned user details.

### 📷 Proof 5: Invalid Data Rejection (Input Validation)
* **What to capture:** Postman screenshot showing `POST /api/crm/leads` with missing name or bad email returning `Status: 400 Bad Request` with `"message": "Lead name is required and cannot be empty"`.

### 📷 Proof 6: Automated Test Suite Terminal Output
* **What to capture:** Terminal screenshot running:
  ```bash
  node test_day6_leads.js
  ```
  showing:
  `DAY 6 TEST SUITE SUMMARY: 67 PASSED, 0 FAILED`.

### 📷 Proof 7: Git Commit & Remote Push
* **What to capture:** Terminal screenshot running:
  ```bash
  git log -1
  git status
  ```
  showing commit `0355d31`: `"Implement lead management APIs"` and `working tree clean`.
