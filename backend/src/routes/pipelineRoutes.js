const express = require("express");
const {
  getAllDeals,
  getDealById,
  createDeal,
  updateDeal,
  updateDealStage,
  deleteDeal,
  getStats
} = require("../controllers/pipelineController");

const router = express.Router();

router.get("/deals", getAllDeals);
router.get("/deals/stats", getStats);
router.get("/deals/:id", getDealById);
router.post("/deals", createDeal);
router.put("/deals/:id", updateDeal);
router.patch("/deals/:id/stage", updateDealStage);
router.delete("/deals/:id", deleteDeal);

module.exports = router;
