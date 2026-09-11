/**
 * Quotation Storage & Data Access Service (Day 8 Backend)
 * SQLite direct queries with enforced multi-tenant organization scoping,
 * atomic transactions, and server-side auto-numbering.
 */

const { run, get, all, runTransaction, generateId, calculateQuotationTotals } = require("../database/db");

const ALLOWED_STATUSES = ["Draft", "Sent", "Accepted", "Declined"];

const formatCustomerDisplay = (name, company) => {
  if (name && company) return `${name} (${company})`;
  if (name) return name;
  if (company) return company;
  return "Unknown Client";
};

/**
 * Server-side automatic quotation number generator.
 * Format: AUTO-00001, AUTO-00002, AUTO-00003...
 * Scoped to organization; safely continues from existing persisted records;
 * guarantees uniqueness and avoids duplicate collisions.
 */
const getNextQuoteNumber = async (organizationId) => {
  const existingQuotes = await all(
    "SELECT quote_number FROM quotations WHERE organization_id = ?",
    [organizationId]
  );

  let maxSeq = 0;
  for (const q of existingQuotes) {
    if (q.quote_number) {
      const match = q.quote_number.match(/^AUTO-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let quoteNumber = `AUTO-${String(nextSeq).padStart(5, "0")}`;

  // Collision check loop against database
  while (
    await get(
      "SELECT id FROM quotations WHERE organization_id = ? AND quote_number = ?",
      [organizationId, quoteNumber]
    )
  ) {
    nextSeq++;
    quoteNumber = `AUTO-${String(nextSeq).padStart(5, "0")}`;
  }

  return quoteNumber;
};

/**
 * Normalizes raw SQLite rows into standard Quotation API response objects
 */
const mapQuotation = (q, items = []) => ({
  id: q.id,
  quoteNumber: q.quote_number,
  customerId: q.customer_id,
  customerName: formatCustomerDisplay(q.cust_name, q.cust_company),
  customerEmail: q.cust_email || "",
  customerPhone: q.cust_phone || "",
  customerCompany: q.cust_company || "",
  customerAddress: q.cust_address || "",
  items: items.map((i) => ({
    id: i.id,
    quotationId: i.quotation_id,
    description: i.description,
    quantity: Number(i.quantity),
    unitPrice: Number(i.unit_price),
    taxRate: Number(i.tax_rate),
    taxAmount: Number(i.tax_amount),
    lineTotal: Number(i.line_total),
    createdAt: i.created_at
  })),
  subtotal: Number(q.subtotal),
  taxTotal: Number(q.tax_total),
  discount: Number(q.discount || 0),
  grandTotal: Number(q.grand_total),
  status: q.status,
  issueDate: q.issue_date,
  validUntil: q.valid_until,
  notes: q.notes || "",
  organizationId: q.organization_id,
  createdAt: q.created_at,
  updatedAt: q.updated_at
});

const quotationStore = {
  getNextQuoteNumber,

  /**
   * Retrieves quotations with tenant filtering, customer joins, search, and pagination.
   */
  async getAll({
    status = "",
    customerId = "",
    search = "",
    page = null,
    limit = null,
    organizationId = null
  } = {}) {
    let baseQuery = `
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (organizationId) {
      baseQuery += " AND q.organization_id = ?";
      params.push(organizationId);
    }

    if (status) {
      baseQuery += " AND LOWER(q.status) = LOWER(?)";
      params.push(status.trim());
    }

    if (customerId) {
      baseQuery += " AND q.customer_id = ?";
      params.push(customerId.trim());
    }

    if (search) {
      baseQuery += " AND (q.quote_number LIKE ? OR q.notes LIKE ? OR c.name LIKE ? OR c.company LIKE ?)";
      const pattern = `%${search.trim()}%`;
      params.push(pattern, pattern, pattern, pattern);
    }

    // Count total matches
    const countRow = await get(`SELECT COUNT(*) as total ${baseQuery}`, params);
    const total = countRow ? countRow.total : 0;

    let query = `
      SELECT q.*, 
             c.name as cust_name,
             c.company as cust_company,
             c.email as cust_email,
             c.phone as cust_phone,
             c.address as cust_address
      ${baseQuery}
      ORDER BY q.created_at DESC
    `;

    const queryParams = [...params];

    const isPaginated = page !== null || limit !== null;
    let parsedPage = 1;
    let parsedLimit = 20;

    if (isPaginated) {
      parsedPage = Math.max(1, Number(page) || 1);
      parsedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
      const offset = (parsedPage - 1) * parsedLimit;
      query += " LIMIT ? OFFSET ?";
      queryParams.push(parsedLimit, offset);
    }

    const dbQuotes = await all(query, queryParams);
    const result = [];

    for (const q of dbQuotes) {
      const items = await all(
        "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY rowid ASC",
        [q.id]
      );
      result.push(mapQuotation(q, items));
    }

    if (isPaginated) {
      const totalPages = Math.ceil(total / parsedLimit) || 1;
      const paginatedResponse = {
        quotations: result,
        pagination: {
          total,
          page: parsedPage,
          limit: parsedLimit,
          totalPages,
          hasNextPage: parsedPage < totalPages,
          hasPrevPage: parsedPage > 1
        }
      };

      // Non-enumerable helpers so code expecting Array functions (e.g. some/filter/map) also works
      Object.defineProperty(paginatedResponse, "length", {
        value: result.length,
        enumerable: false,
        writable: true
      });
      Object.defineProperty(paginatedResponse, Symbol.iterator, {
        value: function* () {
          yield* result;
        },
        enumerable: false,
        writable: true
      });
      ["some", "every", "filter", "map", "find", "forEach"].forEach((fn) => {
        Object.defineProperty(paginatedResponse, fn, {
          value: function (...args) {
            return result[fn](...args);
          },
          enumerable: false,
          writable: true
        });
      });

      return paginatedResponse;
    }

    return result;
  },

  /**
   * Retrieves single quotation by ID or quote_number with line items and customer details.
   */
  async getById(id, organizationId = null) {
    let query = `
      SELECT q.*, 
             c.name as cust_name,
             c.company as cust_company,
             c.email as cust_email,
             c.phone as cust_phone,
             c.address as cust_address
      FROM quotations q
      LEFT JOIN customers c ON q.customer_id = c.id
      WHERE (q.id = ? OR q.quote_number = ?)
    `;
    const params = [id, id];

    if (organizationId) {
      query += " AND q.organization_id = ?";
      params.push(organizationId);
    }

    const q = await get(query, params);
    if (!q) return null;

    const items = await all(
      "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY rowid ASC",
      [q.id]
    );

    return mapQuotation(q, items);
  },

  /**
   * Creates a new quotation with server-generated auto-numbering (AUTO-XXXXX).
   * Validates customer, calculates totals with discount, and executes inside an atomic SQLite transaction.
   */
  async create(data) {
    if (!data.customerId || !String(data.customerId).trim()) {
      throw new Error("A valid client must be selected for the quotation.");
    }

    const targetCustId = String(data.customerId).trim();

    // 1. Verify customer belongs to tenant
    let customer = null;
    if (data.organizationId) {
      customer = await get(
        "SELECT * FROM customers WHERE id = ? AND organization_id = ?",
        [targetCustId, data.organizationId]
      );
    } else {
      customer = await get("SELECT * FROM customers WHERE id = ?", [targetCustId]);
    }

    if (!customer) {
      // Check if ID belongs to another organization to reject cross-tenant manipulation
      if (data.organizationId) {
        const crossCust = await get("SELECT * FROM customers WHERE id = ?", [targetCustId]);
        if (crossCust && crossCust.organization_id !== data.organizationId) {
          throw new Error(`Client with ID "${targetCustId}" does not belong to your organization.`);
        }
      }

      // Check lead bridging within the same organization for backward compatibility
      let lead = null;
      if (data.organizationId) {
        lead = await get(
          "SELECT * FROM leads WHERE id = ? AND organization_id = ?",
          [targetCustId, data.organizationId]
        );
      } else {
        lead = await get("SELECT * FROM leads WHERE id = ?", [targetCustId]);
      }

      if (lead) {
        await run(
          `INSERT OR IGNORE INTO customers (id, organization_id, name, email, phone, company, address, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, null, 'Active', datetime('now'), datetime('now'))`,
          [lead.id, lead.organization_id, lead.name, lead.email, lead.phone, lead.company]
        );
        customer = await get("SELECT * FROM customers WHERE id = ?", [targetCustId]);
      }
    }

    if (!customer) {
      throw new Error(`Client with ID "${targetCustId}" does not exist in the database.`);
    }

    if (data.organizationId && customer.organization_id !== data.organizationId) {
      throw new Error(`Client with ID "${targetCustId}" does not belong to your organization.`);
    }

    const orgId = data.organizationId || customer.organization_id;
    if (!orgId) {
      throw new Error("organizationId is required to create a quotation.");
    }

    // 2. Validate discount and items
    const discount = Math.max(0, Number(data.discount) || 0);
    const items = Array.isArray(data.items) ? data.items : [];

    const { items: validatedItems, subtotal, taxTotal, grandTotal } = calculateQuotationTotals(
      items,
      discount
    );

    // 3. Generate sequential auto-numbering: AUTO-00001, AUTO-00002...
    const quoteNumber = await getNextQuoteNumber(orgId);
    const quoteId = generateId("quote");
    const now = new Date().toISOString();

    const status = ALLOWED_STATUSES.includes(data.status) ? data.status : "Draft";
    const issueDate = data.issueDate || now.split("T")[0];
    const validUntil =
      data.validUntil ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // 4. Atomic SQLite Transaction
    await runTransaction(async (tx) => {
      await tx.run(
        `INSERT INTO quotations (id, organization_id, quote_number, customer_id, issue_date, valid_until, status, subtotal, tax_total, discount, grand_total, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          quoteId,
          orgId,
          quoteNumber,
          customer.id,
          issueDate,
          validUntil,
          status,
          subtotal,
          taxTotal,
          discount,
          grandTotal,
          data.notes ? String(data.notes).trim() : null,
          now,
          now
        ]
      );

      for (const itm of validatedItems) {
        const itemId = generateId("qitem");
        await tx.run(
          `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            quoteId,
            itm.description,
            itm.quantity,
            itm.unit_price,
            itm.tax_rate,
            itm.tax_amount,
            itm.line_total,
            now
          ]
        );
      }
    });

    return await this.getById(quoteId, orgId);
  },

  /**
   * Adds a single line item to an existing quotation (POST /api/quotations/:id/items).
   * Recalculates quotation financial totals and persists changes atomically.
   */
  async addItem(quotationId, itemData, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is required for tenant isolation.");
    }

    const quote = await get(
      "SELECT * FROM quotations WHERE (id = ? OR quote_number = ?) AND organization_id = ?",
      [quotationId, quotationId, organizationId]
    );

    if (!quote) {
      return null;
    }

    const description = String(itemData.description || "").trim();
    if (!description) {
      throw new Error("Item description is required and cannot be empty.");
    }

    const qty = Number(itemData.quantity);
    if (isNaN(qty) || qty <= 0) {
      throw new Error("Item quantity must be a positive number greater than 0.");
    }

    const unitPrice = Number(itemData.unitPrice ?? itemData.unit_price);
    if (isNaN(unitPrice) || unitPrice < 0) {
      throw new Error("Item unit price cannot be negative.");
    }

    const taxRate = Math.max(0, Number(itemData.taxRate ?? itemData.tax_rate) || 0);
    const lineTotal = Number((qty * unitPrice).toFixed(2));
    const taxAmount = Number((lineTotal * (taxRate / 100)).toFixed(2));

    const itemId = generateId("qitem");
    const now = new Date().toISOString();

    let updatedQuote = null;
    let persistedItem = null;

    await runTransaction(async (tx) => {
      // 1. Insert line item
      await tx.run(
        `INSERT INTO quotation_items (id, quotation_id, description, quantity, unit_price, tax_rate, tax_amount, line_total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, quote.id, description, qty, unitPrice, taxRate, taxAmount, lineTotal, now]
      );

      // 2. Fetch all line items to recompute totals
      const allItems = await tx.all(
        "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY rowid ASC",
        [quote.id]
      );

      const discount = Number(quote.discount || 0);
      const totals = calculateQuotationTotals(allItems, discount);

      // 3. Update quotation header totals
      await tx.run(
        `UPDATE quotations
         SET subtotal = ?, tax_total = ?, grand_total = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [totals.subtotal, totals.taxTotal, totals.grandTotal, now, quote.id, organizationId]
      );

      persistedItem = {
        id: itemId,
        quotationId: quote.id,
        description,
        quantity: qty,
        unitPrice,
        taxRate,
        taxAmount,
        lineTotal,
        createdAt: now
      };
    });

    updatedQuote = await this.getById(quote.id, organizationId);

    return {
      item: persistedItem,
      quotation: updatedQuote
    };
  },

  /**
   * Updates quotation-level fields (PATCH /api/quotations/:id).
   * Supports: customerId, status, validUntil, issueDate, notes, discount.
   * Recalculates totals when discount changes.
   */
  async update(id, updateData, organizationId) {
    if (!organizationId) {
      throw new Error("organizationId is required for tenant isolation.");
    }

    const quote = await get(
      "SELECT * FROM quotations WHERE (id = ? OR quote_number = ?) AND organization_id = ?",
      [id, id, organizationId]
    );

    if (!quote) return null;

    let targetCustId = quote.customer_id;
    if (updateData.customerId !== undefined) {
      const newCustId = String(updateData.customerId).trim();
      if (!newCustId) {
        throw new Error("Customer ID cannot be empty.");
      }
      const customer = await get(
        "SELECT id FROM customers WHERE id = ? AND organization_id = ?",
        [newCustId, organizationId]
      );
      if (!customer) {
        throw new Error(`Client with ID "${newCustId}" does not exist in your organization.`);
      }
      targetCustId = newCustId;
    }

    let status = quote.status;
    if (updateData.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(updateData.status)) {
        throw new Error(`Invalid status: ${updateData.status}. Allowed: ${ALLOWED_STATUSES.join(", ")}`);
      }
      status = updateData.status;
    }

    const issueDate = updateData.issueDate !== undefined ? String(updateData.issueDate).trim() : quote.issue_date;
    const validUntil = updateData.validUntil !== undefined ? String(updateData.validUntil).trim() : quote.valid_until;
    const notes = updateData.notes !== undefined ? (updateData.notes ? String(updateData.notes).trim() : null) : quote.notes;

    let discount = Number(quote.discount || 0);
    let recalculateTotals = false;

    if (updateData.discount !== undefined) {
      const parsedDiscount = Number(updateData.discount);
      if (isNaN(parsedDiscount) || parsedDiscount < 0) {
        throw new Error("Quotation discount must be a non-negative number.");
      }
      discount = parsedDiscount;
      recalculateTotals = true;
    }

    const now = new Date().toISOString();

    await runTransaction(async (tx) => {
      let subtotal = Number(quote.subtotal);
      let taxTotal = Number(quote.tax_total);
      let grandTotal = Number(quote.grand_total);

      if (recalculateTotals) {
        const items = await tx.all(
          "SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY rowid ASC",
          [quote.id]
        );
        const totals = calculateQuotationTotals(items, discount);
        subtotal = totals.subtotal;
        taxTotal = totals.taxTotal;
        grandTotal = totals.grandTotal;
      }

      await tx.run(
        `UPDATE quotations
         SET customer_id = ?, status = ?, issue_date = ?, valid_until = ?, notes = ?, discount = ?, subtotal = ?, tax_total = ?, grand_total = ?, updated_at = ?
         WHERE id = ? AND organization_id = ?`,
        [targetCustId, status, issueDate, validUntil, notes, discount, subtotal, taxTotal, grandTotal, now, quote.id, organizationId]
      );
    });

    return await this.getById(quote.id, organizationId);
  },

  /**
   * Preserved status update method for backward compatibility with Day 5 tests.
   */
  async updateStatus(id, status, organizationId = null) {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new Error(`Invalid status: ${status}. Must be Draft, Sent, Accepted, or Declined.`);
    }

    let quoteSql = "SELECT id, organization_id FROM quotations WHERE (id = ? OR quote_number = ?)";
    let quoteParams = [id, id];
    if (organizationId) {
      quoteSql += " AND organization_id = ?";
      quoteParams.push(organizationId);
    }

    const quote = await get(quoteSql, quoteParams);
    if (!quote) return null;

    const now = new Date().toISOString();
    let updateSql = "UPDATE quotations SET status = ?, updated_at = ? WHERE id = ?";
    let updateParams = [status, now, quote.id];
    if (organizationId) {
      updateSql += " AND organization_id = ?";
      updateParams.push(organizationId);
    }

    const updateRes = await run(updateSql, updateParams);
    if (!updateRes || updateRes.changes === 0) {
      throw new Error(`Failed to update quotation ${id} status in SQLite.`);
    }

    return await this.getById(quote.id, organizationId || quote.organization_id);
  },

  /**
   * Deletes a quotation and its line items safely inside an atomic transaction.
   */
  async delete(id, organizationId = null) {
    let quoteSql = "SELECT id, organization_id FROM quotations WHERE (id = ? OR quote_number = ?)";
    let quoteParams = [id, id];
    if (organizationId) {
      quoteSql += " AND organization_id = ?";
      quoteParams.push(organizationId);
    }

    const quote = await get(quoteSql, quoteParams);
    if (!quote) return false;

    await runTransaction(async (tx) => {
      await tx.run("DELETE FROM quotation_items WHERE quotation_id = ?", [quote.id]);
      await tx.run("DELETE FROM quotations WHERE id = ?", [quote.id]);
    });

    return true;
  },

  /**
   * Preview calculation utility (POST /api/quotations/preview).
   */
  calculateTotals(items = [], discount = 0) {
    return calculateQuotationTotals(items, discount);
  }
};

module.exports = quotationStore;
