/**
 * Centralized JavaScript API / HTTP Client
 * Connects React frontend directly to the Express backend.
 * Automatically injects JWT Bearer token into authenticated requests.
 */

const API_BASE_URL = "http://localhost:5000/api";
const TOKEN_KEY = "crm_auth_token";
const USER_KEY = "crm_auth_user";

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  // Retrieve token from localStorage if present
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        // use default message
      }

      // If token expired or invalid (401), clean up session
      if (response.status === 401 && endpoint !== "/auth/login") {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }

      throw new Error(errorMessage);
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
    getPdfUrl: (id) => `${API_BASE_URL}/quotations/${id}/pdf`
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
    create: (data) => request("/tickets", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id, status) => request(`/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    addComment: (id, commentData) => request(`/tickets/${id}/comments`, { method: "POST", body: JSON.stringify(commentData) }),
    delete: (id) => request(`/tickets/${id}`, { method: "DELETE" })
  }
};
