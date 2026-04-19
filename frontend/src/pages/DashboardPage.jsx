import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import SectionCard from "../components/SectionCard";
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
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#0f172a", "#64748b",
];
const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

function sanitizeSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function Icon({ name, size = 16, strokeWidth = 2.2 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  switch (name) {
    case "calendar":
      return (
        <svg {...common}>
          <path d="M8 2v4M16 2v4M3 10h18" />
          <rect x="3" y="4" width="18" height="18" rx="2" />
        </svg>
      );
    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M4 19h16" />
          <path d="M7 16v-5" />
          <path d="M12 16V8" />
          <path d="M17 16v-9" />
        </svg>
      );
    case "link":
      return (
        <svg {...common}>
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      );
    case "video":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3z" />
        </svg>
      );
    case "phone":
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.34 2.74a2 2 0 0 1-.57 1.7l-1.2 1.2a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 1.7-.57l2.74.34A2 2 0 0 1 22 16.92z" />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path d="M12 21s6-5.33 6-11a6 6 0 1 0-12 0c0 5.67 6 11 6 11z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51 15.42 17.49" />
          <path d="M15.41 6.51 8.59 10.49" />
        </svg>
      );
    case "external":
      return (
        <svg {...common}>
          <path d="M14 3h7v7" />
          <path d="M10 14 21 3" />
          <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
        </svg>
      );
    case "duplicate":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "pause":
      return (
        <svg {...common}>
          <rect x="7" y="5" width="3" height="14" />
          <rect x="14" y="5" width="3" height="14" />
        </svg>
      );
    case "play":
      return (
        <svg {...common}>
          <path d="m8 5 11 7-11 7z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
          <path d="m19 6-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      );
    case "code":
      return (
        <svg {...common}>
          <path d="m8 9-4 3 4 3" />
          <path d="m16 9 4 3-4 3" />
          <path d="m14 5-4 14" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8z" />
          <path d="M5 19h.01M19 19h.01" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 5 6v6c0 5 3.5 8 7 9 3.5-1 7-4 7-9V6z" />
          <path d="m9.5 12 1.8 1.8 3.7-3.8" />
        </svg>
      );
    default:
      return null;
  }
}

const LOCATION_TYPES = [
  { value: "video", label: "Video call", icon: "video" },
  { value: "phone", label: "Phone call", icon: "phone" },
  { value: "in_person", label: "In person", icon: "pin" },
  { value: "custom", label: "Custom instructions", icon: "edit" },
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
  const embedCode = `<iframe src="${bookingUrl}" width="100%" height="700" frameborder="0" style="border-radius:16px"></iframe>`;
  const [copied, setCopied] = useState("");

  function copyValue(value, key, message) {
    navigator.clipboard.writeText(value);
    setCopied(key);
    toast.success(message);
    window.setTimeout(() => setCopied(""), 1800);
  }

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const shareActions = [
    {
      key: "copy",
      label: copied === "copy" ? "Link copied" : "Copy link",
      icon: "copy",
      onClick: () => copyValue(bookingUrl, "copy", "Booking link copied."),
    },
    {
      key: "email",
      label: "Email",
      icon: "mail",
      href: `mailto:?subject=Schedule time&body=${encodeURIComponent(`Choose a time here: ${bookingUrl}`)}`,
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      icon: "share",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(bookingUrl)}`,
    },
    {
      key: "preview",
      label: "Open page",
      icon: "external",
      href: bookingUrl,
    },
  ];

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal-panel" style={{ maxWidth: 440 }}>
        <header className="modal-header">
          <div>
            <p className="eyebrow">Share</p>
            <h3>{item.title}</h3>
            <p className="modal-subtitle">Send your booking page anywhere you collect requests.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={16} />
          </button>
        </header>

        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div>
            <p className="modal-label">Booking link</p>
            <div className="share-url-box">
              <span className="share-url-text">{bookingUrl}</span>
              <button className="primary-button" style={{ minHeight: 36, padding: "0 16px", fontSize: 13 }} onClick={() => copyValue(bookingUrl, "copy", "Booking link copied.")}>
                {copied === "copy" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div>
            <p className="modal-label">Quick actions</p>
            <div className="share-social-row">
              {shareActions.map((action) => (
                action.href ? (
                  <a key={action.key} href={action.href} target="_blank" rel="noreferrer" className="share-social-btn">
                    <span className="share-social-icon"><Icon name={action.icon} size={15} /></span>
                    <span>{action.label}</span>
                  </a>
                ) : (
                  <button key={action.key} type="button" className="share-social-btn" onClick={action.onClick}>
                    <span className="share-social-icon"><Icon name={action.icon} size={15} /></span>
                    <span>{action.label}</span>
                  </button>
                )
              ))}
            </div>
          </div>

          <div>
            <p className="modal-label">Embed on your website</p>
            <div className="code-block" style={{ maxHeight: 100 }}>
              <pre style={{ margin: 0, fontSize: 12, padding: "12px 16px", overflowX: "auto" }}>{embedCode}</pre>
              <button className="code-copy-btn" onClick={() => copyValue(embedCode, "embed", "Embed code copied.")}>
                {copied === "embed" ? "Copied" : "Copy"}
              </button>
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
  const [slugTouched, setSlugTouched] = useState(false);

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

  useEffect(() => {
    loadDashboard();
  }, []);

  function resetEditor() {
    setForm(emptyForm);
    setEditingId(null);
    setTouched({});
    setShowAdvanced(false);
    setSlugTouched(false);
  }

  function handleTitleChange(value) {
    setForm((current) => ({
      ...current,
      title: value,
      url_slug: slugTouched ? current.url_slug : sanitizeSlug(value),
    }));
  }

  function handleSlugChange(value) {
    setSlugTouched(true);
    setForm((current) => ({ ...current, url_slug: sanitizeSlug(value) }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setTouched({ title: true, url_slug: true, duration: true });
    if (!isValid) return;

    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateEventType(editingId, form);
        toast.success("Event type updated.");
      } else {
        await api.createEventType(form);
        toast.success("Event type created.");
      }
      resetEditor();
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
    setSlugTouched(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this event type? Related bookings will also be removed.")) return;
    try {
      await api.deleteEventType(id);
      toast.success("Event type deleted.");
      if (editingId === id) resetEditor();
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
      toast.error(error.message || "Could not change status.");
    }
  }

  async function handleDuplicate(item) {
    try {
      await api.duplicateEventType(item.id);
      toast.success("Event type duplicated. Review it before publishing.");
      loadDashboard();
    } catch (error) {
      toast.error(error.message || "Could not duplicate event type.");
    }
  }

  function copyLink(slug) {
    navigator.clipboard.writeText(`${window.location.origin}/book/${slug}`);
    setCopiedSlug(slug);
    toast.success("Booking link copied.");
    window.setTimeout(() => setCopiedSlug(null), 1800);
  }

  function showError(field) {
    return touched[field] && errors[field];
  }

  const stats = [
    { label: "Event types", value: summary?.event_types_count ?? "-", icon: "calendar", color: "var(--accent)" },
    { label: "Upcoming", value: summary?.upcoming_bookings_count ?? "-", icon: "clock", color: "var(--success)" },
    { label: "This week", value: summary?.this_week_count ?? "-", icon: "spark", color: "#0ea5e9" },
    { label: "All bookings", value: summary?.total_bookings_count ?? "-", icon: "chart", color: "#f59e0b" },
  ];

  return (
    <div className="page-grid">
      <div className="stack">
        {loading && !summary ? (
          <SkeletonStats />
        ) : (
          <div className="stats-grid four-col">
            {stats.map((item) => (
              <div key={item.label} className="stat-card">
                <div className="stat-emoji"><Icon name={item.icon} size={18} /></div>
                <strong style={{ color: item.color }}>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        <SectionCard
          title="Your event types"
          subtitle="Manage the booking pages guests can access."
          action={<span className="section-count-badge">{eventTypes.length} total</span>}
        >
          {loading ? (
            <SkeletonList count={3} />
          ) : eventTypes.length === 0 ? (
            <EmptyState
              title="No event types yet"
              description="Create your first event type to publish a booking page and start collecting reservations."
              action={
                <button type="button" className="primary-button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
                  Create event type
                </button>
              }
            />
          ) : (
            <div className="card-list">
              {eventTypes.map((item) => {
                const locationType = LOCATION_TYPES.find((entry) => entry.value === item.location_type) ?? LOCATION_TYPES[0];

                return (
                  <article key={item.id} className={`event-card ${!item.is_active ? "event-card-inactive" : ""}`} style={{ "--event-accent": item.accent_color }}>
                    <div className="event-card-top">
                      <div className="event-color-swatch" style={{ background: item.accent_color }} />
                      <div style={{ flex: 1 }}>
                        <div className="event-title-row">
                          <h4>{item.title}</h4>
                          {!item.is_active ? <span className="event-inactive-badge">Paused</span> : null}
                        </div>
                        <p>{item.description || <em style={{ opacity: 0.5 }}>No description added yet.</em>}</p>
                      </div>
                    </div>

                    <div className="event-meta">
                      <span className="event-meta-chip">
                        <Icon name="clock" size={12} strokeWidth={2.4} />
                        {item.duration} min
                      </span>
                      {item.buffer_minutes > 0 ? (
                        <span className="event-meta-chip">
                          <Icon name="spark" size={12} strokeWidth={2.4} />
                          {item.buffer_minutes} min buffer
                        </span>
                      ) : null}
                      <span className="event-meta-chip">
                        <Icon name={locationType.icon} size={12} strokeWidth={2.4} />
                        {locationType.label}
                      </span>
                      <span className="event-meta-chip slug-chip">
                        <Icon name="link" size={12} strokeWidth={2.4} />
                        /book/{item.url_slug}
                      </span>
                    </div>

                    <div className="event-card-actions">
                      <button type="button" className="icon-button copy-button" onClick={() => copyLink(item.url_slug)}>
                        {copiedSlug === item.url_slug ? (
                          <>
                            <Icon name="check" size={13} />
                            Copied
                          </>
                        ) : (
                          <>
                            <Icon name="copy" size={13} />
                            Copy link
                          </>
                        )}
                      </button>

                      <button type="button" className="icon-button" onClick={() => setShareTarget(item)}>
                        <Icon name="share" size={13} />
                        Share
                      </button>

                      <a className="icon-button" href={`/book/${item.url_slug}`} target="_blank" rel="noreferrer">
                        <Icon name="external" size={13} />
                        Preview
                      </a>

                      <div className="event-card-actions-right">
                        <button type="button" className="icon-button" onClick={() => handleDuplicate(item)}>
                          <Icon name="duplicate" size={13} />
                          Duplicate
                        </button>
                        <button type="button" className="icon-button" onClick={() => handleToggle(item)}>
                          <Icon name={item.is_active ? "pause" : "play"} size={13} />
                          {item.is_active ? "Pause" : "Activate"}
                        </button>
                        <button type="button" className="icon-button edit-button" onClick={() => handleEdit(item)}>
                          <Icon name="edit" size={13} />
                          Edit
                        </button>
                        <button type="button" className="icon-button danger-button" onClick={() => handleDelete(item.id)}>
                          <Icon name="trash" size={13} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={editingId ? "Edit event type" : "New event type"}
        subtitle="Set up a clean booking experience for guests."
      >
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => handleTitleChange(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, title: true }))}
              placeholder="Enter event title"
              aria-invalid={showError("title") ? "true" : "false"}
              required
            />
            <p className="field-hint">Use a clear internal name that guests will immediately understand.</p>
            {showError("title") ? <p className="field-error">{errors.title}</p> : null}
          </label>

          <label>
            URL slug
            <input
              value={form.url_slug}
              onChange={(event) => handleSlugChange(event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, url_slug: true }))}
              placeholder="booking-page"
              aria-invalid={showError("url_slug") ? "true" : "false"}
              required
            />
            <p className="field-hint">This is created from the title automatically until you edit it yourself.</p>
            {showError("url_slug") ? <p className="field-error">{errors.url_slug}</p> : null}
            {form.url_slug && !showError("url_slug") ? (
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>/book/{form.url_slug}</p>
            ) : null}
          </label>

          <label className="full-width">
            Description
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Add a short summary that explains what guests can expect."
            />
          </label>

          <label>
            Duration
            <div className="duration-presets">
              {DURATION_PRESETS.map((duration) => (
                <button
                  key={duration}
                  type="button"
                  className={form.duration === duration ? "duration-chip active" : "duration-chip"}
                  onClick={() => setForm((current) => ({ ...current, duration }))}
                >
                  {duration}m
                </button>
              ))}
            </div>
            <input
              type="number"
              min="5"
              max="480"
              step="5"
              value={form.duration}
              onChange={(event) => setForm((current) => ({ ...current, duration: Number(event.target.value) }))}
              onBlur={() => setTouched((current) => ({ ...current, duration: true }))}
              aria-invalid={showError("duration") ? "true" : "false"}
              required
              style={{ marginTop: 8 }}
            />
            {showError("duration") ? <p className="field-error">{errors.duration}</p> : null}
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
                  onClick={() => setForm((current) => ({ ...current, accent_color: color }))}
                  title={color}
                />
              ))}
            </div>
          </label>

          <label className="full-width">
            Location type
            <div className="location-type-grid">
              {LOCATION_TYPES.map((locationType) => (
                <button
                  key={locationType.value}
                  type="button"
                  className={`location-type-chip ${form.location_type === locationType.value ? "active" : ""}`}
                  onClick={() => setForm((current) => ({ ...current, location_type: locationType.value }))}
                >
                  <Icon name={locationType.icon} size={14} />
                  {locationType.label}
                </button>
              ))}
            </div>

            {(form.location_type === "in_person" || form.location_type === "custom") ? (
              <input
                style={{ marginTop: 8 }}
                value={form.location}
                onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                placeholder={form.location_type === "in_person" ? "Enter address or venue details" : "Add instructions guests should follow"}
              />
            ) : null}
          </label>

          <label className="full-width toggle-row">
            <span>
              <strong>Active</strong>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>
                Paused event types stay hidden until you are ready to share them.
              </p>
            </span>
            <button
              type="button"
              className={`toggle-switch ${form.is_active ? "on" : ""}`}
              onClick={() => setForm((current) => ({ ...current, is_active: !current.is_active }))}
              aria-label="Toggle active"
              role="switch"
              aria-checked={form.is_active}
            >
              <span className="toggle-knob" />
            </button>
          </label>

          <div className="full-width">
            <button type="button" className="advanced-toggle-btn" onClick={() => setShowAdvanced((current) => !current)}>
              <Icon name="spark" size={14} />
              {showAdvanced ? "Hide advanced settings" : "Show advanced settings"}
            </button>

            {showAdvanced ? (
              <div className="advanced-settings form-grid" style={{ marginTop: "var(--space-4)" }}>
                <label>
                  Buffer between meetings
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="5"
                      value={form.buffer_minutes}
                      onChange={(event) => setForm((current) => ({ ...current, buffer_minutes: Number(event.target.value) }))}
                    />
                    <span className="input-unit">min</span>
                  </div>
                  <p className="field-hint">Add breathing room after each confirmed booking.</p>
                </label>

                <label>
                  Minimum notice period
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="0"
                      max="168"
                      step="1"
                      value={form.min_notice_hours}
                      onChange={(event) => setForm((current) => ({ ...current, min_notice_hours: Number(event.target.value) }))}
                    />
                    <span className="input-unit">hrs</span>
                  </div>
                  <p className="field-hint">Control how much lead time guests need before booking.</p>
                </label>

                <label className="full-width">
                  Maximum advance booking window
                  <div className="input-with-unit">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      step="1"
                      value={form.max_advance_days}
                      onChange={(event) => setForm((current) => ({ ...current, max_advance_days: Number(event.target.value) }))}
                    />
                    <span className="input-unit">days</span>
                  </div>
                  <p className="field-hint">Keep your schedule open only as far ahead as you want to plan.</p>
                </label>
              </div>
            ) : null}
          </div>

          <div className="button-row full-width">
            <button type="submit" className="primary-button" disabled={!isValid || submitting}>
              {submitting ? (
                <>
                  <span className="btn-spinner" />
                  Saving...
                </>
              ) : editingId ? "Save changes" : "Create event type"}
            </button>

            {editingId ? (
              <button type="button" className="secondary-button" onClick={resetEditor}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>

      {shareTarget ? <ShareModal item={shareTarget} onClose={() => setShareTarget(null)} /> : null}
    </div>
  );
}
