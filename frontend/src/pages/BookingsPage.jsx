import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import { SkeletonList } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { formatDateTime } from "../utils/date";

const SCOPES = ["upcoming", "past", "all"];

const emptyCopy = {
  upcoming: {
    title: "No upcoming bookings",
    description: "When people book a time through your public links, they'll appear here.",
  },
  past: {
    title: "No past bookings",
    description: "Completed meetings will show up here for reference.",
  },
  all: {
    title: "No bookings yet",
    description: "Share one of your event links to receive your first booking.",
  },
};

export default function BookingsPage() {
  const toast = useToast();
  const [scope, setScope] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleData, setRescheduleData] = useState(null);

  async function loadBookings(activeScope = scope) {
    setLoading(true);
    try {
      const data = await api.getBookings(activeScope);
      setBookings(data);
    } catch (error) {
      toast.error(error.message || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBookings(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function handleCancel(id) {
    if (!window.confirm("Cancel this booking? The guest will need a new slot.")) return;
    try {
      await api.cancelBooking(id);
      toast.success("Booking cancelled.");
      loadBookings(scope);
    } catch (error) {
      toast.error(error.message || "Could not cancel booking.");
    }
  }

  async function submitReschedule(e) {
    e.preventDefault();
    if (!rescheduleData || !rescheduleData.start_time) return;
    try {
      await api.rescheduleBooking(rescheduleData.id, { start_time: rescheduleData.start_time });
      toast.success("Booking rescheduled.");
      setRescheduleData(null);
      loadBookings(scope);
    } catch (error) {
      toast.error(error.message || "Could not reschedule booking.");
    }
  }

  return (
    <SectionCard title="Bookings dashboard" subtitle="Track upcoming meetings and keep older ones for reference.">
      <div className="filter-tabs" role="tablist" aria-label="Booking filter">
        {SCOPES.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={scope === item}
            className={scope === item ? "tab-button active" : "tab-button"}
            onClick={() => setScope(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} />
      ) : bookings.length === 0 ? (
        <EmptyState title={emptyCopy[scope].title} description={emptyCopy[scope].description} />
      ) : (
        <div className="timeline">
          {bookings.map((booking) => (
            <div key={booking.id} className="timeline-item" style={{ "--booking-accent": booking.event_type?.accent_color || "var(--accent)" }}>
              <div className="timeline-dot" />
              <article className="booking-card timeline-card">
                <div>
                  <p className="eyebrow" style={{ color: "var(--booking-accent)" }}>{booking.event_type.title}</p>
                  <h4>{booking.booker_name}</h4>
                  <p>{booking.booker_email}</p>
                  <p style={{ fontWeight: 600, marginTop: "var(--space-2)", color: "var(--text)" }}>{formatDateTime(booking.start_time)}</p>
                </div>
              <div className="booking-side">
                <span className={`status-pill ${booking.status}`}>{booking.status}</span>
                {booking.meeting_url && (
                  <a href={booking.meeting_url} target="_blank" rel="noreferrer" className="meeting-link-button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"></polygon>
                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                    </svg>
                    Join Video
                  </a>
                )}
                {booking.status === "confirmed" && scope !== "past" ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "16px" }}>
                    {rescheduleData?.id === booking.id ? (
                      <form onSubmit={submitReschedule} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                        <input 
                          type="datetime-local" 
                          value={rescheduleData.start_time} 
                          onChange={(e) => setRescheduleData({ ...rescheduleData, start_time: e.target.value })}
                          required
                          style={{ padding: "4px", fontSize: "14px", background: "var(--bg)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "4px" }}
                        />
                        <button type="submit" className="primary-button" style={{ padding: "4px 8px", minHeight: "32px", fontSize: "12px" }}>Save</button>
                        <button type="button" className="ghost-button" onClick={() => setRescheduleData(null)} style={{ padding: "4px 8px", minHeight: "32px", fontSize: "12px" }}>Cancel</button>
                      </form>
                    ) : (
                      <>
                        <button type="button" className="ghost-button" onClick={() => setRescheduleData({ id: booking.id, start_time: "" })} style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px", color: "var(--text)" }}>
                          Reschedule
                        </button>
                        <button type="button" className="ghost-button" onClick={() => handleCancel(booking.id)} style={{ minHeight: "32px", padding: "4px 8px", fontSize: "12px", color: "var(--danger)" }}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
              </article>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
