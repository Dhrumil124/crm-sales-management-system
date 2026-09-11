import React, { useState, useMemo } from "react";
import { api } from "../../services/api";
import {
  IconPlus,
  IconTrash,
  IconX
} from "../common/Icons";

export default function QuotationView({
  quotations,
  customers,
  onAddQuotation,
  onUpdateStatus,
  onDeleteQuotation
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeQuoteView, setActiveQuoteView] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const handleDownloadPdf = async (quote) => {
    try {
      setDownloadingId(quote.id);
      await api.quotations.downloadPdf(quote.id, quote.quoteNumber);
    } catch (err) {
      alert(err.message || "Failed to download PDF quotation");
    } finally {
      setDownloadingId(null);
    }
  };

  // Dynamic Quote Creation Form State
  const [customerId, setCustomerId] = useState(customers[0]?.id || "");
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [validUntil, setValidUntil] = useState(() =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [status, setStatus] = useState("Draft");
  const [items, setItems] = useState([
    { description: "Software Subscription Tier 1", quantity: 1, unitPrice: 1200, taxRate: 10 }
  ]);
  const [formError, setFormError] = useState("");

  const filteredQuotations = useMemo(() => {
    if (statusFilter === "all") return quotations;
    return quotations.filter(q => q.status.toLowerCase() === statusFilter.toLowerCase());
  }, [quotations, statusFilter]);

  // Live client calculation preview
  const previewTotals = useMemo(() => {
    let subtotal = 0;
    let taxTotal = 0;
    items.forEach((item) => {
      const q = Math.max(0, Number(item.quantity) || 0);
      const p = Math.max(0, Number(item.unitPrice) || 0);
      const t = Math.max(0, Number(item.taxRate) || 0);
      const lineTotal = q * p;
      const lineTax = lineTotal * (t / 100);
      subtotal += lineTotal;
      taxTotal += lineTax;
    });
    return {
      subtotal: Number(subtotal.toFixed(2)),
      taxTotal: Number(taxTotal.toFixed(2)),
      grandTotal: Number((subtotal + taxTotal).toFixed(2))
    };
  }, [items]);

  const handleAddItem = () => {
    setItems([...items, { description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;
    setItems(updated);
  };

  const openCreateModal = () => {
    setCustomerId(customers[0]?.id || "");
    setIssueDate(new Date().toISOString().split("T")[0]);
    setValidUntil(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
    setStatus("Draft");
    setItems([{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }]);
    setFormError("");
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const selectedCustomerId = customerId || (customers.length > 0 ? customers[0].id : "");
    if (!selectedCustomerId) {
      setFormError("Please select a client for this quotation.");
      return;
    }
    const validItems = items.filter(i => i.description.trim());
    if (validItems.length === 0) {
      setFormError("At least one line item with a valid description is required.");
      return;
    }

    try {
      await onAddQuotation({
        customerId: selectedCustomerId,
        items: validItems,
        status,
        issueDate,
        validUntil
      });
      setIsCreateModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to create quotation.");
    }
  };

  const statusColors = {
    Draft: "bg-slate-100 text-slate-700 border-slate-200",
    Sent: "bg-blue-50 text-blue-700 border-blue-200",
    Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Declined: "bg-rose-50 text-rose-700 border-rose-200"
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Filter & Actions */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full shrink-0">
          {["all", "draft", "sent", "accepted", "declined"].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                statusFilter === tab
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {tab === "all" ? "All Proposals" : tab}
            </button>
          ))}
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-all self-start md:self-auto shrink-0 whitespace-nowrap"
        >
          <IconPlus className="w-3.5 h-3.5" />
          <span>New Quotation</span>
        </button>
      </div>

      {/* Quotations Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredQuotations.length === 0 ? (
          <div className="py-16 text-center">
            <h4 className="text-base font-semibold text-slate-800">No quotations found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No quotations match the selected status filter. Draft a new quotation to get started.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs"
            >
              + Create Quotation
            </button>
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <table className="w-full text-left text-sm table-fixed">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-2.5 sm:px-3 py-3.5 w-[10%] whitespace-nowrap">Quote #</th>
                  <th className="px-2.5 sm:px-3 py-3.5 w-[21%] min-w-0">Account / Client</th>
                  <th className="px-1.5 sm:px-2 py-3.5 w-[9%] whitespace-nowrap">Status</th>
                  <th className="px-2 py-3.5 w-[13%] whitespace-nowrap">Validity</th>
                  <th className="px-1.5 sm:px-2 py-3.5 w-[9%] whitespace-nowrap">Items</th>
                  <th className="px-2 sm:px-3 py-3.5 w-[16%] text-right whitespace-nowrap">Grand Total</th>
                  <th className="px-2 sm:px-3 py-3.5 w-[22%] text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQuotations.map((quote) => (
                  <tr key={quote.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Quote Number */}
                    <td className="px-2.5 sm:px-3 py-3.5 whitespace-nowrap font-medium">
                      <button
                        onClick={() => setActiveQuoteView(quote)}
                        className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                      >
                        {quote.quoteNumber}
                      </button>
                    </td>

                    {/* Customer Name */}
                    <td className="px-2.5 sm:px-3 py-3.5 min-w-0 overflow-hidden">
                      <div
                        className="font-semibold text-slate-900 truncate block"
                        title={quote.customerName}
                      >
                        {quote.customerName || "—"}
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-1.5 sm:px-2 py-3.5 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
                          statusColors[quote.status] || "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {quote.status}
                      </span>
                    </td>

                    {/* Validity */}
                    <td className="px-2 py-3.5 text-xs text-slate-500 whitespace-nowrap overflow-hidden">
                      <div className="truncate">Issued: {quote.issueDate || "—"}</div>
                      <div className="text-[11px] text-slate-400 truncate">Valid: {quote.validUntil || "—"}</div>
                    </td>

                    {/* Line Items Count */}
                    <td className="px-1.5 sm:px-2 py-3.5 text-xs text-slate-600 font-medium whitespace-nowrap">
                      {quote.items?.length || 0} line item{quote.items?.length === 1 ? "" : "s"}
                    </td>

                    {/* Grand Total */}
                    <td className="px-2 sm:px-3 py-3.5 text-right whitespace-nowrap overflow-hidden">
                      <div className="font-bold text-slate-900 text-sm sm:text-base truncate">
                        ₹{Number(quote.grandTotal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        Sub: ₹{Number(quote.subtotal).toLocaleString("en-IN")} + Tax: ₹{Number(quote.taxTotal).toLocaleString("en-IN")}
                      </div>
                    </td>

                    {/* Status Controls & Actions */}
                    <td className="px-2 sm:px-3 py-3.5 text-right whitespace-nowrap overflow-hidden">
                      <div className="flex items-center justify-end gap-1 shrink-0">
                        {quote.status === "Draft" && (
                          <button
                            onClick={() => onUpdateStatus(quote.id, "Sent")}
                            title="Mark as Sent to Client"
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shrink-0 cursor-pointer"
                          >
                            Send
                          </button>
                        )}
                        {quote.status !== "Draft" && quote.status !== "Accepted" && (
                          <button
                            onClick={() => onUpdateStatus(quote.id, "Accepted")}
                            title="Mark as Accepted"
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors shrink-0 cursor-pointer"
                          >
                            Accept
                          </button>
                        )}
                        {quote.status !== "Draft" && quote.status !== "Declined" && (
                          <button
                            onClick={() => onUpdateStatus(quote.id, "Declined")}
                            title="Mark as Declined"
                            className="px-2 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors shrink-0 cursor-pointer"
                          >
                            Decline
                          </button>
                        )}
                        <button
                          onClick={() => handleDownloadPdf(quote)}
                          disabled={downloadingId === quote.id}
                          title="Download Quotation PDF"
                          className="px-2 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200/60 transition-colors flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-60"
                        >
                          {downloadingId === quote.id ? (
                            <span className="animate-pulse">...</span>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>PDF</span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete quotation ${quote.quoteNumber}?`)) {
                              onDeleteQuotation(quote.id);
                            }
                          }}
                          title="Delete Quotation"
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Interactive Quotation Builder Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Create New Quotation</h3>
                <p className="text-xs text-slate-500">
                  Itemized proposal with real-time preview and server-side mathematical validation
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Select Client *
                  </label>
                  <select
                    value={customerId || (customers.length > 0 ? customers[0].id : "")}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.company || c.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Issue Date
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Valid Until
                  </label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Line Items
                  </span>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                  >
                    <IconPlus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-56 overflow-y-auto p-1">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 grid grid-cols-12 gap-2 items-center text-xs"
                    >
                      <div className="col-span-12 md:col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Description / Service name"
                          value={item.description}
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-500 text-center"
                        />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          placeholder="Price (₹)"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-500 text-right"
                        />
                      </div>
                      <div className="col-span-3 md:col-span-2">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          placeholder="Tax %"
                          value={item.taxRate}
                          onChange={(e) => handleItemChange(idx, "taxRate", e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs focus:outline-none focus:border-indigo-500 text-right"
                        />
                      </div>
                      <div className="col-span-2 md:col-span-1 flex justify-center">
                        <button
                          type="button"
                          disabled={items.length === 1}
                          onClick={() => handleRemoveItem(idx)}
                          className="text-slate-400 hover:text-rose-500 disabled:opacity-20 p-1"
                        >
                          <IconTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real-time Calculation Summary Preview */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Live Calculation Preview
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Subtotal: ₹{previewTotals.subtotal.toLocaleString("en-IN")} + Taxes: ₹{previewTotals.taxTotal.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-xs text-slate-400">Total Proposal Value</div>
                  <div className="text-xl font-bold text-emerald-400">
                    ₹{previewTotals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs"
                >
                  Issue Quotation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Quotation Proposal Modal */}
      {activeQuoteView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-4 sm:p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                  {activeQuoteView.quoteNumber}
                </span>
                <h3 className="font-bold text-slate-900 text-lg mt-1">
                  Official Commercial Proposal
                </h3>
              </div>
              <button
                onClick={() => setActiveQuoteView(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-slate-600 pb-4 border-b border-slate-100">
              <div>
                <span className="text-slate-400 font-medium">Client Account:</span>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{activeQuoteView.customerName}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-medium">Proposal Status:</span>
                <div className="mt-0.5">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusColors[activeQuoteView.status]}`}>
                    {activeQuoteView.status}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Date Issued:</span>
                <p className="font-semibold text-slate-800">{activeQuoteView.issueDate}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-400 font-medium">Valid Until:</span>
                <p className="font-semibold text-slate-800">{activeQuoteView.validUntil}</p>
              </div>
            </div>

            {/* Line items table */}
            <div className="mt-4 overflow-x-auto w-full">
              <table className="w-full text-left text-xs min-w-[420px]">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2">Description</th>
                    <th className="py-2 px-2 text-center">Qty</th>
                    <th className="py-2 px-2 text-right">Unit Price</th>
                    <th className="py-2 px-2 text-right">Tax</th>
                    <th className="py-2 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeQuoteView.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2 px-2 font-medium text-slate-800">{item.description}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-600">₹{item.unitPrice.toLocaleString("en-IN")}</td>
                      <td className="py-2 px-2 text-right text-slate-500">{item.taxRate}%</td>
                      <td className="py-2 px-2 text-right font-semibold text-slate-900">₹{item.lineTotal.toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold">₹{activeQuoteView.subtotal?.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Calculated Taxes</span>
                  <span className="font-semibold">₹{activeQuoteView.taxTotal?.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-1.5 border-t border-slate-200">
                  <span>Grand Total</span>
                  <span className="text-indigo-600">₹{activeQuoteView.grandTotal?.toLocaleString("en-IN")}</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setActiveQuoteView(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
