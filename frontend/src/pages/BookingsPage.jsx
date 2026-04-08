import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import { SkeletonList, Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { formatDate, formatDateTime, getUpcomingDates, toDateInputValue } from "../utils/date";

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
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

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
                    <div className="booking-actions">
                      <button
                        type="button"
                        className="ghost-button reschedule-button"
                        onClick={() => setRescheduleTarget(booking)}
                      >
                        Reschedule
                      </button>
                      <button
                        type="button"
                        className="ghost-button cancel-button"
                        onClick={() => handleCancel(booking.id)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            </div>
          ))}
        </div>
      )}

      {rescheduleTarget ? (
        <RescheduleModal
          booking={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => {
            setRescheduleTarget(null);
            loadBookings(scope);
          }}
        />
      ) : null}
    </SectionCard>
  );
}

function RescheduleModal({ booking, onClose, onSuccess }) {
  const toast = useToast();
  const dateChoices = useMemo(() => getUpcomingDates(14), []);
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(dateChoices[0]));
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const slug = booking.event_type?.url_slug;

  useEffect(() => {
    async function loadSlots() {
      if (!slug || !selectedDate) return;
      setLoadingSlots(true);
      setSelectedSlot("");
      try {
        const data = await api.getSlots(slug, selectedDate);
        setSlots(data);
      } catch (error) {
        toast.error(error.message || "Could not load slots.");
      } finally {
        setLoadingSlots(false);
      }
    }
    loadSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, selectedDate]);

  // Close on Escape.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleConfirm() {
    if (!selectedSlot) return;
    setSubmitting(true);
    try {
      await api.rescheduleBooking(booking.id, { start_time: selectedSlot });
      toast.success("Booking rescheduled.");
      onSuccess();
    } catch (error) {
      toast.error(error.message || "Could not reschedule booking.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Reschedule booking"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Reschedule</p>
            <h3>{booking.event_type.title}</h3>
            <p className="modal-subtitle">
              with {booking.booker_name} — currently {formatDateTime(booking.start_time)}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal-body">
          <p className="modal-label">Pick a new date</p>
          <div className="date-picker-grid" role="radiogroup" aria-label="Pick a date">
            {dateChoices.map((date) => {
              const value = toDateInputValue(date);
              const active = selectedDate === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={active ? "date-chip active" : "date-chip"}
                  onClick={() => setSelectedDate(value)}
                >
                  {formatDate(date)}
                </button>
              );
            })}
          </div>

          <p className="modal-label" style={{ marginTop: "var(--space-4)" }}>
            Pick a new time
          </p>
          {loadingSlots ? (
            <div className="slot-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} height={44} />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p style={{ color: "var(--text-muted)", margin: "8px 0 16px" }}>
              No slots available for this day.
            </p>
          ) : (
            <div className="slot-grid" role="radiogroup" aria-label="Available times">
              {slots.map((slot) => {
                const active = selectedSlot === slot.start_time;
                return (
                  <button
                    key={slot.start_time}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={active ? "slot-button active" : "slot-button"}
                    onClick={() => setSelectedSlot(slot.start_time)}
                  >
                    {slot.display_time}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="modal-footer">
          <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={handleConfirm}
            disabled={!selectedSlot || submitting}
          >
            {submitting ? "Rescheduling..." : "Confirm reschedule"}
          </button>
        </footer>
      </div>
    </div>
  );
}
