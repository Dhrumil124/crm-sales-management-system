const mongoose = require("mongoose");
const models = require("../models");

// Mapping table names to Mongoose models
const tableModelMap = {
  organizations: models.Organization,
  users: models.User,
  pipeline_stages: models.PipelineStage,
  customers: models.Customer,
  leads: models.Lead,
  lead_notes: models.LeadNote,
  lead_communications: models.LeadCommunication,
  deals: models.Deal,
  deal_stage_history: models.DealStageHistory,
  quotations: models.Quotation,
  quotation_items: models.QuotationItem,
  tickets: models.Ticket,
  ticket_comments: models.TicketComment,
  ticket_attachments: models.TicketAttachment,
  payments: models.Payment
};

let isConnected = false;
const syncQueue = new Set();
let syncTimer = null;

/**
 * Connect to MongoDB Atlas
 */
async function connectMongo() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI not found in environment, running in local-only mode.");
    return;
  }

  try {
    await mongoose.connect(uri);
    isConnected = true;
    console.log("Connected to MongoDB Atlas successfully.");
  } catch (err) {
    console.error("MongoDB Atlas connection error:", err.message);
  }
}

/**
 * Load all documents from MongoDB Atlas into SQLite on startup
 */
async function loadFromMongoToSqlite(sqliteDb) {
  if (!isConnected) return;

  try {
    for (const [tableName, model] of Object.entries(tableModelMap)) {
      const docs = await model.find({}).lean();
      if (!docs || docs.length === 0) continue;

      sqliteDb.serialize(() => {
        for (const doc of docs) {
          const cleanDoc = { ...doc };
          delete cleanDoc._id;
          delete cleanDoc.__v;

          // Convert ISO Dates to strings if necessary
          for (const key of Object.keys(cleanDoc)) {
            if (cleanDoc[key] instanceof Date) {
              cleanDoc[key] = cleanDoc[key].toISOString();
            }
          }

          const columns = Object.keys(cleanDoc);
          const placeholders = columns.map(() => "?").join(", ");
          const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
          const values = Object.values(cleanDoc);

          sqliteDb.run(sql, values, (err) => {
            if (err) {
              // Ignore benign constraint mismatches during initial load
            }
          });
        }
      });
    }
    console.log("Synchronized MongoDB Atlas collections into active database engine.");
  } catch (err) {
    console.error("Error loading data from MongoDB to SQLite:", err.message);
  }
}

/**
 * Sync a specific table from SQLite to MongoDB Atlas
 */
async function syncTableToMongo(tableName, sqliteDb) {
  const model = tableModelMap[tableName];
  if (!model || !isConnected) return;

  return new Promise((resolve) => {
    sqliteDb.all(`SELECT * FROM ${tableName}`, [], async (err, rows) => {
      if (err) {
        return resolve();
      }

      try {
        const rowsList = rows || [];
        const currentIds = rowsList.map((r) => r.id).filter(Boolean);

        // Delete any records removed from SQLite
        if (currentIds.length > 0) {
          await model.deleteMany({ id: { $nin: currentIds } });
        } else {
          await model.deleteMany({});
        }

        // Upsert all current records
        if (rowsList.length > 0) {
          const ops = rowsList.map((row) => {
            const doc = { ...row };
            // Normalize numeric fields
            if (doc.value !== undefined) doc.value = Number(doc.value) || 0;
            if (doc.stage_order !== undefined) doc.stage_order = Number(doc.stage_order) || 0;
            if (doc.subtotal !== undefined) doc.subtotal = Number(doc.subtotal) || 0;
            if (doc.tax_total !== undefined) doc.tax_total = Number(doc.tax_total) || 0;
            if (doc.discount !== undefined) doc.discount = Number(doc.discount) || 0;
            if (doc.grand_total !== undefined) doc.grand_total = Number(doc.grand_total) || 0;
            if (doc.quantity !== undefined) doc.quantity = Number(doc.quantity) || 1;
            if (doc.unit_price !== undefined) doc.unit_price = Number(doc.unit_price) || 0;
            if (doc.tax_rate !== undefined) doc.tax_rate = Number(doc.tax_rate) || 0;
            if (doc.tax_amount !== undefined) doc.tax_amount = Number(doc.tax_amount) || 0;
            if (doc.line_total !== undefined) doc.line_total = Number(doc.line_total) || 0;
            if (doc.file_size !== undefined) doc.file_size = Number(doc.file_size) || 0;
            if (doc.amount !== undefined) doc.amount = Number(doc.amount) || 0;

            return {
              updateOne: {
                filter: { id: doc.id },
                update: { $set: doc },
                upsert: true
              }
            };
          });

          await model.bulkWrite(ops);
        }
      } catch (syncErr) {
        console.error(`Sync error for ${tableName}:`, syncErr.message);
      }
      resolve();
    });
  });
}

/**
 * Schedule debounced sync for changed tables
 */
function queueTableSync(tableName, sqliteDb) {
  if (!tableModelMap[tableName]) return;
  syncQueue.add(tableName);

  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    const tablesToSync = Array.from(syncQueue);
    syncQueue.clear();
    for (const table of tablesToSync) {
      await syncTableToMongo(table, sqliteDb);
    }
  }, 100);
}

/**
 * Detect table name from SQL mutation query
 */
function detectAffectedTable(sql) {
  const clean = sql.trim().toUpperCase();
  const match = clean.match(/(?:INSERT\s+(?:OR\s+IGNORE\s+|OR\s+REPLACE\s+)?INTO|UPDATE|DELETE\s+FROM)\s+([a-zA-Z0-9_]+)/i);
  if (match && match[1]) {
    return match[1].toLowerCase();
  }
  return null;
}

module.exports = {
  connectMongo,
  loadFromMongoToSqlite,
  syncTableToMongo,
  queueTableSync,
  detectAffectedTable,
  models
};
