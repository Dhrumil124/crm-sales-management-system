const { customerStore } = require("../services/storage");

const getAllCustomers = async (req, res) => {
  try {
    const { search, type, status } = req.query;
    const data = await customerStore.getAll({ search, type, status });
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch CRM contacts", error: error.message });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const customer = await customerStore.getById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Contact not found" });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch contact", error: error.message });
  }
};

const createCustomer = async (req, res) => {
  try {
    const { name, email, phone, company, type, status, notes } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Contact name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ message: "Valid email is required" });
    }

    const validatedType = type === "customer" ? "customer" : "lead";
    let validatedStatus = status;
    if (!validatedStatus) {
      validatedStatus = validatedType === "customer" ? "Active" : "New";
    }

    const newCustomer = await customerStore.create({
      name: name.trim(),
      email: email.trim(),
      phone: phone ? phone.trim() : "",
      company: company ? company.trim() : "",
      type: validatedType,
      status: validatedStatus,
      notes: notes ? notes.trim() : ""
    });

    res.status(201).json(newCustomer);
  } catch (error) {
    res.status(500).json({ message: "Failed to create contact", error: error.message });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { name, email, phone, company, type, status, notes } = req.body;
    const existing = await customerStore.getById(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Contact not found" });
    }

    const updated = await customerStore.update(req.params.id, {
      ...(name && { name: name.trim() }),
      ...(email && { email: email.trim() }),
      ...(phone !== undefined && { phone: phone.trim() }),
      ...(company !== undefined && { company: company.trim() }),
      ...(type && { type: type === "customer" ? "customer" : "lead" }),
      ...(status && { status }),
      ...(notes !== undefined && { notes: notes.trim() })
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: "Failed to update contact", error: error.message });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const success = await customerStore.delete(req.params.id);
    if (!success) {
      return res.status(404).json({ message: "Contact not found" });
    }
    res.json({ message: "Contact deleted successfully", id: req.params.id });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete contact", error: error.message });
  }
};

module.exports = {
  getAllCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer
};
