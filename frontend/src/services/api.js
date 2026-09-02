/**
 * Centralized JavaScript API / HTTP Client
 * Connects React frontend directly to the Express backend.
 */

const API_BASE_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
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
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (err) {
    console.error(`API request failed [${options.method || "GET"} ${endpoint}]:`, err.message);
    throw err;
  }
}

export const api = {
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

  // 2. Sales Pipeline (Deals)
  pipeline: {
    getAll: (params = {}) => {
      const query = new URLSearchParams();
      if (params.stage) query.append("stage", params.stage);
      if (params.customerId) query.append("customerId", params.customerId);
      const qs = query.toString();
      return request(`/pipeline/deals${qs ? `?${qs}` : ""}`);
    },
    getStats: () => request("/pipeline/deals/stats"),
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
      const qs = query.toString();
      return request(`/quotations${qs ? `?${qs}` : ""}`);
    },
    getById: (id) => request(`/quotations/${id}`),
    create: (data) => request("/quotations", { method: "POST", body: JSON.stringify(data) }),
    calculatePreview: (items) => request("/quotations/preview", { method: "POST", body: JSON.stringify({ items }) }),
    updateStatus: (id, status) => request(`/quotations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    delete: (id) => request(`/quotations/${id}`, { method: "DELETE" })
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
