import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import { SkeletonList, Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { formatDate, formatDateTime, getUpcomingDates, toDateInputValue } from "../utils/date";

const SCOPES = ["upcoming", "past", "all"];

export default function BookingsPage() {
  const toast = useToast();
  const [scope, setScope] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);

  async function loadBookings(activeScope = scope) {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const data = await api.getBookings(activeScope);
      setBookings(data);
    } catch (error) {
      toast.error(error.message || "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBookings(scope); }, [scope]);

  async function handleCancel(id) {
    if (!window.confirm("Cancel this booking?")) return;
    try {
      await api.cancelBooking(id);
      toast.success("Booking cancelled.");
      loadBookings(scope);
    } catch (error) {
      toast.error(error.message || "Could not cancel booking.");
    }
  }

  async function handleBulkCancel() {
    if (!selectedIds.size) return;
    if (!window.confirm(`Cancel ${selectedIds.size} booking(s)?`)) return;
    setBulkCancelling(true);
    try {
      await Promise.all([...selectedIds].map((id) => api.cancelBooking(id)));
      toast.success(`${selectedIds.size} booking(s) cancelled.`);
      loadBookings(scope);
    } catch (error) {
      toast.error("Some cancellations failed.");
    } finally {
      setBulkCancelling(false);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((b) => b.id)));
    }
  }

  function exportCSV() {
    const rows = [
      ["ID", "Guest Name", "Guest Email", "Event Type", "Start Time", "Status", "Notes"],
      ...filtered.map((b) => [
        b.id,
        b.booker_name,
        b.booker_email,
        b.event_type?.title || "",
        b.start_time,
        b.status,
        (b.notes || "").replace(/,/g, ";"),
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookings-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const q = search.toLowerCase();
    return bookings.filter(
      (b) =>
        b.booker_name?.toLowerCase().includes(q) ||
        b.booker_email?.toLowerCase().includes(q) ||
        b.event_type?.title?.toLowerCase().includes(q)
    );
  }, [bookings, search]);

  const emptyCopy = {
    upcoming: { title: "No upcoming bookings", description: "When people book through your links they'll appear here." },
    past: { title: "No past bookings", description: "Completed meetings will show for reference." },
    all: { title: "No bookings yet", description: "Share an event link to receive your first booking." },
  };

  return (
    <SectionCard title="Bookings" subtitle="All scheduled meetings in one place.">
      {/* Toolbar */}
      <div className="bookings-toolbar">
        <div className="filter-tabs" role="tablist">
          {SCOPES.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={scope === item}
              className={scope === item ? "tab-button active" : "tab-button"}
              onClick={() => setScope(item)}
            >
              {item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
        <div className="bookings-toolbar-right">
          <div className="search-input-wrap">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="search-input"
              placeholder="Search guest, email, event…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">×</button>
            )}
          </div>
          <button className="secondary-button" onClick={exportCSV} disabled={filtered.length === 0}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="bulk-action-bar">
          <span>{selectedIds.size} selected</span>
          <button
            className="ghost-button cancel-button"
            onClick={handleBulkCancel}
            disabled={bulkCancelling}
          >
            {bulkCancelling ? "Cancelling..." : `Cancel ${selectedIds.size} booking(s)`}
          </button>
          <button className="secondary-button" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonList count={4} />
      ) : filtered.length === 0 ? (
        search ? (
          <EmptyState title="No results" description={`No bookings match "${search}"`} />
        ) : (
          <EmptyState title={emptyCopy[scope].title} description={emptyCopy[scope].description} />
        )
      ) : (
        <>
          {/* Select all row */}
          <div className="select-all-row">
            <label className="select-all-label">
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
                onChange={toggleSelectAll}
              />
              Select all ({filtered.length})
            </label>
          </div>

          <div className="timeline">
            {filtered.map((booking) => (
              <div
                key={booking.id}
                className="timeline-item"
                style={{ "--booking-accent": booking.event_type?.accent_color || "var(--accent)" }}
              >
                <div className="timeline-dot" />
                <article className={`booking-card timeline-card ${selectedIds.has(booking.id) ? "selected" : ""}`}>
                  <div className="booking-select">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(booking.id)}
                      onChange={() => toggleSelect(booking.id)}
                      aria-label={`Select booking with ${booking.booker_name}`}
                    />
                  </div>
                  <div className="booking-main">
                    <p className="eyebrow" style={{ color: "var(--booking-accent)" }}>
                      {booking.event_type?.title}
                    </p>
                    <h4>{booking.booker_name}</h4>
                    <p className="booking-email">{booking.booker_email}</p>
                    <p className="booking-time">{formatDateTime(booking.start_time)}</p>
                    {booking.notes && (
                      <p className="booking-notes">"{booking.notes}"</p>
                    )}
                  </div>
                  <div className="booking-side">
                    <span className={`status-pill ${booking.status}`}>{booking.status}</span>
                    {booking.meeting_url && (
                      <a
                        href={booking.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="meeting-link-button"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
                        </svg>
                        Join
                      </a>
                    )}
                    {booking.status === "confirmed" && scope !== "past" && (
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
                    )}
                  </div>
                </article>
              </div>
            ))}
          </div>
        </>
      )}

      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => { setRescheduleTarget(null); loadBookings(scope); }}
        />
      )}
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
  }, [slug, selectedDate]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
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
      toast.error(error.message || "Could not reschedule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Reschedule</p>
            <h3>{booking.event_type.title}</h3>
            <p className="modal-subtitle">with {booking.booker_name} · {formatDateTime(booking.start_time)}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body">
          <p className="modal-label">Pick a new date</p>
          <div className="date-picker-grid" role="radiogroup">
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
          <p className="modal-label" style={{ marginTop: "var(--space-4)" }}>Pick a new time</p>
          {loadingSlots ? (
            <div className="slot-grid">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={44} />)}</div>
          ) : slots.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No slots available for this day.</p>
          ) : (
            <div className="slot-grid" role="radiogroup">
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
          <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>Cancel</button>
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
