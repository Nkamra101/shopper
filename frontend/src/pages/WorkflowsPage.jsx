import { useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";

const TRIGGER_OPTIONS = [
  { value: "booking_created", label: "When booking is created" },
  { value: "reminder_24h", label: "24 hours before meeting" },
  { value: "reminder_1h", label: "1 hour before meeting" },
  { value: "reminder_15m", label: "15 minutes before meeting" },
  { value: "after_meeting", label: "After meeting ends" },
  { value: "booking_cancelled", label: "When booking is cancelled" },
  { value: "booking_rescheduled", label: "When booking is rescheduled" },
];

const ACTION_OPTIONS = [
  { value: "email_guest", label: "Send email to guest" },
  { value: "email_host", label: "Send email to host" },
  { value: "webhook", label: "Send webhook" },
];

const EMAIL_TEMPLATES = {
  booking_created: {
    subject: "Your booking is confirmed – {{event_title}}",
    body: `Hi {{guest_name}},

Your meeting has been confirmed!

📅 {{event_title}}
🕐 {{start_time}}
📍 {{location}}

{{#if meeting_url}}
🔗 Join here: {{meeting_url}}
{{/if}}

See you soon!`,
  },
  reminder_24h: {
    subject: "Reminder: {{event_title}} tomorrow",
    body: `Hi {{guest_name}},

Just a reminder that you have a meeting tomorrow:

📅 {{event_title}}
🕐 {{start_time}}
{{#if meeting_url}}🔗 {{meeting_url}}{{/if}}

See you then!`,
  },
  reminder_1h: {
    subject: "Your meeting starts in 1 hour – {{event_title}}",
    body: `Hi {{guest_name}},

Your meeting starts in 1 hour:

📅 {{event_title}}
🕐 {{start_time}}
{{#if meeting_url}}🔗 {{meeting_url}}{{/if}}`,
  },
  after_meeting: {
    subject: "Thanks for meeting – {{event_title}}",
    body: `Hi {{guest_name}},

Thanks for taking the time to meet today.

If you'd like to book again: {{booking_url}}

Have a great day!`,
  },
  booking_cancelled: {
    subject: "Your booking has been cancelled – {{event_title}}",
    body: `Hi {{guest_name}},

Your booking for {{event_title}} on {{start_time}} has been cancelled.

To rebook: {{booking_url}}`,
  },
};

const VARIABLE_HINTS = [
  { tag: "{{guest_name}}", desc: "Guest's full name" },
  { tag: "{{event_title}}", desc: "Event type name" },
  { tag: "{{start_time}}", desc: "Formatted start time" },
  { tag: "{{meeting_url}}", desc: "Video call link" },
  { tag: "{{location}}", desc: "Meeting location" },
  { tag: "{{booking_url}}", desc: "Public booking page URL" },
  { tag: "{{host_name}}", desc: "Your display name" },
];

const DEFAULT_WORKFLOW = {
  name: "",
  trigger: "booking_created",
  action: "email_guest",
  subject: EMAIL_TEMPLATES.booking_created.subject,
  body: EMAIL_TEMPLATES.booking_created.body,
  active: true,
};

let _idCounter = 3;

function WorkflowCard({ wf, onToggle, onEdit, onDelete }) {
  const triggerLabel = TRIGGER_OPTIONS.find((t) => t.value === wf.trigger)?.label ?? wf.trigger;
  const actionLabel = ACTION_OPTIONS.find((a) => a.value === wf.action)?.label ?? wf.action;

  return (
    <article className={`event-card ${!wf.active ? "event-card-inactive" : ""}`}>
      <div className="event-card-top">
        <div
          style={{
            width: 36, height: 36, borderRadius: "var(--radius-md)",
            background: wf.active ? "var(--accent-soft)" : "var(--surface-muted)",
            border: "1px solid var(--border)",
            display: "grid", placeItems: "center", flexShrink: 0,
            fontSize: 18,
          }}
        >
          {wf.action === "webhook" ? "🔗" : "✉️"}
        </div>
        <div style={{ flex: 1 }}>
          <div className="event-title-row">
            <h4 style={{ margin: 0 }}>{wf.name || "Unnamed workflow"}</h4>
            {!wf.active && <span className="event-inactive-badge">Paused</span>}
          </div>
          <p style={{ margin: "4px 0 0" }}>
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>{triggerLabel}</span>
            {" → "}
            <span style={{ fontWeight: 600 }}>{actionLabel}</span>
          </p>
        </div>
      </div>

      {wf.action !== "webhook" && wf.subject && (
        <div
          style={{
            marginTop: "var(--space-3)",
            padding: "10px 14px",
            background: "var(--surface-muted)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--text-subtle)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em" }}>Subject: </span>
          {wf.subject}
        </div>
      )}

      <div className="event-card-actions">
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button type="button" className="icon-button edit-button" onClick={() => onEdit(wf)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit
          </button>
          <button type="button" className="icon-button" onClick={() => onToggle(wf)}>
            {wf.active
              ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause</>
              : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Activate</>
            }
          </button>
        </div>
        <button type="button" className="icon-button danger-button" onClick={() => onDelete(wf.id)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          Delete
        </button>
      </div>
    </article>
  );
}

export default function WorkflowsPage() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState([
    {
      id: 1,
      name: "Booking confirmation",
      trigger: "booking_created",
      action: "email_guest",
      subject: EMAIL_TEMPLATES.booking_created.subject,
      body: EMAIL_TEMPLATES.booking_created.body,
      active: true,
    },
    {
      id: 2,
      name: "24h reminder",
      trigger: "reminder_24h",
      action: "email_guest",
      subject: EMAIL_TEMPLATES.reminder_24h.subject,
      body: EMAIL_TEMPLATES.reminder_24h.body,
      active: true,
    },
  ]);

  const [form, setForm] = useState(DEFAULT_WORKFLOW);
  const [editingId, setEditingId] = useState(null);
  const [showVarHints, setShowVarHints] = useState(false);

  function handleTriggerChange(trigger) {
    const tmpl = EMAIL_TEMPLATES[trigger];
    setForm((f) => ({
      ...f,
      trigger,
      subject: tmpl?.subject ?? f.subject,
      body: tmpl?.body ?? f.body,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Please give this workflow a name."); return; }
    if (editingId) {
      setWorkflows((ws) => ws.map((w) => w.id === editingId ? { ...form, id: editingId } : w));
      toast.success("Workflow updated.");
    } else {
      setWorkflows((ws) => [...ws, { ...form, id: ++_idCounter }]);
      toast.success("Workflow created!");
    }
    setForm(DEFAULT_WORKFLOW);
    setEditingId(null);
  }

  function handleEdit(wf) {
    setEditingId(wf.id);
    setForm({ name: wf.name, trigger: wf.trigger, action: wf.action, subject: wf.subject, body: wf.body, active: wf.active });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleToggle(wf) {
    setWorkflows((ws) => ws.map((w) => w.id === wf.id ? { ...w, active: !w.active } : w));
    toast.success(wf.active ? "Workflow paused." : "Workflow activated.");
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this workflow?")) return;
    setWorkflows((ws) => ws.filter((w) => w.id !== id));
    if (editingId === id) { setEditingId(null); setForm(DEFAULT_WORKFLOW); }
    toast.success("Workflow deleted.");
  }

  const activeCount = workflows.filter((w) => w.active).length;

  return (
    <div className="page-grid">
      <div className="stack">
        {/* Stats strip */}
        <div className="four-col" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
          {[
            { label: "Total workflows", value: workflows.length, icon: "⚡", color: "var(--accent)" },
            { label: "Active", value: activeCount, icon: "✅", color: "var(--success)" },
            { label: "Paused", value: workflows.length - activeCount, icon: "⏸️", color: "var(--warning)" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-emoji">{s.icon}</div>
              <strong style={{ color: s.color, fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.04em" }}>{s.value}</strong>
              <span className="stat-label">{s.label}</span>
            </div>
          ))}
        </div>

        <SectionCard
          title="Automated workflows"
          subtitle="Send emails automatically based on booking events."
          action={<span className="section-count-badge">{workflows.length}</span>}
        >
          {workflows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚡</div>
              <h4>No workflows yet</h4>
              <p>Create your first workflow to automate email reminders and notifications.</p>
            </div>
          ) : (
            <div className="card-list">
              {workflows.map((wf) => (
                <WorkflowCard
                  key={wf.id}
                  wf={wf}
                  onToggle={handleToggle}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Variable reference card */}
        <SectionCard
          title="Template variables"
          subtitle="Use these in your email subjects and body text."
          action={
            <button
              type="button"
              className="icon-button"
              onClick={() => setShowVarHints((v) => !v)}
              style={{ fontSize: 12 }}
            >
              {showVarHints ? "Hide" : "Show"}
            </button>
          }
        >
          {showVarHints && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: "var(--space-2)",
              }}
            >
              {VARIABLE_HINTS.map((v) => (
                <div
                  key={v.tag}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--space-2)",
                    padding: "10px 14px",
                    background: "var(--surface-muted)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <code
                    style={{
                      fontSize: 12, fontFamily: "ui-monospace, monospace",
                      color: "var(--accent)", fontWeight: 700,
                      background: "var(--accent-soft)",
                      padding: "2px 6px", borderRadius: 4, flexShrink: 0,
                    }}
                  >
                    {v.tag}
                  </code>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{v.desc}</span>
                </div>
              ))}
            </div>
          )}
          {!showVarHints && (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Click "Show" to see available template variables like{" "}
              <code style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "var(--accent)" }}>{"{{guest_name}}"}</code>,{" "}
              <code style={{ fontSize: 12, fontFamily: "ui-monospace, monospace", color: "var(--accent)" }}>{"{{event_title}}"}</code>, and more.
            </p>
          )}
        </SectionCard>
      </div>

      {/* Create / Edit form */}
      <SectionCard
        title={editingId ? "Edit workflow" : "New workflow"}
        subtitle="Automate an email or webhook action."
      >
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <label>
            Workflow name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. 24h reminder to guest"
              required
            />
          </label>

          <label>
            Trigger
            <select
              value={form.trigger}
              onChange={(e) => handleTriggerChange(e.target.value)}
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>

          <label>
            Action
            <select
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            >
              {ACTION_OPTIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </label>

          {form.action !== "webhook" ? (
            <>
              <label>
                Email subject
                <input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="Subject line"
                />
              </label>
              <label>
                Email body
                <textarea
                  rows="10"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, lineHeight: 1.6 }}
                />
              </label>
            </>
          ) : (
            <label>
              Webhook URL
              <input
                type="url"
                value={form.webhookUrl ?? ""}
                onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                placeholder="https://hooks.example.com/..."
              />
              <p className="field-hint">We'll POST booking data as JSON to this URL on the selected trigger.</p>
            </label>
          )}

          <label className="toggle-row">
            <span>
              <strong>Active</strong>
              <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>
                Inactive workflows won't fire
              </p>
            </span>
            <button
              type="button"
              className={`toggle-switch ${form.active ? "on" : ""}`}
              onClick={() => setForm({ ...form, active: !form.active })}
              role="switch"
              aria-checked={form.active}
              aria-label="Toggle active"
            >
              <span className="toggle-knob" />
            </button>
          </label>

          <div className="button-row">
            <button type="submit" className="primary-button">
              {editingId ? "Save changes" : "Create workflow"}
            </button>
            {editingId && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => { setEditingId(null); setForm(DEFAULT_WORKFLOW); }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
