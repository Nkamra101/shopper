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
  accent_color: "#0f172a",
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PREDEFINED_COLORS = ["#0f172a", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899"];

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = "Title is required.";
  if (!form.url_slug.trim()) {
    errors.url_slug = "Slug is required.";
  } else if (!SLUG_PATTERN.test(form.url_slug)) {
    errors.url_slug = "Use lowercase letters, numbers, and hyphens only.";
  }
  if (!form.duration || form.duration < 15) errors.duration = "Minimum 15 minutes.";
  return errors;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setForm(emptyForm);
      setEditingId(null);
      setTouched({});
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
    });
    setTouched({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this event type? This cannot be undone.")) return;
    try {
      await api.deleteEventType(id);
      toast.success("Event type deleted.");
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      loadDashboard();
    } catch (error) {
      toast.error(error.message || "Could not delete event type.");
    }
  }

  function showError(field) {
    return touched[field] && errors[field];
  }

  return (
    <div className="page-grid">
      <div className="stack">
        {loading && !summary ? (
          <SkeletonStats />
        ) : (
          <div className="stats-grid">
            <div className="stat-card">
              <span>Event Types</span>
              <strong>{summary?.event_types_count ?? "--"}</strong>
            </div>
            <div className="stat-card">
              <span>Upcoming</span>
              <strong>{summary?.upcoming_bookings_count ?? "--"}</strong>
            </div>
            <div className="stat-card">
              <span>Past</span>
              <strong>{summary?.past_bookings_count ?? "--"}</strong>
            </div>
          </div>
        )}

        <SectionCard
          title="Your event types"
          subtitle="These event types become public booking links that you can share with visitors."
        >
          {loading ? (
            <SkeletonList count={3} />
          ) : eventTypes.length === 0 ? (
            <EmptyState
              title="No event types yet"
              description="Create your first event type using the form on the right to get a shareable booking link."
            />
          ) : (
            <div className="card-list">
              {eventTypes.map((item) => (
                <article
                  key={item.id}
                  className="event-card"
                  style={{ "--event-accent": item.accent_color }}
                >
                  <div className="event-card-top">
                    <span className="color-dot" style={{ background: item.accent_color }} />
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.description || "No description"}</p>
                    </div>
                  </div>
                  <div className="event-meta">
                    <span>{item.duration} mins</span>
                    <span>/book/{item.url_slug}</span>
                  </div>
                  <div className="button-row">
                    <button type="button" className="secondary-button" onClick={() => handleEdit(item)}>
                      Edit
                    </button>
                    <a
                      className="secondary-button"
                      href={`/book/${item.url_slug}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open link
                    </a>
                    <button type="button" className="ghost-button" onClick={() => handleDelete(item.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title={editingId ? "Edit event type" : "Create event type"}
        subtitle="Keep it simple and friendly for visitors."
      >
        <form className="form-grid" onSubmit={handleSubmit} noValidate>
          <label>
            Title
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onBlur={() => setTouched((t) => ({ ...t, title: true }))}
              placeholder="Product Discovery Call"
              aria-invalid={showError("title") ? "true" : "false"}
              aria-describedby={showError("title") ? "title-error" : undefined}
              required
            />
            {showError("title") ? (
              <p id="title-error" className="field-error">{errors.title}</p>
            ) : null}
          </label>
          <label>
            Slug
            <input
              value={form.url_slug}
              onChange={(e) =>
                setForm({ ...form, url_slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
              }
              onBlur={() => setTouched((t) => ({ ...t, url_slug: true }))}
              placeholder="product-discovery"
              aria-invalid={showError("url_slug") ? "true" : "false"}
              aria-describedby={showError("url_slug") ? "slug-error" : undefined}
              required
            />
            {showError("url_slug") ? (
              <p id="slug-error" className="field-error">{errors.url_slug}</p>
            ) : null}
          </label>
          <label className="full-width">
            Description
            <textarea
              rows="4"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="A short call to understand goals and timelines."
            />
          </label>
          <label>
            Duration (minutes)
            <input
              type="number"
              min="15"
              max="240"
              step="15"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
              onBlur={() => setTouched((t) => ({ ...t, duration: true }))}
              aria-invalid={showError("duration") ? "true" : "false"}
              required
            />
            {showError("duration") ? (
              <p className="field-error">{errors.duration}</p>
            ) : null}
          </label>
          <label>
            Accent color
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
              {PREDEFINED_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor: color,
                    border: form.accent_color === color ? '3px solid var(--bg)' : '2px solid transparent',
                    boxShadow: form.accent_color === color ? '0 0 0 2px var(--text)' : 'none',
                    cursor: 'pointer',
                    padding: 0
                  }}
                  onClick={() => setForm({ ...form, accent_color: color })}
                  title={color}
                  aria-label={`Select accent color ${color}`}
                />
              ))}
            </div>
          </label>
          <div className="button-row full-width">
            <button type="submit" className="primary-button" disabled={!isValid || submitting}>
              {submitting ? "Saving..." : editingId ? "Save changes" : "Create event"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                  setTouched({});
                }}
              >
                Cancel editing
              </button>
            ) : null}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
