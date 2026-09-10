/**
 * Lead Management Input Validation Middleware
 * Strict validations adhering directly to SQLite schema constraints.
 */

const ALLOWED_STATUSES = [
  "New",
  "Contacted",
  "Qualified",
  "Lost",
  "Active",
  "Inactive",
  "Converted"
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates request body for Lead creation (POST /api/crm/leads)
 */
const validateCreateLead = (req, res, next) => {
  const { name, email, phone, company, status } = req.body || {};

  // 1. Validate required name
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({
      message: "Lead name is required and cannot be empty"
    });
  }
  if (name.trim().length > 100) {
    return res.status(400).json({
      message: "Lead name cannot exceed 100 characters"
    });
  }

  // 2. Validate email format if provided
  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        message: "Invalid email format"
      });
    }
    if (email.trim().length > 150) {
      return res.status(400).json({
        message: "Email cannot exceed 150 characters"
      });
    }
  }

  // 3. Validate phone if provided
  if (phone !== undefined && phone !== null && phone !== "") {
    if (typeof phone !== "string") {
      return res.status(400).json({
        message: "Phone must be a string"
      });
    }
    if (phone.trim().length > 30) {
      return res.status(400).json({
        message: "Phone number cannot exceed 30 characters"
      });
    }
  }

  // 4. Validate company if provided
  if (company !== undefined && company !== null && company !== "") {
    if (typeof company !== "string") {
      return res.status(400).json({
        message: "Company must be a string"
      });
    }
    if (company.trim().length > 100) {
      return res.status(400).json({
        message: "Company name cannot exceed 100 characters"
      });
    }
  }

  // 5. Validate status if provided
  if (status !== undefined && status !== null && status !== "") {
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
      });
    }
  }

  next();
};

/**
 * Validates request body for Lead update (PATCH /api/crm/leads/:id)
 */
const validateUpdateLead = (req, res, next) => {
  if (!req.body || typeof req.body !== "object" || Object.keys(req.body).length === 0) {
    return res.status(400).json({
      message: "Request body cannot be empty for update"
    });
  }

  const { name, email, phone, company, status } = req.body;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        message: "Lead name cannot be empty"
      });
    }
    if (name.trim().length > 100) {
      return res.status(400).json({
        message: "Lead name cannot exceed 100 characters"
      });
    }
  }

  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string" || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        message: "Invalid email format"
      });
    }
    if (email.trim().length > 150) {
      return res.status(400).json({
        message: "Email cannot exceed 150 characters"
      });
    }
  }

  if (phone !== undefined && phone !== null && phone !== "") {
    if (typeof phone !== "string") {
      return res.status(400).json({
        message: "Phone must be a string"
      });
    }
    if (phone.trim().length > 30) {
      return res.status(400).json({
        message: "Phone number cannot exceed 30 characters"
      });
    }
  }

  if (company !== undefined && company !== null && company !== "") {
    if (typeof company !== "string") {
      return res.status(400).json({
        message: "Company must be a string"
      });
    }
    if (company.trim().length > 100) {
      return res.status(400).json({
        message: "Company name cannot exceed 100 characters"
      });
    }
  }

  if (status !== undefined) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
      });
    }
  }

  next();
};

/**
 * Validates Lead ID parameter
 */
const validateLeadId = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({
      message: "Lead ID parameter is required"
    });
  }
  next();
};

/**
 * Validates query pagination parameters (GET /api/crm/leads)
 */
const validateLeadPagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page !== undefined) {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        message: "Query parameter 'page' must be a positive integer >= 1"
      });
    }
  }

  if (limit !== undefined) {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        message: "Query parameter 'limit' must be an integer between 1 and 100"
      });
    }
  }

  next();
};

/**
 * Validates note creation body (POST /api/crm/leads/:id/notes)
 */
const validateAddLeadNote = (req, res, next) => {
  const { content } = req.body || {};

  if (!content || typeof content !== "string" || !content.trim()) {
    return res.status(400).json({
      message: "Note content is required and cannot be empty"
    });
  }

  if (content.trim().length > 2000) {
    return res.status(400).json({
      message: "Note content cannot exceed 2000 characters"
    });
  }

  next();
};

/**
 * Validates lead assignment body (PATCH /api/crm/leads/:id/assign)
 */
const validateAssignLead = (req, res, next) => {
  const assignedTo = req.body?.assignedTo ?? req.body?.userId;

  if (!assignedTo || typeof assignedTo !== "string" || !assignedTo.trim()) {
    return res.status(400).json({
      message: "Target user ID ('assignedTo') is required"
    });
  }

  next();
};

module.exports = {
  ALLOWED_STATUSES,
  validateCreateLead,
  validateUpdateLead,
  validateLeadId,
  validateLeadPagination,
  validateAddLeadNote,
  validateAssignLead
};
