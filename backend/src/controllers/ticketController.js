/**
 * Support Ticket Management Controller (Day 9 Backend)
 * Complete multi-tenant operations with SQLite persistence, auto-numbering,
 * threaded comments, assignment verification, and attachment handling.
 */

const path = require("path");
const ticketStore = require("../services/ticketStore");

/**
 * GET /api/tickets
 * Retrieves support tickets strictly scoped to req.user.organizationId.
 */
const getAllTickets = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { status, priority, customerId, search, assignedTo, page, limit } = req.query;

    const data = await ticketStore.getAll({
      status,
      priority,
      customerId,
      search,
      assignedTo,
      page,
      limit,
      organizationId
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tickets", error: error.message });
  }
};

/**
 * GET /api/tickets/:id
 * Retrieves a single ticket by canonical ID with comments and attachments.
 */
const getTicketById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const ticket = await ticketStore.getById(req.params.id, organizationId);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch ticket", error: error.message });
  }
};

/**
 * POST /api/tickets
 * Creates a new ticket with server-generated auto-numbering (TICKET-00001 format).
 */
const createTicket = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const {
      title,
      description,
      priority,
      status,
      customerId,
      assignedTo
    } = req.body || {};

    const newTicket = await ticketStore.create({
      title,
      description,
      priority,
      status,
      customerId,
      assignedTo,
      organizationId
    });

    res.status(201).json(newTicket);
  } catch (error) {
    const errMsg = error.message || "";
    const isClientErr =
      errMsg.includes("required") ||
      errMsg.includes("does not exist") ||
      errMsg.includes("does not belong") ||
      errMsg.includes("organization") ||
      errMsg.includes("empty");

    res.status(isClientErr ? 400 : 500).json({
      message: errMsg || "Failed to create ticket"
    });
  }
};

/**
 * PATCH /api/tickets/:id
 * Updates valid ticket-level fields in SQLite.
 */
const updateTicket = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const updated = await ticketStore.update(req.params.id, req.body, organizationId);
    if (!updated) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(updated);
  } catch (error) {
    const errMsg = error.message || "";
    const isClientErr =
      errMsg.includes("empty") ||
      errMsg.includes("Invalid") ||
      errMsg.includes("does not exist") ||
      errMsg.includes("does not belong");

    res.status(isClientErr ? 400 : 500).json({
      message: errMsg || "Failed to update ticket"
    });
  }
};

/**
 * PATCH /api/tickets/:id/status
 * Updates status with validated allowed status values.
 */
const updateTicketStatus = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { status } = req.body || {};
    const updated = await ticketStore.updateStatus(req.params.id, status, organizationId);
    if (!updated) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(updated);
  } catch (error) {
    const isClientErr = error.message && error.message.includes("Invalid");
    res.status(isClientErr ? 400 : 500).json({
      message: error.message || "Failed to update ticket status"
    });
  }
};

/**
 * PATCH /api/tickets/:id/assign
 * Assigns ticket to a verified same-organization user.
 */
const assignTicket = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const assignedTo = req.body?.assignedTo !== undefined ? req.body.assignedTo : req.body?.userId;
    const updated = await ticketStore.assign(req.params.id, assignedTo, organizationId);
    if (!updated) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(updated);
  } catch (error) {
    const isClientErr =
      error.message &&
      (error.message.includes("does not exist") || error.message.includes("does not belong"));

    res.status(isClientErr ? 400 : 500).json({
      message: error.message || "Failed to assign ticket"
    });
  }
};

/**
 * POST /api/tickets/:id/comments
 * Adds a threaded comment to a ticket.
 */
const addTicketComment = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { author, text, comment } = req.body || {};
    const updated = await ticketStore.addComment(
      req.params.id,
      {
        author: author ? author.trim() : "Staff",
        text: (text || comment || "").trim(),
        userId: req.user?.userId || null
      },
      organizationId
    );

    if (!updated) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Return the updated ticket with comments
    res.status(201).json(updated);
  } catch (error) {
    const isClientErr = error.message && error.message.includes("required");
    res.status(isClientErr ? 400 : 500).json({
      message: error.message || "Failed to add comment"
    });
  }
};

/**
 * POST /api/tickets/:id/attachments
 * Handles multipart file upload (via multer) or verified testing metadata.
 */
const uploadAttachment = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    let originalFilename = "";
    let storedPath = "";
    let mimeType = "";
    let fileSize = 0;

    if (req.file) {
      // Trust attributes derived strictly from multer uploaded file
      originalFilename = req.file.originalname;
      const relativePath = path
        .relative(path.join(__dirname, "../.."), req.file.path)
        .replace(/\\/g, "/");
      storedPath = relativePath.startsWith("storage") ? relativePath : `storage/attachments/${req.file.filename}`;
      mimeType = req.file.mimetype || "application/octet-stream";
      fileSize = req.file.size;
    } else {
      // Strictly validated testing metadata
      const cleanName = path.basename((req.body?.originalFilename || "").trim());
      if (!cleanName) {
        return res.status(400).json({ message: "File or valid originalFilename is required" });
      }
      originalFilename = cleanName;
      storedPath = `storage/attachments/meta_${Date.now()}_${cleanName}`;
      mimeType = req.body?.mimeType || "application/octet-stream";
      fileSize = Number(req.body?.fileSize) || 0;
    }

    const attachment = await ticketStore.uploadAttachment(
      req.params.id,
      {
        originalFilename,
        storedPath,
        mimeType,
        fileSize,
        commentId: req.body?.commentId || null,
        userId: req.user?.userId || null
      },
      organizationId
    );

    if (!attachment) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.status(201).json(attachment);
  } catch (error) {
    const isClientErr =
      error.message &&
      (error.message.includes("required") || error.message.includes("File size"));

    res.status(isClientErr ? 400 : 500).json({
      message: error.message || "Failed to upload attachment"
    });
  }
};

/**
 * DELETE /api/tickets/:id
 * Preserved for backward compatibility with older tests.
 */
const deleteTicket = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const success = await ticketStore.delete(req.params.id, organizationId);
    if (!success) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json({ message: "Ticket deleted successfully", id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete ticket", error: error.message });
  }
};

module.exports = {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  updateTicketStatus,
  assignTicket,
  addTicketComment,
  uploadAttachment,
  deleteTicket
};
