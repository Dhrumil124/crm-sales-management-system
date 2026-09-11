import React from "react";

export default function Header({
  currentTab,
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

  const currentMeta = titles[currentTab] || titles.dashboard;

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
        {/* User Identity & Logout Button */}
        {user && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <div className="text-xs font-semibold text-slate-800 leading-tight truncate">
                {user.name}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight truncate">
                {user.email}
              </div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                title="Log out of session"
                className="px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-xs font-medium text-slate-600 transition-colors cursor-pointer whitespace-nowrap shrink-0 select-none inline-flex items-center justify-center"
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
