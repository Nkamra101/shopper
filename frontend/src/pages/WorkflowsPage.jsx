import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

/**
 * Trigger values map 1:1 onto the backend. Time-based ones pair with
 * `offset_minutes`, which the reminder scheduler polls against.
 */
const TRIGGERS = [
  { value: "booking_created", label: "Booking confirmed" },
  { value: "booking_cancelled", label: "Booking cancelled" },
  { value: "booking_rescheduled", label: "Booking rescheduled" },
  { value: "before_event", label: "Before the meeting" },
  { value: "after_event", label: "After the meeting" },
];

const OFFSET_CHOICES = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "24 hours" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];

function offsetLabel(minutes) {
  return OFFSET_CHOICES.find((choice) => choice.value === minutes)?.label || `${minutes} minutes`;
}

const ACTIONS = [
  { value: "email_guest", label: "Email guest" },
  { value: "email_host", label: "Email host" },
  { value: "webhook", label: "Send webhook" },
];

const TEMPLATES = {
  booking_created: {
    subject: "Your booking is confirmed – {{event_title}}",
    body: "Hi {{guest_name}},\n\nYour booking is confirmed for {{start_time}}.\n\nJoin here: {{meeting_url}}\n\nSee you soon!",
  },
  booking_cancelled: {
    subject: "Your booking has been cancelled – {{event_title}}",
    body: "Hi {{guest_name}},\n\nUnfortunately your booking for {{start_time}} has been cancelled.\n\nIf you'd like to reschedule, please visit the booking page.",
  },
  booking_rescheduled: {
    subject: "Your booking has been rescheduled – {{event_title}}",
    body: "Hi {{guest_name}},\n\nYour booking has been moved to {{start_time}}.\n\nJoin here: {{meeting_url}}",
  },
  before_event: {
    subject: "Reminder: {{event_title}}",
    body: "Hi {{guest_name}},\n\nThis is a reminder about your meeting at {{start_time}}.\n\nJoin here: {{meeting_url}}\n\nNeed to change plans? {{manage_url}}",
  },
  after_event: {
    subject: "Thanks for meeting – {{event_title}}",
    body: "Hi {{guest_name}},\n\nThank you for your time today! It was great connecting.\n\nLooking forward to speaking again.",
  },
};

const VARIABLES = [
  "{{guest_name}}", "{{guest_email}}", "{{event_title}}", "{{start_time}}",
  "{{meeting_url}}", "{{host_name}}", "{{manage_url}}",
];

const EMPTY_FORM = {
  name: "",
  trigger: "booking_created",
  action: "email_guest",
  subject: TEMPLATES.booking_created.subject,
  body: TEMPLATES.booking_created.body,
  webhook_url: "",
  active: true,
  offset_minutes: 1440,
};

const TIME_BASED = new Set(["before_event", "after_event"]);

function TriggerBadge({ workflow }) {
  const trigger = TRIGGERS.find((item) => item.value === workflow.trigger);
  if (!trigger) return null;

  const suffix = TIME_BASED.has(workflow.trigger)
    ? ` · ${offsetLabel(workflow.offset_minutes ?? 1440)} ${workflow.trigger === "before_event" ? "before" : "after"}`
    : "";

  return <span className="workflow-trigger-badge">{trigger.label}{suffix}</span>;
}

function WorkflowCard({ workflow, onEdit, onToggle, onDelete, saving }) {
  const actionLabel = ACTIONS.find((a) => a.value === workflow.action)?.label || workflow.action;

  return (
    <article className={`workflow-card ${workflow.active ? "" : "paused"}`}>
      <div className="workflow-card-top">
        <div className="workflow-card-meta">
          <TriggerBadge workflow={workflow} />
        </div>
        <h4 className="workflow-card-name">{workflow.name}</h4>
        <p className="workflow-card-action">
          <span className={`workflow-state ${workflow.active ? "active" : "paused"}`}>
            {workflow.active ? "Active" : "Paused"}
          </span>
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>·</span>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{actionLabel}</span>
        </p>
      </div>
      <div className="workflow-preview">
        {workflow.action === "webhook"
          ? workflow.webhook_url || <em style={{ color: "var(--text-subtle)" }}>No URL set</em>
          : workflow.subject || <em style={{ color: "var(--text-subtle)" }}>No subject</em>}
      </div>
      <div className="workflow-card-actions">
        <button type="button" className="secondary-button" onClick={() => onEdit(workflow)}>Edit</button>
        <button
          type="button"
          className={workflow.active ? "ghost-button" : "primary-button"}
          onClick={() => onToggle(workflow)}
          disabled={saving === workflow.id}
        >
          {saving === workflow.id ? <span className="btn-spinner" /> : workflow.active ? "Pause" : "Activate"}
        </button>
        <button type="button" className="ghost-button danger" onClick={() => onDelete(workflow.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}

export default function WorkflowsPage() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [savingToggle, setSavingToggle] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    api.getWorkflows()
      .then((data) => setWorkflows(data))
      .catch((err) => toast.error(err.message || "Could not load workflows."))
      .finally(() => setLoading(false));
  }, [toast]);

  const activeCount = useMemo(() => workflows.filter((w) => w.active).length, [workflows]);

  function updateTrigger(trigger) {
    const tpl = TEMPLATES[trigger];
    setForm((f) => ({ ...f, trigger, subject: tpl?.subject || f.subject, body: tpl?.body || f.body }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Add a workflow name."); return; }
    setSubmitting(true);
    try {
      const payload = {
        name: form.name.trim(),
        trigger: form.trigger,
        action: form.action,
        subject: form.subject,
        body: form.body,
        webhook_url: form.webhook_url,
        active: form.active,
        offset_minutes: form.offset_minutes,
      };
      if (editingId) {
        const updated = await api.updateWorkflow(editingId, payload);
        setWorkflows((wf) => wf.map((w) => (w.id === editingId ? updated : w)));
        toast.success("Workflow updated.");
      } else {
        const created = await api.createWorkflow(payload);
        setWorkflows((wf) => [...wf, created]);
        toast.success("Workflow created.");
      }
      cancelEdit();
    } catch (err) {
      toast.error(err.message || "Could not save workflow.");
    } finally {
      setSubmitting(false);
    }
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function startEdit(workflow) {
    setEditingId(workflow.id);
    setForm({
      name: workflow.name,
      trigger: workflow.trigger,
      action: workflow.action,
      subject: workflow.subject || "",
      body: workflow.body || "",
      webhook_url: workflow.webhook_url || "",
      active: workflow.active,
      offset_minutes: workflow.offset_minutes ?? 1440,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleToggle(workflow) {
    setSavingToggle(workflow.id);
    try {
      const updated = await api.toggleWorkflow(workflow.id);
      setWorkflows((wf) => wf.map((w) => (w.id === workflow.id ? updated : w)));
      toast.success(updated.active ? "Workflow activated." : "Workflow paused.");
    } catch (err) {
      toast.error(err.message || "Could not toggle workflow.");
    } finally {
      setSavingToggle(null);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this workflow? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await api.deleteWorkflow(id);
      setWorkflows((wf) => wf.filter((w) => w.id !== id));
      if (editingId === id) cancelEdit();
      toast.success("Workflow deleted.");
    } catch (err) {
      toast.error(err.message || "Could not delete workflow.");
    } finally {
      setDeletingId(null);
    }
  }

  function insertVariable(variable) {
    const field = form.action !== "webhook" ? "body" : "webhook_url";
    setForm((f) => ({ ...f, [field]: f[field] + variable }));
  }

  return (
    <div className="stack">
      <section className="workflows-hero">
        <div>
          <p className="eyebrow">Automation</p>
          <h3>Keep guests informed without extra manual work.</h3>
          <p>Workflows let Shopper send confirmations and notifications at exactly the right moment — no manual follow-up needed.</p>
        </div>
        <div className="workflows-hero-stats">
          <div className="workflows-stat-card">
            <span>Total</span>
            <strong>{loading ? "…" : workflows.length}</strong>
          </div>
          <div className="workflows-stat-card">
            <span>Active</span>
            <strong>{loading ? "…" : activeCount}</strong>
          </div>
          <div className="workflows-stat-card">
            <span>Paused</span>
            <strong>{loading ? "…" : workflows.length - activeCount}</strong>
          </div>
        </div>
      </section>

      <div className="workflows-layout">
        <SectionCard
          title={editingId ? "Edit workflow" : "New workflow"}
          subtitle="Choose a trigger and define what should happen next."
        >
          <form className="workflow-form" onSubmit={handleSubmit}>
            <label>
              Workflow name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Confirmation email"
                autoFocus={!!editingId}
              />
            </label>

            <label>
              Trigger
              <select value={form.trigger} onChange={(e) => updateTrigger(e.target.value)}>
                {TRIGGERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </label>

            {TIME_BASED.has(form.trigger) && (
              <label>
                How long {form.trigger === "before_event" ? "before" : "after"} the meeting?
                <select
                  value={form.offset_minutes}
                  onChange={(e) => setForm({ ...form, offset_minutes: Number(e.target.value) })}
                >
                  {OFFSET_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>{choice.label}</option>
                  ))}
                </select>
                <p className="field-hint">
                  Checked every minute by the reminder scheduler. Each guest receives this once.
                </p>
              </label>
            )}

            <label>
              Action
              <select value={form.action} onChange={(e) => setForm({ ...form, action: e.target.value })}>
                {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </label>

            {form.action === "webhook" ? (
              <label>
                Webhook URL
                <input
                  type="url"
                  value={form.webhook_url}
                  onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
                  placeholder="https://example.com/hooks/shopper"
                />
              </label>
            ) : (
              <>
                <label>
                  Email subject
                  <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </label>
                <label>
                  Email body
                  <textarea rows="7" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                </label>
                <div className="workflow-variables">
                  <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Insert variable</p>
                  <div className="workflow-variable-chips">
                    {VARIABLES.map((v) => (
                      <button key={v} type="button" className="workflow-variable-chip" onClick={() => insertVariable(v)}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <label className="toggle-row">
              <span>
                <strong>Active</strong>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>
                  Pause to stop this workflow from firing.
                </p>
              </span>
              <button
                type="button"
                className={`toggle-switch ${form.active ? "on" : ""}`}
                onClick={() => setForm({ ...form, active: !form.active })}
              >
                <span className="toggle-knob" />
              </button>
            </label>

            <div className="button-row">
              <button type="submit" className="primary-button" disabled={submitting}>
                {submitting ? <><span className="btn-spinner" />{editingId ? "Saving…" : "Creating…"}</> : editingId ? "Save changes" : "Create workflow"}
              </button>
              {editingId && (
                <button type="button" className="secondary-button" onClick={cancelEdit}>Cancel</button>
              )}
            </div>
          </form>
        </SectionCard>

        <SectionCard title="Your workflows" subtitle="Automations that run when booking events occur.">
          {loading ? (
            <div className="workflow-list">
              {[1, 2].map((n) => (
                <div key={n} className="workflow-card" style={{ minHeight: 120, opacity: 0.5 }} />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <div className="chart-empty" style={{ padding: "var(--space-10) 0" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.3 }}>
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <p style={{ fontWeight: 600, marginBottom: 4 }}>No workflows yet</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Create your first workflow to start automating booking notifications.</p>
            </div>
          ) : (
            <div className="workflow-list">
              {workflows.map((workflow) => (
                <WorkflowCard
                  key={workflow.id}
                  workflow={workflow}
                  onEdit={startEdit}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  saving={savingToggle}
                />
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
