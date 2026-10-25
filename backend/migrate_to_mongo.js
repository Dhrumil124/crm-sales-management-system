require("dotenv").config();
const sqlite3 = require("sqlite3");
const path = require("path");
const mongoose = require("mongoose");
const models = require("./src/models");

const sqlitePath = path.join(__dirname, "src/database/crm.sqlite");
const db = new sqlite3.Database(sqlitePath);

const getSqliteRows = (sql) => {
  return new Promise((resolve, reject) => {
    db.all(sql, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
};

const tableModelMap = [
  { table: "organizations", model: models.Organization },
  { table: "users", model: models.User },
  { table: "pipeline_stages", model: models.PipelineStage },
  { table: "customers", model: models.Customer },
  { table: "leads", model: models.Lead },
  { table: "lead_notes", model: models.LeadNote },
  { table: "lead_communications", model: models.LeadCommunication },
  { table: "deals", model: models.Deal },
  { table: "deal_stage_history", model: models.DealStageHistory },
  { table: "quotations", model: models.Quotation },
  { table: "quotation_items", model: models.QuotationItem },
  { table: "tickets", model: models.Ticket },
  { table: "ticket_comments", model: models.TicketComment },
  { table: "ticket_attachments", model: models.TicketAttachment },
  { table: "payments", model: models.Payment }
];

async function migrate() {
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB Atlas successfully!\n");

  for (const { table, model } of tableModelMap) {
    const rows = await getSqliteRows(`SELECT * FROM ${table}`);
    console.log(`Migrating ${table}: found ${rows.length} rows in SQLite...`);

    if (rows.length > 0) {
      // Clear existing records in this collection to avoid duplicates
      await model.deleteMany({});
      
      // Transform date/numeric fields if needed
      const docs = rows.map(row => {
        const doc = { ...row };
        // Ensure numeric fields are numbers
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
        return doc;
      });

      await model.insertMany(docs);
      console.log(`  -> Inserted ${docs.length} documents into MongoDB collection '${model.collection.name}'.`);
    } else {
      console.log(`  -> 0 rows, skipping insert.`);
    }
  }

  console.log("\n--- Verification Summary in MongoDB Atlas ---");
  for (const { table, model } of tableModelMap) {
    const count = await model.countDocuments();
    console.log(`Collection '${model.collection.name}': ${count} documents`);
  }

  await mongoose.disconnect();
  db.close();
  console.log("\nMigration completed successfully! Check MongoDB Compass!");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
