/**
 * Lead Management Controller
 * Express request handlers for Lead CRUD, Pagination, Notes, and Assignment.
 */

const leadStore = require("../services/leadStore");

const createLead = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { name, email, phone, company, status, assignedTo } = req.body;

    const lead = await leadStore.create({
      organizationId,
      name,
      email,
      phone,
      company,
      status,
      assignedTo
    });

    return res.status(201).json(lead);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to create lead"
    });
  }
};

const getAllLeads = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { page, limit, search, status } = req.query;

    const result = await leadStore.getAll({
      organizationId,
      page,
      limit,
      search,
      status
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch leads",
      error: error.message
    });
  }
};

const getLeadById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const lead = await leadStore.getById(req.params.id, organizationId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.status(200).json(lead);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lead",
      error: error.message
    });
  }
};

const updateLead = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const updated = await leadStore.update(req.params.id, req.body, organizationId);
    if (!updated) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to update lead"
    });
  }
};

const deleteLead = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const success = await leadStore.delete(req.params.id, organizationId);
    if (!success) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.status(200).json({
      message: "Lead deleted successfully",
      id: req.params.id
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to delete lead",
      error: error.message
    });
  }
};

const addLeadNote = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const authorId = req.user?.userId || req.user?.id;
    const { content } = req.body;

    const note = await leadStore.addNote(
      req.params.id,
      { content, authorId },
      organizationId
    );

    if (!note) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.status(201).json(note);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to add lead note",
      error: error.message
    });
  }
};

const getLeadNotes = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const notes = await leadStore.getNotes(req.params.id, organizationId);
    if (notes === null) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.status(200).json(notes);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch lead notes",
      error: error.message
    });
  }
};

const assignLead = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const targetUserId = req.body?.assignedTo ?? req.body?.userId;

    const lead = await leadStore.assign(req.params.id, targetUserId, organizationId);
    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    return res.status(200).json(lead);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: error.message || "Failed to assign lead"
    });
  }
};

module.exports = {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  addLeadNote,
  getLeadNotes,
  assignLead
};
