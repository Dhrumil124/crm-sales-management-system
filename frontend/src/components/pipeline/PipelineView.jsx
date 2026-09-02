import React, { useState } from "react";
import {
  IconPlus,
  IconCalendar,
  IconTrash,
  IconChevronRight,
  IconChevronLeft,
  IconX,
  IconBuilding
} from "../common/Icons";

const PIPELINE_STAGES = [
  { id: "Lead", label: "Lead In", color: "border-t-slate-400" },
  { id: "Contacted", label: "Contact Made", color: "border-t-blue-500" },
  { id: "Proposal", label: "Proposal Sent", color: "border-t-indigo-500" },
  { id: "Negotiation", label: "Negotiation", color: "border-t-purple-500" },
  { id: "Won", label: "Closed Won", color: "border-t-emerald-500" },
  { id: "Lost", label: "Closed Lost", color: "border-t-rose-400" }
];

export default function PipelineView({
  deals,
  customers,
  onAddDeal,
  onUpdateStage,
  onDeleteDeal
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    customerId: "",
    value: "",
    stage: "Lead",
    expectedCloseDate: "",
    notes: ""
  });
  const [formError, setFormError] = useState("");

  const openCreateModal = () => {
    setFormData({
      title: "",
      customerId: customers[0]?.id || "",
      value: "",
      stage: "Lead",
      expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: ""
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError("Deal title is required.");
      return;
    }
    const val = Number(formData.value);
    if (isNaN(val) || val < 0) {
      setFormError("Please enter a valid positive deal value.");
      return;
    }

    try {
      await onAddDeal({
        ...formData,
        value: val
      });
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to create deal.");
    }
  };

  // Helper to move stages
  const moveStage = (deal, direction) => {
    const currentIndex = PIPELINE_STAGES.findIndex(s => s.id === deal.stage);
    if (currentIndex === -1) return;

    const nextIndex = currentIndex + direction;
    if (nextIndex >= 0 && nextIndex < PIPELINE_STAGES.length) {
      onUpdateStage(deal.id, PIPELINE_STAGES[nextIndex].id);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header bar with summary */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-900 text-base">
            Opportunity Kanban Pipeline
          </h3>
          <p className="text-xs text-slate-500">
            Click stage controls on any opportunity to advance deal velocity in real time
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-all"
        >
          <IconPlus className="w-3.5 h-3.5" />
          <span>New Opportunity</span>
        </button>
      </div>

      {/* Kanban Board Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 items-start overflow-x-auto pb-4">
        {PIPELINE_STAGES.map((col, colIdx) => {
          const stageDeals = deals.filter(d => d.stage === col.id);
          const colValue = stageDeals.reduce((sum, d) => sum + (Number(d.value) || 0), 0);

          return (
            <div
              key={col.id}
              className={`bg-slate-50/80 rounded-2xl border border-slate-200/80 border-t-4 ${col.color} p-3 flex flex-col min-h-[500px]`}
            >
              {/* Column Header */}
              <div className="pb-3 border-b border-slate-200/60 mb-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-800 tracking-tight">
                    {col.label}
                  </span>
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                    {stageDeals.length}
                  </span>
                </div>
                <div className="text-xs font-semibold text-slate-600 mt-1 flex items-center gap-0.5">
                  <span>₹{colValue.toLocaleString("en-IN")}</span>
                </div>
              </div>

              {/* Deal Cards */}
              <div className="space-y-3 flex-1">
                {stageDeals.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-medium italic">
                    No deals
                  </div>
                ) : (
                  stageDeals.map((deal) => (
                    <div
                      key={deal.id}
                      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition-shadow group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-xs text-slate-900 leading-snug">
                            {deal.title}
                          </h4>
                          <button
                            onClick={() => {
                              if (confirm(`Delete deal "${deal.title}"?`)) {
                                onDeleteDeal(deal.id);
                              }
                            }}
                            title="Delete Deal"
                            className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <IconTrash className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1.5">
                          <IconBuilding className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{deal.customerName || "Unassigned"}</span>
                        </div>

                        <div className="mt-2.5 flex items-center justify-between">
                          <div className="text-sm font-bold text-indigo-600">
                            ₹{Number(deal.value).toLocaleString("en-IN")}
                          </div>
                          {deal.expectedCloseDate && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1">
                              <IconCalendar className="w-3 h-3" />
                              <span>{deal.expectedCloseDate}</span>
                            </div>
                          )}
                        </div>

                        {deal.notes && (
                          <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100 line-clamp-2">
                            {deal.notes}
                          </p>
                        )}
                      </div>

                      {/* Stage Advance Buttons */}
                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <button
                          disabled={colIdx === 0}
                          onClick={() => moveStage(deal, -1)}
                          title="Move Back"
                          className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <IconChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-1">
                          {col.id !== "Won" && (
                            <button
                              onClick={() => onUpdateStage(deal.id, "Won")}
                              title="Mark Won"
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            >
                              Won
                            </button>
                          )}
                          {col.id !== "Lost" && (
                            <button
                              onClick={() => onUpdateStage(deal.id, "Lost")}
                              title="Mark Lost"
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 hover:bg-rose-100"
                            >
                              Lost
                            </button>
                          )}
                        </div>

                        <button
                          disabled={colIdx === PIPELINE_STAGES.length - 1}
                          onClick={() => moveStage(deal, 1)}
                          title="Advance Stage"
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <IconChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                Create Sales Opportunity
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
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

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Opportunity Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Cloud Infrastructure Migration"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Associated CRM Customer / Lead
                </label>
                <select
                  value={formData.customerId}
                  onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="">-- Select Contact --</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.company || c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Deal Value (₹ INR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="25000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Initial Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Close Date
                </label>
                <input
                  type="date"
                  value={formData.expectedCloseDate}
                  onChange={(e) => setFormData({ ...formData, expectedCloseDate: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deal Notes & Terms
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Key decision makers, requirements, or next steps..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-xs"
                >
                  Create Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
