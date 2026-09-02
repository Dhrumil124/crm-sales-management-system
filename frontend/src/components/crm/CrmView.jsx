import React, { useState, useMemo } from "react";
import {
  IconSearch,
  IconFilter,
  IconPlus,
  IconTrash,
  IconEdit,
  IconMail,
  IconPhone,
  IconBuilding,
  IconX
} from "../common/Icons";

export default function CrmView({
  customers,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer
}) {
  const [activeTypeTab, setActiveTypeTab] = useState("all"); // 'all' | 'lead' | 'customer'
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    type: "lead",
    status: "New",
    notes: ""
  });
  const [formError, setFormError] = useState("");

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      // Tab filter
      if (activeTypeTab !== "all" && c.type !== activeTypeTab) return false;
      // Status filter
      if (statusFilter !== "all" && c.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name?.toLowerCase().includes(q);
        const matchesEmail = c.email?.toLowerCase().includes(q);
        const matchesCompany = c.company?.toLowerCase().includes(q);
        const matchesPhone = c.phone?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesCompany && !matchesPhone) return false;
      }
      return true;
    });
  }, [customers, activeTypeTab, statusFilter, searchQuery]);

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      email: "",
      phone: "",
      company: "",
      type: activeTypeTab === "customer" ? "customer" : "lead",
      status: activeTypeTab === "customer" ? "Active" : "New",
      notes: ""
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      company: customer.company || "",
      type: customer.type || "lead",
      status: customer.status || "New",
      notes: customer.notes || ""
    });
    setFormError("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) {
      setFormError("Contact Name and Email are required.");
      return;
    }

    try {
      if (editingCustomer) {
        await onUpdateCustomer(editingCustomer.id, formData);
      } else {
        await onAddCustomer(formData);
      }
      setIsModalOpen(false);
    } catch (err) {
      setFormError(err.message || "Operation failed.");
    }
  };

  const handleConvertToCustomer = async (lead) => {
    if (confirm(`Convert "${lead.name}" (${lead.company}) from Lead to Customer?`)) {
      await onUpdateCustomer(lead.id, {
        type: "customer",
        status: "Active"
      });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Type Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => { setActiveTypeTab("all"); setStatusFilter("all"); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTypeTab === "all"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All Contacts ({customers.length})
          </button>
          <button
            onClick={() => { setActiveTypeTab("lead"); setStatusFilter("all"); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTypeTab === "lead"
                ? "bg-white text-blue-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Leads ({customers.filter(c => c.type === "lead").length})
          </button>
          <button
            onClick={() => { setActiveTypeTab("customer"); setStatusFilter("all"); }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTypeTab === "customer"
                ? "bg-white text-emerald-600 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Customers ({customers.filter(c => c.type === "customer").length})
          </button>
        </div>

        {/* Search & Status Controls */}
        <div className="flex flex-1 items-center gap-3 max-w-md">
          <div className="relative flex-1">
            <IconSearch className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <IconFilter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Statuses</option>
              {activeTypeTab !== "customer" && (
                <>
                  <option value="New">New</option>
                  <option value="Contacted">Contacted</option>
                  <option value="Qualified">Qualified</option>
                  <option value="Lost">Lost</option>
                </>
              )}
              {activeTypeTab !== "lead" && (
                <>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </>
              )}
            </select>
          </div>

          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-xs transition-all whitespace-nowrap"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Contacts Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredCustomers.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <IconSearch className="w-6 h-6" />
            </div>
            <h4 className="text-base font-semibold text-slate-800">No contacts found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              No leads or customer accounts match your current filters. Try resetting the search or add a new record.
            </p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-xs"
            >
              + Create New Contact
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 text-slate-500 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Contact & Company</th>
                  <th className="px-6 py-3.5">Type</th>
                  <th className="px-6 py-3.5">Lifecycle Status</th>
                  <th className="px-6 py-3.5">Communication</th>
                  <th className="px-6 py-3.5">Notes</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((contact) => {
                  const isLead = contact.type === "lead";

                  const statusColors = {
                    New: "bg-blue-50 text-blue-700 border-blue-200",
                    Contacted: "bg-indigo-50 text-indigo-700 border-indigo-200",
                    Qualified: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    Lost: "bg-slate-100 text-slate-600 border-slate-200",
                    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    Inactive: "bg-rose-50 text-rose-700 border-rose-200"
                  };

                  return (
                    <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name & Company */}
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{contact.name}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <IconBuilding className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.company || "Individual Contact"}</span>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                            isLead
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {isLead ? "Lead" : "Customer"}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                            statusColors[contact.status] || "bg-slate-100 text-slate-700 border-slate-200"
                          }`}
                        >
                          {contact.status}
                        </span>
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-4">
                        <div className="text-xs text-slate-700 flex items-center gap-1.5">
                          <IconMail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span>{contact.email}</span>
                        </div>
                        {contact.phone && (
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                            <IconPhone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span>{contact.phone}</span>
                          </div>
                        )}
                      </td>

                      {/* Notes snippet */}
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-xs text-slate-500 truncate" title={contact.notes}>
                          {contact.notes || "—"}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isLead && (
                            <button
                              onClick={() => handleConvertToCustomer(contact)}
                              title="Convert to Customer"
                              className="px-2 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                            >
                              Convert
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(contact)}
                            title="Edit Contact"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <IconEdit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete contact "${contact.name}"?`)) {
                                onDeleteCustomer(contact.id);
                              }
                            }}
                            title="Delete Contact"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <IconTrash className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Contact Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingCustomer ? "Edit Contact Details" : "Create New CRM Contact"}
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
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Jessica Sterling"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="jessica@company.com"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company / Organization
                </label>
                <input
                  type="text"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g. Sterling Digital Ltd."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Relationship Classification
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setFormData({
                        ...formData,
                        type: newType,
                        status: newType === "customer" ? "Active" : "New"
                      });
                    }}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="lead">Lead (Prospective)</option>
                    <option value="customer">Customer (Signed Account)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lifecycle Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {formData.type === "lead" ? (
                      <>
                        <option value="New">New</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Lost">Lost</option>
                      </>
                    ) : (
                      <>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Notes & Context
                </label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Add background context, budget expectations, or meeting summaries..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
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
                  {editingCustomer ? "Save Changes" : "Create Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
