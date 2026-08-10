import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import EmptyState from "../components/EmptyState";
import Icon from "../components/Icon";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const TRIGGERS = [
  { value: "booking_created", label: "Booking confirmed" },
  { value: "booking_cancelled", label: "Booking cancelled" },
  { value: "booking_rescheduled", label: "Booking rescheduled" },
  { value: "before_event", label: "Before the meeting" },
  { value: "after_event", label: "After the meeting" },
];

const ACTIONS = [
  { value: "email_guest", label: "Email the guest" },
  { value: "email_host", label: "Email me" },
  { value: "webhook", label: "Send a webhook" },
];

const OFFSETS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "24 hours" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];

const TIME_BASED = new Set(["before_event", "after_event"]);

const VARIABLES = [
  "{{guest_name}}", "{{guest_email}}", "{{event_title}}", "{{start_time}}",
  "{{meeting_url}}", "{{host_name}}", "{{manage_url}}",
];

const TEMPLATES = {
  booking_created: {
    subject: "You're booked — {{event_title}}",
    body: "Hi {{guest_name}},\n\nYour meeting is confirmed for {{start_time}}.\n\nJoin here: {{meeting_url}}\n\nNeed to change it? {{manage_url}}",
  },
  booking_cancelled: {
    subject: "Cancelled — {{event_title}}",
    body: "Hi {{guest_name}},\n\nYour meeting on {{start_time}} has been cancelled.",
  },
  booking_rescheduled: {
    subject: "Moved — {{event_title}}",
    body: "Hi {{guest_name}},\n\nYour meeting has moved to {{start_time}}.\n\nJoin here: {{meeting_url}}",
  },
  before_event: {
    subject: "Reminder — {{event_title}}",
    body: "Hi {{guest_name}},\n\nA reminder about your meeting at {{start_time}}.\n\nJoin here: {{meeting_url}}\n\nNeed to change it? {{manage_url}}",
  },
  after_event: {
    subject: "Thanks for meeting — {{event_title}}",
    body: "Hi {{guest_name}},\n\nThanks for your time today. It was good to talk.",
  },
};

const EMPTY = {
  name: "", trigger: "booking_created", action: "email_guest",
  subject: TEMPLATES.booking_created.subject, body: TEMPLATES.booking_created.body,
  webhook_url: "", active: true, offset_minutes: 1440,
};

function describe(workflow) {
  const trigger = TRIGGERS.find((item) => item.value === workflow.trigger)?.label || workflow.trigger;
  if (!TIME_BASED.has(workflow.trigger)) return trigger;
  const offset = OFFSETS.find((item) => item.value === (workflow.offset_minutes ?? 1440))?.label
    || `${workflow.offset_minutes} minutes`;
  return `${offset} ${workflow.trigger === "before_event" ? "before" : "after"} the meeting`;
}

export default function WorkflowsPage() {
  const toast = useToast();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    api.getWorkflows()
      .then(setWorkflows)
      .catch((error) => toast.error(error.message || "Could not load workflows."))
      .finally(() => setLoading(false));
  }, [toast]);

  const activeCount = useMemo(() => workflows.filter((item) => item.active).length, [workflows]);

  function reset() {
    setForm(EMPTY);
    setEditingId(null);
  }

  function changeTrigger(trigger) {
    const template = TEMPLATES[trigger];
    setForm((current) => ({
      ...current,
      trigger,
      subject: template?.subject ?? current.subject,
      body: template?.body ?? current.body,
    }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim()) { toast.error("Give the workflow a name."); return; }
    if (form.action === "webhook" && !/^https?:\/\//.test(form.webhook_url.trim())) {
      toast.error("Webhook URL must start with http:// or https://.");
      return;
    }
    if (form.action !== "webhook" && !form.subject.trim() && !form.body.trim()) {
      toast.error("Add a subject or a body for the email.");
      return;
    }

    setSaving(true);
    try {
      const payload = { ...form, name: form.name.trim() };
      if (editingId) {
        const updated = await api.updateWorkflow(editingId, payload);
        setWorkflows((current) => current.map((item) => (item.id === editingId ? updated : item)));
        toast.success("Workflow updated.");
      } else {
        const created = await api.createWorkflow(payload);
        setWorkflows((current) => [...current, created]);
        toast.success("Workflow created.");
      }
      reset();
    } catch (error) {
      toast.error(error.message || "Could not save the workflow.");
    } finally {
      setSaving(false);
    }
  }

  function edit(workflow) {
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

  async function toggle(workflow) {
    setTogglingId(workflow.id);
    try {
      const updated = await api.toggleWorkflow(workflow.id);
      setWorkflows((current) => current.map((item) => (item.id === workflow.id ? updated : item)));
    } catch (error) {
      toast.error(error.message || "Could not update it.");
    } finally {
      setTogglingId(null);
    }
  }

  async function remove(workflow) {
    if (!window.confirm(`Delete “${workflow.name}”?`)) return;
    try {
      await api.deleteWorkflow(workflow.id);
      setWorkflows((current) => current.filter((item) => item.id !== workflow.id));
      if (editingId === workflow.id) reset();
      toast.success("Workflow deleted.");
    } catch (error) {
      toast.error(error.message || "Could not delete it.");
    }
  }

  function insertVariable(variable) {
    const field = form.action === "webhook" ? "webhook_url" : "body";
    setForm((current) => ({ ...current, [field]: `${current[field]}${variable}` }));
  }

  return (
    <div className="stack">
      <div className="grid-auto">
        <div className="card stat"><p className="stat-label">Workflows</p><p className="stat-value">{loading ? "—" : workflows.length}</p></div>
        <div className="card stat"><p className="stat-label">Active</p><p className="stat-value">{loading ? "—" : activeCount}</p></div>
        <div className="card stat"><p className="stat-label">Paused</p><p className="stat-value">{loading ? "—" : workflows.length - activeCount}</p></div>
      </div>

      <div className="split">
        <SectionCard title="Your workflows" subtitle="These run automatically — nothing to trigger by hand.">
          {loading ? (
            <p className="hint">Loading…</p>
          ) : workflows.length === 0 ? (
            <EmptyState
              icon="zap"
              title="No workflows yet"
              description="Add a reminder that goes out 24 hours before every meeting, or a webhook that posts to Slack."
            />
          ) : (
            <div className="stack-3">
              {workflows.map((workflow) => (
                <article key={workflow.id} className={`item${workflow.active ? "" : " is-muted"}`} style={{ flexDirection: "column" }}>
                  <div className="row-between" style={{ width: "100%", alignItems: "flex-start" }}>
                    <div className="item-main">
                      <div className="row-2" style={{ flexWrap: "wrap" }}>
                        <h3 className="item-title">{workflow.name}</h3>
                        <span className={`badge ${workflow.active ? "badge-ok" : ""}`}>{workflow.active ? "Active" : "Paused"}</span>
                      </div>
                      <p className="tiny subtle" style={{ marginTop: 4 }}>
                        {describe(workflow)} · {ACTIONS.find((item) => item.value === workflow.action)?.label}
                      </p>
                      <p className="small muted break" style={{ marginTop: "var(--s3)" }}>
                        {workflow.action === "webhook"
                          ? workflow.webhook_url || "No URL set"
                          : workflow.subject || "No subject"}
                      </p>
                    </div>

                    <div className="item-actions">
                      <button className="btn btn-sm" onClick={() => edit(workflow)}>Edit</button>
                      <button className="btn btn-sm" onClick={() => toggle(workflow)} disabled={togglingId === workflow.id}>
                        {togglingId === workflow.id ? <span className="spinner" /> : workflow.active ? "Pause" : "Activate"}
                      </button>
                      <button className="btn btn-icon btn-ghost btn-danger" onClick={() => remove(workflow)} aria-label="Delete">
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title={editingId ? "Edit workflow" : "New workflow"}
          subtitle="Choose when it runs and what it does."
          actions={editingId ? <button className="btn btn-sm btn-ghost" onClick={reset}>Cancel</button> : null}
        >
          <form className="stack-4" onSubmit={submit}>
            <div className="field">
              <label className="field-label" htmlFor="wf-name">Name</label>
              <input id="wf-name" className="input" value={form.name} placeholder="24 hour reminder"
                     onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>

            <div className="field">
              <label className="field-label" htmlFor="wf-trigger">When</label>
              <select id="wf-trigger" className="select" value={form.trigger}
                      onChange={(event) => changeTrigger(event.target.value)}>
                {TRIGGERS.map((trigger) => <option key={trigger.value} value={trigger.value}>{trigger.label}</option>)}
              </select>
            </div>

            {TIME_BASED.has(form.trigger) && (
              <div className="field">
                <label className="field-label" htmlFor="wf-offset">
                  How long {form.trigger === "before_event" ? "before" : "after"}?
                </label>
                <select id="wf-offset" className="select" value={form.offset_minutes}
                        onChange={(event) => setForm({ ...form, offset_minutes: Number(event.target.value) })}>
                  {OFFSETS.map((offset) => <option key={offset.value} value={offset.value}>{offset.label}</option>)}
                </select>
                <span className="hint">Checked every minute. Each guest gets it once.</span>
              </div>
            )}

            <div className="field">
              <label className="field-label" htmlFor="wf-action">Then</label>
              <select id="wf-action" className="select" value={form.action}
                      onChange={(event) => setForm({ ...form, action: event.target.value })}>
                {ACTIONS.map((action) => <option key={action.value} value={action.value}>{action.label}</option>)}
              </select>
            </div>

            {form.action === "webhook" ? (
              <div className="field">
                <label className="field-label" htmlFor="wf-url">Webhook URL</label>
                <input id="wf-url" className="input input-mono" type="url" value={form.webhook_url}
                       placeholder="https://hooks.slack.com/services/…"
                       onChange={(event) => setForm({ ...form, webhook_url: event.target.value })} />
              </div>
            ) : (
              <>
                <div className="field">
                  <label className="field-label" htmlFor="wf-subject">Subject</label>
                  <input id="wf-subject" className="input" value={form.subject}
                         onChange={(event) => setForm({ ...form, subject: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="wf-body">Message</label>
                  <textarea id="wf-body" className="textarea" rows="6" value={form.body}
                            onChange={(event) => setForm({ ...form, body: event.target.value })} />
                </div>
              </>
            )}

            <div className="field">
              <span className="field-label">Insert a value</span>
              <div className="row-wrap" style={{ gap: 5 }}>
                {VARIABLES.map((variable) => (
                  <button key={variable} type="button" className="badge badge-mono" onClick={() => insertVariable(variable)}>
                    {variable}
                  </button>
                ))}
              </div>
            </div>

            <div className="panel row-between">
              <div>
                <p className="small" style={{ fontWeight: 600 }}>Active</p>
                <p className="hint">Paused workflows never fire.</p>
              </div>
              <button type="button" className="switch" role="switch" aria-checked={form.active}
                      aria-label="Active"
                      onClick={() => setForm({ ...form, active: !form.active })} />
            </div>

            <div className="row-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : editingId ? "Save changes" : "Create workflow"}
              </button>
              {editingId && <button type="button" className="btn btn-ghost" onClick={reset}>Cancel</button>}
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
