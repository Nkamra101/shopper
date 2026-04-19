const API_BASE = import.meta.env.VITE_API_URL || "https://shopper-backend-2n4n.onrender.com";

function getToken() {
  return localStorage.getItem("shopper_token") || null;
}

async function request(path, options = {}) {
  let timeoutId;
  if (!options.hideSpinUpWarning) {
    timeoutId = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("api-slow"));
    }, 4000);
  }

  const token = getToken();
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
        ...(options.headers || {}),
      },
      ...options,
    });

    if (timeoutId) clearTimeout(timeoutId);
    window.dispatchEvent(new CustomEvent("api-fast"));

    if (response.status === 401) {
      // Token expired — clear it and redirect to login
      localStorage.removeItem("shopper_token");
      localStorage.removeItem("shopper_user");
      window.location.href = "/login";
      throw new Error("Session expired. Please sign in again.");
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || "Something went wrong");
    }

    if (response.status === 204) return null;
    return response.json();
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    window.dispatchEvent(new CustomEvent("api-fast"));
    throw error;
  }
}

export const api = {
  // Auth
  register: (payload) => request("/api/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  getMe: () => request("/api/auth/me"),
  updateProfile: (payload) => request("/api/auth/profile", { method: "PUT", body: JSON.stringify(payload) }),
  changePassword: (payload) => request("/api/auth/change-password", { method: "PUT", body: JSON.stringify(payload) }),

  // Event types
  getSummary: () => request("/api/summary"),
  getEventTypes: () => request("/api/event-types"),
  createEventType: (payload) => request("/api/event-types", { method: "POST", body: JSON.stringify(payload) }),
  updateEventType: (id, payload) => request(`/api/event-types/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEventType: (id) => request(`/api/event-types/${id}`, { method: "DELETE" }),
  toggleEventType: (id) => request(`/api/event-types/${id}/toggle`, { method: "PATCH" }),
  duplicateEventType: (id) => request(`/api/event-types/${id}/duplicate`, { method: "POST" }),

  // Availability
  getAvailability: () => request("/api/availability"),
  updateAvailability: (payload) => request("/api/availability", { method: "PUT", body: JSON.stringify(payload) }),

  // Bookings
  getBookings: (scope = "all") => request(`/api/bookings?scope=${scope}`),
  createAdminBooking: (payload) => request("/api/bookings", { method: "POST", body: JSON.stringify(payload) }),
  cancelBooking: (id) => request(`/api/bookings/${id}/cancel`, { method: "POST" }),
  rescheduleBooking: (id, payload) => request(`/api/bookings/${id}/reschedule`, { method: "POST", body: JSON.stringify(payload) }),
  updateBookingNotes: (id, notes) => request(`/api/bookings/${id}/notes`, { method: "PATCH", body: JSON.stringify({ notes }) }),

  // Blockouts
  getBlockouts: () => request("/api/blockouts"),
  createBlockout: (payload) => request("/api/blockouts", { method: "POST", body: JSON.stringify(payload) }),
  deleteBlockout: (date) => request(`/api/blockouts/${date}`, { method: "DELETE" }),

  // Public booking (no auth required)
  getPublicEventType: (slug) => request(`/api/public/event-types/${slug}`, { hideSpinUpWarning: false }),
  getSlots: (slug, date) => request(`/api/public/event-types/${slug}/slots?date=${date}`),
  createBooking: (slug, payload) => request(`/api/public/event-types/${slug}/book`, { method: "POST", body: JSON.stringify(payload) }),
  getPublicBooking: (id) => request(`/api/public/bookings/${id}`),

  // OTP (public)
  requestOtp: (email) => request("/api/public/otp/request", { method: "POST", body: JSON.stringify({ email }) }),
  verifyOtp: (email, code) => request("/api/public/otp/verify", { method: "POST", body: JSON.stringify({ email, code }) }),

  // Integrations
  getIntegrations: () => request("/api/integrations"),
  saveIntegration: (key, config) => request(`/api/integrations/${key}`, { method: "POST", body: JSON.stringify({ config }) }),
  disconnectIntegration: (key) => request(`/api/integrations/${key}`, { method: "DELETE" }),
  testIntegration: (key) => request(`/api/integrations/${key}/test`, { method: "POST" }),

  // API keys
  getApiKeys: () => request("/api/auth/api-keys"),
  generateApiKey: () => request("/api/auth/api-keys", { method: "POST" }),
  revokeApiKey: () => request("/api/auth/api-keys", { method: "DELETE" }),

  // iCal feed URL (helper, not a request)
  icalUrl: (username) => `${API_BASE}/api/public/ical/${username}`,

  // Workflows
  getWorkflows: () => request("/api/workflows"),
  createWorkflow: (payload) => request("/api/workflows", { method: "POST", body: JSON.stringify(payload) }),
  updateWorkflow: (id, payload) => request(`/api/workflows/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  toggleWorkflow: (id) => request(`/api/workflows/${id}/toggle`, { method: "PATCH" }),
  deleteWorkflow: (id) => request(`/api/workflows/${id}`, { method: "DELETE" }),
};
