import React from "react";
import {
  IconUsers,
  IconPipeline,
  IconQuotation,
  IconTicket,
  IconAlert,
  IconChevronRight
} from "../common/Icons";

export default function DashboardOverview({ summary, setCurrentTab, onOpenCreateModal }) {
  const kpis = summary?.kpis || {
    totalLeads: 0,
    totalCustomers: 0,
    activeDealsCount: 0,
    pipelineActiveValue: 0,
    wonDealsValue: 0,
    totalQuotations: 0,
    pendingQuotationsValue: 0,
    acceptedQuotationsValue: 0,
    openTickets: 0,
    urgentTickets: 0
  };

  const activities = summary?.recentActivities || [];
  const pipelineByStage = summary?.pipelineByStage || {};

  const stagesList = ["Lead", "Contacted", "Proposal", "Negotiation", "Won", "Lost"];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* 4 Module KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* CRM Metric Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              CRM Module
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <IconUsers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">
              {kpis.totalCustomers}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                {kpis.totalLeads} Active Leads
              </span>
              <span>awaiting qualification</span>
            </p>
          </div>
          <button
            onClick={() => setCurrentTab("crm")}
            className="mt-4 w-full flex items-center justify-between text-xs font-medium text-blue-600 hover:text-blue-700 pt-3 border-t border-slate-100"
          >
            <span>View All Contacts & Leads</span>
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Sales Pipeline Metric Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Sales Pipeline
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IconPipeline className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">
              ₹{kpis.pipelineActiveValue.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {kpis.activeDealsCount} Active Deals
              </span>
              <span>• ₹{kpis.wonDealsValue.toLocaleString("en-IN")} Closed Won</span>
            </p>
          </div>
          <button
            onClick={() => setCurrentTab("pipeline")}
            className="mt-4 w-full flex items-center justify-between text-xs font-medium text-emerald-600 hover:text-emerald-700 pt-3 border-t border-slate-100"
          >
            <span>Open Pipeline Kanban</span>
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quotation Metric Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quotation Module
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <IconQuotation className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">
              ₹{kpis.pendingQuotationsValue.toLocaleString("en-IN")}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                {kpis.totalQuotations} Total Proposals
              </span>
              <span>• ₹{kpis.acceptedQuotationsValue.toLocaleString("en-IN")} Accepted</span>
            </p>
          </div>
          <button
            onClick={() => setCurrentTab("quotations")}
            className="mt-4 w-full flex items-center justify-between text-xs font-medium text-purple-600 hover:text-purple-700 pt-3 border-t border-slate-100"
          >
            <span>Review Quotations</span>
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Support Tickets Metric Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Support Tickets
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <IconTicket className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-bold text-slate-900">
              {kpis.openTickets}
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              {kpis.urgentTickets > 0 ? (
                <span className="font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <IconAlert className="w-3 h-3" />
                  {kpis.urgentTickets} High/Urgent Priority
                </span>
              ) : (
                <span className="text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                  All Normal Priority
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setCurrentTab("tickets")}
            className="mt-4 w-full flex items-center justify-between text-xs font-medium text-amber-600 hover:text-amber-700 pt-3 border-t border-slate-100"
          >
            <span>Manage Ticket Queue</span>
            <IconChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pipeline Stage Distribution & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Stage Distribution Card */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Pipeline Stages Breakdown
              </h3>
              <p className="text-xs text-slate-500">
                Live distribution of deal value across active opportunity stages
              </p>
            </div>
            <button
              onClick={() => setCurrentTab("pipeline")}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Open Board →
            </button>
          </div>

          <div className="space-y-3">
            {stagesList.map((stage) => {
              const data = pipelineByStage[stage] || { count: 0, totalValue: 0 };
              const percent = kpis.pipelineActiveValue > 0
                ? Math.round((data.totalValue / (kpis.pipelineActiveValue + kpis.wonDealsValue || 1)) * 100)
                : 0;
              
              const stageColors = {
                Lead: "bg-slate-500",
                Contacted: "bg-blue-500",
                Proposal: "bg-indigo-500",
                Negotiation: "bg-purple-500",
                Won: "bg-emerald-500",
                Lost: "bg-rose-400"
              };

              return (
                <div key={stage} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs font-medium mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${stageColors[stage] || "bg-slate-400"}`} />
                      <span className="font-semibold text-slate-800">{stage}</span>
                      <span className="text-slate-400">({data.count} deals)</span>
                    </div>
                    <span className="font-bold text-slate-900">
                      ₹{data.totalValue.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${stageColors[stage] || "bg-slate-400"}`}
                      style={{ width: `${Math.min(100, percent)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Launchpad & Shortcuts */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Quick Shortcuts</h3>
            <p className="text-xs text-slate-500 mb-4">
              Instantly create records across the 4 modules
            </p>

            <div className="space-y-2.5">
              <button
                onClick={() => onOpenCreateModal("crm")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-slate-700 hover:text-blue-700 transition-all text-sm font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <IconUsers className="w-4 h-4" />
                  </div>
                  <span>New Lead / Customer</span>
                </div>
                <span className="text-xs text-slate-400 font-semibold">+ Add</span>
              </button>

              <button
                onClick={() => onOpenCreateModal("pipeline")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-slate-700 hover:text-emerald-700 transition-all text-sm font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <IconPipeline className="w-4 h-4" />
                  </div>
                  <span>Create Deal</span>
                </div>
                <span className="text-xs text-slate-400 font-semibold">+ Add</span>
              </button>

              <button
                onClick={() => onOpenCreateModal("quotations")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 text-slate-700 hover:text-purple-700 transition-all text-sm font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                    <IconQuotation className="w-4 h-4" />
                  </div>
                  <span>Draft Quotation</span>
                </div>
                <span className="text-xs text-slate-400 font-semibold">+ Add</span>
              </button>

              <button
                onClick={() => onOpenCreateModal("tickets")}
                className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/50 text-slate-700 hover:text-amber-700 transition-all text-sm font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <IconTicket className="w-4 h-4" />
                  </div>
                  <span>Open Support Ticket</span>
                </div>
                <span className="text-xs text-slate-400 font-semibold">+ Add</span>
              </button>
            </div>
          </div>

          <div className="mt-6 p-3.5 rounded-xl bg-slate-900 text-white text-xs">
            <div className="font-semibold flex items-center gap-1.5 text-indigo-300 mb-1">
              <span>Architectural Status</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Pre-database phase active with async storage service. All 4 business modules communicate with genuine Express REST endpoints.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Cross-Module Activities Feed */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              Recent Cross-Module Activity
            </h3>
            <p className="text-xs text-slate-500">
              Live updates recorded across CRM, Deals, Proposals, and Support
            </p>
          </div>
          <span className="text-xs text-slate-400">Chronological</span>
        </div>

        <div className="divide-y divide-slate-100">
          {activities.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              No recent activity recorded.
            </div>
          ) : (
            activities.map((act, index) => {
              const badgeColors = {
                crm: "bg-blue-100 text-blue-700",
                pipeline: "bg-emerald-100 text-emerald-700",
                quotation: "bg-purple-100 text-purple-700",
                ticket: "bg-amber-100 text-amber-700"
              };

              const moduleNames = {
                crm: "CRM",
                pipeline: "Sales Pipeline",
                quotation: "Quotation",
                ticket: "Support Ticket"
              };

              return (
                <div key={index} className="py-3.5 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        badgeColors[act.type] || "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {moduleNames[act.type] || act.type}
                    </span>
                    <span className="font-medium text-slate-800">{act.title}</span>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {new Date(act.timestamp).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric"
                    })}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
