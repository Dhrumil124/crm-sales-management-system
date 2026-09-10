const express = require("express");
const {
  getAllDeals,
  getDealById,
  createDeal,
  updateDeal,
  updateDealStage,
  getDealHistory,
  deleteDeal,
  getStats
} = require("../controllers/pipelineController");

const {
  validatePaginationAndFilters,
  validateCreateDeal,
  validateUpdateDeal,
  validateStageMovement,
  validateDealId
} = require("../middleware/pipelineValidation");

const router = express.Router();

// Day 7 Required Endpoints & Pipeline Analytics
router.get("/deals", validatePaginationAndFilters, getAllDeals);
router.get("/stats", getStats);
router.get("/deals/stats", getStats); // Backward compatibility
router.get("/deals/:id", validateDealId, getDealById);
router.get("/deals/:id/history", validateDealId, getDealHistory);

router.post("/deals", validateCreateDeal, createDeal);
router.put("/deals/:id", validateDealId, validateUpdateDeal, updateDeal);
router.patch("/deals/:id/stage", validateDealId, validateStageMovement, updateDealStage);
router.delete("/deals/:id", validateDealId, deleteDeal);

module.exports = router;
