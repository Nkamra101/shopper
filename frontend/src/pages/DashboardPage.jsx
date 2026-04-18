import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import { SkeletonList, SkeletonStats } from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const emptyForm = {
  title: "",
  description: "",
  duration: 30,
  url_slug: "",
  accent_color: "#6366f1",
  is_active: true,
  buffer_minutes: 0,
  min_notice_hours: 0,
  max_advance_days: 60,
  location: "",
  location_type: "video",
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREDEFINED_COLORS = [
  "#6366f1","#8b5cf6","#ec4899","#ef4444",
  "#f97316","#f59e0b","#10b981","#3b82f6","#0f172a","#64748b",
];
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];
const LOCATION_TYPES = [
  { value: "video", label: "Video call", icon: "📹" },
  { value: "phone", label: "Phone call", icon: "📞" },
  { value: "in_person", label: "In person", icon: "📍" },
  { value: "custom", label: "Custom", icon: "✏️" },
];

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.url_slug.trim()) {
    errors.url_slug = "Slug is required.";
  } else if (!SLUG_PATTERN.test(form.url_slug)) {
    errors.url_slug = "Use lowercase letters, numbers, and hyphens only.";
  }
  if (!form.duration || form.duration < 5) errors.duration = "Minimum 5 minutes.";
  return errors;
}

function ShareModal({ item, onClose }) {
  const toast = useToast();
  const bookingUrl = `${window.location.origin}/book/${item.url_slug}`;
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(bookingUrl);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ maxWidth: 440 }}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Share</p>
            <h3>{item.title}</h3>
            <p className="modal-subtitle">Share your booking link with anyone</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* URL copy */}
          <div>
            <p className="modal-label">Booking link</p>
            <div className="share-url-box">
              <span className="share-url-text">{bookingUrl}</span>
              <button className="primary-button" style={{ minHeight: 36, padding: "0 16px", fontSize: 13 }} onClick={copyUrl}>
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>

          {/* Social share buttons */}
          <div>
            <p className="modal-label">Share via</p>
            <div className="share-social-row">
              {[
                {
                  label: "Twitter / X",
                  color: "#000",
                  href: `https://twitter.com/intent/tweet?text=Book%20a%20meeting%20with%20me%3A%20${encodeURIComponent(bookingUrl)}`,
                  icon: "𝕏",
                },
                {
                  label: "LinkedIn",
                  color: "#0a66c2",
                  href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(bookingUrl)}`,
                  icon: "in",
                },
                {
                  label: "WhatsApp",
                  color: "#25d366",
                  href: `https://wa.me/?text=${encodeURIComponent("Book a meeting with me: " + bookingUrl)}`,
                  icon: "💬",
                },
                {
                  label: "Email",
                  color: "var(--accent)",
                  href: `mailto:?subject=Book%20a%20meeting&body=${encodeURIComponent("Book a time with me: " + bookingUrl)}`,
                  icon: "✉️",
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="share-social-btn"
                  style={{ "--share-color": s.color }}
                >
                  <span className="share-social-icon">{s.icon}</span>
                  <span>{s.label}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Embed snippet */}
          <div>
            <p className="modal-label">Embed on your website</p>
            <div className="code-block" style={{ maxHeight: 100 }}>
              <pre style={{ margin: 0, fontSize: 12, padding: "12px 16px", overflowX: "auto" }}>{`<iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" style="border-radius:16px"></iframe>`}</pre>
              <button className="code-copy-btn" onClick={() => { navigator.clipboard.writeText(`<iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" style="border-radius:16px"></iframe>`); toast.success("Embed code copied!"); }}>Copy</button>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <button className="secondary-button" onClick={onClose}>Close</button>
        </footer>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState({});
  const [copiedSlug, setCopiedSlug] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  async function loadDashboard() {
    setLoading(true);
    try {
      const [summaryData, eventTypeData] = await Promise.all([api.getSummary(), api.getEventTypes()]);
      setSummary(summaryData);
      setEventTypes(eventTypeData);
    } catch (error) {
      toast.error(error.message || "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setTouched({ title: true, url_slug: true, duration: true });
    if (!isValid) return;
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateEventType(editingId, form);
        toast.success("Event type updated.");
      } else {
        await api.createEventType(form);
        toast.success("Event type created!");
      }
      setForm(emptyForm);
      setEditingId(null);
      setTouched({});
      setShowAdvanced(false);
      loadDashboard();
    } catch (error) {
      toast.error(error.message || "Could not save event type.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      description: item.description,
      duration: item.duration,
      url_slug: item.url_slug,
      accent_color: item.accent_color,
      is_active: item.is_active,
      buffer_minutes: item.buffer_minutes ?? 0,
      min_notice_hours: item.min_notice_hours ?? 0,
      max_advance_days: item.max_advance_days ?? 60,
      location: item.location ?? "",
      location_type: item.location_type ?? "video",
    });
    setTouched({});
    setShowAdvanced(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this event type? All its bookings will be permanently removed.")) return;
    try {
      await api.deleteEventType(id);
      toast.success("Event type deleted.");
      if (editingId === id) { setEditingId(null); setForm(emptyForm); }
      loadDashboard();
    } catch (error) {
      toast.error(error.message || "Could not delete event type.");
    }
  }

  async function handleToggle(item) {
    try {
      await api.toggleEventType(item.id);
      toast.success(item.is_active ? "Event type paused." : "Event type activated.");
      loadDashboard();
    } catch (error) {
      toast.error(error.message || "Could not toggle event type.");
    }
  }

  async function handleDuplicate(item) {
    try {
      await api.duplicateEventType(item.id);
      toast.success("Event type duplicated (inactive — review before publishing).");
      loadDashboard();
    } catch (error) {
      toast.error(error.message || "Could not duplicate event type.");
    }
  }

  function copyLink(slug) {
    navigator.clipboard.writeText(`${window.location.origin}/book/${slug}`);
    setCopiedSlug(slug);
    toast.success("Booking link copied!");
    setTimeout(() => setCopiedSlug(null), 2000);
  }

  function showError(field) { return touched[field] && errors[field]; }

  const stats = [
    { label: "Event Types", value: summary?.event_types_count ?? "—", icon: "📋", color: "var(--accent)" },
    { label: "Upcoming", value: summary?.upcoming_bookings_count ?? "—", icon: "📅", color: "var(--success)" },
    { label: "This Week", value: summary?.this_week_count ?? "—", icon: "📆", color: "#06b6d4" },
    { label: "All Time", value: summary?.total_bookings_count ?? "—", icon: "📊", color: "#f59e0b" },
  ];

  return (
    <div className="page-grid">
      <div className="stack">
        {/* Stats */}
        {loading && !summary ? <SkeletonStats /> : (
          <div className="stats-grid four-col">
            {stats.map((s) => (
              <div key={s.label} className="stat-card">
                <div className="stat-emoji">{s.icon}</div>
                <strong style={{ color: s.color }}>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Event type list */}
        <SectionCard
          title="Your event types"
          subtitle="Shareable booking links for your guests."
          action={
            <span className="section-count-badge">{eventTypes.length} types</span>
          }
        >
          {loading ? <SkeletonList count={3} /> : eventTypes.length === 0 ? (
            <EmptyState
              title="No event types yet"
              description="Create your first event type to get a shareable booking link."
            />
          ) : (
            <div className="card-list">
              {eventTypes.map((item) => (
                <article
                  key={item.id}
                  className={`event-card ${!item.is_active ? "event-card-inactive" : ""}`}
                  style={{ "--event-accent": item.accent_color }}
                >
                  <div className="event-card-top">
                    <div className="event-color-swatch" style={{ background: item.accent_color }} />
                    <div style={{ flex: 1 }}>
                      <div className="event-title-row">
                        <h4>{item.title}</h4>
                        {!item.is_active && <span className="event-inactive-badge">Paused</span>}
                      </div>
                      <p>{item.description || <em style={{ opacity: 0.45 }}>No description</em>}</p>
                    </div>
                  </div>

                  <div className="event-meta">
                    <span className="event-meta-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      {item.duration} min
                    </span>
                    {item.buffer_minutes > 0 && (
                      <span className="event-meta-chip">+{item.buffer_minutes}m buffer</span>
                    )}
                    {item.location_type && (
                      <span className="event-meta-chip">
                        {LOCATION_TYPES.find(l => l.value === item.location_type)?.icon} {LOCATION_TYPES.find(l => l.value === item.location_type)?.label}
                      </span>
                    )}
                    <span className="event-meta-chip slug-chip">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                      /book/{item.url_slug}
                    </span>
                  </div>

                  <div className="event-card-actions">
                    <button
                      type="button"
                      className="icon-button copy-button"
                      onClick={() => copyLink(item.url_slug)}
                    >
                      {copiedSlug === item.url_slug
                        ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Copied!</>
                        : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy link</>
                      }
                    </button>
                    <button type="button" className="icon-button" onClick={() => setShareTarget(item)}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                      Share
                    </button>
                    <a className="icon-button" href={`/book/${item.url_slug}`} target="_blank" rel="noreferrer">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Preview
                    </a>
                    <div className="event-card-actions-right">
                      <button type="button" className="icon-button" title="Duplicate" onClick={() => handleDuplicate(item)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Duplicate
                      </button>
                      <button type="button" className="icon-button" title={item.is_active ? "Pause" : "Activate"} onClick={() => handleToggle(item)}>
                        {item.is_active
                          ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
                          : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Activate</>
                        }
                      </button>
                      <button type="button" className="icon-button edit-button" onClick={() => handleEdit(item)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                      </button>
                      <button type="button" className="icon-button danger-button" onClick={() => handleDelete(item.id)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Create / Edit form */}
      <SectionCard
        title={editingId ? "Edit event type" : "New event type"}
        subtitle="Configure how guests book time with you."
      >
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              placeholder="30-min intro call"
              aria-invalid={showError("title") ? "true" : "false"}
              required
            />
            {showError("title") && <p className="field-error">{errors.title}</p>}
          </label>

          <label>
            URL slug
            <input
              value={form.url_slug}
              onChange={(e) => setForm({ ...form, url_slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })}
              onBlur={() => setTouched((t) => ({ ...t, url_slug: true }))}
              placeholder="intro-call"
              aria-invalid={showError("url_slug") ? "true" : "false"}
              required
            />
            {showError("url_slug") && <p className="field-error">{errors.url_slug}</p>}
            {form.url_slug && !showError("url_slug") && (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>/book/{form.url_slug}</p>
            )}
          </label>

          <label className="full-width">
            Description
            <textarea
              rows="3"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="A short description shown to guests on the booking page."
            />
          </label>

          <label>
            Duration
            <div className="duration-presets">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={form.duration === d ? "duration-chip active" : "duration-chip"}
                  onClick={() => setForm({ ...form, duration: d })}
                >{d}m</button>
              ))}
            </div>
            <input
              type="number" min="5" max="480" step="5"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              onBlur={() => setTouched((t) => ({ ...t, duration: true }))}
              aria-invalid={showError("duration") ? "true" : "false"}
              required
              style={{ marginTop: 8 }}
            />
            {showError("duration") && <p className="field-error">{errors.duration}</p>}
          </label>

          <label>
            Accent color
            <div className="color-picker-grid">
              {PREDEFINED_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-swatch ${form.accent_color === color ? "selected" : ""}`}
                  style={{ background: color }}
                  onClick={() => setForm({ ...form, accent_color: color })}
                  title={color}
                />
              ))}
            </div>
          </label>

          {/* Location */}
          <label className="full-width">
            Location type
            <div className="location-type-grid">
              {LOCATION_TYPES.map((lt) => (
                <button
                  key={lt.value}
                  type="button"
                  className={`location-type-chip ${form.location_type === lt.value ? "active" : ""}`}
                  onClick={() => setForm({ ...form, location_type: lt.value })}
                >
                  {lt.icon} {lt.label}
                </button>
              ))}
            </div>
            {(form.location_type === "in_person" || form.location_type === "custom") && (
              <input
                style={{ marginTop: 8 }}
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder={form.location_type === "in_person" ? "123 Main St, City" : "e.g. Ask in notes"}
              />
            )}
          </label>

          {/* Active toggle */}
          <label className="full-width toggle-row">
            <span>
              <strong>Active</strong>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>
                Inactive event types are hidden from guests
              </p>
            </span>
            <button
              type="button"
              className={`toggle-switch ${form.is_active ? "on" : ""}`}
              onClick={() => setForm({ ...form, is_active: !form.is_active })}
              aria-label="Toggle active"
              role="switch"
              aria-checked={form.is_active}
            >
              <span className="toggle-knob" />
            </button>
          </label>

          {/* Advanced settings collapsible */}
          <div className="full-width">
            <button
              type="button"
              className="advanced-toggle-btn"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showAdvanced ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}
              >
                <polyline points="6 9 12 15 18 9"/>
              </svg>
              {showAdvanced ? "Hide" : "Show"} advanced settings
            </button>

            {showAdvanced && (
              <div className="advanced-settings form-grid" style={{ marginTop: "var(--space-4)" }}>
                <label>
                  Buffer between meetings
                  <div className="input-with-unit">
                    <input
                      type="number" min="0" max="120" step="5"
                      value={form.buffer_minutes}
                      onChange={(e) => setForm({ ...form, buffer_minutes: Number(e.target.value) })}
                    />
                    <span className="input-unit">min</span>
                  </div>
                  <p className="field-hint">Adds a gap after each booking so you have breathing room.</p>
                </label>

                <label>
                  Minimum notice period
                  <div className="input-with-unit">
                    <input
                      type="number" min="0" max="168" step="1"
                      value={form.min_notice_hours}
                      onChange={(e) => setForm({ ...form, min_notice_hours: Number(e.target.value) })}
                    />
                    <span className="input-unit">hrs</span>
                  </div>
                  <p className="field-hint">How far in advance guests must book (e.g. 24 hrs).</p>
                </label>

                <label className="full-width">
                  Maximum advance booking window
                  <div className="input-with-unit">
                    <input
                      type="number" min="1" max="365" step="1"
                      value={form.max_advance_days}
                      onChange={(e) => setForm({ ...form, max_advance_days: Number(e.target.value) })}
                    />
                    <span className="input-unit">days</span>
                  </div>
                  <p className="field-hint">Guests can only book within this many days from today.</p>
                </label>
              </div>
            )}
          </div>

          <div className="button-row full-width">
            <button type="submit" className="primary-button" disabled={!isValid || submitting}>
              {submitting
                ? <><span className="btn-spinner" /> Saving…</>
                : editingId ? "Save changes" : "Create event type"
              }
            </button>
            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setEditingId(null); setForm(emptyForm); setTouched({}); setShowAdvanced(false); }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      {shareTarget && (
        <ShareModal item={shareTarget} onClose={() => setShareTarget(null)} />
      )}
    </div>
  );
}
