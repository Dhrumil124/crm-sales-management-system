import React, { useState, useEffect, useCallback } from "react";
import { api } from "./services/api";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import DashboardOverview from "./components/dashboard/DashboardOverview";
import CrmView from "./components/crm/CrmView";
import PipelineView from "./components/pipeline/PipelineView";
import QuotationView from "./components/quotations/QuotationView";
import TicketView from "./components/tickets/TicketView";
import AuthPage from "./components/auth/AuthPage";

export default function App() {
  // Authentication State
  const [currentUser, setCurrentUser] = useState(() => api.auth.getUser());
  const [authChecking, setAuthChecking] = useState(true);

  // Application View State
  const [currentTab, setCurrentTab] = useState("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Core Data States from Backend
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [tickets, setTickets] = useState([]);

  // Toast alert notification
  const [toast, setToast] = useState(null);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // 1. Session Rehydration on Initial Load
  useEffect(() => {
    const verifyAuthSession = async () => {
      const token = api.auth.getToken();
      if (!token) {
        setCurrentUser(null);
        setAuthChecking(false);
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.auth.getMe();
        if (response?.user) {
          setCurrentUser(response.user);
          api.auth.setSession(token, response.user);
        } else {
          api.auth.logout();
          setCurrentUser(null);
        }
      } catch {
        // Expired or invalid token
        api.auth.logout();
        setCurrentUser(null);
      } finally {
        setAuthChecking(false);
      }
    };

    verifyAuthSession();
  }, []);

  // 2. Centralized data fetch from Express backend (Protected)
  const loadAllData = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      // Test health first
      await api.checkHealth();

      // Fetch all 4 modules and dashboard summary in parallel
      const [summaryData, crmData, dealsData, quotesData, ticketsData] = await Promise.all([
        api.getDashboardSummary(),
        api.crm.getAll(),
        api.pipeline.getAll(),
        api.quotations.getAll(),
        api.tickets.getAll()
      ]);

      setDashboardSummary(summaryData);
      setCustomers(crmData);
      setDeals(dealsData);
      setQuotations(quotesData);
      setTickets(ticketsData);
    } catch (err) {
      console.warn("Backend connection failed:", err.message);
      showToast("Could not sync backend data: " + err.message, "error");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Sync data once authenticated
  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser, loadAllData]);

  // Authentication Handlers
  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    showToast(`Welcome, ${user.name}! Workspace ready.`);
  };

  const handleLogout = () => {
    setIsMobileMenuOpen(false);
    api.auth.logout();
    setCurrentUser(null);
    setDashboardSummary(null);
    setCustomers([]);
    setDeals([]);
    setQuotations([]);
    setTickets([]);
    setCurrentTab("dashboard");
    showToast("You have been signed out safely.");
  };

  // ------------------------------------------------------------------
  // 1. CRM Handlers
  // ------------------------------------------------------------------
  const handleAddCustomer = async (data) => {
    const created = await api.crm.create(data);
    showToast(`Contact "${created.name}" created successfully.`);
    await loadAllData(true);
  };

  const handleUpdateCustomer = async (id, data) => {
    const updated = await api.crm.update(id, data);
    showToast(`Contact "${updated.name}" updated successfully.`);
    await loadAllData(true);
  };

  const handleDeleteCustomer = async (id) => {
    await api.crm.delete(id);
    showToast("Contact deleted successfully.");
    await loadAllData(true);
  };

  // ------------------------------------------------------------------
  // 2. Sales Pipeline Handlers
  // ------------------------------------------------------------------
  const handleAddDeal = async (data) => {
    try {
      const created = await api.pipeline.create(data);
      setDeals(prev => [created, ...prev.filter(d => d.id !== created.id)]);
      showToast(`Opportunity "${created.title}" added to pipeline.`);
      await loadAllData(true);
      return created;
    } catch (err) {
      showToast(`Failed to create deal: ${err.message}`, "error");
      throw err;
    }
  };

  const handleUpdateDealStage = async (id, stage) => {
    const prevDeals = [...deals];
    setDeals(prev => prev.map(d => d.id === id ? { ...d, stage } : d));
    try {
      const persisted = await api.pipeline.updateStage(id, stage);
      setDeals(prev => prev.map(d => d.id === id ? persisted : d));
      showToast(`Deal moved to stage: ${stage}`);
      await loadAllData(true);
    } catch (err) {
      setDeals(prevDeals);
      showToast(`Failed to move deal: ${err.message}`, "error");
    }
  };

  const handleDeleteDeal = async (id) => {
    try {
      await api.pipeline.delete(id);
      setDeals(prev => prev.filter(d => d.id !== id));
      showToast("Deal removed from pipeline.");
      await loadAllData(true);
    } catch (err) {
      showToast(`Failed to delete deal: ${err.message}`, "error");
    }
  };

  // ------------------------------------------------------------------
  // 3. Quotation Handlers
  // ------------------------------------------------------------------
  const handleAddQuotation = async (data) => {
    try {
      const created = await api.quotations.create(data);
      setQuotations(prev => [created, ...prev.filter(q => q.id !== created.id)]);
      showToast(`Quotation ${created.quoteNumber} issued (₹${Number(created.grandTotal).toLocaleString("en-IN")}).`);
      await loadAllData(true);
      return created;
    } catch (err) {
      showToast(`Failed to create quotation: ${err.message}`, "error");
      throw err;
    }
  };

  const handleUpdateQuoteStatus = async (id, status) => {
    const prevQuotes = [...quotations];
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    try {
      const persisted = await api.quotations.updateStatus(id, status);
      setQuotations(prev => prev.map(q => q.id === id ? persisted : q));
      showToast(`Quotation status changed to "${status}".`);
      await loadAllData(true);
    } catch (err) {
      setQuotations(prevQuotes);
      showToast(`Failed to update quotation: ${err.message}`, "error");
    }
  };

  const handleDeleteQuotation = async (id) => {
    try {
      await api.quotations.delete(id);
      setQuotations(prev => prev.filter(q => q.id !== id));
      showToast("Quotation deleted.");
      await loadAllData(true);
    } catch (err) {
      showToast(`Failed to delete quotation: ${err.message}`, "error");
    }
  };

  // ------------------------------------------------------------------
  // 4. Support Ticket Handlers
  // ------------------------------------------------------------------
  const handleAddTicket = async (data) => {
    try {
      const created = await api.tickets.create(data);
      setTickets(prev => [created, ...prev.filter(t => t.id !== created.id)]);
      showToast(`Support Ticket ${created.ticketNumber} opened.`);
      await loadAllData(true);
      return created;
    } catch (err) {
      showToast(`Failed to open ticket: ${err.message}`, "error");
      throw err;
    }
  };

  const handleUpdateTicketStatus = async (id, status) => {
    const prevTickets = [...tickets];
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    try {
      const updated = await api.tickets.updateStatus(id, status);
      setTickets(prev => prev.map(t => t.id === id ? updated : t));
      showToast(`Ticket status updated to "${status}".`);
      await loadAllData(true);
      return updated;
    } catch (err) {
      setTickets(prevTickets);
      showToast(`Failed to update ticket: ${err.message}`, "error");
      throw err;
    }
  };

  const handleAddTicketComment = async (id, commentData) => {
    try {
      const updated = await api.tickets.addComment(id, commentData);
      setTickets(prev => prev.map(t => t.id === id ? updated : t));
      showToast("Comment posted to ticket timeline.");
      await loadAllData(true);
      return updated;
    } catch (err) {
      showToast(`Failed to add comment: ${err.message}`, "error");
      throw err;
    }
  };

  const handleDeleteTicket = async (id) => {
    try {
      await api.tickets.delete(id);
      setTickets(prev => prev.filter(t => t.id !== id));
      showToast("Ticket deleted.");
      await loadAllData(true);
    } catch (err) {
      showToast(`Failed to delete ticket: ${err.message}`, "error");
    }
  };

  // Quick Action navigation from Header/Dashboard
  const handleOpenCreateModal = (targetModule) => {
    setCurrentTab(targetModule);
  };

  // ------------------------------------------------------------------
  // Auth Gate: Checking initial session
  // ------------------------------------------------------------------
  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 text-slate-600">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs font-medium text-slate-500">
          Loading workspace...
        </p>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Auth Gate: Unauthenticated Visitor -> Render AuthPage
  // ------------------------------------------------------------------
  if (!currentUser) {
    return (
      <>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50 animate-bounce">
            <div
              className={`px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold text-white flex items-center gap-2 border ${
                toast.type === "error"
                  ? "bg-rose-600 border-rose-500 shadow-rose-600/30"
                  : "bg-slate-900 border-slate-700 shadow-slate-900/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  toast.type === "error" ? "bg-rose-300" : "bg-emerald-400"
                }`}
              />
              <span>{toast.message}</span>
            </div>
          </div>
        )}
        <AuthPage onAuthSuccess={handleAuthSuccess} />
      </>
    );
  }

  // ------------------------------------------------------------------
  // Authenticated Workspace Application (Protected)
  // ------------------------------------------------------------------
  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100 font-sans text-slate-800 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Toast Alert Feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold text-white flex items-center gap-2 border ${
              toast.type === "error"
                ? "bg-rose-600 border-rose-500 shadow-rose-600/30"
                : "bg-slate-900 border-slate-700 shadow-slate-900/30"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                toast.type === "error" ? "bg-rose-300" : "bg-emerald-400"
              }`}
            />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={(tab) => {
          setCurrentTab(tab);
          setIsMobileMenuOpen(false);
        }}
        counts={{
          customers: customers.length,
          deals: deals.length,
          quotations: quotations.length,
          tickets: tickets.length
        }}
        user={currentUser}
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen max-h-screen overflow-hidden">
        <Header
          currentTab={currentTab}
          onRefresh={() => loadAllData(false)}
          isRefreshing={isRefreshing}
          onOpenCreateModal={handleOpenCreateModal}
          user={currentUser}
          onLogout={handleLogout}
          onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
        />

        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 overflow-y-auto overflow-x-hidden min-w-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-96 text-slate-400">
              <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-medium">Connecting to Backend & Syncing Modules...</p>
            </div>
          ) : (
            <>
              {currentTab === "dashboard" && (
                <DashboardOverview
                  summary={dashboardSummary}
                  setCurrentTab={setCurrentTab}
                  onOpenCreateModal={handleOpenCreateModal}
                />
              )}

              {currentTab === "crm" && (
                <CrmView
                  customers={customers}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={handleUpdateCustomer}
                  onDeleteCustomer={handleDeleteCustomer}
                />
              )}

              {currentTab === "pipeline" && (
                <PipelineView
                  deals={deals}
                  customers={customers}
                  onAddDeal={handleAddDeal}
                  onUpdateStage={handleUpdateDealStage}
                  onDeleteDeal={handleDeleteDeal}
                />
              )}

              {currentTab === "quotations" && (
                <QuotationView
                  quotations={quotations}
                  customers={customers}
                  onAddQuotation={handleAddQuotation}
                  onUpdateStatus={handleUpdateQuoteStatus}
                  onDeleteQuotation={handleDeleteQuotation}
                />
              )}

              {currentTab === "tickets" && (
                <TicketView
                  tickets={tickets}
                  customers={customers}
                  onAddTicket={handleAddTicket}
                  onUpdateStatus={handleUpdateTicketStatus}
                  onAddComment={handleAddTicketComment}
                  onDeleteTicket={handleDeleteTicket}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}