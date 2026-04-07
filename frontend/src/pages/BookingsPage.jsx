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
        <div className="card-list">
          {bookings.map((booking) => (
            <article
              key={booking.id}
              className="booking-card"
              style={{ "--booking-accent": booking.event_type?.accent_color || "var(--accent)" }}
            >
              <div>
                <p className="eyebrow">{booking.event_type.title}</p>
                <h4>{booking.booker_name}</h4>
                <p>{booking.booker_email}</p>
                <p>{formatDateTime(booking.start_time)}</p>
              </div>
              <div className="booking-side">
                <span className={`status-pill ${booking.status}`}>{booking.status}</span>
                {booking.status === "confirmed" && scope !== "past" ? (
                  <button type="button" className="ghost-button" onClick={() => handleCancel(booking.id)}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
