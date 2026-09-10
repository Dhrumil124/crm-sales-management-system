/**
 * Pipeline Management Controller
 * Express request handlers for Deal CRUD, Stage Movement, History, and Pipeline Stats.
 * Scoped strictly to authenticated req.user.organizationId.
 */

const dealStore = require("../services/dealStore");

/**
 * GET /api/pipeline/deals
 * Retrieve deals with pagination and filtering
 */
const getAllDeals = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { page, limit, stage, search, customerId } = req.pagination || req.query || {};

    const result = await dealStore.getPaginated({
      organizationId,
      page,
      limit,
      stage,
      search,
      customerId
    });

    return res.status(200).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to fetch deals",
      error: error.message
    });
  }
};

/**
 * GET /api/pipeline/stats and GET /api/pipeline/deals/stats
 * Aggregate pipeline metrics directly from SQLite
 */
const getStats = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const stats = await dealStore.getStats(organizationId);
    return res.status(200).json(stats);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch pipeline stats",
      error: error.message
    });
  }
};

/**
 * GET /api/pipeline/deals/:id
 * Retrieve single deal by ID
 */
const getDealById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const deal = await dealStore.getById(req.params.id, organizationId);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }

    return res.status(200).json(deal);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch deal",
      error: error.message
    });
  }
};

/**
 * POST /api/pipeline/deals
 * Create deal with tenant reference checks and SQLite persistence
 */
const createDeal = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { title, customerId, value, stage, expectedCloseDate, notes } = req.body || {};

    const newDeal = await dealStore.create({
      organizationId,
      title: title.trim(),
      customerId: customerId || null,
      value: value !== undefined ? Number(value) : 0,
      stage: stage || "Lead In",
      expectedCloseDate: expectedCloseDate || null,
      notes: notes ? notes.trim() : null
    });

    return res.status(201).json(newDeal);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to create deal"
    });
  }
};

/**
 * PUT /api/pipeline/deals/:id
 * Update deal details
 */
const updateDeal = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const existing = await dealStore.getById(req.params.id, organizationId);
    if (!existing) {
      return res.status(404).json({ message: "Deal not found" });
    }

    const { title, customerId, value, stage, expectedCloseDate, notes } = req.body;

    const payload = {};
    if (title !== undefined) payload.title = title.trim();
    if (customerId !== undefined) payload.customerId = customerId;
    if (value !== undefined) payload.value = Number(value);
    if (stage !== undefined) payload.stage = stage;
    if (expectedCloseDate !== undefined) payload.expectedCloseDate = expectedCloseDate;
    if (notes !== undefined) payload.notes = notes ? notes.trim() : "";

    const updated = await dealStore.update(req.params.id, payload, organizationId);
    return res.status(200).json(updated);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to update deal"
    });
  }
};

/**
 * PATCH /api/pipeline/deals/:id/stage
 * Move deal stage and record persistent history atomically
 */
const updateDealStage = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const stage = req.body?.stage ?? req.body?.stageId;
    if (!stage || typeof stage !== "string" || !stage.trim()) {
      return res.status(400).json({ message: "Target stage is required" });
    }

    const updated = await dealStore.updateStage(
      req.params.id,
      stage.trim(),
      organizationId,
      req.user?.userId || req.user?.id
    );

    if (!updated) {
      return res.status(404).json({ message: "Deal not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to update deal stage"
    });
  }
};

/**
 * GET /api/pipeline/deals/:id/history
 * Retrieve deal stage transition audit trail
 */
const getDealHistory = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const history = await dealStore.getHistory(req.params.id, organizationId);
    if (history === null) {
      return res.status(404).json({ message: "Deal not found" });
    }

    return res.status(200).json({ history });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch deal history",
      error: error.message
    });
  }
};

/**
 * DELETE /api/pipeline/deals/:id
 * Delete deal
 */
const deleteDeal = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const success = await dealStore.delete(req.params.id, organizationId);
    if (!success) {
      return res.status(404).json({ message: "Deal not found" });
    }

    return res.status(200).json({ message: "Deal deleted successfully", id: req.params.id });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete deal",
      error: error.message
    });
  }
};

module.exports = {
  getAllDeals,
  getDealById,
  createDeal,
  updateDeal,
  updateDealStage,
  getDealHistory,
  deleteDeal,
  getStats
};
