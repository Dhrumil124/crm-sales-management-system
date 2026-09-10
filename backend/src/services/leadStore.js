/**
 * Lead Storage & Data Access Service
 * SQLite direct queries with enforced multi-tenant organization scoping.
 */

const { run, get, all, generateId } = require("../database/db");

/**
 * Normalizes lead record format for consistent API consumption
 */
const formatLead = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    email: row.email || null,
    phone: row.phone || null,
    company: row.company || null,
    status: row.status || "New",
    assignedTo: row.assigned_to
      ? {
          id: row.assigned_to,
          name: row.assigned_to_name || "Assigned User",
          email: row.assigned_to_email || null
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

/**
 * Normalizes lead note record format
 */
const formatNote = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    leadId: row.lead_id,
    author: row.author_id
      ? {
          id: row.author_id,
          name: row.author_name || "Author",
          email: row.author_email || null
        }
      : null,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

const leadStore = {
  /**
   * Create a new Lead scoped to organization
   */
  async create({ organizationId, name, email, phone, company, status, assignedTo }) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    // Verify assigned user belongs to the same organization if provided
    let verifiedAssignedTo = null;
    if (assignedTo) {
      const user = await get(
        "SELECT id FROM users WHERE id = ? AND organization_id = ?",
        [assignedTo, organizationId]
      );
      if (!user) {
        const err = new Error("Assigned user does not belong to your organization or does not exist");
        err.statusCode = 400;
        throw err;
      }
      verifiedAssignedTo = user.id;
    }

    const leadId = generateId("lead");
    const now = new Date().toISOString();
    const finalStatus = status || "New";

    await run(
      `INSERT INTO leads (id, organization_id, name, email, phone, company, status, assigned_to, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leadId,
        organizationId,
        name.trim(),
        email ? email.trim() : null,
        phone ? phone.trim() : null,
        company ? company.trim() : null,
        finalStatus,
        verifiedAssignedTo,
        now,
        now
      ]
    );

    return await this.getById(leadId, organizationId);
  },

  /**
   * Retrieve Leads scoped to organization with pagination and optional search/status filters
   */
  async getAll({ organizationId, page = 1, limit = 10, search = "", status = "" } = {}) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (currentPage - 1) * pageLimit;

    const conditions = ["l.organization_id = ?"];
    const params = [organizationId];

    if (status && status.trim()) {
      conditions.push("l.status = ?");
      params.push(status.trim());
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push("(l.name LIKE ? OR l.company LIKE ? OR l.email LIKE ? OR l.phone LIKE ?)");
      params.push(term, term, term, term);
    }

    const whereSql = conditions.join(" AND ");

    // 1. Total matching count query
    const countRow = await get(
      `SELECT COUNT(*) as total FROM leads l WHERE ${whereSql}`,
      params
    );
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageLimit) || 1;

    // 2. Paginated rows query
    const rows = await all(
      `SELECT l.*, u.name as assigned_to_name, u.email as assigned_to_email
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    return {
      leads: rows.map(formatLead),
      pagination: {
        total,
        page: currentPage,
        limit: pageLimit,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPrevPage: currentPage > 1
      }
    };
  },

  /**
   * Get single Lead by ID scoped to organization
   */
  async getById(id, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const row = await get(
      `SELECT l.*, u.name as assigned_to_name, u.email as assigned_to_email
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE l.id = ? AND l.organization_id = ?`,
      [id, organizationId]
    );

    return formatLead(row);
  },

  /**
   * Partially update a Lead scoped to organization
   */
  async update(id, updates = {}, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const existing = await this.getById(id, organizationId);
    if (!existing) {
      return null;
    }

    const setClauses = [];
    const params = [];

    if (updates.name !== undefined) {
      setClauses.push("name = ?");
      params.push(updates.name.trim());
    }

    if (updates.email !== undefined) {
      setClauses.push("email = ?");
      params.push(updates.email ? updates.email.trim() : null);
    }

    if (updates.phone !== undefined) {
      setClauses.push("phone = ?");
      params.push(updates.phone ? updates.phone.trim() : null);
    }

    if (updates.company !== undefined) {
      setClauses.push("company = ?");
      params.push(updates.company ? updates.company.trim() : null);
    }

    if (updates.status !== undefined) {
      setClauses.push("status = ?");
      params.push(updates.status);
    }

    if (updates.assignedTo !== undefined) {
      if (updates.assignedTo) {
        const user = await get(
          "SELECT id FROM users WHERE id = ? AND organization_id = ?",
          [updates.assignedTo, organizationId]
        );
        if (!user) {
          const err = new Error("Assigned user does not belong to your organization or does not exist");
          err.statusCode = 400;
          throw err;
        }
        setClauses.push("assigned_to = ?");
        params.push(user.id);
      } else {
        setClauses.push("assigned_to = NULL");
      }
    }

    const now = new Date().toISOString();
    setClauses.push("updated_at = ?");
    params.push(now);

    params.push(id, organizationId);

    await run(
      `UPDATE leads SET ${setClauses.join(", ")} WHERE id = ? AND organization_id = ?`,
      params
    );

    return await this.getById(id, organizationId);
  },

  /**
   * Delete Lead scoped to organization (cascades to notes and communications via FK)
   */
  async delete(id, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const existing = await this.getById(id, organizationId);
    if (!existing) {
      return false;
    }

    await run(
      "DELETE FROM leads WHERE id = ? AND organization_id = ?",
      [id, organizationId]
    );

    return true;
  },

  /**
   * Add note to a Lead scoped to organization
   */
  async addNote(leadId, { content, authorId }, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const lead = await this.getById(leadId, organizationId);
    if (!lead) {
      return null;
    }

    const noteId = generateId("lnote");
    const now = new Date().toISOString();

    await run(
      `INSERT INTO lead_notes (id, lead_id, author_id, content, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [noteId, leadId, authorId || null, content.trim(), now, now]
    );

    const row = await get(
      `SELECT n.*, u.name as author_name, u.email as author_email
       FROM lead_notes n
       LEFT JOIN users u ON n.author_id = u.id
       WHERE n.id = ?`,
      [noteId]
    );

    return formatNote(row);
  },

  /**
   * Get all notes for a Lead scoped to organization
   */
  async getNotes(leadId, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const lead = await this.getById(leadId, organizationId);
    if (!lead) {
      return null;
    }

    const rows = await all(
      `SELECT n.*, u.name as author_name, u.email as author_email
       FROM lead_notes n
       LEFT JOIN users u ON n.author_id = u.id
       WHERE n.lead_id = ?
       ORDER BY n.created_at DESC`,
      [leadId]
    );

    return rows.map(formatNote);
  },

  /**
   * Assign a Lead to a staff user in the same organization
   */
  async assign(leadId, assignedToId, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const lead = await this.getById(leadId, organizationId);
    if (!lead) {
      return null;
    }

    // Verify user exists and belongs to the same organization
    const user = await get(
      "SELECT id, name, email FROM users WHERE id = ? AND organization_id = ?",
      [assignedToId, organizationId]
    );

    if (!user) {
      const err = new Error("Target user does not exist or does not belong to your organization");
      err.statusCode = 400;
      throw err;
    }

    const now = new Date().toISOString();
    await run(
      "UPDATE leads SET assigned_to = ?, updated_at = ? WHERE id = ? AND organization_id = ?",
      [user.id, now, leadId, organizationId]
    );

    return await this.getById(leadId, organizationId);
  }
};

module.exports = leadStore;
