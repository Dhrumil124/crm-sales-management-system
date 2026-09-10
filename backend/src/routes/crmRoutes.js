const express = require("express");
const {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
} = require("../controllers/crmController");

const {
  createLead,
  getAllLeads,
  getLeadById,
  updateLead,
  deleteLead,
  addLeadNote,
  getLeadNotes,
  assignLead
} = require("../controllers/leadController");

const {
  validateCreateLead,
  validateUpdateLead,
  validateLeadId,
  validateLeadPagination,
  validateAddLeadNote,
  validateAssignLead
} = require("../middleware/leadValidation");

const router = express.Router();

// Existing Customer Management Routes (Preserved Intact)
router.get("/customers", getAllCustomers);
router.get("/customers/:id", getCustomerById);
router.post("/customers", createCustomer);
router.put("/customers/:id", updateCustomer);
router.delete("/customers/:id", deleteCustomer);

// Day 6 Lead Management Routes
router.post("/leads", validateCreateLead, createLead);
router.get("/leads", validateLeadPagination, getAllLeads);
router.get("/leads/:id", validateLeadId, getLeadById);
router.patch("/leads/:id", validateLeadId, validateUpdateLead, updateLead);
router.delete("/leads/:id", validateLeadId, deleteLead);
router.post("/leads/:id/notes", validateLeadId, validateAddLeadNote, addLeadNote);
router.get("/leads/:id/notes", validateLeadId, getLeadNotes);
router.patch("/leads/:id/assign", validateLeadId, validateAssignLead, assignLead);

module.exports = router;

