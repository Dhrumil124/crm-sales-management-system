/**
 * Ticket Storage & Data Access Service (Day 9 Backend)
 * Direct SQLite persistence, tenant scoping (organization_id),
 * server-side sequential auto-numbering (TICKET-00001),
 * threaded comments, and attachment handling.
 */

const { run, get, all, runTransaction, generateId } = require("../database/db");

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const ALLOWED_STATUSES = ["Open", "In Progress", "Waiting", "Resolved", "Closed"];

const formatCustomerDisplay = (name, company) => {
  const n = (name || "").trim();
  const c = (company || "").trim();
  if (n && c && n.toLowerCase() !== c.toLowerCase()) {
    return `${n} (${c})`;
  }
  return n || c || "Unknown Client";
};

/**
 * Server-side automatic ticket number generator.
 * Format: TICKET-00001, TICKET-00002, TICKET-00003...
 * Scoped per organization; safely continues from existing persisted records;
 * guarantees uniqueness and avoids duplicate collisions.
 */
const getNextTicketNumber = async (organizationId) => {
  const existingTickets = await all(
    "SELECT ticket_number FROM tickets WHERE organization_id = ?",
    [organizationId]
  );

  let maxSeq = 0;
  for (const t of existingTickets) {
    if (t.ticket_number) {
      const match = t.ticket_number.match(/^TICKET-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let ticketNumber = `TICKET-${String(nextSeq).padStart(5, "0")}`;

  // Collision check loop against database
  while (
    await get(
      "SELECT id FROM tickets WHERE organization_id = ? AND ticket_number = ?",
      [organizationId, ticketNumber]
    )
  ) {
    nextSeq++;
    ticketNumber = `TICKET-${String(nextSeq).padStart(5, "0")}`;
  }

  return ticketNumber;
};

/**
 * Normalizes raw SQLite rows into standard Ticket API response objects
 */
const mapTicket = (t, comments = [], attachments = []) => ({
  id: t.id,
  ticketNumber: t.ticket_number,
  organizationId: t.organization_id,
  customerId: t.customer_id || "",
  customerName: formatCustomerDisplay(t.cust_name, t.cust_company),
  customerEmail: t.cust_email || "",
  customerCompany: t.cust_company || "",
  title: t.title,
  description: t.description,
  priority: t.priority,
  status: t.status,
  assignedTo: t.assigned_name || (t.assigned_to ? "Staff" : "Unassigned"),
  assignedToId: t.assigned_to || null,
  assignedUser: t.assigned_to
    ? {
        id: t.assigned_to,
        name: t.assigned_name || "Staff",
        email: t.assigned_email || ""
      }
    : null,
  comments: comments.map((c) => ({
    id: c.id,
    ticketId: c.ticket_id,
    userId: c.user_id,
    author: c.author_name || "Staff",
    comment: c.comment,
    text: c.comment,
    createdAt: c.created_at,
    updatedAt: c.updated_at || c.created_at
  })),
  commentCount: comments.length,
  attachments: attachments.map((a) => ({
    id: a.id,
    ticketId: a.ticket_id,
    commentId: a.comment_id || null,
    uploadedBy: a.uploaded_by,
    uploaderName: a.uploader_name || "Staff",
    originalFilename: a.original_filename,
    storedPath: a.stored_path,
    mimeType: a.mime_type || "application/octet-stream",
    fileSize: a.file_size,
    createdAt: a.created_at
  })),
  attachmentCount: attachments.length,
  createdAt: t.created_at,
  updatedAt: t.updated_at
});

const ticketStore = {
  getNextTicketNumber,

  /**
   * Backward-compatible mirror sync method
   */
  async syncFromDatabase() {
    return true;
  },

  /**
   * Retrieves tickets with tenant filtering, search, and optional pagination.
   */
  async getAll({
    status = "",
    priority = "",
    customerId = "",
    search = "",
    assignedTo = "",
    page = null,
    limit = null,
    organizationId = null
  } = {}) {
    let baseQuery = `
      FROM tickets t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE 1=1
    `;
    const params = [];

    if (organizationId) {
      baseQuery += " AND t.organization_id = ?";
      params.push(organizationId);
    }

    if (status) {
      baseQuery += " AND LOWER(t.status) = LOWER(?)";
      params.push(status.trim());
    }

    if (priority) {
      baseQuery += " AND LOWER(t.priority) = LOWER(?)";
      params.push(priority.trim());
    }

    if (customerId) {
      baseQuery += " AND t.customer_id = ?";
      params.push(customerId.trim());
    }

    if (assignedTo) {
      baseQuery += " AND (t.assigned_to = ? OR LOWER(u.name) = LOWER(?))";
      params.push(assignedTo.trim(), assignedTo.trim());
    }

    if (search) {
      baseQuery += " AND (t.ticket_number LIKE ? OR t.title LIKE ? OR t.description LIKE ? OR c.name LIKE ? OR c.company LIKE ?)";
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern, pattern);
    }

    const countRow = await get(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = countRow ? countRow.total : 0;

    let query = `
      SELECT t.*, 
             c.name as cust_name,
             c.company as cust_company,
             c.email as cust_email,
             u.name as assigned_name,
             u.email as assigned_email
      ${baseQuery}
      ORDER BY t.created_at DESC
    `;

    const queryParams = [...params];
    const isPaginated = page !== null || limit !== null;
    let parsedPage = 1;
    let parsedLimit = 20;

    if (isPaginated) {
      parsedPage = Math.max(1, Number(page) || 1);
      parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
      const offset = (parsedPage - 1) * parsedLimit;
      query += " LIMIT ? OFFSET ?";
      queryParams.push(parsedLimit, offset);
    }

    const dbTickets = await all(query, queryParams);
    const result = [];

    for (const t of dbTickets) {
      const comments = await all(
        `SELECT tc.*, COALESCE(u.name, 'Staff') as author_name
         FROM ticket_comments tc
         LEFT JOIN users u ON tc.user_id = u.id
         WHERE tc.ticket_id = ?
         ORDER BY tc.created_at ASC`,
        [t.id]
      );

      const attachments = await all(
        `SELECT ta.*, COALESCE(u.name, 'Staff') as uploader_name
         FROM ticket_attachments ta
         LEFT JOIN users u ON ta.uploaded_by = u.id
         WHERE ta.ticket_id = ?
         ORDER BY ta.created_at ASC`,
        [t.id]
      );

      result.push(mapTicket(t, comments, attachments));
    }

    if (isPaginated) {
      const totalPages = Math.ceil(total / parsedLimit) || 1;
      const paginatedResponse = {
        tickets: result,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages,
          hasNextPage: parsedPage < totalPages,
          hasPrevPage: parsedPage > 1
        }
      };

      // Non-enumerable array helpers so callers treating it as array also work seamlessly
      Object.defineProperty(paginatedResponse, "length", {
        value: result.length,
        enumerable: false,
        writable: true
      });
      for (let i = 0; i < result.length; i++) {
        Object.defineProperty(paginatedResponse, i, {
          value: result[i],
          enumerable: false,
          writable: true
        });
      }
      paginatedResponse.map = (fn) => result.map(fn);
      paginatedResponse.filter = (fn) => result.filter(fn);
      paginatedResponse.find = (fn) => result.find(fn);
      paginatedResponse.some = (fn) => result.some(fn);
      paginatedResponse.forEach = (fn) => result.forEach(fn);
      paginatedResponse.slice = (...args) => result.slice(...args);
      paginatedResponse[Symbol.iterator] = function* () {
        for (const item of result) yield item;
      };

      return paginatedResponse;
    }

    return result;
  },

  /**
   * Retrieves a single ticket by canonical ID with comments and attachments.
   */
  async getById(id, organizationId = null) {
    let query = `
      SELECT t.*, 
             c.name as cust_name,
             c.company as cust_company,
             c.email as cust_email,
             c.phone as cust_phone,
             u.name as assigned_name,
             u.email as assigned_email
      FROM tickets t
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN users u ON t.assigned_to = u.id
      WHERE (t.id = ? OR t.ticket_number = ?)
    `;
    const params = [id, id];

    if (organizationId) {
      query += " AND t.organization_id = ?";
      params.push(organizationId);
    }

    const t = await get(query, params);
    if (!t) return null;

    const comments = await all(
      `SELECT tc.*, COALESCE(u.name, 'Staff') as author_name
       FROM ticket_comments tc
       LEFT JOIN users u ON tc.user_id = u.id
       WHERE tc.ticket_id = ?
       ORDER BY tc.created_at ASC`,
      [t.id]
    );

    const attachments = await all(
      `SELECT ta.*, COALESCE(u.name, 'Staff') as uploader_name
       FROM ticket_attachments ta
       LEFT JOIN users u ON ta.uploaded_by = u.id
       WHERE ta.ticket_id = ?
       ORDER BY ta.created_at ASC`,
      [t.id]
    );

    return mapTicket(t, comments, attachments);
  },

  /**
   * Creates a ticket with server-side auto-numbering (TICKET-00001 format).
   */
  async create(data) {
    let orgId = data.organizationId;
    if (!orgId) {
      // Direct call fallback for legacy persistence test compatibility
      if (data.customerId) {
        const cust = await get("SELECT organization_id FROM customers WHERE id = ?", [data.customerId]);
        if (cust) orgId = cust.organization_id;
      }
      if (!orgId) {
        const org = await get("SELECT id FROM organizations LIMIT 1");
        orgId = org ? org.id : "org-default";
      }
    }

    // Customer validation within organization
    let validCustomerId = null;
    if (data.customerId && data.customerId.trim()) {
      const cust = await get(
        "SELECT id FROM customers WHERE id = ? AND organization_id = ?",
        [data.customerId.trim(), orgId]
      );
      if (!cust) {
        throw new Error("Customer does not exist or does not belong to your organization");
      }
      validCustomerId = cust.id;
    }

    // Assigned user validation within organization
    let assignedUserId = null;
    if (data.assignedTo && typeof data.assignedTo === "string" && data.assignedTo.trim()) {
      const trimmed = data.assignedTo.trim();
      if (trimmed !== "Unassigned" && trimmed !== "Support Team") {
        const user = await get(
          "SELECT id FROM users WHERE (id = ? OR name = ?) AND organization_id = ?",
          [trimmed, trimmed, orgId]
        );
        if (!user) {
          throw new Error("Assigned user does not exist or does not belong to your organization");
        }
        assignedUserId = user.id;
      }
    }

    const priority = ALLOWED_PRIORITIES.includes(data.priority) ? data.priority : "Medium";
    const status = ALLOWED_STATUSES.includes(data.status) ? data.status : "Open";
    const title = (data.title || "").trim();
    const description = (data.description || "").trim();

    if (!title) {
      throw new Error("Ticket title is required");
    }
    if (!description) {
      throw new Error("Ticket description is required");
    }

    const ticketId = generateId("tck");
    const now = new Date().toISOString();

    let createdTicket = null;
    await runTransaction(async (tx) => {
      // Generate server-side sequential auto-number inside transaction
      const existingTickets = await tx.all(
        "SELECT ticket_number FROM tickets WHERE organization_id = ?",
        [orgId]
      );
      let maxSeq = 0;
      for (const t of existingTickets) {
        if (t.ticket_number) {
          const match = t.ticket_number.match(/^TICKET-(\d+)$/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxSeq) maxSeq = num;
          }
        }
      }
      let nextSeq = maxSeq + 1;
      let ticketNumber = `TICKET-${String(nextSeq).padStart(5, "0")}`;

      while (
        await tx.get(
          "SELECT id FROM tickets WHERE organization_id = ? AND ticket_number = ?",
          [orgId, ticketNumber]
        )
      ) {
        nextSeq++;
        ticketNumber = `TICKET-${String(nextSeq).padStart(5, "0")}`;
      }

      await tx.run(
        `INSERT INTO tickets (
          id, organization_id, ticket_number, customer_id, title,
          description, priority, status, assigned_to, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ticketId,
          orgId,
          ticketNumber,
          validCustomerId,
          title,
          description,
          priority,
          status,
          assignedUserId,
          now,
          now
        ]
      );
    });

    createdTicket = await this.getById(ticketId, orgId);
    return createdTicket;
  },

  /**
   * Updates valid existing ticket fields.
   */
  async update(id, data, organizationId) {
    const existing = await this.getById(id, organizationId);
    if (!existing) return null;

    let validCustomerId = existing.customerId || null;
    if ("customerId" in data) {
      if (data.customerId && data.customerId.trim()) {
        const cust = await get(
          "SELECT id FROM customers WHERE id = ? AND organization_id = ?",
          [data.customerId.trim(), organizationId]
        );
        if (!cust) {
          throw new Error("Customer does not exist or does not belong to your organization");
        }
        validCustomerId = cust.id;
      } else {
        validCustomerId = null;
      }
    }

    let assignedUserId = existing.assignedToId || null;
    if ("assignedTo" in data) {
      if (data.assignedTo && typeof data.assignedTo === "string" && data.assignedTo.trim()) {
        const trimmed = data.assignedTo.trim();
        if (trimmed === "Unassigned") {
          assignedUserId = null;
        } else {
          const user = await get(
            "SELECT id FROM users WHERE (id = ? OR name = ?) AND organization_id = ?",
            [trimmed, trimmed, organizationId]
          );
          if (!user) {
            throw new Error("Assigned user does not exist or does not belong to your organization");
          }
          assignedUserId = user.id;
        }
      } else {
        assignedUserId = null;
      }
    }

    const priority = data.priority
      ? ALLOWED_PRIORITIES.includes(data.priority)
        ? data.priority
        : existing.priority
      : existing.priority;

    const status = data.status
      ? ALLOWED_STATUSES.includes(data.status)
        ? data.status
        : existing.status
      : existing.status;

    const title = data.title !== undefined ? String(data.title).trim() : existing.title;
    const description = data.description !== undefined ? String(data.description).trim() : existing.description;

    if (data.title !== undefined && !title) {
      throw new Error("Ticket title cannot be empty");
    }
    if (data.description !== undefined && !description) {
      throw new Error("Ticket description cannot be empty");
    }

    const now = new Date().toISOString();
    await run(
      `UPDATE tickets SET
         title = ?,
         description = ?,
         priority = ?,
         status = ?,
         customer_id = ?,
         assigned_to = ?,
         updated_at = ?
       WHERE id = ? AND organization_id = ?`,
      [title, description, priority, status, validCustomerId, assignedUserId, now, existing.id, organizationId]
    );

    return await this.getById(existing.id, organizationId);
  },

  /**
   * Updates status of a ticket with validation.
   */
  async updateStatus(id, status, organizationId = null) {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new Error(`Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`);
    }

    let ticketSql = "SELECT id, organization_id FROM tickets WHERE (id = ? OR ticket_number = ?)";
    let ticketParams = [id, id];
    if (organizationId) {
      ticketSql += " AND organization_id = ?";
      ticketParams.push(organizationId);
    }

    const ticket = await get(ticketSql, ticketParams);
    if (!ticket) return null;

    const now = new Date().toISOString();
    let updateSql = "UPDATE tickets SET status = ?, updated_at = ? WHERE id = ?";
    let updateParams = [status, now, ticket.id];
    if (organizationId) {
      updateSql += " AND organization_id = ?";
      updateParams.push(organizationId);
    }

    await run(updateSql, updateParams);
    return await this.getById(ticket.id, organizationId || ticket.organization_id);
  },

  /**
   * Assigns ticket to a verified same-organization user.
   */
  async assign(id, assignedTo, organizationId) {
    const existing = await this.getById(id, organizationId);
    if (!existing) return null;

    let targetUserId = null;
    if (assignedTo && typeof assignedTo === "string" && assignedTo.trim()) {
      const trimmed = assignedTo.trim();
      if (trimmed !== "Unassigned") {
        const user = await get(
          "SELECT id FROM users WHERE (id = ? OR name = ?) AND organization_id = ?",
          [trimmed, trimmed, organizationId]
        );
        if (!user) {
          throw new Error("Assigned user does not exist or does not belong to your organization");
        }
        targetUserId = user.id;
      }
    }

    const now = new Date().toISOString();
    await run(
      "UPDATE tickets SET assigned_to = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
      [targetUserId, now, existing.id, organizationId]
    );

    return await this.getById(existing.id, organizationId);
  },

  /**
   * Adds a comment to a ticket.
   */
  async addComment(id, { author = "Staff", text, comment, userId = null }, organizationId = null) {
    const commentBody = (text || comment || "").trim();
    if (!commentBody) {
      throw new Error("Comment text is required");
    }

    let ticketSql = "SELECT id, organization_id FROM tickets WHERE (id = ? OR ticket_number = ?)";
    let ticketParams = [id, id];
    if (organizationId) {
      ticketSql += " AND organization_id = ?";
      ticketParams.push(organizationId);
    }

    const ticket = await get(ticketSql, ticketParams);
    if (!ticket) return null;

    let authorUserId = userId;
    if (!authorUserId && author) {
      const user = await get("SELECT id FROM users WHERE name = ? AND organization_id = ? LIMIT 1", [
        author,
        ticket.organization_id
      ]);
      if (user) authorUserId = user.id;
    }

    const commentId = generateId("comm");
    const now = new Date().toISOString();

    await run(
      `INSERT INTO ticket_comments (id, ticket_id, user_id, comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [commentId, ticket.id, authorUserId, commentBody, now, now]
    );

    await run(
      "UPDATE tickets SET updated_at = ? WHERE id = ?",
      [now, ticket.id]
    );

    return await this.getById(ticket.id, organizationId || ticket.organization_id);
  },

  /**
   * Adds an attachment record to a ticket.
   */
  async uploadAttachment(
    id,
    { originalFilename, storedPath, mimeType, fileSize, commentId = null, userId = null },
    organizationId
  ) {
    const ticket = await this.getById(id, organizationId);
    if (!ticket) return null;

    if (!originalFilename || !originalFilename.trim()) {
      throw new Error("Original filename is required");
    }
    if (!storedPath || !storedPath.trim()) {
      throw new Error("Stored path is required");
    }
    if (typeof fileSize !== "number" || fileSize < 0) {
      throw new Error("File size must be a non-negative number");
    }

    const attachmentId = generateId("att");
    const now = new Date().toISOString();

    await run(
      `INSERT INTO ticket_attachments (
        id, ticket_id, comment_id, uploaded_by, original_filename,
        stored_path, mime_type, file_size, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachmentId,
        ticket.id,
        commentId,
        userId,
        originalFilename.trim(),
        storedPath.trim(),
        mimeType || "application/octet-stream",
        fileSize,
        now
      ]
    );

    await run(
      "UPDATE tickets SET updated_at = ? WHERE id = ?",
      [now, ticket.id]
    );

    const attachmentRow = await get(
      `SELECT ta.*, COALESCE(u.name, 'Staff') as uploader_name
       FROM ticket_attachments ta
       LEFT JOIN users u ON ta.uploaded_by = u.id
       WHERE ta.id = ?`,
      [attachmentId]
    );

    return {
      id: attachmentRow.id,
      ticketId: attachmentRow.ticket_id,
      commentId: attachmentRow.comment_id,
      uploadedBy: attachmentRow.uploaded_by,
      uploaderName: attachmentRow.uploader_name,
      originalFilename: attachmentRow.original_filename,
      storedPath: attachmentRow.stored_path,
      mimeType: attachmentRow.mime_type,
      fileSize: attachmentRow.file_size,
      createdAt: attachmentRow.created_at
    };
  },

  /**
   * Legacy delete method preserved for test_persistence_verification.js compatibility.
   */
  async delete(id, organizationId = null) {
    let ticketSql = "SELECT id, organization_id FROM tickets WHERE (id = ? OR ticket_number = ?)";
    let ticketParams = [id, id];
    if (organizationId) {
      ticketSql += " AND organization_id = ?";
      ticketParams.push(organizationId);
    }

    const ticket = await get(ticketSql, ticketParams);
    if (!ticket) return false;

    await runTransaction(async (tx) => {
      await tx.run("DELETE FROM ticket_attachments WHERE ticket_id = ?", [ticket.id]);
      await tx.run("DELETE FROM ticket_comments WHERE ticket_id = ?", [ticket.id]);
      await tx.run("DELETE FROM tickets WHERE id = ?", [ticket.id]);
    });

    return true;
  }
};

module.exports = ticketStore;
