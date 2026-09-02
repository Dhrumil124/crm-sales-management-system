const express = require("express");
const {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotationStatus,
  deleteQuotation,
  calculatePreview
} = require("../controllers/quotationController");

const router = express.Router();

router.get("/", getAllQuotations);
router.post("/preview", calculatePreview);
router.get("/:id", getQuotationById);
router.post("/", createQuotation);
router.patch("/:id/status", updateQuotationStatus);
router.delete("/:id", deleteQuotation);

module.exports = router;
