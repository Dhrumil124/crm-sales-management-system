/**
 * Quotation Input Validation Middleware (Day 8 Backend)
 * Enforces strict input validation adhering directly to SQLite schema constraints.
 */

const ALLOWED_STATUSES = ["Draft", "Sent", "Accepted", "Declined"];

/**
 * Validates quotation ID parameter presence and format
 */
const validateQuotationId = (req, res, next) => {
  const { id } = req.params;
  if (!id || typeof id !== "string" || !id.trim()) {
    return res.status(400).json({ message: "Quotation ID parameter is required" });
  }
  next();
};

/**
 * Validates query pagination and filter parameters (GET /api/quotations)
 */
const validateQuotationPagination = (req, res, next) => {
  const { page, limit } = req.query;

  if (page !== undefined) {
    const p = Number(page);
    if (!Number.isInteger(p) || p < 1) {
      return res.status(400).json({
        message: "Query parameter 'page' must be a positive integer >= 1"
      });
    }
  }

  if (limit !== undefined) {
    const l = Number(limit);
    if (!Number.isInteger(l) || l < 1 || l > 100) {
      return res.status(400).json({
        message: "Query parameter 'limit' must be an integer between 1 and 100"
      });
    }
  }

  next();
};

/**
 * Validates request body for quotation creation (POST /api/quotations)
 */
const validateCreateQuotation = (req, res, next) => {
  const { customerId, items, status, discount, issueDate, validUntil } = req.body || {};

  // 1. Customer ID is required
  if (!customerId || typeof customerId !== "string" || !customerId.trim()) {
    return res.status(400).json({
      message: "A valid client must be selected for the quotation"
    });
  }

  // 2. Status validation if provided
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status '${status}'. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
    });
  }

  // 3. Discount validation if provided
  if (discount !== undefined) {
    const d = Number(discount);
    if (isNaN(d) || d < 0) {
      return res.status(400).json({
        message: "Quotation discount must be a non-negative number >= 0"
      });
    }
  }

  // 4. Line items validation if provided
  if (items !== undefined) {
    if (!Array.isArray(items)) {
      return res.status(400).json({ message: "Quotation items must be an array" });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item || typeof item !== "object") {
        return res.status(400).json({ message: `Item #${i + 1} must be an object` });
      }

      if (!item.description || typeof item.description !== "string" || !item.description.trim()) {
        return res.status(400).json({ message: `Item #${i + 1} must have a valid description` });
      }

      const qty = Number(item.quantity);
      if (isNaN(qty) || qty <= 0) {
        return res.status(400).json({ message: `Item #${i + 1} quantity must be greater than zero` });
      }

      const price = Number(item.unitPrice ?? item.unit_price);
      if (isNaN(price) || price < 0) {
        return res.status(400).json({ message: `Item #${i + 1} unit price cannot be negative` });
      }

      const tax = Number(item.taxRate ?? item.tax_rate ?? 0);
      if (isNaN(tax) || tax < 0) {
        return res.status(400).json({ message: `Item #${i + 1} tax rate cannot be negative` });
      }
    }
  }

  next();
};

/**
 * Validates request body for adding a line item (POST /api/quotations/:id/items)
 */
const validateAddQuotationItem = (req, res, next) => {
  const { description, quantity, unitPrice, unit_price, taxRate, tax_rate } = req.body || {};

  if (!description || typeof description !== "string" || !description.trim()) {
    return res.status(400).json({ message: "Item description is required and cannot be empty" });
  }

  if (quantity === undefined || quantity === null) {
    return res.status(400).json({ message: "Item quantity is required" });
  }
  const qty = Number(quantity);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ message: "Item quantity must be a positive number greater than 0" });
  }

  const rawPrice = unitPrice !== undefined ? unitPrice : unit_price;
  if (rawPrice === undefined || rawPrice === null) {
    return res.status(400).json({ message: "Item unit price is required" });
  }
  const price = Number(rawPrice);
  if (isNaN(price) || price < 0) {
    return res.status(400).json({ message: "Item unit price cannot be negative" });
  }

  const rawTax = taxRate !== undefined ? taxRate : tax_rate;
  if (rawTax !== undefined && rawTax !== null) {
    const tax = Number(rawTax);
    if (isNaN(tax) || tax < 0) {
      return res.status(400).json({ message: "Item tax rate cannot be negative" });
    }
  }

  next();
};

/**
 * Validates request body for quotation update (PATCH /api/quotations/:id)
 * Only updates quotation-level fields.
 */
const validateUpdateQuotation = (req, res, next) => {
  const body = req.body || {};
  const allowedKeys = ["customerId", "status", "validUntil", "issueDate", "notes", "discount"];
  const presentKeys = Object.keys(body).filter((k) => allowedKeys.includes(k));

  if (presentKeys.length === 0) {
    return res.status(400).json({
      message: `At least one valid field to update must be provided: ${allowedKeys.join(", ")}`
    });
  }

  if (body.status !== undefined && !ALLOWED_STATUSES.includes(body.status)) {
    return res.status(400).json({
      message: `Invalid status '${body.status}'. Allowed values: ${ALLOWED_STATUSES.join(", ")}`
    });
  }

  if (body.customerId !== undefined) {
    if (typeof body.customerId !== "string" || !body.customerId.trim()) {
      return res.status(400).json({ message: "Customer ID cannot be empty" });
    }
  }

  if (body.discount !== undefined) {
    const d = Number(body.discount);
    if (isNaN(d) || d < 0) {
      return res.status(400).json({ message: "Quotation discount must be a non-negative number >= 0" });
    }
  }

  next();
};

module.exports = {
  validateQuotationId,
  validateQuotationPagination,
  validateCreateQuotation,
  validateAddQuotationItem,
  validateUpdateQuotation
};
