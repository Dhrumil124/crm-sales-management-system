import React from "react";
import {
  IconDashboard,
  IconUsers,
  IconPipeline,
  IconQuotation,
  IconTicket
} from "../common/Icons";

export default function Sidebar({ currentTab, setCurrentTab, apiConnected, counts = {} }) {
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
        <div>
          <h1 className="font-bold text-white text-base tracking-tight leading-tight">
            Sales & CRM Suite
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
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
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

      {/* Connection Health Indicator */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Backend API</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                apiConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
              }`}
            />
            <span
              className={`font-semibold ${
                apiConnected ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {apiConnected ? "Port 5000 Online" : "Offline"}
            </span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 font-mono">
          JWT Middleware Active
        </p>
      </div>
    </aside>
  );
}
