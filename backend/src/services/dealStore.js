/**
 * Pipeline Deals Storage & Data Access Service
 * SQLite direct queries with enforced multi-tenant organization scoping.
 */

const { run, get, all, generateId } = require("../database/db");

/**
 * Normalizes customer display string for deal client/company
 */
const formatCustomerDisplay = (name, company) => {
  if (name && company) return `${name} (${company})`;
  if (name) return name;
  if (company) return company;
  return "Unknown Client";
};

/**
 * Canonical stage mapping for standard CRM aliases
 */
const STAGE_ALIAS_MAP = {
  "lead": "Lead In",
  "lead in": "Lead In",
  "contacted": "Contact Made",
  "contact made": "Contact Made",
  "proposal": "Proposal Sent",
  "proposal sent": "Proposal Sent",
  "negotiation": "Negotiation",
  "won": "Closed Won",
  "closed won": "Closed Won",
  "lost": "Closed Lost",
  "closed lost": "Closed Lost"
};

/**
 * Maps stage names to short dashboard keys
 */
const SHORT_STAGE_MAP = {
  "lead in": "Lead",
  "contact made": "Contacted",
  "proposal sent": "Proposal",
  "negotiation": "Negotiation",
  "closed won": "Won",
  "closed lost": "Lost"
};

const normalizeStageAlias = (stageStr) => {
  if (!stageStr) return "Lead In";
  const lower = String(stageStr).toLowerCase().trim();
  return STAGE_ALIAS_MAP[lower] || stageStr;
};

const normalizeShortStage = (stageStr) => {
  if (!stageStr) return "Lead";
  const lower = String(stageStr).toLowerCase().trim();
  return SHORT_STAGE_MAP[lower] || stageStr;
};

/**
 * Formats a raw deal database row into an API-ready object
 */
const formatDeal = (row) => {
  if (!row) return null;
  const stageName = row.stage_name || "Lead In";
  const clientName = row.client_name || row.lead_name || "";
  const clientCompany = row.client_company || row.lead_company || "";

  return {
    id: row.id,
    organizationId: row.organization_id,
    title: row.title,
    customerId: row.lead_id || "",
    customerName: formatCustomerDisplay(clientName, clientCompany),
    client: clientName,
    company: clientCompany,
    value: Number(row.value) || 0,
    stageId: row.stage_id,
    stage: stageName,
    stageOrder: row.stage_order !== undefined ? Number(row.stage_order) : 1,
    stageColor: row.stage_color || "border-t-indigo-500",
    expectedCloseDate: row.expected_close_date || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

/**
 * Resolves stage input (ID or name or alias) against organization's pipeline stages
 */
const resolveStage = async (stageInput, organizationId) => {
  if (!stageInput || !organizationId) return null;
  const trimmed = String(stageInput).trim();
  const normalizedName = normalizeStageAlias(trimmed);

  // 1. Direct ID match
  const byId = await get(
    "SELECT id, name, stage_order, color FROM pipeline_stages WHERE id = ? AND organization_id = ?",
    [trimmed, organizationId]
  );
  if (byId) return byId;

  // 2. Exact or normalized name match
  const byName = await get(
    `SELECT id, name, stage_order, color FROM pipeline_stages 
     WHERE organization_id = ? AND (LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?))
     LIMIT 1`,
    [organizationId, trimmed, normalizedName]
  );
  if (byName) return byName;

  // 3. Fallback matching without org filter if org has no custom stages
  const fallback = await get(
    `SELECT id, name, stage_order, color FROM pipeline_stages 
     WHERE LOWER(name) = LOWER(?) OR LOWER(name) = LOWER(?)
     LIMIT 1`,
    [trimmed, normalizedName]
  );
  return fallback || null;
};

const dealStore = {
  /**
   * Retrieve deals with pagination, filtering, and metadata scoped to organization
   */
  async getPaginated({
    organizationId,
    page = 1,
    limit = 20,
    stage = "",
    search = "",
    customerId = ""
  } = {}) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (currentPage - 1) * pageLimit;

    const conditions = ["d.organization_id = ?"];
    const params = [organizationId];

    // Filter by stage (name, alias, or ID)
    if (stage && stage.trim()) {
      const target = stage.trim();
      const normName = normalizeStageAlias(target);
      conditions.push(
        "(d.stage_id = ? OR LOWER(s.name) = LOWER(?) OR LOWER(s.name) = LOWER(?))"
      );
      params.push(target, target, normName);
    }

    // Filter by customer / lead
    if (customerId && customerId.trim()) {
      conditions.push("d.lead_id = ?");
      params.push(customerId.trim());
    }

    // Search filter
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        "(d.title LIKE ? OR c.name LIKE ? OR l.name LIKE ? OR c.company LIKE ? OR l.company LIKE ?)"
      );
      params.push(term, term, term, term, term);
    }

    const whereSql = conditions.join(" AND ");

    // 1. Total matching count
    const countRow = await get(
      `SELECT COUNT(*) as total
       FROM deals d
       LEFT JOIN pipeline_stages s ON d.stage_id = s.id
       LEFT JOIN customers c ON d.lead_id = c.id
       LEFT JOIN leads l ON d.lead_id = l.id
       WHERE ${whereSql}`,
      params
    );
    const total = countRow ? countRow.total : 0;
    const totalPages = Math.ceil(total / pageLimit) || 1;

    // 2. Paginated deals rows
    const rows = await all(
      `SELECT d.*, 
              COALESCE(c.name, l.name, '') as client_name,
              COALESCE(c.company, l.company, '') as client_company,
              s.name as stage_name,
              s.stage_order,
              s.color as stage_color
       FROM deals d
       LEFT JOIN pipeline_stages s ON d.stage_id = s.id
       LEFT JOIN customers c ON d.lead_id = c.id
       LEFT JOIN leads l ON d.lead_id = l.id
       WHERE ${whereSql}
       ORDER BY d.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageLimit, offset]
    );

    return {
      deals: rows.map(formatDeal),
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
   * Retrieve all deals without pagination (raw array for internal services/dashboard)
   */
  async getAll({ organizationId = null, stage = "", customerId = "", search = "" } = {}) {
    const conditions = [];
    const params = [];

    if (organizationId) {
      conditions.push("d.organization_id = ?");
      params.push(organizationId);
    }

    if (stage && stage.trim()) {
      const target = stage.trim();
      const normName = normalizeStageAlias(target);
      conditions.push(
        "(d.stage_id = ? OR LOWER(s.name) = LOWER(?) OR LOWER(s.name) = LOWER(?))"
      );
      params.push(target, target, normName);
    }

    if (customerId && customerId.trim()) {
      conditions.push("d.lead_id = ?");
      params.push(customerId.trim());
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(
        "(d.title LIKE ? OR c.name LIKE ? OR l.name LIKE ? OR c.company LIKE ? OR l.company LIKE ?)"
      );
      params.push(term, term, term, term, term);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = await all(
      `SELECT d.*, 
              COALESCE(c.name, l.name, '') as client_name,
              COALESCE(c.company, l.company, '') as client_company,
              s.name as stage_name,
              s.stage_order,
              s.color as stage_color
       FROM deals d
       LEFT JOIN pipeline_stages s ON d.stage_id = s.id
       LEFT JOIN customers c ON d.lead_id = c.id
       LEFT JOIN leads l ON d.lead_id = l.id
       ${whereSql}
       ORDER BY d.created_at DESC`,
      params
    );

    return rows.map(formatDeal);
  },

  /**
   * Retrieve a single deal by ID scoped to organization
   */
  async getById(id, organizationId = null) {
    if (!id) return null;

    let query = `
      SELECT d.*, 
             COALESCE(c.name, l.name, '') as client_name,
             COALESCE(c.company, l.company, '') as client_company,
             s.name as stage_name,
             s.stage_order,
             s.color as stage_color
      FROM deals d
      LEFT JOIN pipeline_stages s ON d.stage_id = s.id
      LEFT JOIN customers c ON d.lead_id = c.id
      LEFT JOIN leads l ON d.lead_id = l.id
      WHERE d.id = ?
    `;
    const params = [id];

    if (organizationId) {
      query += ` AND d.organization_id = ?`;
      params.push(organizationId);
    }

    const row = await get(query, params);
    return formatDeal(row);
  },

  /**
   * Create a new deal with cross-tenant reference checks and SQLite persistence
   */
  async create({
    organizationId,
    title,
    customerId = null,
    value = 0,
    stage = "Lead In",
    expectedCloseDate = null,
    notes = null
  }) {
    if (!organizationId) {
      throw new Error("organizationId is strictly required");
    }
    if (!title || !title.trim()) {
      const err = new Error("Deal title is required");
      err.statusCode = 400;
      throw err;
    }

    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) {
      const err = new Error("Deal value must be a valid non-negative number");
      err.statusCode = 400;
      throw err;
    }

    // 1. Resolve and verify stage
    let matchedStage = await resolveStage(stage || "Lead In", organizationId);
    if (!matchedStage) {
      // Fallback to the first stage in the organization
      matchedStage = await get(
        "SELECT id, name, stage_order, color FROM pipeline_stages WHERE organization_id = ? ORDER BY stage_order ASC LIMIT 1",
        [organizationId]
      );
    }
    if (!matchedStage) {
      const err = new Error(`Invalid deal stage: '${stage}'. No matching pipeline stage found.`);
      err.statusCode = 400;
      throw err;
    }

    // 2. Validate customer reference if supplied (multi-tenant cross-org check)
    let validatedLeadId = null;
    if (customerId && String(customerId).trim()) {
      const cleanCustomerId = String(customerId).trim();

      // Check leads table
      let lead = await get(
        "SELECT id FROM leads WHERE id = ? AND organization_id = ?",
        [cleanCustomerId, organizationId]
      );

      if (!lead) {
        // Check customers table
        const cust = await get(
          "SELECT * FROM customers WHERE id = ? AND organization_id = ?",
          [cleanCustomerId, organizationId]
        );

        if (cust) {
          // Mirror into leads table so FK deals(lead_id) REFERENCES leads(id) succeeds
          await run(
            `INSERT OR IGNORE INTO leads (id, organization_id, name, email, phone, company, status)
             VALUES (?, ?, ?, ?, ?, ?, 'Qualified')`,
            [cust.id, organizationId, cust.name, cust.email, cust.phone, cust.company]
          );
          validatedLeadId = cust.id;
        } else {
          const err = new Error("Referenced customer does not belong to your organization or does not exist");
          err.statusCode = 400;
          throw err;
        }
      } else {
        validatedLeadId = lead.id;
      }
    }

    const newDealId = generateId("deal");
    const now = new Date().toISOString();

    await run(
      `INSERT INTO deals (id, organization_id, title, lead_id, stage_id, value, expected_close_date, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newDealId,
        organizationId,
        title.trim(),
        validatedLeadId,
        matchedStage.id,
        numValue,
        expectedCloseDate && String(expectedCloseDate).trim() ? String(expectedCloseDate).trim() : null,
        notes && String(notes).trim() ? String(notes).trim() : null,
        now,
        now
      ]
    );

    return await this.getById(newDealId, organizationId);
  },

  /**
   * Update deal details
   */
  async update(id, data, organizationId = null) {
    if (!id) return null;

    let checkSql = "SELECT id, organization_id, stage_id FROM deals WHERE id = ?";
    let checkParams = [id];
    if (organizationId) {
      checkSql += " AND organization_id = ?";
      checkParams.push(organizationId);
    }

    const existing = await get(checkSql, checkParams);
    if (!existing) return null;

    let stageId = existing.stage_id;
    if (data.stage) {
      const matched = await resolveStage(data.stage, existing.organization_id);
      if (!matched) {
        const err = new Error(`Invalid stage "${data.stage}"`);
        err.statusCode = 400;
        throw err;
      }
      stageId = matched.id;
    }

    let customerId = undefined;
    if (data.customerId !== undefined) {
      if (data.customerId) {
        const cleanCust = String(data.customerId).trim();
        const valid = await get(
          "SELECT id FROM customers WHERE id = ? AND organization_id = ?",
          [cleanCust, existing.organization_id]
        ) || await get(
          "SELECT id FROM leads WHERE id = ? AND organization_id = ?",
          [cleanCust, existing.organization_id]
        );
        if (!valid) {
          const err = new Error("Referenced customer does not belong to your organization");
          err.statusCode = 400;
          throw err;
        }
        customerId = cleanCust;
      } else {
        customerId = null;
      }
    }

    const now = new Date().toISOString();
    let updateSql = `UPDATE deals SET
         title = COALESCE(?, title),
         value = COALESCE(?, value),
         expected_close_date = COALESCE(?, expected_close_date),
         notes = COALESCE(?, notes),
         stage_id = ?,
         ${customerId !== undefined ? "lead_id = ?," : ""}
         updated_at = ?
       WHERE id = ?`;

    const updateParams = [
      data.title ? data.title.trim() : null,
      data.value !== undefined ? Number(data.value) : null,
      data.expectedCloseDate !== undefined ? data.expectedCloseDate : null,
      data.notes !== undefined ? (data.notes ? data.notes.trim() : "") : null,
      stageId
    ];

    if (customerId !== undefined) {
      updateParams.push(customerId);
    }
    updateParams.push(now, id);

    if (organizationId) {
      updateSql += " AND organization_id = ?";
      updateParams.push(organizationId);
    }

    await run(updateSql, updateParams);
    return await this.getById(id, organizationId);
  },

  /**
   * Move deal stage and record audit history atomically
   */
  async updateStage(id, stageInput, organizationId = null, userId = null) {
    if (!id) return null;

    let query = `
      SELECT d.id, d.organization_id, d.stage_id, s.name as current_stage_name
      FROM deals d
      LEFT JOIN pipeline_stages s ON d.stage_id = s.id
      WHERE d.id = ?
    `;
    let params = [id];
    if (organizationId) {
      query += " AND d.organization_id = ?";
      params.push(organizationId);
    }

    const dealRow = await get(query, params);
    if (!dealRow) return null;

    const orgId = dealRow.organization_id;

    // Resolve requested target stage
    const targetStage = await resolveStage(stageInput, orgId);
    if (!targetStage) {
      const err = new Error(`Invalid stage: "${stageInput}". No matching pipeline stage found.`);
      err.statusCode = 400;
      throw err;
    }

    const previousStageId = dealRow.stage_id;
    const previousStageName = dealRow.current_stage_name || "Lead In";

    // If stage did not actually change, skip history insertion
    if (previousStageId === targetStage.id) {
      return await this.getById(id, organizationId);
    }

    const now = new Date().toISOString();

    // 1. Update deal stage_id in SQLite
    let updateSql = "UPDATE deals SET stage_id = ?, updated_at = ? WHERE id = ?";
    let updateParams = [targetStage.id, now, id];
    if (organizationId) {
      updateSql += " AND organization_id = ?";
      updateParams.push(organizationId);
    }
    await run(updateSql, updateParams);

    // 2. Atomically record stage transition in deal_stage_history
    const historyId = generateId("dhist");
    await run(
      `INSERT INTO deal_stage_history (
         id, deal_id, organization_id, from_stage_id, from_stage_name, to_stage_id, to_stage_name, user_id, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        historyId,
        id,
        orgId,
        previousStageId,
        previousStageName,
        targetStage.id,
        targetStage.name,
        userId || null,
        now
      ]
    );

    return await this.getById(id, organizationId);
  },

  /**
   * Retrieve stage movement history for a deal
   */
  async getHistory(dealId, organizationId = null) {
    if (!dealId) return [];

    // Verify deal belongs to organization
    let checkSql = "SELECT id, organization_id FROM deals WHERE id = ?";
    let checkParams = [dealId];
    if (organizationId) {
      checkSql += " AND organization_id = ?";
      checkParams.push(organizationId);
    }
    const deal = await get(checkSql, checkParams);
    if (!deal) return null;

    const historyRows = await all(
      `SELECT h.*, u.name as user_name, u.email as user_email
       FROM deal_stage_history h
       LEFT JOIN users u ON h.user_id = u.id
       WHERE h.deal_id = ? AND h.organization_id = ?
       ORDER BY h.created_at DESC`,
      [dealId, deal.organization_id]
    );

    return historyRows.map(h => ({
      id: h.id,
      dealId: h.deal_id,
      fromStage: {
        id: h.from_stage_id,
        name: h.from_stage_name
      },
      toStage: {
        id: h.to_stage_id,
        name: h.to_stage_name
      },
      user: h.user_id
        ? {
            id: h.user_id,
            name: h.user_name || "User",
            email: h.user_email || null
          }
        : null,
      createdAt: h.created_at
    }));
  },

  /**
   * Delete deal
   */
  async delete(id, organizationId = null) {
    if (!id) return false;

    let delSql = "DELETE FROM deals WHERE id = ?";
    let delParams = [id];
    if (organizationId) {
      delSql += " AND organization_id = ?";
      delParams.push(organizationId);
    }
    const res = await run(delSql, delParams);
    return res && res.changes > 0;
  },

  /**
   * Calculate pipeline statistics directly from persisted SQLite tables
   */
  async getStats(organizationId = null) {
    let stagesQuery = "SELECT id, name, stage_order, color FROM pipeline_stages";
    let stagesParams = [];
    let dealsQuery = `
      SELECT d.*, s.name as stage_name
      FROM deals d
      LEFT JOIN pipeline_stages s ON d.stage_id = s.id
    `;
    let dealsParams = [];

    if (organizationId) {
      stagesQuery += " WHERE organization_id = ? ORDER BY stage_order ASC";
      stagesParams.push(organizationId);
      dealsQuery += " WHERE d.organization_id = ?";
      dealsParams.push(organizationId);
    } else {
      stagesQuery += " ORDER BY stage_order ASC";
    }

    // 1. Fetch organization pipeline stages in display order
    const stages = await all(stagesQuery, stagesParams);

    // 2. Fetch all deals
    const deals = await all(dealsQuery, dealsParams);

    const stageCounts = {};
    const stageValues = {};
    const byStage = {
      Lead: { count: 0, totalValue: 0 },
      Contacted: { count: 0, totalValue: 0 },
      Proposal: { count: 0, totalValue: 0 },
      Negotiation: { count: 0, totalValue: 0 },
      Won: { count: 0, totalValue: 0 },
      Lost: { count: 0, totalValue: 0 }
    };

    // Initialize canonical stage structures
    stages.forEach(s => {
      stageCounts[s.name] = 0;
      stageValues[s.name] = 0;
    });

    let totalValue = 0;
    let totalActiveValue = 0;
    let totalWonValue = 0;
    let totalLostValue = 0;
    let wonCount = 0;
    let lostCount = 0;

    deals.forEach(d => {
      const dealVal = Number(d.value) || 0;
      const rawStageName = d.stage_name || "Lead In";
      const shortStage = normalizeShortStage(rawStageName);

      totalValue += dealVal;

      if (stageCounts[rawStageName] !== undefined) {
        stageCounts[rawStageName] += 1;
        stageValues[rawStageName] += dealVal;
      } else {
        stageCounts[rawStageName] = (stageCounts[rawStageName] || 0) + 1;
        stageValues[rawStageName] = (stageValues[rawStageName] || 0) + dealVal;
      }

      if (byStage[shortStage]) {
        byStage[shortStage].count += 1;
        byStage[shortStage].totalValue += dealVal;
      }

      if (shortStage === "Won" || rawStageName.toLowerCase().includes("won")) {
        totalWonValue += dealVal;
        wonCount += 1;
      } else if (shortStage === "Lost" || rawStageName.toLowerCase().includes("lost")) {
        totalLostValue += dealVal;
        lostCount += 1;
      } else {
        totalActiveValue += dealVal;
      }
    });

    const totalDeals = deals.length;
    const closedCount = wonCount + lostCount;
    const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;
    const avgDealValue = totalDeals > 0 ? Math.round((totalValue / totalDeals) * 100) / 100 : 0;

    return {
      totalDeals,
      totalValue,
      totalActiveValue,
      totalWonValue,
      totalLostValue,
      stageCounts,
      stageValues,
      byStage,
      winRate,
      avgDealValue
    };
  }
};

module.exports = dealStore;
