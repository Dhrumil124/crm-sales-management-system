const { ticketStore } = require("../services/storage");

const ALLOWED_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const ALLOWED_STATUSES = ["Open", "In Progress", "Waiting", "Resolved", "Closed"];

const getAllTickets = async (req, res) => {
  try {
    const { status, priority, customerId } = req.query;
    const data = await ticketStore.getAll({ status, priority, customerId });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch tickets", error: error.message });
  }
};

const getTicketById = async (req, res) => {
  try {
    const ticket = await ticketStore.getById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }
    res.json(ticket);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch ticket", error: error.message });
  }
};

const createTicket = async (req, res) => {
  try {
    const { title, description, priority, customerId, customerName, assignedTo } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Ticket title is required" });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: "Ticket description is required" });
    }

    const validatedPriority = ALLOWED_PRIORITIES.includes(priority) ? priority : "Medium";

    const newTicket = await ticketStore.create({
      title: title.trim(),
      description: description.trim(),
      priority: validatedPriority,
      customerId: customerId || "",
      customerName: customerName || "",
      assignedTo: assignedTo ? assignedTo.trim() : "Unassigned"
    });

    res.status(201).json(newTicket);
  } catch (error) {
    res.status(500).json({ message: "Failed to create ticket", error: error.message });
  }
};

const updateTicketStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
      });
    }

    const updated = await ticketStore.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update ticket status", error: error.message });
  }
};

const addComment = async (req, res) => {
  try {
    const { author, text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required" });
    }

    const updated = await ticketStore.addComment(req.params.id, {
      author: author ? author.trim() : "Staff",
      text: text.trim()
    });

    if (!updated) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.status(201).json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to add comment", error: error.message });
  }
};

const deleteTicket = async (req, res) => {
  try {
    const success = await ticketStore.delete(req.params.id);
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
  updateTicketStatus,
  addComment,
  deleteTicket
};
