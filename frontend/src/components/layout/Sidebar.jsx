import React from "react";
import {
  IconDashboard,
  IconUsers,
  IconPipeline,
  IconQuotation,
  IconTicket,
  IconX
} from "../common/Icons";

export default function Sidebar({
  currentTab,
  setCurrentTab,
  counts = {},
  user,
  onLogout,
  isMobileOpen = false,
  onClose
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

  const handleNavClick = (tabId) => {
    setCurrentTab(tabId);
    if (onClose) onClose();
  };

  const handleLogoutClick = () => {
    if (onClose) onClose();
    if (onLogout) onLogout();
  };

  const renderSidebarContent = (isDrawer = false) => (
    <>
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/30 shrink-0">
            CS
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-white text-base tracking-tight leading-tight truncate">
              {user?.organizationName || "Sales & CRM Suite"}
            </h1>
            <p className="text-xs text-slate-400">Enterprise Edition</p>
          </div>
        </div>

        {/* Mobile Close Button */}
        {isDrawer && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Close menu"
          >
            <IconX className="w-5 h-5" />
          </button>
        )}
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
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-white" : "text-slate-400"}`} />
                <div className="text-left min-w-0">
                  <div className="leading-snug truncate">{item.label}</div>
                </div>
              </div>
              {item.count !== undefined && item.count !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ml-2 ${
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
        <div className="p-3 mx-3 mb-3 rounded-xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{user.name}</p>
            <p className="text-[11px] text-slate-400 truncate">
              {user.email}
            </p>
          </div>
          {onLogout && (
            <button
              onClick={handleLogoutClick}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-700/60 transition-colors cursor-pointer shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile / Tablet Backdrop Overlay */}
      {isMobileOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Mobile / Tablet Off-Canvas Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 shadow-2xl transition-transform duration-200 ease-in-out lg:hidden ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {renderSidebarContent(true)}
      </aside>

      {/* Desktop Persistent Sidebar (Identical to reference PC design) */}
      <aside className="hidden lg:flex w-64 bg-slate-900 text-slate-200 flex-col flex-shrink-0 min-h-screen border-r border-slate-800">
        {renderSidebarContent(false)}
      </aside>
    </>
  );
}

