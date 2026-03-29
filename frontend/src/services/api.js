const API_BASE = import.meta.env.VITE_API_URL || "https://shopper-backend-2n4n.onrender.com";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Something went wrong");
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  getSummary: () => request("/api/summary"),
  getEventTypes: () => request("/api/event-types"),
  createEventType: (payload) =>
    request("/api/event-types", { method: "POST", body: JSON.stringify(payload) }),
  updateEventType: (id, payload) =>
    request(`/api/event-types/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  deleteEventType: (id) => request(`/api/event-types/${id}`, { method: "DELETE" }),
  getAvailability: () => request("/api/availability"),
  updateAvailability: (payload) =>
    request("/api/availability", { method: "PUT", body: JSON.stringify(payload) }),
  getBookings: (scope = "all") => request(`/api/bookings?scope=${scope}`),
  cancelBooking: (id) => request(`/api/bookings/${id}/cancel`, { method: "POST" }),
  getPublicEventType: (slug) => request(`/api/public/event-types/${slug}`),
  getSlots: (slug, date) => request(`/api/public/event-types/${slug}/slots?date=${date}`),
  createBooking: (slug, payload) =>
    request(`/api/public/event-types/${slug}/book`, { method: "POST", body: JSON.stringify(payload) }),
  getPublicBooking: (id) => request(`/api/public/bookings/${id}`),
};

