import React, { useState, useMemo } from "react";
import {
  IconPlus,
  IconTrash,
  IconX,
  IconSend,
  IconBuilding
} from "../common/Icons";

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Open", "In Progress", "Waiting", "Resolved", "Closed"];

export default function TicketView({
  tickets,
  customers,
  onAddTicket,
  onUpdateStatus,
  onAddComment,
  onDeleteTicket
}) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [activeTicket, setActiveTicket] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New Ticket Form State
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "Medium",
    customerId: "",
    assignedTo: "Support Team"
  });
  const [formError, setFormError] = useState("");

  // Comment reply state
  const [replyText, setReplyText] = useState("");
  const replyAuthor = "Support Agent";

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (priorityFilter !== "all" && t.priority.toLowerCase() !== priorityFilter.toLowerCase()) return false;
      return true;
    });
  }, [tickets, statusFilter, priorityFilter]);

  const openCreateModal = () => {
    setFormData({
      title: "",
      description: "",
      priority: "Medium",
      customerId: customers[0]?.id || "",
      assignedTo: "Support Team"
    });
    setFormError("");
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.description.trim()) {
      setFormError("Ticket Title and Description are required.");
      return;
    }

    try {
      await onAddTicket(formData);
      setIsCreateModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Failed to create ticket.");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeTicket) return;

    try {
      const updated = await onAddComment(activeTicket.id, {
        author: replyAuthor.trim() || "Staff",
        text: replyText.trim()
      });
      setReplyText("");
      // Update local active ticket view
      if (updated) {
        setActiveTicket(updated);
      }
    } catch (err) {
      alert("Failed to submit comment: " + err.message);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!activeTicket) return;
    try {
      const updated = await onUpdateStatus(activeTicket.id, newStatus);
      if (updated) {
        setActiveTicket(updated);
      }
    } catch (err) {
      alert("Failed to update status: " + err.message);
    }
  };

  const priorityColors = {
    Low: "bg-slate-100 text-slate-700 border-slate-200",
    Medium: "bg-blue-50 text-blue-700 border-blue-200",
    High: "bg-amber-50 text-amber-700 border-amber-200",
    Urgent: "bg-rose-50 text-rose-700 border-rose-200 font-bold"
  };

  const statusColors = {
    Open: "bg-blue-50 text-blue-700 border-blue-200",
    "In Progress": "bg-indigo-50 text-indigo-700 border-indigo-200",
    Waiting: "bg-amber-50 text-amber-700 border-amber-200",
    Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Closed: "bg-slate-100 text-slate-600 border-slate-200"
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Filter & Actions Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filters */}
        <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              statusFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({tickets.length})
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                statusFilter === s ? "bg-white text-indigo-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Priority Filter & Add Button */}
        <div className="flex items-center gap-3 self-end md:self-auto">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="all">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p} Priority
              </option>
            ))}
          </select>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-all whitespace-nowrap"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Open Ticket</span>
          </button>
        </div>
      </div>

      {/* Tickets List View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredTickets.length === 0 ? (
          <div className="py-16 text-center">
            <h4 className="text-base font-semibold text-slate-800">No support tickets found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No tickets match your active filter criteria. Open a new support ticket to test the helpdesk workflow.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs"
            >
              + Open Ticket
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Ticket #</th>
                  <th className="px-6 py-3.5">Subject & Account</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Assigned Agent</th>
                  <th className="px-6 py-3.5">Replies</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Ticket Number */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => setActiveTicket(t)}
                        className="font-mono font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        {t.ticketNumber}
                      </button>
                    </td>

                    {/* Subject & Customer */}
                    <td className="px-6 py-4 max-w-sm">
                      <div
                        onClick={() => setActiveTicket(t)}
                        className="font-semibold text-slate-900 cursor-pointer hover:text-indigo-600 line-clamp-1"
                      >
                        {t.title}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <IconBuilding className="w-3 h-3 text-slate-400" />
                        <span>{t.customerName || "Unassigned Account"}</span>
                      </div>
                    </td>

                    {/* Priority Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                          priorityColors[t.priority] || "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          statusColors[t.status] || "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>

                    {/* Assigned To (Simple string attribute) */}
                    <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                      {t.assignedTo || "Unassigned"}
                    </td>

                    {/* Comment Count */}
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {t.comments?.length || 0} note{t.comments?.length === 1 ? "" : "s"}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setActiveTicket(t)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                        >
                          View Thread
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete ticket ${t.ticketNumber}?`)) {
                              onDeleteTicket(t.id);
                            }
                          }}
                          title="Delete Ticket"
                          className="p-1 rounded-lg text-slate-300 hover:text-rose-500"
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

      {/* Ticket Details & Timeline Thread Modal */}
      {activeTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                    {activeTicket.ticketNumber}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${priorityColors[activeTicket.priority]}`}>
                    {activeTicket.priority} Priority
                  </span>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mt-1.5 leading-snug">
                  {activeTicket.title}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Account: <strong className="text-slate-700">{activeTicket.customerName}</strong> | Assigned: <strong className="text-slate-700">{activeTicket.assignedTo}</strong>
                </p>
              </div>
              <button
                onClick={() => setActiveTicket(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <IconX className="w-5 h-5" />
              </button>
            </div>

            {/* Status Selector */}
            <div className="py-3 px-4 bg-slate-50 rounded-xl border border-slate-200/80 my-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Ticket Status:</span>
              <div className="flex gap-1">
                {STATUSES.map((st) => (
                  <button
                    key={st}
                    onClick={() => handleStatusChange(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTicket.status === st
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Description & Comment Timeline */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-4 my-2">
              {/* Initial Issue Description */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Issue Description
                </div>
                <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {activeTicket.description}
                </p>
              </div>

              {/* Comment Thread Timeline */}
              <div className="space-y-2.5 pt-2">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Conversation Timeline ({activeTicket.comments?.length || 0})</span>
                  <span className="text-[10px] text-slate-400 font-normal">Stored on server</span>
                </div>

                {activeTicket.comments?.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 italic">
                    No notes or replies added yet. Post the first update below.
                  </div>
                ) : (
                  activeTicket.comments?.map((c) => (
                    <div key={c.id} className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-bold text-slate-900">{c.author}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{c.text}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="pt-3 border-t border-slate-100 mt-auto">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type a response or internal support note..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
                >
                  <IconSend className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Open Ticket Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">Open Support Ticket</h3>
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ticket Subject / Title *
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. SSO Login Timeout Investigation"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Client Account
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
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Agent (Name)
                  </label>
                  <input
                    type="text"
                    value={formData.assignedTo}
                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                    placeholder="Support Team / Alex"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Issue Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Provide detailed context, steps to reproduce, or client inquiry..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
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
                  Open Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
