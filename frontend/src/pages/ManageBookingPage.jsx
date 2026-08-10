import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import {
  browserTimezone,
  dateKeyIn,
  formatFullIn,
  formatTimeIn,
  shiftDateKey,
  timezoneOffsetLabel,
  toDateInputValue,
} from "../utils/date";
import { Skeleton } from "../components/Skeleton";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

/**
 * The page an invitee lands on from the "reschedule or cancel" link in their
 * confirmation email. The URL token is the only credential — there is no
 * account and nothing to sign into.
 */
export default function ManageBookingPage() {
  const { token } = useParams();
  const toast = useToast();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState("view");
  const [busy, setBusy] = useState(false);

  const [timezone, setTimezone] = useState(browserTimezone);
  const [selectedDate, setSelectedDate] = useState(() => toDateInputValue(new Date()));
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBooking(await api.getManagedBooking(token));
      setNotFound(false);
    } catch (error) {
      setNotFound(true);
      if (!/invalid|expired/i.test(error.message || "")) {
        toast.error(error.message || "Could not load this booking.");
      }
    } finally {
      setLoading(false);
    }
  }, [token, toast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;

    async function loadSlots() {
      if (mode !== "reschedule" || !booking?.event_slug) return;
      setLoadingSlots(true);
      try {
        const days = [shiftDateKey(selectedDate, -1), selectedDate, shiftDateKey(selectedDate, 1)];
        const results = await Promise.all(
          days.map((day) => api.getSlots(booking.event_slug, day).catch(() => []))
        );
        if (cancelled) return;

        const byStart = new Map();
        results.flat().forEach((slot) => byStart.set(slot.start_utc, slot));
        setSlots(
          [...byStart.values()]
            .filter((slot) => dateKeyIn(slot.start_utc, timezone) === selectedDate)
            .sort((a, b) => a.start_utc.localeCompare(b.start_utc))
        );
        setSelectedSlot("");
      } catch (error) {
        if (!cancelled) toast.error(error.message || "Could not load times.");
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }

    loadSlots();
    return () => { cancelled = true; };
  }, [mode, booking?.event_slug, selectedDate, timezone, toast]);

  async function handleCancel() {
    if (!window.confirm("Cancel this meeting? The host will be notified.")) return;
    setBusy(true);
    try {
      setBooking(await api.cancelManagedBooking(token));
      toast.success("Your meeting has been cancelled.");
      setMode("view");
    } catch (error) {
      toast.error(error.message || "Could not cancel this booking.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReschedule() {
    if (!selectedSlot) {
      toast.error("Pick a new time first.");
      return;
    }
    setBusy(true);
    try {
      setBooking(await api.rescheduleManagedBooking(token, { start_time: selectedSlot }));
      toast.success("Your meeting has been moved.");
      setMode("view");
    } catch (error) {
      toast.error(error.message || "Could not reschedule this booking.");
    } finally {
      setBusy(false);
    }
  }

  const statusLabel = useMemo(() => {
    if (!booking) return "";
    if (booking.status === "cancelled") return "Cancelled";
    if (new Date(booking.start_time) < new Date()) return "Completed";
    return "Confirmed";
  }, [booking]);

  if (loading) {
    return (
      <div className="public-page">
        <div className="public-topbar">
          <div className="public-brand">Shopper</div>
          <ThemeToggle />
        </div>
        <div className="manage-shell">
          <div className="manage-card">
            <Skeleton height={22} width="55%" style={{ marginBottom: 16 }} />
            <Skeleton height={14} width="80%" style={{ marginBottom: 8 }} />
            <Skeleton height={14} width="60%" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="public-page">
        <div className="public-topbar">
          <div className="public-brand">Shopper</div>
          <ThemeToggle />
        </div>
        <div className="manage-shell">
          <div className="manage-card manage-card-empty">
            <h1 className="manage-title">This link isn't valid</h1>
            <p className="manage-lead">
              It may have already been used, or the booking was removed. If you still need to make
              a change, reply to your confirmation email and the host can help.
            </p>
            <Link className="secondary-button" to="/">Go to Shopper</Link>
          </div>
        </div>
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";

  return (
    <div className="public-page">
      <div className="public-topbar">
        <div className="public-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          </svg>
          Shopper
        </div>
        <ThemeToggle />
      </div>

      <div className="manage-shell">
        <div className="manage-card">
          <div className="manage-head">
            <span className={`status-pill ${isCancelled ? "cancelled" : "confirmed"}`}>{statusLabel}</span>
            <h1 className="manage-title">{booking.event_title}</h1>
            {booking.host_name ? <p className="manage-lead">with {booking.host_name}</p> : null}
          </div>

          <dl className="manage-details">
            <div>
              <dt>When</dt>
              <dd>
                {formatFullIn(booking.start_time, timezone)}
                <span className="manage-tz"> ({timezone.replace(/_/g, " ")} {timezoneOffsetLabel(timezone)})</span>
              </dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{booking.duration} minutes</dd>
            </div>
            <div>
              <dt>Guest</dt>
              <dd>{booking.booker_name} &middot; {booking.booker_email}</dd>
            </div>
            {booking.meeting_url ? (
              <div>
                <dt>Join</dt>
                <dd><a className="manage-link" href={booking.meeting_url} target="_blank" rel="noreferrer">{booking.meeting_url}</a></dd>
              </div>
            ) : null}
            {booking.notes ? (
              <div>
                <dt>Notes</dt>
                <dd>{booking.notes}</dd>
              </div>
            ) : null}
            {(booking.answers || []).map((answer) => (
              <div key={answer.question_id}>
                <dt>{answer.label || answer.question_id}</dt>
                <dd>{answer.value}</dd>
              </div>
            ))}
          </dl>

          {isCancelled ? (
            <p className="manage-note">This meeting was cancelled. Book a new time from the host's page.</p>
          ) : !booking.can_cancel && !booking.can_reschedule ? (
            <p className="manage-note">This meeting has already taken place.</p>
          ) : mode === "view" ? (
            <div className="manage-actions">
              {booking.can_reschedule ? (
                <button className="secondary-button" onClick={() => setMode("reschedule")}>Reschedule</button>
              ) : null}
              {booking.can_cancel ? (
                <button className="danger-button" onClick={handleCancel} disabled={busy}>
                  {busy ? "Cancelling..." : "Cancel meeting"}
                </button>
              ) : null}
            </div>
          ) : (
            <div className="manage-reschedule">
              <div className="step-heading-row">
                <h3 className="step-heading">Pick a new time</h3>
                <label className="tz-select">
                  <span className="tz-select-label">Times in</span>
                  <select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                    {[timezone, browserTimezone(), "UTC"]
                      .filter((zone, index, all) => all.indexOf(zone) === index)
                      .map((zone) => (
                        <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>
                      ))}
                  </select>
                </label>
              </div>

              <label className="manage-date-field">
                Date
                <input
                  type="date"
                  value={selectedDate}
                  min={toDateInputValue(new Date())}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </label>

              {loadingSlots ? (
                <div className="slot-grid">
                  {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} height={40} />)}
                </div>
              ) : slots.length === 0 ? (
                <div className="slots-empty"><span>No available times on this day.</span></div>
              ) : (
                <div className="slot-grid" role="radiogroup" aria-label="Available times">
                  {slots.map((slot) => {
                    const active = selectedSlot === slot.start_utc;
                    return (
                      <button
                        key={slot.start_utc}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={active ? "slot-button active" : "slot-button"}
                        onClick={() => setSelectedSlot(slot.start_utc)}
                      >
                        {formatTimeIn(slot.start_utc, timezone)}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="manage-actions">
                <button className="primary-button" onClick={handleReschedule} disabled={!selectedSlot || busy}>
                  {busy ? "Moving..." : "Confirm new time"}
                </button>
                <button className="ghost-button" onClick={() => setMode("view")} disabled={busy}>Back</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
