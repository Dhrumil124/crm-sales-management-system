import React from "react";
import { IconMenu } from "../common/Icons";

export default function Header({
  currentTab,
  user,
  onLogout,
  onToggleMobileMenu
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
    <header className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3.5 lg:py-4 flex flex-row items-center justify-between gap-3 sm:gap-4 sticky top-0 z-10 shrink-0 shadow-xs">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        {/* Mobile / Tablet Drawer Hamburger Toggle */}
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 -ml-1 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <IconMenu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 tracking-tight truncate">
              {currentMeta.title}
            </h2>
            {user?.organizationName && (
              <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shrink-0">
                {user.organizationName}
              </span>
            )}
          </div>
          <p className="hidden sm:block text-xs lg:text-sm text-slate-500 truncate max-w-lg">
            {currentMeta.subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* User Identity & Single-Line Logout Button */}
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="hidden md:block text-left min-w-0 max-w-[150px]">
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
                className="px-3 sm:px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 text-xs font-medium text-slate-600 transition-colors cursor-pointer whitespace-nowrap shrink-0 flex-shrink-0 select-none inline-flex items-center justify-center"
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

