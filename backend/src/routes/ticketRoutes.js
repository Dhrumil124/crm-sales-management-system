const express = require("express");
const {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  updateTicketStatus,
  assignTicket,
  addTicketComment,
  uploadAttachment,
  deleteTicket
} = require("../controllers/ticketController");

const {
  validateTicketId,
  validateTicketPagination,
  validateCreateTicket,
  validateUpdateTicket,
  validateUpdateStatus,
  validateAssignTicket,
  validateAddComment,
  validateAttachment
} = require("../middleware/ticketValidation");

const { ticketAttachmentUpload } = require("../middleware/uploadMiddleware");

const router = express.Router();

// 1. GET /api/tickets - List tickets with filters, search, and pagination
router.get("/", validateTicketPagination, getAllTickets);

// 2. POST /api/tickets - Create ticket with server-side auto-numbering (TICKET-00001)
router.post("/", validateCreateTicket, createTicket);

// 3. GET /api/tickets/:id - Retrieve ticket details by canonical ID
router.get("/:id", validateTicketId, getTicketById);

// 4. PATCH /api/tickets/:id - Update valid ticket-level fields
router.patch("/:id", validateTicketId, validateUpdateTicket, updateTicket);

// 5. PATCH /api/tickets/:id/status - Update ticket status
router.patch("/:id/status", validateTicketId, validateUpdateStatus, updateTicketStatus);

// 6. PATCH /api/tickets/:id/assign - Assign ticket to same-org user
router.patch("/:id/assign", validateTicketId, validateAssignTicket, assignTicket);

// 7. POST /api/tickets/:id/comments - Add threaded comment
router.post("/:id/comments", validateTicketId, validateAddComment, addTicketComment);

// 8. POST /api/tickets/:id/attachments - Upload attachment file or test metadata
router.post("/:id/attachments", validateTicketId, ticketAttachmentUpload, validateAttachment, uploadAttachment);

// 9. DELETE /api/tickets/:id - Preserved for backward compatibility
router.delete("/:id", validateTicketId, deleteTicket);

module.exports = router;
