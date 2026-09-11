/**
 * Request Validation Middleware for Ticket Endpoints (Day 9 Backend)
 */

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const ALLOWED_STATUSES = ["Open", "In Progress", "Waiting", "Resolved", "Closed"];

const validateTicketId = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ message: "Valid ticket ID is required" });
  }
  req.params.id = id.trim();
  next();
};

const validateTicketPagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page !== undefined) {
    const parsedPage = Number(page);
    if (!Number.isInteger(parsedPage) || parsedPage < 1) {
      return res.status(400).json({ message: "Page parameter must be a positive integer" });
    }
  }

  if (limit !== undefined) {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({ message: "Limit parameter must be an integer between 1 and 100" });
    }
  }

  next();
};

const validateCreateTicket = (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ message: "Request body is required" });
  }

  const { title, description, priority, status } = body;

  if (!title || typeof title !== "string" || !title.trim()) {
    return res.status(400).json({ message: "Ticket title is required and cannot be empty" });
  }
  if (title.trim().length > 200) {
    return res.status(400).json({ message: "Ticket title cannot exceed 200 characters" });
  }

  if (!description || typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ message: "Ticket description is required and cannot be empty" });
  }

  if (priority !== undefined && !ALLOWED_PRIORITIES.includes(priority)) {
    return res.status(400).json({
      message: `Invalid priority '${priority}'. Allowed values: ${ALLOWED_PRIORITIES.join(", ")}`
    });
  }

  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
    });
  }

  next();
};

const validateUpdateTicket = (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== "object" || Object.keys(body).length === 0) {
    return res.status(400).json({ message: "Request body must contain at least one valid field to update" });
  }

  const allowedFields = ["title", "description", "priority", "status", "customerId", "assignedTo"];
  const presentFields = Object.keys(body).filter((key) => allowedFields.includes(key));

  if (presentFields.length === 0) {
    return res.status(400).json({
      message: `No valid update fields provided. Allowed fields: ${allowedFields.join(", ")}`
    });
  }

  if ("title" in body) {
    if (typeof body.title !== "string" || !body.title.trim()) {
      return res.status(400).json({ message: "Ticket title cannot be empty" });
    }
    if (body.title.trim().length > 200) {
      return res.status(400).json({ message: "Ticket title cannot exceed 200 characters" });
    }
  }

  if ("description" in body) {
    if (typeof body.description !== "string" || !body.description.trim()) {
      return res.status(400).json({ message: "Ticket description cannot be empty" });
    }
  }

  if ("priority" in body && !ALLOWED_PRIORITIES.includes(body.priority)) {
    return res.status(400).json({
      message: `Invalid priority '${body.priority}'. Allowed values: ${ALLOWED_PRIORITIES.join(", ")}`
    });
  }

  if ("status" in body && !ALLOWED_STATUSES.includes(body.status)) {
    return res.status(400).json({
      message: `Invalid status '${body.status}'. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
    });
  }

  next();
};

const validateUpdateStatus = (req, res, next) => {
  const { status } = req.body || {};
  if (!status || !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
    });
  }
  next();
};

const validateAssignTicket = (req, res, next) => {
  const body = req.body;
  if (!body || typeof body !== "object") {
    return res.status(400).json({ message: "Request body is required" });
  }
  // assignedTo can be a string user ID / name or null/empty to unassign
  next();
};

const validateAddComment = (req, res, next) => {
  const { comment, text } = req.body || {};
  const content = (comment || text || "").trim();
  if (!content) {
    return res.status(400).json({ message: "Comment text is required and cannot be empty" });
  }
  next();
};

const validateAttachment = (req, res, next) => {
  // Check if multer parsed a real uploaded file
  if (req.file) {
    return next();
  }

  // Otherwise check if body contains JSON metadata for testing/compatibility
  const { originalFilename, fileSize } = req.body || {};
  if (!originalFilename || typeof originalFilename !== "string" || !originalFilename.trim()) {
    return res.status(400).json({ message: "Uploaded file or originalFilename metadata is required" });
  }

  if (fileSize !== undefined) {
    const size = Number(fileSize);
    if (!Number.isInteger(size) || size < 0) {
      return res.status(400).json({ message: "fileSize must be a non-negative integer" });
    }
  }

  next();
};

module.exports = {
  ALLOWED_PRIORITIES,
  ALLOWED_STATUSES,
  validateTicketId,
  validateTicketPagination,
  validateCreateTicket,
  validateUpdateTicket,
  validateUpdateStatus,
  validateAssignTicket,
  validateAddComment,
  validateAttachment
};
