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
import Logo from "../components/Logo";
import Icon from "../components/Icon";
import ThemeToggle from "../components/ThemeToggle";
import { Skeleton } from "../components/Skeleton";
import { useToast } from "../components/Toast";

/**
 * The page an invitee lands on from the "reschedule or cancel" link in their
 * confirmation email. The URL token is the only credential — no account.
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
    (async () => {
      if (mode !== "reschedule" || !booking?.event_slug) return;
      setLoadingSlots(true);
      try {
        const days = [shiftDateKey(selectedDate, -1), selectedDate, shiftDateKey(selectedDate, 1)];
        const results = await Promise.all(days.map((day) => api.getSlots(booking.event_slug, day).catch(() => [])));
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
    })();
    return () => { cancelled = true; };
  }, [mode, booking?.event_slug, selectedDate, timezone, toast]);

  async function cancelBooking() {
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

  async function reschedule() {
    if (!selectedSlot) { toast.error("Pick a new time first."); return; }
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

  const status = useMemo(() => {
    if (!booking) return { label: "", tone: "" };
    if (booking.status === "cancelled") return { label: "Cancelled", tone: "badge-danger" };
    if (new Date(booking.start_time) < new Date()) return { label: "Completed", tone: "" };
    return { label: "Confirmed", tone: "badge-ok" };
  }, [booking]);

  const frame = (children) => (
    <div className="public">
      <header className="public-bar">
        <Logo size={28} tile />
        <ThemeToggle />
      </header>
      <main className="public-main public-narrow">{children}</main>
    </div>
  );

  if (loading) {
    return frame(
      <div className="card card-body stack-3">
        <Skeleton width="50%" height={20} />
        <Skeleton width="80%" />
        <Skeleton width="60%" />
      </div>
    );
  }

  if (notFound) {
    return frame(
      <div className="card result-card">
        <div className="result-icon is-cancelled"><Icon name="ban" size={22} /></div>
        <h1 style={{ margin: "var(--s2) 0" }}>This link isn't valid</h1>
        <p className="small muted" style={{ maxWidth: "44ch", margin: "0 auto" }}>
          It may already have been used, or the booking was removed. Reply to your
          confirmation email and the host can help.
        </p>
        <Link className="btn" to="/" style={{ marginTop: "var(--s6)" }}>Go to Shopper</Link>
      </div>
    );
  }

  const isCancelled = booking.status === "cancelled";

  return frame(
    <div className="card">
      <div className="card-body stack-4">
        <div>
          <span className={`badge ${status.tone}`}>{status.label}</span>
          <h1 style={{ margin: "var(--s3) 0 2px" }}>{booking.event_title}</h1>
          {booking.host_name ? <p className="small muted">with {booking.host_name}</p> : null}
        </div>

        <dl className="dl panel">
          <div>
            <dt>When</dt>
            <dd>
              {formatFullIn(booking.start_time, timezone)}
              <span className="tiny subtle" style={{ display: "block", fontWeight: 400 }}>
                {timezone.replace(/_/g, " ")} {timezoneOffsetLabel(timezone)}
              </span>
            </dd>
          </div>
          <div><dt>Duration</dt><dd>{booking.duration} minutes</dd></div>
          <div><dt>Guest</dt><dd>{booking.booker_name}<span className="tiny subtle" style={{ display: "block", fontWeight: 400 }}>{booking.booker_email}</span></dd></div>
          {booking.meeting_url ? (
            <div><dt>Join</dt><dd><a className="btn-link break" href={booking.meeting_url} target="_blank" rel="noreferrer">{booking.meeting_url}</a></dd></div>
          ) : null}
          {booking.notes ? <div><dt>Notes</dt><dd>{booking.notes}</dd></div> : null}
          {(booking.answers || []).map((answer) => (
            <div key={answer.question_id}><dt>{answer.label || answer.question_id}</dt><dd>{answer.value}</dd></div>
          ))}
        </dl>

        {isCancelled ? (
          <p className="banner">This meeting was cancelled. Book a new time from the host's page.</p>
        ) : !booking.can_cancel && !booking.can_reschedule ? (
          <p className="banner">This meeting has already taken place.</p>
        ) : mode === "view" ? (
          <div className="row-2" style={{ flexWrap: "wrap" }}>
            {booking.can_reschedule && (
              <button className="btn" onClick={() => setMode("reschedule")}>
                <Icon name="refresh" size={14} /> Reschedule
              </button>
            )}
            {booking.can_cancel && (
              <button className="btn btn-danger" onClick={cancelBooking} disabled={busy}>
                {busy ? <span className="spinner" /> : <Icon name="ban" size={14} />} Cancel meeting
              </button>
            )}
          </div>
        ) : (
          <div className="stack-4" style={{ borderTop: "1px solid var(--c-line)", paddingTop: "var(--s5)" }}>
            <div className="row-between" style={{ flexWrap: "wrap" }}>
              <h2>Pick a new time</h2>
              <div className="field tz-field">
                <label className="field-label tiny subtle" htmlFor="mz">Times shown in</label>
                <select id="mz" className="select" value={timezone} onChange={(event) => setTimezone(event.target.value)}>
                  {[...new Set([timezone, browserTimezone(), "UTC"])].map((zone) => (
                    <option key={zone} value={zone}>{zone.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field" style={{ maxWidth: 220 }}>
              <label className="field-label" htmlFor="date">Date</label>
              <input
                id="date" className="input" type="date"
                min={toDateInputValue(new Date())}
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value)}
              />
            </div>

            {loadingSlots ? (
              <div className="slot-grid">
                {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} height={36} radius="8px" />)}
              </div>
            ) : slots.length === 0 ? (
              <p className="empty small">No open times on this day.</p>
            ) : (
              <div className="slot-grid" role="radiogroup" aria-label="Available times">
                {slots.map((slot) => (
                  <button
                    key={slot.start_utc}
                    type="button"
                    role="radio"
                    aria-checked={selectedSlot === slot.start_utc}
                    className={`slot${selectedSlot === slot.start_utc ? " is-active" : ""}`}
                    onClick={() => setSelectedSlot(slot.start_utc)}
                  >
                    {formatTimeIn(slot.start_utc, timezone)}
                  </button>
                ))}
              </div>
            )}

            <div className="row-2">
              <button className="btn btn-primary" onClick={reschedule} disabled={!selectedSlot || busy}>
                {busy ? <><span className="spinner" /> Moving…</> : "Confirm new time"}
              </button>
              <button className="btn btn-ghost" onClick={() => setMode("view")} disabled={busy}>Back</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
