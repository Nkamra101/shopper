import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import { SkeletonList } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api } from "../services/api";
import { browserTimezone, formatFullIn, formatTimeIn, toDateInputValue } from "../utils/date";

const SCOPES = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function statusBadge(booking) {
  if (booking.status === "cancelled") return { label: "Cancelled", tone: "badge-danger" };
  if (new Date(booking.start_time) < new Date()) return { label: "Completed", tone: "" };
  return { label: "Confirmed", tone: "badge-ok" };
}

/** Groups bookings by their local calendar day for the timeline. */
function groupByDay(bookings, timezone) {
  const groups = new Map();
  bookings.forEach((booking) => {
    const key = new Date(booking.start_time).toLocaleDateString("en-US", {
      timeZone: timezone, weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(booking);
  });
  return [...groups.entries()];
}

export default function BookingsPage() {
  const toast = useToast();
  const timezone = browserTimezone();

  const [scope, setScope] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [bookings, setBookings] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [notesDraft, setNotesDraft] = useState({ id: null, text: "" });
  const [rescheduleFor, setRescheduleFor] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  async function load(activeScope = scope) {
    setLoading(true);
    setSelected(new Set());
    try {
      setBookings(await api.getBookings({ scope: activeScope }));
    } catch (error) {
      toast.error(error.message || "Could not load bookings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(scope); }, [scope]);
  useEffect(() => { api.getEventTypes().then(setEventTypes).catch(() => setEventTypes([])); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return bookings;
    return bookings.filter((booking) =>
      [booking.booker_name, booking.booker_email, booking.notes, booking.event_type?.title]
        .some((value) => (value || "").toLowerCase().includes(query))
    );
  }, [bookings, search]);

  const groups = useMemo(() => groupByDay(filtered, timezone), [filtered, timezone]);

  async function cancel(id) {
    if (!window.confirm("Cancel this booking? The guest will be emailed.")) return;
    try {
      await api.cancelBooking(id);
      toast.success("Booking cancelled.");
      load(scope);
    } catch (error) {
      toast.error(error.message || "Could not cancel it.");
    }
  }

  async function bulkCancel() {
    if (!selected.size) return;
    if (!window.confirm(`Cancel ${selected.size} booking(s)? Guests will be emailed.`)) return;
    setBusy(true);
    const results = await Promise.allSettled([...selected].map((id) => api.cancelBooking(id)));
    const failed = results.filter((result) => result.status === "rejected").length;
    if (failed) toast.error(`${failed} of ${results.length} could not be cancelled.`);
    else toast.success(`${results.length} booking(s) cancelled.`);
    setBusy(false);
    load(scope);
  }

  async function saveNotes(id) {
    try {
      const updated = await api.updateBookingNotes(id, notesDraft.text);
      setBookings((current) => current.map((booking) => (booking.id === id ? { ...booking, notes: updated.notes } : booking)));
      setNotesDraft({ id: null, text: "" });
      toast.success("Notes saved.");
    } catch (error) {
      toast.error(error.message || "Could not save the notes.");
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await api.exportBookingsCsv({ scope, search: search.trim() });
      toast.success("CSV downloaded.");
    } catch (error) {
      toast.error(error.message || "Could not export.");
    } finally {
      setExporting(false);
    }
  }

  function toggleSelected(id) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="stack">
      <SectionCard
        title="Add a booking"
        subtitle="Book someone in yourself — useful for calls agreed over email."
        actions={
          <button className="btn btn-sm" onClick={() => setShowAdd((value) => !value)}>
            <Icon name={showAdd ? "chevronDown" : "plus"} size={13} />
            {showAdd ? "Hide" : "New booking"}
          </button>
        }
      >
        {showAdd ? (
          <ManualBooking
            eventTypes={eventTypes.filter((item) => item.is_active !== false)}
            onCreated={() => { setShowAdd(false); load(scope); }}
          />
        ) : (
          <p className="small muted">
            Bookings added here skip email verification and are confirmed immediately.
          </p>
        )}
      </SectionCard>

      <SectionCard title="Bookings" subtitle="Everything scheduled with you.">
        <div className="toolbar" style={{ marginBottom: "var(--s5)" }}>
          <div className="seg" role="tablist">
            {SCOPES.map((item) => (
              <button
                key={item.value} type="button" role="tab"
                className="seg-item"
                aria-selected={scope === item.value}
                onClick={() => setScope(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="toolbar-right">
            <div className="search">
              <Icon name="search" size={14} />
              <input
                className="input" style={{ minWidth: 210 }}
                placeholder="Search name, email or notes"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear search">
                  <Icon name="close" size={11} />
                </button>
              )}
            </div>
            <button className="btn" onClick={exportCsv} disabled={exporting || filtered.length === 0}>
              {exporting ? <span className="spinner" /> : <Icon name="download" size={14} />}
              Export CSV
            </button>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar" style={{ marginBottom: "var(--s4)" }}>
            <strong>{selected.size} selected</strong>
            <div className="spacer" />
            <button className="btn btn-sm btn-danger" onClick={bulkCancel} disabled={busy}>
              {busy ? <span className="spinner" /> : null} Cancel selected
            </button>
            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {loading ? (
          <SkeletonList count={3} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="users"
            title={search ? "No matches" : "Nothing here yet"}
            description={search ? `Nothing matches “${search}”.` : "Bookings will appear here as guests schedule time with you."}
          />
        ) : (
          <div className="timeline">
            {groups.map(([day, items]) => (
              <div key={day}>
                <p className="timeline-group-label">{day}</p>
                <div className="stack-2" style={{ marginTop: "var(--s2)" }}>
                  {items.map((booking) => {
                    const status = statusBadge(booking);
                    const editing = notesDraft.id === booking.id;
                    const canAct = booking.status !== "cancelled" && new Date(booking.start_time) > new Date();

                    return (
                      <article key={booking.id} className="item" style={{ flexDirection: "column" }}>
                        <div className="row-top" style={{ width: "100%", gap: "var(--s3)" }}>
                          {canAct && (
                            <input
                              type="checkbox" style={{ marginTop: 4 }}
                              checked={selected.has(booking.id)}
                              onChange={() => toggleSelected(booking.id)}
                              aria-label={`Select booking with ${booking.booker_name}`}
                            />
                          )}

                          <div className="item-main">
                            <div className="row-2" style={{ flexWrap: "wrap" }}>
                              <span className="small num" style={{ fontWeight: 650 }}>
                                {formatTimeIn(booking.start_time, timezone)}
                              </span>
                              <span className="badge">{booking.event_type?.title}</span>
                              <span className={`badge ${status.tone}`}>{status.label}</span>
                            </div>

                            <p className="small" style={{ marginTop: 6, fontWeight: 600 }}>{booking.booker_name}</p>
                            <p className="tiny subtle">{booking.booker_email}</p>

                            {(booking.answers || []).length > 0 && (
                              <dl className="dl" style={{ marginTop: "var(--s3)" }}>
                                {booking.answers.map((answer) => (
                                  <div key={answer.question_id}>
                                    <dt>{answer.label || answer.question_id}</dt>
                                    <dd>{answer.value}</dd>
                                  </div>
                                ))}
                              </dl>
                            )}

                            <div style={{ marginTop: "var(--s3)" }}>
                              {editing ? (
                                <div className="stack-2">
                                  <textarea
                                    className="textarea" rows="2" value={notesDraft.text}
                                    onChange={(event) => setNotesDraft({ ...notesDraft, text: event.target.value })}
                                  />
                                  <div className="row-2">
                                    <button className="btn btn-sm btn-primary" onClick={() => saveNotes(booking.id)}>Save</button>
                                    <button className="btn btn-sm btn-ghost" onClick={() => setNotesDraft({ id: null, text: "" })}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  className="btn-link tiny"
                                  onClick={() => setNotesDraft({ id: booking.id, text: booking.notes || "" })}
                                >
                                  {booking.notes ? booking.notes : "Add a private note"}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="item-actions">
                            {booking.meeting_url && canAct && (
                              <a className="btn btn-sm" href={booking.meeting_url} target="_blank" rel="noreferrer">
                                <Icon name="video" size={12} /> Join
                              </a>
                            )}
                            {canAct && (
                              <>
                                <button className="btn btn-sm" onClick={() => setRescheduleFor(booking)}>
                                  <Icon name="refresh" size={12} /> Move
                                </button>
                                <button className="btn btn-sm btn-danger" onClick={() => cancel(booking.id)}>Cancel</button>
                              </>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {rescheduleFor && (
        <RescheduleModal
          booking={rescheduleFor}
          timezone={timezone}
          onClose={() => setRescheduleFor(null)}
          onDone={() => { setRescheduleFor(null); load(scope); }}
        />
      )}
    </div>
  );
}

function ManualBooking({ eventTypes, onCreated }) {
  const toast = useToast();
  const [form, setForm] = useState({
    eventTypeId: "", date: toDateInputValue(new Date()), startTime: "",
    name: "", email: "", notes: "", sendEmail: true,
  });
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);

  const eventType = eventTypes.find((item) => item.id === form.eventTypeId) || null;

  useEffect(() => {
    if (!form.eventTypeId && eventTypes.length) {
      setForm((current) => ({ ...current, eventTypeId: eventTypes[0].id }));
    }
  }, [eventTypes, form.eventTypeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!eventType?.url_slug || !form.date) { setSlots([]); return; }
      setLoadingSlots(true);
      try {
        const data = await api.getSlots(eventType.url_slug, form.date);
        if (!cancelled) setSlots(data);
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventType?.url_slug, form.date]);

  async function submit(event) {
    event.preventDefault();
    if (!form.eventTypeId || !form.startTime) { toast.error("Pick an event type and a time."); return; }
    if (!form.name.trim()) { toast.error("Add the guest's name."); return; }
    if (!EMAIL_PATTERN.test(form.email.trim())) { toast.error("Add a valid guest email."); return; }

    setSaving(true);
    try {
      await api.createAdminBooking({
        event_type_id: form.eventTypeId,
        start_time: form.startTime,
        booker_name: form.name.trim(),
        booker_email: form.email.trim(),
        notes: form.notes.trim(),
        send_email: form.sendEmail,
      });
      toast.success("Booking added.");
      onCreated();
    } catch (error) {
      toast.error(error.message || "Could not add the booking.");
    } finally {
      setSaving(false);
    }
  }

  if (eventTypes.length === 0) {
    return <p className="empty small">Create an active event type first.</p>;
  }

  return (
    <form className="stack-4" onSubmit={submit}>
      <div className="grid-2">
        <div className="field">
          <label className="field-label" htmlFor="mb-type">Event type</label>
          <select id="mb-type" className="select" value={form.eventTypeId}
                  onChange={(event) => setForm({ ...form, eventTypeId: event.target.value, startTime: "" })}>
            {eventTypes.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.duration}m</option>)}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="mb-date">Date</label>
          <input id="mb-date" className="input" type="date" value={form.date}
                 onChange={(event) => setForm({ ...form, date: event.target.value, startTime: "" })} />
        </div>
      </div>

      <div className="field">
        <span className="field-label">Time</span>
        {loadingSlots ? (
          <p className="hint">Loading open times…</p>
        ) : slots.length === 0 ? (
          <p className="hint">No open times that day — check your availability or pick another date.</p>
        ) : (
          <div className="slot-grid">
            {slots.map((slot) => (
              <button key={slot.start_utc} type="button"
                      className={`slot${form.startTime === slot.start_utc ? " is-active" : ""}`}
                      onClick={() => setForm({ ...form, startTime: slot.start_utc })}>
                {slot.display_time}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid-2">
        <div className="field">
          <label className="field-label" htmlFor="mb-name">Guest name</label>
          <input id="mb-name" className="input" value={form.name} placeholder="Jane Smith"
                 onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="mb-email">Guest email</label>
          <input id="mb-email" className="input" type="email" value={form.email} placeholder="jane@example.com"
                 onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="mb-notes">Notes <span className="opt">optional</span></label>
        <textarea id="mb-notes" className="textarea" rows="2" value={form.notes}
                  onChange={(event) => setForm({ ...form, notes: event.target.value })} />
      </div>

      <label className="check">
        <input type="checkbox" checked={form.sendEmail}
               onChange={(event) => setForm({ ...form, sendEmail: event.target.checked })} />
        Email the guest a confirmation
      </label>

      <div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? <><span className="spinner" /> Adding…</> : "Add booking"}
        </button>
      </div>
    </form>
  );
}

function RescheduleModal({ booking, timezone, onClose, onDone }) {
  const toast = useToast();
  const [date, setDate] = useState(toDateInputValue(new Date(booking.start_time)));
  const [slots, setSlots] = useState([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const slug = booking.event_type?.url_slug;
      if (!slug) return;
      setLoading(true);
      try {
        const data = await api.getSlots(slug, date);
        if (!cancelled) { setSlots(data); setSelected(""); }
      } catch {
        if (!cancelled) setSlots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [booking.event_type?.url_slug, date]);

  async function submit() {
    if (!selected) return;
    setSaving(true);
    try {
      await api.rescheduleBooking(booking.id, { start_time: selected });
      toast.success("Booking moved. The guest has been emailed.");
      onDone();
    } catch (error) {
      toast.error(error.message || "Could not reschedule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-head">
          <div>
            <h3 className="card-title">Move this booking</h3>
            <p className="card-sub">
              {booking.booker_name} · currently {formatFullIn(booking.start_time, timezone)}
            </p>
          </div>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Close"><Icon name="close" size={16} /></button>
        </header>

        <div className="modal-body stack-4">
          <div className="field" style={{ maxWidth: 220 }}>
            <label className="field-label" htmlFor="rs-date">New date</label>
            <input id="rs-date" className="input" type="date" value={date}
                   min={toDateInputValue(new Date())}
                   onChange={(event) => setDate(event.target.value)} />
          </div>

          {loading ? (
            <p className="hint">Loading open times…</p>
          ) : slots.length === 0 ? (
            <p className="empty small">No open times on this day.</p>
          ) : (
            <div className="slot-grid">
              {slots.map((slot) => (
                <button key={slot.start_utc} type="button"
                        className={`slot${selected === slot.start_utc ? " is-active" : ""}`}
                        onClick={() => setSelected(slot.start_utc)}>
                  {slot.display_time}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={!selected || saving}>
            {saving ? <><span className="spinner" /> Moving…</> : "Confirm new time"}
          </button>
        </footer>
      </div>
    </div>
  );
}
