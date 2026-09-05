import React from "react";
import { IconPlus, IconRefresh } from "../common/Icons";

export default function Header({
  currentTab,
  onRefresh,
  isRefreshing,
  onOpenCreateModal,
  user,
  onLogout
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
        <div className="flex items-center gap-2 mb-0.5">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            {currentMeta.title}
          </h2>
          {user?.organizationName && (
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
              {user.organizationName}
            </span>
          )}
        </div>
        <p className="text-xs md:text-sm text-slate-500">
          {currentMeta.subtitle}
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh data from server"
          className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <IconRefresh className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
        </button>

        {actionLabel && (
          <button
            onClick={() => onOpenCreateModal(currentTab)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm shadow-md shadow-indigo-600/20 transition-all active:scale-[0.98] cursor-pointer"
          >
            <IconPlus className="w-4 h-4" />
            <span>{actionLabel}</span>
          </button>
        )}

        {/* User Identity & Logout Button */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-semibold text-slate-800 leading-tight">
                {user.name}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight">
                {user.email}
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out of session"
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-xs font-medium text-slate-600 transition-colors cursor-pointer"
              >
                Log Out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
