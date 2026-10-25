const mongoose = require("mongoose");
const { Schema } = mongoose;

// 1. Organization Schema
const OrganizationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
}, { collection: "organizations", timestamps: false });

// 2. User Schema
const UserSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password_hash: { type: String, required: true },
  role: { type: String, default: "admin" },
  created_at: { type: Date, default: Date.now }
}, { collection: "users", timestamps: false });

// 3. Lead Schema
const LeadSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, default: null, index: true },
  phone: { type: String, default: null },
  company: { type: String, default: null },
  status: { type: String, default: "New", index: true },
  assigned_to: { type: String, default: null, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "leads", timestamps: false });

// 4. LeadNote Schema
const LeadNoteSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  lead_id: { type: String, required: true, index: true },
  author_id: { type: String, default: null, index: true },
  content: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "lead_notes", timestamps: false });

// 5. LeadCommunication Schema
const LeadCommunicationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  lead_id: { type: String, required: true, index: true },
  type: { type: String, required: true },
  subject: { type: String, default: null },
  details: { type: String, required: true },
  communication_date: { type: Date, default: Date.now, index: true },
  created_by: { type: String, default: null, index: true },
  created_at: { type: Date, default: Date.now }
}, { collection: "lead_communications", timestamps: false });

// 6. PipelineStage Schema
const PipelineStageSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  stage_order: { type: Number, required: true },
  color: { type: String, default: "border-t-indigo-500" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "pipeline_stages", timestamps: false });
PipelineStageSchema.index({ organization_id: 1, stage_order: 1 }, { unique: true });

// 7. Deal Schema
const DealSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  title: { type: String, required: true },
  lead_id: { type: String, default: null, index: true },
  stage_id: { type: String, required: true, index: true },
  value: { type: Number, default: 0 },
  expected_close_date: { type: String, default: null, index: true },
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "deals", timestamps: false });

// 8. DealStageHistory Schema
const DealStageHistorySchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  deal_id: { type: String, required: true, index: true },
  organization_id: { type: String, required: true, index: true },
  from_stage_id: { type: String, default: null },
  from_stage_name: { type: String, default: null },
  to_stage_id: { type: String, required: true },
  to_stage_name: { type: String, required: true },
  user_id: { type: String, default: null },
  created_at: { type: Date, default: Date.now, index: true }
}, { collection: "deal_stage_history", timestamps: false });

// 9. Customer Schema
const CustomerSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, default: null, index: true },
  phone: { type: String, default: null },
  company: { type: String, default: null },
  address: { type: String, default: null },
  status: { type: String, default: "Active", index: true },
  contact_type: { type: String, default: "customer" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "customers", timestamps: false });

// 10. Quotation Schema
const QuotationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  quote_number: { type: String, required: true },
  customer_id: { type: String, required: true, index: true },
  issue_date: { type: String, required: true },
  valid_until: { type: String, required: true },
  status: { type: String, default: "Draft", index: true },
  subtotal: { type: Number, default: 0 },
  tax_total: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  grand_total: { type: Number, default: 0 },
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "quotations", timestamps: false });
QuotationSchema.index({ organization_id: 1, quote_number: 1 }, { unique: true });

// 11. QuotationItem Schema
const QuotationItemSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  quotation_id: { type: String, required: true, index: true },
  description: { type: String, required: true },
  quantity: { type: Number, required: true, default: 1 },
  unit_price: { type: Number, required: true, default: 0 },
  tax_rate: { type: Number, default: 0 },
  tax_amount: { type: Number, default: 0 },
  line_total: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
}, { collection: "quotation_items", timestamps: false });

// 12. Ticket Schema
const TicketSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  ticket_number: { type: String, required: true },
  customer_id: { type: String, default: null, index: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  priority: { type: String, default: "Medium", index: true },
  status: { type: String, default: "Open", index: true },
  assigned_to: { type: String, default: null, index: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "tickets", timestamps: false });
TicketSchema.index({ organization_id: 1, ticket_number: 1 }, { unique: true });

// 13. TicketComment Schema
const TicketCommentSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  ticket_id: { type: String, required: true, index: true },
  user_id: { type: String, default: null, index: true },
  comment: { type: String, required: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "ticket_comments", timestamps: false });

// 14. TicketAttachment Schema
const TicketAttachmentSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  ticket_id: { type: String, required: true, index: true },
  comment_id: { type: String, default: null, index: true },
  uploaded_by: { type: String, default: null, index: true },
  original_filename: { type: String, required: true },
  stored_path: { type: String, required: true },
  mime_type: { type: String, default: null },
  file_size: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
}, { collection: "ticket_attachments", timestamps: false });

// 15. Payment Schema
const PaymentSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  organization_id: { type: String, required: true, index: true },
  quotation_id: { type: String, default: null, index: true },
  customer_id: { type: String, default: null, index: true },
  amount: { type: Number, required: true },
  payment_date: { type: Date, default: Date.now, index: true },
  payment_method: { type: String, required: true },
  payment_status: { type: String, default: "Completed", index: true },
  reference_number: { type: String, default: null },
  notes: { type: String, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: "payments", timestamps: false });

const Organization = mongoose.models.Organization || mongoose.model("Organization", OrganizationSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);
const Lead = mongoose.models.Lead || mongoose.model("Lead", LeadSchema);
const LeadNote = mongoose.models.LeadNote || mongoose.model("LeadNote", LeadNoteSchema);
const LeadCommunication = mongoose.models.LeadCommunication || mongoose.model("LeadCommunication", LeadCommunicationSchema);
const PipelineStage = mongoose.models.PipelineStage || mongoose.model("PipelineStage", PipelineStageSchema);
const Deal = mongoose.models.Deal || mongoose.model("Deal", DealSchema);
const DealStageHistory = mongoose.models.DealStageHistory || mongoose.model("DealStageHistory", DealStageHistorySchema);
const Customer = mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);
const Quotation = mongoose.models.Quotation || mongoose.model("Quotation", QuotationSchema);
const QuotationItem = mongoose.models.QuotationItem || mongoose.model("QuotationItem", QuotationItemSchema);
const Ticket = mongoose.models.Ticket || mongoose.model("Ticket", TicketSchema);
const TicketComment = mongoose.models.TicketComment || mongoose.model("TicketComment", TicketCommentSchema);
const TicketAttachment = mongoose.models.TicketAttachment || mongoose.model("TicketAttachment", TicketAttachmentSchema);
const Payment = mongoose.models.Payment || mongoose.model("Payment", PaymentSchema);

module.exports = {
  Organization,
  User,
  Lead,
  LeadNote,
  LeadCommunication,
  PipelineStage,
  Deal,
  DealStageHistory,
  Customer,
  Quotation,
  QuotationItem,
  Ticket,
  TicketComment,
  TicketAttachment,
  Payment
};
