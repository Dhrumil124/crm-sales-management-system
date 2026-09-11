/**
 * Quotation Management Controller (Day 8 Backend)
 * Complete multi-tenant operations with SQLite persistence, auto-numbering,
 * item addition, totals calculation, and direct PDF generation.
 */

const quotationStore = require("../services/quotationStore");
const { generateQuotationPdf } = require("../services/pdfService");

const ALLOWED_STATUSES = ["Draft", "Sent", "Accepted", "Declined"];

/**
 * GET /api/quotations
 * Retrieves quotations scoped strictly to req.user.organizationId.
 */
const getAllQuotations = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { status, customerId, search, page, limit } = req.query;

    const data = await quotationStore.getAll({
      status,
      customerId,
      search,
      page,
      limit,
      organizationId
    });

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch quotations", error: error.message });
  }
};

/**
 * GET /api/quotations/:id
 * Retrieves a single quotation with its line items and customer information.
 */
const getQuotationById = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const quote = await quotationStore.getById(req.params.id, organizationId);
    if (!quote) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json(quote);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch quotation", error: error.message });
  }
};

/**
 * POST /api/quotations
 * Creates a new quotation with server-generated auto-numbering (AUTO-00001 format).
 */
const createQuotation = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const {
      customerId,
      items,
      status,
      discount,
      issueDate,
      validUntil,
      notes
    } = req.body || {};

    const newQuotation = await quotationStore.create({
      customerId,
      items,
      status,
      discount,
      issueDate,
      validUntil,
      notes,
      organizationId
    });

    res.status(201).json(newQuotation);
  } catch (error) {
    const errMsg = error.message || "";
    const isClientErr =
      errMsg.includes("client") ||
      errMsg.includes("Client") ||
      errMsg.includes("Customer") ||
      errMsg.includes("organization") ||
      errMsg.includes("item");

    res.status(isClientErr ? 400 : 500).json({
      message: errMsg || "Failed to create quotation"
    });
  }
};

/**
 * POST /api/quotations/:id/items
 * Adds a line item to an existing quotation, recalculates totals, and persists in SQLite.
 */
const addQuotationItem = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const result = await quotationStore.addItem(req.params.id, req.body, organizationId);
    if (!result) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.status(201).json({
      message: "Quotation item added successfully",
      id: result.item.id,
      quotationId: result.item.quotationId,
      description: result.item.description,
      quantity: result.item.quantity,
      unitPrice: result.item.unitPrice,
      taxRate: result.item.taxRate,
      taxAmount: result.item.taxAmount,
      lineTotal: result.item.lineTotal,
      item: result.item,
      quotation: result.quotation
    });
  } catch (error) {
    const isClientErr =
      error.message &&
      (error.message.includes("positive") ||
        error.message.includes("negative") ||
        error.message.includes("required"));

    res.status(isClientErr ? 400 : 500).json({
      message: error.message || "Failed to add quotation item"
    });
  }
};

/**
 * PATCH /api/quotations/:id
 * Updates quotation-level fields and recalculates totals if necessary.
 */
const updateQuotation = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const updated = await quotationStore.update(req.params.id, req.body, organizationId);
    if (!updated) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json(updated);
  } catch (error) {
    const isClientErr =
      error.message &&
      (error.message.includes("Invalid") ||
        error.message.includes("exist") ||
        error.message.includes("negative") ||
        error.message.includes("empty"));

    res.status(isClientErr ? 400 : 500).json({
      message: error.message || "Failed to update quotation"
    });
  }
};

/**
 * PATCH /api/quotations/:id/status
 * Preserved for backward compatibility with Day 5 tests.
 */
const updateQuotationStatus = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const { status } = req.body;
    if (!status || !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
      });
    }

    const updated = await quotationStore.updateStatus(req.params.id, status, organizationId);
    if (!updated) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update quotation status", error: error.message });
  }
};

/**
 * DELETE /api/quotations/:id
 * Safely deletes a quotation and its line items inside an atomic SQLite transaction.
 */
const deleteQuotation = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const success = await quotationStore.delete(req.params.id, organizationId);
    if (!success) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.json({ message: "Quotation deleted successfully", id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete quotation", error: error.message });
  }
};

/**
 * GET /api/quotations/:id/pdf
 * Generates and delivers a PDF document rendered directly from SQLite data.
 */
const generatePdf = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }

    const pdfData = await generateQuotationPdf(req.params.id, organizationId);
    if (!pdfData) {
      return res.status(404).json({ message: "Quotation not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${pdfData.filename}"`);
    res.setHeader("Content-Length", pdfData.buffer.length);

    res.send(pdfData.buffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to generate quotation PDF", error: error.message });
  }
};

/**
 * POST /api/quotations/preview
 * Preserved calculation preview endpoint.
 */
const calculatePreview = (req, res) => {
  try {
    const { items, discount } = req.body || {};
    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Items array is required" });
    }
    const calculation = quotationStore.calculateTotals(items, discount);
    res.json(calculation);
  } catch (error) {
    res.status(500).json({ message: "Failed to calculate totals", error: error.message });
  }
};

module.exports = {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  addQuotationItem,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  generatePdf,
  calculatePreview
};
