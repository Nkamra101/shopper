import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import { Skeleton, SkeletonList } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { formatDate, formatDateTime, getUpcomingDates, toDateInputValue } from "../utils/date";

const SCOPES = ["upcoming", "past", "all"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validatePortalForm(form) {
  const errors = {};
  if (!form.eventTypeId) errors.eventTypeId = "Select an event type.";
  if (!form.selectedDate) errors.selectedDate = "Choose a date.";
  if (!form.startTime) errors.startTime = "Pick a time slot.";
  if (!form.bookerName.trim()) errors.bookerName = "Guest name is required.";
  if (!EMAIL_PATTERN.test(form.bookerEmail.trim())) errors.bookerEmail = "Enter a valid email address.";
  return errors;
}

function PortalField({ label, error, children, fullWidth = false }) {
  return (
    <label className={fullWidth ? "full-width" : ""}>
      {label}
      {children}
      {error && <p className="field-error">{error}</p>}
    </label>
  );
}

export default function BookingsPage() {
  const toast = useToast();
  const [scope, setScope] = useState("upcoming");
  const [bookings, setBookings] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(true);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);
  const [editingNotes, setEditingNotes] = useState({ id: null, text: "" });
  const [savingNotes, setSavingNotes] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotOptions, setSlotOptions] = useState([]);
  const [portalTouched, setPortalTouched] = useState({});
  const [portalForm, setPortalForm] = useState({
    eventTypeId: "",
    selectedDate: toDateInputValue(getUpcomingDates(1)[0]),
    startTime: "",
    bookerName: "",
    bookerEmail: "",
    notes: "",
    sendEmail: true,
  });

  const upcomingDates = useMemo(() => getUpcomingDates(21), []);
  const portalErrors = useMemo(() => validatePortalForm(portalForm), [portalForm]);
  const filteredEventTypes = useMemo(
    () => eventTypes.filter((item) => item.is_active !== false),
    [eventTypes]
  );
  const selectedEventType = useMemo(
    () => filteredEventTypes.find((item) => item.id === portalForm.eventTypeId) || null,
    [filteredEventTypes, portalForm.eventTypeId]
  );

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

  async function loadPortalData() {
    setPortalLoading(true);
    try {
      const data = await api.getEventTypes();
      setEventTypes(data);
      const activeTypes = data.filter((item) => item.is_active !== false);
      setPortalForm((current) => ({
        ...current,
        eventTypeId: current.eventTypeId || activeTypes[0]?.id || "",
      }));
    } catch (error) {
      toast.error(error.message || "Failed to load booking portal.");
    } finally {
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    loadBookings(scope);
  }, [scope]);

  useEffect(() => {
    loadPortalData();
  }, []);

  useEffect(() => {
    async function loadSlots() {
      if (!selectedEventType?.url_slug || !portalForm.selectedDate) {
        setSlotOptions([]);
        return;
      }

      setSlotsLoading(true);
      try {
        const data = await api.getSlots(selectedEventType.url_slug, portalForm.selectedDate);
        setSlotOptions(data);
        setPortalForm((current) => {
          if (!current.startTime) return current;
          const stillAvailable = data.some((slot) => slot.start_time === current.startTime);
          return stillAvailable ? current : { ...current, startTime: "" };
        });
      } catch (error) {
        setSlotOptions([]);
        toast.error(error.message || "Could not load slots.");
      } finally {
        setSlotsLoading(false);
      }
    }

    loadSlots();
  }, [selectedEventType?.url_slug, portalForm.selectedDate]);

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
    const results = await Promise.allSettled([...selectedIds].map((id) => api.cancelBooking(id)));
    const failed = results.filter((r) => r.status === "rejected").length;
    const succeeded = results.length - failed;
    if (succeeded > 0) loadBookings(scope);
    if (failed > 0) toast.error(`${failed} cancellation(s) failed${succeeded > 0 ? `; ${succeeded} succeeded` : ""}.`);
    else toast.success(`${succeeded} booking(s) cancelled.`);
    setBulkCancelling(false);
  }

  async function handleCreateBooking(event) {
    event.preventDefault();
    setPortalTouched({
      eventTypeId: true,
      selectedDate: true,
      startTime: true,
      bookerName: true,
      bookerEmail: true,
    });
    if (Object.keys(portalErrors).length > 0) return;

    setCreatingBooking(true);
    try {
      await api.createAdminBooking({
        event_type_id: portalForm.eventTypeId,
        start_time: portalForm.startTime,
        booker_name: portalForm.bookerName.trim(),
        booker_email: portalForm.bookerEmail.trim(),
        notes: portalForm.notes.trim(),
        send_email: portalForm.sendEmail,
      });
      toast.success("Booking added successfully.");
      setPortalForm((current) => ({
        ...current,
        startTime: "",
        bookerName: "",
        bookerEmail: "",
        notes: "",
      }));
      setPortalTouched({});
      loadBookings(scope);
      if (selectedEventType?.url_slug) {
        const refreshedSlots = await api.getSlots(selectedEventType.url_slug, portalForm.selectedDate);
        setSlotOptions(refreshedSlots);
      }
    } catch (error) {
      toast.error(error.message || "Could not create booking.");
    } finally {
      setCreatingBooking(false);
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return bookings;
    const query = search.toLowerCase();
    return bookings.filter(
      (booking) =>
        booking.booker_name?.toLowerCase().includes(query) ||
        booking.booker_email?.toLowerCase().includes(query) ||
        booking.event_type?.title?.toLowerCase().includes(query)
    );
  }, [bookings, search]);

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((booking) => booking.id)));
    }
  }

  function exportCsv() {
    const rows = [
      ["ID", "Guest Name", "Guest Email", "Event Type", "Start Time", "Status", "Notes"],
      ...filtered.map((booking) => [
        booking.id,
        booking.booker_name,
        booking.booker_email,
        booking.event_type?.title || "",
        booking.start_time,
        booking.status,
        (booking.notes || "").replaceAll(",", ";"),
      ]),
    ];
    const csv = rows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bookings-${scope}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported.");
  }

  async function handleSaveNotes(bookingId) {
    setSavingNotes(true);
    try {
      const updated = await api.updateBookingNotes(bookingId, editingNotes.text);
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, notes: updated.notes } : b));
      setEditingNotes({ id: null, text: "" });
      toast.success("Notes saved.");
    } catch (err) {
      toast.error(err.message || "Could not save notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  const selectedSlotLabel =
    slotOptions.find((slot) => slot.start_time === portalForm.startTime)?.display_time || "";

  const emptyCopy = {
    upcoming: { title: "No upcoming bookings", description: "Manual bookings and public bookings will show here." },
    past: { title: "No past bookings", description: "Completed meetings will appear here for reference." },
    all: { title: "No bookings yet", description: "Create a booking or share a public link to get started." },
  };

  return (
    <div className="bookings-layout">
      <SectionCard
        title="Booking portal"
        subtitle="Add bookings for people yourself, even before they visit the public page."
      >
        {portalLoading ? (
          <div className="manual-booking-skeleton">
            <Skeleton height={42} />
            <Skeleton height={42} />
            <Skeleton height={120} />
          </div>
        ) : filteredEventTypes.length === 0 ? (
          <EmptyState
            title="Create an event type first"
            description="Your booking portal needs at least one active event type before you can add a person booking."
          />
        ) : (
          <form className="manual-booking-form" onSubmit={handleCreateBooking} noValidate>
            <div className="manual-booking-grid">
              <PortalField label="Event type" error={portalTouched.eventTypeId && portalErrors.eventTypeId}>
                <select
                  value={portalForm.eventTypeId}
                  onChange={(event) =>
                    setPortalForm((current) => ({
                      ...current,
                      eventTypeId: event.target.value,
                      startTime: "",
                    }))
                  }
                  onBlur={() => setPortalTouched((current) => ({ ...current, eventTypeId: true }))}
                >
                  {filteredEventTypes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title} - {item.duration} min
                    </option>
                  ))}
                </select>
              </PortalField>

              <PortalField label="Guest name" error={portalTouched.bookerName && portalErrors.bookerName}>
                <input
                  value={portalForm.bookerName}
                  onChange={(event) => setPortalForm((current) => ({ ...current, bookerName: event.target.value }))}
                  onBlur={() => setPortalTouched((current) => ({ ...current, bookerName: true }))}
                  placeholder="Priya Sharma"
                />
              </PortalField>

              <PortalField label="Date" error={portalTouched.selectedDate && portalErrors.selectedDate}>
                <select
                  value={portalForm.selectedDate}
                  onChange={(event) =>
                    setPortalForm((current) => ({
                      ...current,
                      selectedDate: event.target.value,
                      startTime: "",
                    }))
                  }
                  onBlur={() => setPortalTouched((current) => ({ ...current, selectedDate: true }))}
                >
                  {upcomingDates.map((date) => {
                    const value = toDateInputValue(date);
                    return (
                      <option key={value} value={value}>
                        {formatDate(date)}
                      </option>
                    );
                  })}
                </select>
              </PortalField>

              <PortalField label="Guest email" error={portalTouched.bookerEmail && portalErrors.bookerEmail}>
                <input
                  type="email"
                  value={portalForm.bookerEmail}
                  onChange={(event) => setPortalForm((current) => ({ ...current, bookerEmail: event.target.value }))}
                  onBlur={() => setPortalTouched((current) => ({ ...current, bookerEmail: true }))}
                  placeholder="priya@example.com"
                />
              </PortalField>

              <div className="full-width">
                <div className="manual-booking-slot-header">
                  <div>
                    <p className="eyebrow">Available slots</p>
                    <h4>
                      {selectedEventType?.title || "Choose a time"}
                    </h4>
                  </div>
                  {selectedSlotLabel && (
                    <div className="manual-booking-selection">
                      {formatDate(new Date(`${portalForm.selectedDate}T00:00:00`))} at {selectedSlotLabel}
                    </div>
                  )}
                </div>

                {slotsLoading ? (
                  <div className="slot-grid">
                    {Array.from({ length: 8 }).map((_, index) => (
                      <Skeleton key={index} height={44} />
                    ))}
                  </div>
                ) : slotOptions.length === 0 ? (
                  <div className="slots-empty">
                    <span>No open slots for this date.</span>
                  </div>
                ) : (
                  <div className="slot-grid" role="radiogroup" aria-label="Available slots">
                    {slotOptions.map((slot) => {
                      const active = slot.start_time === portalForm.startTime;
                      return (
                        <button
                          key={slot.start_time}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={active ? "slot-button active" : "slot-button"}
                          onClick={() =>
                            setPortalForm((current) => ({
                              ...current,
                              startTime: slot.start_time,
                            }))
                          }
                        >
                          {slot.display_time}
                        </button>
                      );
                    })}
                  </div>
                )}
                {portalTouched.startTime && portalErrors.startTime && (
                  <p className="field-error" style={{ marginTop: "var(--space-2)" }}>
                    {portalErrors.startTime}
                  </p>
                )}
              </div>

              <PortalField label="Notes" fullWidth>
                <textarea
                  rows="3"
                  value={portalForm.notes}
                  onChange={(event) => setPortalForm((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Optional context for the meeting"
                />
              </PortalField>
            </div>

            <div className="manual-booking-footer">
              <label className="portal-checkbox">
                <input
                  type="checkbox"
                  checked={portalForm.sendEmail}
                  onChange={(event) =>
                    setPortalForm((current) => ({
                      ...current,
                      sendEmail: event.target.checked,
                    }))
                  }
                />
                Send confirmation email and meeting link to the guest
              </label>

              <button type="submit" className="primary-button" disabled={creatingBooking}>
                {creatingBooking ? (
                  <>
                    <span className="btn-spinner" />
                    Creating booking...
                  </>
                ) : (
                  "Add booking"
                )}
              </button>
            </div>
          </form>
        )}
      </SectionCard>

      <SectionCard
        title="Bookings"
        subtitle="Track all upcoming and past meetings in one place."
      >
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                className="search-input"
                placeholder="Search guest, email, or event"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
                  x
                </button>
              )}
            </div>
            <button className="secondary-button" onClick={exportCsv} disabled={filtered.length === 0}>
              Export CSV
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <div className="bulk-action-bar">
            <span>{selectedIds.size} selected</span>
            <button className="ghost-button cancel-button" onClick={handleBulkCancel} disabled={bulkCancelling}>
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
            <EmptyState title="No results" description={`No bookings match "${search}".`} />
          ) : (
            <EmptyState title={emptyCopy[scope].title} description={emptyCopy[scope].description} />
          )
        ) : (
          <>
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
                        aria-label={`Select booking for ${booking.booker_name}`}
                      />
                    </div>
                    <div className="booking-main">
                      <p className="eyebrow" style={{ color: "var(--booking-accent)" }}>
                        {booking.event_type?.title}
                      </p>
                      <h4>{booking.booker_name}</h4>
                      <p className="booking-email">{booking.booker_email}</p>
                      <p className="booking-time">{formatDateTime(booking.start_time)}</p>
                      {editingNotes.id === booking.id ? (
                        <div className="booking-notes-edit">
                          <textarea
                            className="booking-notes-textarea"
                            rows="2"
                            value={editingNotes.text}
                            onChange={(e) => setEditingNotes((prev) => ({ ...prev, text: e.target.value }))}
                            placeholder="Add internal notes…"
                            autoFocus
                          />
                          <div className="booking-notes-actions">
                            <button
                              type="button"
                              className="primary-button"
                              style={{ minHeight: 32, padding: "4px 14px", fontSize: 13 }}
                              onClick={() => handleSaveNotes(booking.id)}
                              disabled={savingNotes}
                            >
                              {savingNotes ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              className="secondary-button"
                              style={{ minHeight: 32, padding: "4px 14px", fontSize: 13 }}
                              onClick={() => setEditingNotes({ id: null, text: "" })}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="booking-notes-row"
                          onClick={() => setEditingNotes({ id: booking.id, text: booking.notes || "" })}
                          title="Click to edit notes"
                        >
                          {booking.notes
                            ? <p className="booking-notes">"{booking.notes}"</p>
                            : <p className="booking-notes-empty">Add notes…</p>}
                        </div>
                      )}
                    </div>
                    <div className="booking-side">
                      <span className={`status-pill ${booking.status}`}>{booking.status}</span>
                      {booking.meeting_url && (
                        <a href={booking.meeting_url} target="_blank" rel="noreferrer" className="meeting-link-button">
                          Join
                        </a>
                      )}
                      {booking.status === "confirmed" && scope !== "past" && (
                        <div className="booking-actions">
                          <button type="button" className="ghost-button reschedule-button" onClick={() => setRescheduleTarget(booking)}>
                            Reschedule
                          </button>
                          <button type="button" className="ghost-button cancel-button" onClick={() => handleCancel(booking.id)}>
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
      </SectionCard>

      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => {
            setRescheduleTarget(null);
            loadBookings(scope);
          }}
        />
      )}
    </div>
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
  }, [slug, selectedDate, toast]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
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
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-panel">
        <header className="modal-header">
          <div>
            <p className="eyebrow">Reschedule booking</p>
            <h3>{booking.event_type.title}</h3>
            <p className="modal-subtitle">
              {booking.booker_name} - {formatDateTime(booking.start_time)}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            x
          </button>
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

          <p className="modal-label" style={{ marginTop: "var(--space-4)" }}>
            Pick a new time
          </p>
          {loadingSlots ? (
            <div className="slot-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} height={44} />
              ))}
            </div>
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
          <button type="button" className="secondary-button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="primary-button" onClick={handleConfirm} disabled={!selectedSlot || submitting}>
            {submitting ? "Rescheduling..." : "Confirm reschedule"}
          </button>
        </footer>
      </div>
    </div>
  );
}
