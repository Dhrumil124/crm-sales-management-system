/**
 * Pipeline Management Input Validation Middleware
 * Strict validations adhering directly to SQLite schema constraints.
 */

/**
 * Validates query pagination and filter parameters (GET /api/pipeline/deals)
 */
const validatePaginationAndFilters = (req, res, next) => {
  const { page, limit, stage, search, customerId } = req.query;

  let parsedPage = 1;
  let parsedLimit = 20;

  if (page !== undefined) {
    const p = Number(page);
    if (!Number.isInteger(p) || p < 1) {
      return res.status(400).json({
        message: "Query parameter 'page' must be a positive integer >= 1"
      });
    }
    parsedPage = p;
  }

  if (limit !== undefined) {
    const l = Number(limit);
    if (!Number.isInteger(l) || l < 1 || l > 100) {
      return res.status(400).json({
        message: "Query parameter 'limit' must be an integer between 1 and 100"
      });
    }
    parsedLimit = l;
  }

  req.pagination = {
    page: parsedPage,
    limit: parsedLimit,
    stage: typeof stage === "string" ? stage.trim() : "",
    search: typeof search === "string" ? search.trim() : "",
    customerId: typeof customerId === "string" ? customerId.trim() : ""
  };

  next();
};

/**
 * Validates request body for Deal creation (POST /api/pipeline/deals)
 */
const validateCreateDeal = (req, res, next) => {
  const { title, value, customerId, stage, expectedCloseDate, notes } = req.body || {};

  // 1. Title is required and non-empty
  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({
      message: "Deal title is required and cannot be empty"
    });
  }
  if (title.trim().length > 255) {
    return res.status(400).json({
      message: "Deal title cannot exceed 255 characters"
    });
  }

  // 2. Value must be a valid non-negative number
  if (value !== undefined && value !== null && value !== "") {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) {
      return res.status(400).json({
        message: "Deal value must be a valid non-negative number"
      });
    }
  }

  // 3. Customer ID if provided must be a string
  if (customerId !== undefined && customerId !== null && customerId !== "") {
    if (typeof customerId !== "string" || !customerId.trim()) {
      return res.status(400).json({
        message: "customerId must be a valid string identifier"
      });
    }
  }

  // 4. Expected close date if provided must be a valid string
  if (expectedCloseDate !== undefined && expectedCloseDate !== null && expectedCloseDate !== "") {
    if (typeof expectedCloseDate !== "string" || !expectedCloseDate.trim()) {
      return res.status(400).json({
        message: "expectedCloseDate must be a valid date string"
      });
    }
  }

  // 5. Notes length check
  if (notes !== undefined && notes !== null && typeof notes === "string") {
    if (notes.trim().length > 4000) {
      return res.status(400).json({
        message: "Notes cannot exceed 4000 characters"
      });
    }
  }

  next();
};

/**
 * Validates request body for Deal update (PUT /api/pipeline/deals/:id)
 */
const validateUpdateDeal = (req, res, next) => {
  if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      message: "Request body cannot be empty for update"
    });
  }

  const { title, value, notes } = req.body;

  if (title !== undefined) {
    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        message: "Deal title cannot be empty"
      });
    }
    if (title.trim().length > 255) {
      return res.status(400).json({
        message: "Deal title cannot exceed 255 characters"
      });
    }
  }

  if (value !== undefined) {
    const numValue = Number(value);
    if (isNaN(numValue) || numValue < 0) {
      return res.status(400).json({
        message: "Deal value must be a valid non-negative number"
      });
    }
  }

  if (notes !== undefined && typeof notes === "string" && notes.trim().length > 4000) {
    return res.status(400).json({
      message: "Notes cannot exceed 4000 characters"
    });
  }

  next();
};

/**
 * Validates stage movement request body (PATCH /api/pipeline/deals/:id/stage)
 */
const validateStageMovement = (req, res, next) => {
  const stage = req.body?.stage ?? req.body?.stageId;

  if (!stage || typeof stage !== "string" || !stage.trim()) {
    return res.status(400).json({
      message: "Target stage ('stage' or 'stageId') is required"
    });
  }

  next();
};

/**
 * Validates deal ID parameter
 */
const validateDealId = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({
      message: "Deal ID parameter is required"
    });
  }
  next();
};

module.exports = {
  validatePaginationAndFilters,
  validateCreateDeal,
  validateUpdateDeal,
  validateStageMovement,
  validateDealId
};
