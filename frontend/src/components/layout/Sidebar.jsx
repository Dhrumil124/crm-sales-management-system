import React from "react";
import {
  IconDashboard,
  IconUsers,
  IconPipeline,
  IconQuotation,
  IconTicket
} from "../common/Icons";

export default function Sidebar({
  currentTab,
  setCurrentTab,
  counts = {},
  user,
  onLogout
}) {
  const navItems = [
    {
      id: "dashboard",
      label: "Overview",
      icon: IconDashboard,
      description: "Executive Summary"
    },
    {
      id: "crm",
      label: "CRM",
      icon: IconUsers,
      count: counts.customers,
      description: "Leads & Accounts"
    },
    {
      id: "pipeline",
      label: "Sales Pipeline",
      icon: IconPipeline,
      count: counts.deals,
      description: "Deals & Opportunities"
    },
    {
      id: "quotations",
      label: "Quotations",
      icon: IconQuotation,
      count: counts.quotations,
      description: "Estimates & Proposals"
    },
    {
      id: "tickets",
      label: "Support Tickets",
      icon: IconTicket,
      count: counts.tickets,
      description: "Helpdesk & Inquiries"
    }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 min-h-screen border-r border-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30">
          CS
        </div>
        <div className="min-w-0">
          <h1 className="font-bold text-white text-base tracking-tight leading-tight truncate">
            {user?.organizationName || "Sales & CRM Suite"}
          </h1>
          <p className="text-xs text-slate-400">Enterprise Edition</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Core Modules
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-5 h-5 ${isActive ? "text-white" : "text-slate-400"}`} />
                <div className="text-left">
                  <div className="leading-snug">{item.label}</div>
                </div>
              </div>
              {item.count !== undefined && item.count !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    isActive ? "bg-indigo-700/80 text-white" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User / Organization Profile Info */}
      {user && (
        <div className="p-3 mx-3 mb-2 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {user.email}
            </p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
