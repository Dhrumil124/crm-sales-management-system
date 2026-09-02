const express = require("express");
const {
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
  addComment,
  deleteTicket
} = require("../controllers/ticketController");

const router = express.Router();

router.get("/", getAllTickets);
router.get("/:id", getTicketById);
router.post("/", createTicket);
router.patch("/:id/status", updateTicketStatus);
router.post("/:id/comments", addComment);
router.delete("/:id", deleteTicket);

module.exports = router;
