const express = require("express");
const {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  addQuotationItem,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  generatePdf,
  calculatePreview
} = require("../controllers/quotationController");

const {
  validateQuotationId,
  validateQuotationPagination,
  validateCreateQuotation,
  validateAddQuotationItem,
  validateUpdateQuotation
} = require("../middleware/quotationValidation");

const router = express.Router();

// 1. GET /api/quotations - List quotations with filters and pagination
router.get("/", validateQuotationPagination, getAllQuotations);

// Preserved preview calculation endpoint
router.post("/preview", calculatePreview);

// 2. POST /api/quotations - Create quotation with server-side auto-numbering
router.post("/", validateCreateQuotation, createQuotation);

// 3. POST /api/quotations/:id/items - Add line item and recalculate totals
router.post("/:id/items", validateQuotationId, validateAddQuotationItem, addQuotationItem);

// 4. GET /api/quotations/:id/pdf - Generate and stream PDF quotation
router.get("/:id/pdf", validateQuotationId, generatePdf);
router.get("/:id/download", validateQuotationId, generatePdf); // Convenience alias

// Preserved status update endpoint (Day 5 test compatibility)
router.patch("/:id/status", validateQuotationId, updateQuotationStatus);

// 5. GET /api/quotations/:id - Retrieve quotation details with line items
router.get("/:id", validateQuotationId, getQuotationById);

// 6. PATCH /api/quotations/:id - Update quotation-level fields
router.patch("/:id", validateQuotationId, validateUpdateQuotation, updateQuotation);

// 7. DELETE /api/quotations/:id - Delete quotation and line items
router.delete("/:id", validateQuotationId, deleteQuotation);

module.exports = router;
