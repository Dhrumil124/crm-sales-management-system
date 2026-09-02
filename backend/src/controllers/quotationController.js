const { quotationStore } = require("../services/storage");

const ALLOWED_STATUSES = ["Draft", "Sent", "Accepted", "Declined"];

const getAllQuotations = async (req, res) => {
  try {
    const { status, customerId } = req.query;
    const data = await quotationStore.getAll({ status, customerId });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch quotations", error: error.message });
  }
};

const getQuotationById = async (req, res) => {
  try {
    const quote = await quotationStore.getById(req.params.id);
    if (!quote) {
      return res.status(404).json({ message: "Quotation not found" });
    }
    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch quotation", error: error.message });
  }
};

/**
 * Creates a quotation.
 * CRITICAL REQUIREMENT: Totals, taxes, and line items are calculated
 * and validated securely on the backend.
 */
const createQuotation = async (req, res) => {
  try {
    const { customerId, customerName, items, status, issueDate, validUntil } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one quotation line item is required" });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.description || !item.description.trim()) {
        return res.status(400).json({ message: `Item #${i + 1} must have a description` });
      }
      if (Number(item.quantity) <= 0 || isNaN(Number(item.quantity))) {
        return res.status(400).json({ message: `Item #${i + 1} quantity must be greater than zero` });
      }
      if (Number(item.unitPrice) < 0 || isNaN(Number(item.unitPrice))) {
        return res.status(400).json({ message: `Item #${i + 1} unit price cannot be negative` });
      }
    }

    const validatedStatus = ALLOWED_STATUSES.includes(status) ? status : "Draft";

    const newQuotation = await quotationStore.create({
      customerId: customerId || "",
      customerName: customerName || "",
      items,
      status: validatedStatus,
      issueDate,
      validUntil
    });

    res.status(201).json(newQuotation);
  } catch (error) {
    res.status(500).json({ message: "Failed to create quotation", error: error.message });
  }
};

const updateQuotationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
      });
    }

    const updated = await quotationStore.updateStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update quotation status", error: error.message });
  }
};

const deleteQuotation = async (req, res) => {
  try {
    const success = await quotationStore.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Quotation not found" });
    }
    res.json({ message: "Quotation deleted successfully", id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete quotation", error: error.message });
  }
};

/**
 * Backend calculation preview endpoint
 */
const calculatePreview = (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Items array is required" });
    }
    const calculation = quotationStore.calculateTotals(items);
    res.json(calculation);
  } catch (error) {
    res.status(500).json({ message: "Failed to calculate totals", error: error.message });
  }
};

module.exports = {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotationStatus,
  deleteQuotation,
  calculatePreview
};
