import React from "react";
import { IconPlus, IconRefresh } from "../common/Icons";

export default function Header({
  currentTab,
  onRefresh,
  isRefreshing,
  onOpenCreateModal
}) {
  const titles = {
    dashboard: {
      title: "Executive Dashboard",
      subtitle: "Unified cross-module intelligence and key business performance indicators"
    },
    crm: {
      title: "CRM — Leads & Accounts",
      subtitle: "Track, qualify, and convert prospective leads and manage customer accounts"
    },
    pipeline: {
      title: "Sales Pipeline",
      subtitle: "Visual opportunity workflow and deal velocity tracking"
    },
    quotations: {
      title: "Quotations & Estimates",
      subtitle: "Itemized commercial proposals with backend verified tax & total calculations"
    },
    tickets: {
      title: "Support Tickets",
      subtitle: "Customer inquiry queue, priority assignment, and conversation timeline"
    }
  };

  const actionLabels = {
    crm: "+ Add Contact / Lead",
    pipeline: "+ New Deal",
    quotations: "+ New Quotation",
    tickets: "+ Open Ticket"
  };

  const currentMeta = titles[currentTab] || titles.dashboard;
  const actionLabel = actionLabels[currentTab];

  return (
    <header className="bg-white border-b border-slate-200 px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sticky top-0 z-10 shadow-xs">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
          {currentMeta.title}
        </h2>
        <p className="text-xs md:text-sm text-slate-500 mt-0.5">
          {currentMeta.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data from server"
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50"
        >
          <IconRefresh className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
        </button>

        {actionLabel && (
          <button
            onClick={() => onOpenCreateModal(currentTab)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98]"
          >
            <IconPlus className="w-4 h-4" />
            <span>{actionLabel}</span>
          </button>
        )}
      </div>
    </header>
  );
}
