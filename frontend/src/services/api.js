/**
 * Centralized JavaScript API / HTTP Client
 * Connects React frontend directly to the Express backend.
 * Automatically injects JWT Bearer token into authenticated requests.
 */

// Dynamic backend URL cache and auto-discovery
let cachedBackendUrl = null;

export const resolveBackendUrl = async () => {
  if (cachedBackendUrl) return cachedBackendUrl;

  // 1. Explicit production URL from environment variable (e.g. Render/Vercel)
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim() !== "") {
    const trimmed = envUrl.trim().replace(/\/+$/, "");
    cachedBackendUrl = trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
    return cachedBackendUrl;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname || "localhost";

    // 2. Query Vite dev server middleware for the currently active backend port
    try {
      const devPortRes = await fetch("/active-backend-port", { signal: AbortSignal.timeout(400) });
      if (devPortRes.ok) {
        const info = await devPortRes.json();
        if (info && info.url) {
          // Verify backend responds
          const testRes = await fetch(`${info.url}/health`, { signal: AbortSignal.timeout(500) }).catch(() => null);
          if (testRes && testRes.ok) {
            cachedBackendUrl = info.url;
            localStorage.setItem("crm_active_backend_url", cachedBackendUrl);
            console.log(`[CRM API] Connected to backend on port ${info.port}: ${cachedBackendUrl}`);
            return cachedBackendUrl;
          }
        }
      }
    } catch (_) {}

    // 3. Check cached working backend port from localStorage
    const stored = localStorage.getItem("crm_active_backend_url");
    if (stored) {
      try {
        const testRes = await fetch(`${stored}/health`, { signal: AbortSignal.timeout(400) });
        if (testRes.ok) {
          const data = await testRes.json().catch(() => ({}));
          if (data.service === "crm-sales-management-system" || data.status === "healthy") {
            cachedBackendUrl = stored;
            return cachedBackendUrl;
          }
        }
      } catch (_) {
        localStorage.removeItem("crm_active_backend_url");
      }
    }

    // 4. Scan candidate backend ports (5000-5015) in parallel to locate THIS CRM backend service
    const candidates = [5001, 5002, 5003, 5004, 5005, 5006, 5007, 5008, 5009, 5010, 5000];
    const checks = candidates.map(async (port) => {
      const url = `http://${hostname}:${port}/api`;
      try {
        const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(600) });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data.service === "crm-sales-management-system") {
            return { url, priority: 1 };
          }
          if (data.status === "healthy") {
            return { url, priority: 2 };
          }
        }
      } catch (_) {}
      return null;
    });

    const results = (await Promise.all(checks)).filter(Boolean);
    if (results.length > 0) {
      results.sort((a, b) => a.priority - b.priority);
      cachedBackendUrl = results[0].url;
      localStorage.setItem("crm_active_backend_url", cachedBackendUrl);
      console.log(`[CRM API] Connected to active backend at: ${cachedBackendUrl}`);
      return cachedBackendUrl;
    }

    // 4. Fallback to localhost:5001/api
    return `http://${hostname}:5001/api`;
  }

  return "http://localhost:5001/api";
};

const TOKEN_KEY = "crm_auth_token";
const USER_KEY = "crm_auth_user";

async function request(endpoint, options = {}) {
  let baseUrl = await resolveBackendUrl();
  let url = `${baseUrl}${endpoint}`;
  
  // Retrieve token from localStorage if present
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
    } catch (networkErr) {
      // Invalidate cache and auto-discover active backend port
      cachedBackendUrl = null;
      localStorage.removeItem("crm_active_backend_url");
      baseUrl = await resolveBackendUrl();
      url = `${baseUrl}${endpoint}`;
      response = await fetch(url, { ...options, headers });
    }

    // If 502/504 Bad Gateway (e.g. stale proxy), re-scan and retry directly
    if (response.status === 502 || response.status === 504) {
      cachedBackendUrl = null;
      localStorage.removeItem("crm_active_backend_url");
      const freshBase = await resolveBackendUrl();
      if (freshBase !== baseUrl) {
        response = await fetch(`${freshBase}${endpoint}`, { ...options, headers });
      }
    }

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error && errorData.error !== errorData.message
          ? `${errorData.message} (${errorData.error})`
          : (errorData.message || errorMessage);
      } catch {
        // use default message
      }

      // If token expired or invalid (401), clean up session
      if (response.status === 401 && endpoint !== "/auth/login") {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return await response.json();
  } catch (err) {
    console.error(`API request failed [${options.method || "GET"} ${endpoint}]:`, err.message);
    throw err;
  }
}

export const api = {
  // Authentication & Session Management
  auth: {
    signup: (data) => request("/auth/signup", { method: "POST", body: JSON.stringify(data) }),
    login: (data) => request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
    getMe: () => request("/auth/me"),
    getToken: () => localStorage.getItem(TOKEN_KEY),
    getUser: () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return null;
        const u = localStorage.getItem(USER_KEY);
        return u ? JSON.parse(u) : null;
      } catch {
        return null;
      }
    },
    setSession: (token, user) => {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    logout: () => {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  // Health & Test
  checkHealth: () => request("/test"),

  // Dashboard Overview
  getDashboardSummary: () => request("/dashboard/summary"),

  // 1. CRM (Customers & Leads)
  crm: {
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.search) query.append("search", params.search);
      if (params.type) query.append("type", params.type);
      if (params.status) query.append("status", params.status);
      const qs = query.toString();
      return request(`/crm/customers${qs ? `?${qs}` : ""}`);
    },
    getById: (id) => request(`/crm/customers/${id}`),
    create: (data) => request("/crm/customers", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/crm/customers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id) => request(`/crm/customers/${id}`, { method: "DELETE" })
  },

  // 1.1 Lead Management (Day 6)
  leads: {
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.page) query.append("page", params.page);
      if (params.limit) query.append("limit", params.limit);
      if (params.status) query.append("status", params.status);
      if (params.search) query.append("search", params.search);
      const qs = query.toString();
      return request(`/crm/leads${qs ? `?${qs}` : ""}`);
    },
    getById: (id) => request(`/crm/leads/${id}`),
    create: (data) => request("/crm/leads", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/crm/leads/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    delete: (id) => request(`/crm/leads/${id}`, { method: "DELETE" }),
    getNotes: (id) => request(`/crm/leads/${id}/notes`),
    addNote: (id, data) => request(`/crm/leads/${id}/notes`, { method: "POST", body: JSON.stringify(data) }),
    assign: (id, assignedTo) => request(`/crm/leads/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assignedTo }) })
  },

  // 2. Sales Pipeline (Deals)
  pipeline: {
    getAll: async (params = {}) => {
      const query = new URLSearchParams();
      if (params.page) query.append("page", params.page);
      if (params.limit) query.append("limit", params.limit);
      if (params.stage) query.append("stage", params.stage);
      if (params.search) query.append("search", params.search);
      if (params.customerId) query.append("customerId", params.customerId);
      const qs = query.toString();
      const res = await request(`/pipeline/deals${qs ? `?${qs}` : ""}`);
      return Array.isArray(res) ? res : (res.deals || []);
    },
    getStats: () => request("/pipeline/stats"),
    getById: (id) => request(`/pipeline/deals/${id}`),
    create: (data) => request("/pipeline/deals", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/pipeline/deals/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    updateStage: (id, stage) => request(`/pipeline/deals/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stage }) }),
    delete: (id) => request(`/pipeline/deals/${id}`, { method: "DELETE" })
  },

  // 3. Quotation
  quotations: {
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.append("status", params.status);
      if (params.customerId) query.append("customerId", params.customerId);
      if (params.page) query.append("page", params.page);
      if (params.limit) query.append("limit", params.limit);
      if (params.search) query.append("search", params.search);
      const qs = query.toString();
      return request(`/quotations${qs ? `?${qs}` : ""}`);
    },
    getById: (id) => request(`/quotations/${id}`),
    create: (data) => request("/quotations", { method: "POST", body: JSON.stringify(data) }),
    addItem: (id, itemData) => request(`/quotations/${id}/items`, { method: "POST", body: JSON.stringify(itemData) }),
    update: (id, data) => request(`/quotations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    calculatePreview: (items, discount = 0) => request("/quotations/preview", { method: "POST", body: JSON.stringify({ items, discount }) }),
    updateStatus: (id, status) => request(`/quotations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    delete: (id) => request(`/quotations/${id}`, { method: "DELETE" }),
    getPdfUrl: async (id) => {
      const baseUrl = await resolveBackendUrl();
      return `${baseUrl}/quotations/${id}/pdf`;
    },
    downloadPdf: async (id, quoteNumber = "quotation") => {
      const baseUrl = await resolveBackendUrl();
      const token = localStorage.getItem(TOKEN_KEY);
      const res = await fetch(`${baseUrl}/quotations/${id}/pdf`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        throw new Error(`Failed to download PDF (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `quotation-${quoteNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(link);
    }
  },

  // 4. Support Tickets
  tickets: {
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.status) query.append("status", params.status);
      if (params.priority) query.append("priority", params.priority);
      if (params.customerId) query.append("customerId", params.customerId);
      const qs = query.toString();
      return request(`/tickets${qs ? `?${qs}` : ""}`);
    },
    getById: (id) => request(`/tickets/${id}`),
    getAgents: () => request("/tickets/agents"),
    create: (data) => request("/tickets", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => request(`/tickets/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    updateStatus: (id, status) => request(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    assign: (id, assignedTo) => request(`/tickets/${id}/assign`, { method: "PATCH", body: JSON.stringify({ assignedTo }) }),
    addComment: (id, commentData) => request(`/tickets/${id}/comments`, { method: "POST", body: JSON.stringify(commentData) }),
    uploadAttachment: async (id, formData) => {
      const baseUrl = await resolveBackendUrl();
      const token = localStorage.getItem("crm_auth_token");
      return fetch(`${baseUrl}/tickets/${id}/attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      }).then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Failed to upload attachment");
        return data;
      });
    },
    delete: (id) => request(`/tickets/${id}`, { method: "DELETE" })
  }
};
