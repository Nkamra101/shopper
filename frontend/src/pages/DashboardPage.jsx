import { useEffect, useState } from "react";
import SectionCard from "../components/SectionCard";
import { api } from "../services/api";

const emptyForm = {
  title: "",
  description: "",
  duration: 30,
  url_slug: "",
  accent_color: "#0f172a",
};

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [summaryData, eventTypeData] = await Promise.all([api.getSummary(), api.getEventTypes()]);
      setSummary(summaryData);
      setEventTypes(eventTypeData);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    try {
      if (editingId) {
        await api.updateEventType(editingId, form);
        setMessage("Event type updated successfully.");
      } else {
        await api.createEventType(form);
        setMessage("Event type created successfully.");
      }

      setForm(emptyForm);
      setEditingId(null);
      loadDashboard();
    } catch (error) {
      setMessage(error.message);
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
  }

  async function handleDelete(id) {
    try {
      await api.deleteEventType(id);
      setMessage("Event type deleted.");
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      loadDashboard();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="page-grid">
      <div className="stack">
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

        <SectionCard
          title="Your event types"
          subtitle="These event types become public booking links that you can share with visitors."
        >
          {loading ? <p>Loading event types...</p> : null}
          <div className="card-list">
            {eventTypes.map((item) => (
              <article key={item.id} className="event-card">
                <div className="event-card-top">
                  <span className="color-dot" style={{ background: item.accent_color }} />
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.description}</p>
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
                  <a className="secondary-button" href={`/book/${item.url_slug}`} target="_blank" rel="noreferrer">
                    Open link
                  </a>
                  <button type="button" className="ghost-button" onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title={editingId ? "Edit event type" : "Create event type"}
        subtitle="Keep it simple and friendly for the demo."
      >
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Title
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Product Discovery Call"
              required
            />
          </label>
          <label>
            Slug
            <input
              value={form.url_slug}
              onChange={(event) =>
                setForm({ ...form, url_slug: event.target.value.toLowerCase().replace(/\s+/g, "-") })
              }
              placeholder="product-discovery"
              required
            />
          </label>
          <label className="full-width">
            Description
            <textarea
              rows="4"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
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
              onChange={(event) => setForm({ ...form, duration: Number(event.target.value) })}
              required
            />
          </label>
          <label>
            Accent color
            <input
              type="color"
              value={form.accent_color}
              onChange={(event) => setForm({ ...form, accent_color: event.target.value })}
            />
          </label>
          <div className="button-row full-width">
            <button type="submit" className="primary-button">
              {editingId ? "Save changes" : "Create event"}
            </button>
            {editingId ? (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel editing
              </button>
            ) : null}
          </div>
        </form>
        {message ? <p className="inline-message">{message}</p> : null}
      </SectionCard>
    </div>
  );
}

