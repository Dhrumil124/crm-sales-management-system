const { dealStore } = require("../services/storage");

const ALLOWED_STAGES = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];

const getAllDeals = async (req, res) => {
  try {
    const { stage, customerId } = req.query;
    const data = await dealStore.getAll({ stage, customerId });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deals", error: error.message });
  }
};

const getDealById = async (req, res) => {
  try {
    const deal = await dealStore.getById(req.params.id);
    if (!deal) {
      return res.status(404).json({ message: "Deal not found" });
    }
    res.json(deal);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch deal", error: error.message });
  }
};

const createDeal = async (req, res) => {
  try {
    const { title, customerId, customerName, value, stage, expectedCloseDate, notes } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Deal title is required" });
    }

    const validatedStage = ALLOWED_STAGES.includes(stage) ? stage : "Lead";
    const numericValue = Number(value);
    if (isNaN(numericValue) || numericValue < 0) {
      return res.status(400).json({ message: "Deal value must be a valid positive number" });
    }

    const newDeal = await dealStore.create({
      title: title.trim(),
      customerId: customerId || "",
      customerName: customerName || "",
      value: numericValue,
      stage: validatedStage,
      expectedCloseDate: expectedCloseDate || "",
      notes: notes ? notes.trim() : ""
    });

    res.status(201).json(newDeal);
  } catch (error) {
    res.status(500).json({ message: "Failed to create deal", error: error.message });
  }
};

const updateDeal = async (req, res) => {
  try {
    const existing = await dealStore.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Deal not found" });
    }

    const { title, customerId, customerName, value, stage, expectedCloseDate, notes } = req.body;

    const payload = {};
    if (title) payload.title = title.trim();
    if (customerId !== undefined) payload.customerId = customerId;
    if (customerName !== undefined) payload.customerName = customerName;
    if (value !== undefined) {
      const num = Number(value);
      if (isNaN(num) || num < 0) {
        return res.status(400).json({ message: "Deal value must be a valid non-negative number" });
      }
      payload.value = num;
    }
    if (stage && ALLOWED_STAGES.includes(stage)) payload.stage = stage;
    if (expectedCloseDate !== undefined) payload.expectedCloseDate = expectedCloseDate;
    if (notes !== undefined) payload.notes = notes.trim();

    const updated = await dealStore.update(req.params.id, payload);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update deal", error: error.message });
  }
};

const updateDealStage = async (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage || !ALLOWED_STAGES.includes(stage)) {
      return res.status(400).json({
        message: `Invalid stage. Allowed values: ${ALLOWED_STAGES.join(", ")}`
      });
    }

    const updated = await dealStore.updateStage(req.params.id, stage);
    if (!updated) {
      return res.status(404).json({ message: "Deal not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update deal stage", error: error.message });
  }
};

const deleteDeal = async (req, res) => {
  try {
    const success = await dealStore.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Deal not found" });
    }
    res.json({ message: "Deal deleted successfully", id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete deal", error: error.message });
  }
};

const getStats = async (req, res) => {
  try {
    const stats = await dealStore.getStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch pipeline stats", error: error.message });
  }
};

module.exports = {
  getAllDeals,
  getDealById,
  createDeal,
  updateDeal,
  updateDealStage,
  deleteDeal,
  getStats
};
