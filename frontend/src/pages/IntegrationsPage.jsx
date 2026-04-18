import { useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://shopper.app";

// ── Integration definitions ──────────────────────────────────────────────────
const INTEGRATIONS = [
  {
    key: "google_calendar",
    name: "Google Calendar",
    category: "calendar",
    tagline: "Sync bookings & block busy times",
    desc: "Automatically add every confirmed booking to your Google Calendar and prevent double-bookings by blocking off your busy slots.",
    badge: "Popular",
    steps: ["Click Connect below", "Sign in with your Google account", "Approve calendar read+write access"],
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect x="2" y="6" width="44" height="40" rx="6" fill="#4285F4"/>
        <rect x="2" y="6" width="44" height="14" rx="6" fill="#1a73e8"/>
        <rect x="2" y="14" width="44" height="6" fill="#1a73e8"/>
        <path d="M14 4v8M34 4v8" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
        <rect x="10" y="26" width="8" height="8" rx="2" fill="white"/>
        <rect x="20" y="26" width="8" height="8" rx="2" fill="white"/>
        <rect x="30" y="26" width="8" height="8" rx="2" fill="white"/>
        <rect x="10" y="36" width="8" height="6" rx="2" fill="white"/>
        <rect x="20" y="36" width="8" height="6" rx="2" fill="white"/>
      </svg>
    ),
  },
  {
    key: "zoom",
    name: "Zoom",
    category: "video",
    tagline: "Auto-generate Zoom links",
    desc: "Create a unique Zoom meeting room for every booking automatically. The link gets emailed to the guest and appears in the booking confirmation.",
    badge: "Popular",
    steps: ["Click Connect below", "Log in to your Zoom account", "Authorize the Shopper app"],
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect width="48" height="48" rx="12" fill="#2D8CFF"/>
        <path d="M26 17H10a5 5 0 0 0-5 5v4a5 5 0 0 0 5 5h16a5 5 0 0 0 5-5v-4a5 5 0 0 0-5-5z" fill="white"/>
        <path d="M43 19l-8 6v-2a2 2 0 0 0-2-2h2l8-5v3z" fill="white"/>
        <path d="M43 29l-8-6v2a2 2 0 0 0 2 2h-2l8 5v-3z" fill="white"/>
      </svg>
    ),
  },
  {
    key: "google_meet",
    name: "Google Meet",
    category: "video",
    tagline: "Generate Meet rooms instantly",
    desc: "Every confirmed booking gets a Google Meet room link. No extra software needed — just click and join.",
    steps: ["Click Connect below", "Sign in with Google", "Grant Meet access"],
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect width="48" height="48" rx="12" fill="#00897B"/>
        <rect x="8" y="15" width="22" height="18" rx="3" fill="white"/>
        <path d="M34 18l10 4v4l-10 4V18z" fill="white"/>
      </svg>
    ),
  },
  {
    key: "microsoft_teams",
    name: "Microsoft Teams",
    category: "video",
    tagline: "Teams meeting links on every booking",
    desc: "Automatically create Microsoft Teams meeting rooms when a booking is confirmed.",
    comingSoon: true,
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect width="48" height="48" rx="12" fill="#5059C9"/>
        <circle cx="32" cy="14" r="6" fill="#7B83EB"/>
        <path d="M20 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" fill="#E2E2F9"/>
        <path d="M38 22h-6a4 4 0 0 0-4 4v10h10a4 4 0 0 0 4-4V26a4 4 0 0 0-4-4z" fill="#5059C9"/>
        <path d="M28 22H8a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h20a4 4 0 0 0 4-4v-9a4 4 0 0 0-4-4z" fill="#7B83EB"/>
      </svg>
    ),
  },
  {
    key: "outlook",
    name: "Outlook Calendar",
    category: "calendar",
    tagline: "Keep Outlook in sync",
    desc: "Sync all your Shopper bookings to Microsoft Outlook Calendar and block off busy times across your org.",
    comingSoon: true,
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect width="48" height="48" rx="12" fill="#0078D4"/>
        <rect x="6" y="13" width="36" height="26" rx="3" fill="none" stroke="white" strokeWidth="2.5"/>
        <path d="M6 21h36M6 29h36" stroke="white" strokeWidth="1.5"/>
        <path d="M16 13V7M32 13V7" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    key: "slack",
    name: "Slack",
    category: "notifications",
    tagline: "Booking alerts in Slack",
    desc: "Get instant Slack messages whenever a booking is made, cancelled, or rescheduled. Never miss a meeting request.",
    comingSoon: true,
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect width="48" height="48" rx="12" fill="#4A154B"/>
        <g strokeWidth="3.5" strokeLinecap="round">
          <path d="M18 9a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="#E01E5A" stroke="none"/>
          <path d="M18 17v8" stroke="#E01E5A"/>
          <path d="M18 25h8" stroke="#36C5F0"/>
          <path d="M30 17a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="#2EB67D" stroke="none"/>
          <path d="M30 25v8" stroke="#2EB67D"/>
          <path d="M30 33H22" stroke="#ECB22E"/>
          <path d="M10 18a4 4 0 1 0 8 0 4 4 0 0 0-8 0z" fill="#ECB22E" stroke="none"/>
          <path d="M30 30a4 4 0 1 0-8 0 4 4 0 0 0 8 0z" fill="#E01E5A" stroke="none"/>
        </g>
      </svg>
    ),
  },
  {
    key: "zapier",
    name: "Zapier",
    category: "automation",
    tagline: "Connect 5,000+ apps",
    desc: "Trigger Zapier workflows on any booking event — push to CRMs, spreadsheets, project tools, and more.",
    comingSoon: true,
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect width="48" height="48" rx="12" fill="#FF4A00"/>
        <path d="M24 8l4 10h10l-8 6 3 10-9-6-9 6 3-10-8-6h10z" fill="white"/>
      </svg>
    ),
  },
  {
    key: "hubspot",
    name: "HubSpot CRM",
    category: "crm",
    tagline: "Sync contacts & deals",
    desc: "Automatically create or update HubSpot contacts when someone books with you, and log the meeting as an activity.",
    comingSoon: true,
    icon: (
      <svg viewBox="0 0 48 48" width="32" height="32">
        <rect width="48" height="48" rx="12" fill="#FF7A59"/>
        <circle cx="33" cy="15" r="6" fill="white"/>
        <path d="M16 24a8 8 0 1 0 16 0A8 8 0 0 0 16 24z" fill="white"/>
        <path d="M33 21v10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "calendar", label: "📅 Calendar" },
  { key: "video", label: "📹 Video" },
  { key: "notifications", label: "🔔 Notifications" },
  { key: "automation", label: "⚡ Automation" },
  { key: "crm", label: "👥 CRM" },
];

function IntegrationCard({ intg, connected, onToggle }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`intg-card ${connected ? "intg-card-connected" : ""} ${intg.comingSoon ? "intg-card-soon" : ""}`}>
      <div className="intg-card-top">
        <div className="intg-card-icon">{intg.icon}</div>
        <div className="intg-card-info">
          <div className="intg-card-title-row">
            <h4 className="intg-card-name">{intg.name}</h4>
            <div className="intg-card-badges">
              {intg.badge && <span className="intg-badge intg-badge-popular">{intg.badge}</span>}
              {intg.comingSoon && <span className="intg-badge intg-badge-soon">Coming soon</span>}
              {connected && (
                <span className="intg-badge intg-badge-connected">
                  <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="currentColor"/></svg>
                  Connected
                </span>
              )}
            </div>
          </div>
          <p className="intg-card-tagline">{intg.tagline}</p>
        </div>
      </div>

      <p className="intg-card-desc">{intg.desc}</p>

      {!intg.comingSoon && intg.steps && (
        <div>
          <button
            type="button"
            className="intg-expand-btn"
            onClick={() => setExpanded((v) => !v)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 180ms" }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
            {expanded ? "Hide" : "How to connect"}
          </button>
          {expanded && (
            <ol className="intg-steps">
              {intg.steps.map((s, i) => (
                <li key={i} className="intg-step-item">
                  <span className="intg-step-num">{i + 1}</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="intg-card-footer">
        {intg.comingSoon ? (
          <button className="secondary-button" disabled style={{ opacity: 0.55, fontSize: 13 }}>
            Coming soon
          </button>
        ) : connected ? (
          <button className="ghost-button" style={{ fontSize: 13 }} onClick={() => onToggle(intg.key)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
            Disconnect
          </button>
        ) : (
          <button className="primary-button" style={{ fontSize: 13 }} onClick={() => onToggle(intg.key)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
            Connect
          </button>
        )}
        {connected && (
          <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            Active & syncing
          </span>
        )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const toast = useToast();
  const [connections, setConnections] = useState({ google_calendar: false, zoom: false, google_meet: false });
  const [category, setCategory] = useState("all");
  const [embedTab, setEmbedTab] = useState("iframe");
  const [embedCopied, setEmbedCopied] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookSaved, setWebhookSaved] = useState(false);
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingLinkSaved, setMeetingLinkSaved] = useState(false);

  const demoApiKey = "sk_live_shopper_••••••••••••••••••••••";
  const realApiKey = "sk_live_shopper_d4f8a9b2c1e3f70512abc98765def321";

  function toggleConnection(key) {
    const next = !connections[key];
    setConnections((c) => ({ ...c, [key]: next }));
    const name = INTEGRATIONS.find((i) => i.key === key)?.name || key;
    if (next) toast.success(`${name} connected! (demo mode)`);
    else toast.info(`${name} disconnected.`);
  }

  const filtered = category === "all"
    ? INTEGRATIONS
    : INTEGRATIONS.filter((i) => i.category === category);

  const connectedCount = Object.values(connections).filter(Boolean).length;

  const iframeCode = `<iframe
  src="${APP_ORIGIN}/book/your-event-slug"
  width="100%"
  height="700"
  frameborder="0"
  style="border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.12);"
></iframe>`;

  const floatingCode = `<script>
  window.__SHOPPER__={slug:'your-event-slug',origin:'${APP_ORIGIN}'};
  (function(d,s,id){
    var js,fjs=d.getElementsByTagName(s)[0];
    if(d.getElementById(id))return;
    js=d.createElement(s);js.id=id;
    js.src='${APP_ORIGIN}/widget.js';
    fjs.parentNode.insertBefore(js,fjs);
  }(document,'script','shopper-widget'));
</script>`;

  function copyEmbed() {
    const code = embedTab === "iframe" ? iframeCode : floatingCode;
    navigator.clipboard.writeText(code);
    setEmbedCopied(true);
    toast.success("Code copied!");
    setTimeout(() => setEmbedCopied(false), 2000);
  }

  function copyApiKey() {
    navigator.clipboard.writeText(realApiKey);
    setApiKeyCopied(true);
    toast.success("API key copied!");
    setTimeout(() => setApiKeyCopied(false), 2000);
  }

  return (
    <div className="stack">
      {/* Connection summary */}
      <div className="four-col" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[
          { label: "Available", value: INTEGRATIONS.filter((i) => !i.comingSoon).length, icon: "🔌", color: "var(--accent)" },
          { label: "Connected", value: connectedCount, icon: "✅", color: "var(--success)" },
          { label: "Coming soon", value: INTEGRATIONS.filter((i) => i.comingSoon).length, icon: "🚀", color: "var(--warning)" },
        ].map((s) => (
          <div key={s.label} className="stat-card">
            <div className="stat-emoji">{s.icon}</div>
            <strong style={{ color: s.color, fontSize: "1.8rem", fontWeight: 800, letterSpacing: "-0.04em" }}>{s.value}</strong>
            <span className="stat-label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Integrations grid */}
      <SectionCard
        title="Apps & services"
        subtitle="Connect your favourite tools to automate your workflow"
      >
        {/* Category filter */}
        <div className="intg-filter-row">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              className={`intg-filter-chip ${category === c.key ? "active" : ""}`}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="intg-grid">
          {filtered.map((intg) => (
            <IntegrationCard
              key={intg.key}
              intg={intg}
              connected={!!connections[intg.key]}
              onToggle={toggleConnection}
            />
          ))}
        </div>
      </SectionCard>

      {/* Default meeting link */}
      <SectionCard
        title="Default Meeting Link"
        subtitle="Fallback meeting URL used when no video integration is connected"
      >
        <form
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          onSubmit={(e) => { e.preventDefault(); setMeetingLinkSaved(true); toast.success("Saved!"); }}
        >
          <label>
            Meeting URL
            <input
              type="url"
              placeholder="https://zoom.us/j/your-personal-room"
              value={meetingLink}
              onChange={(e) => { setMeetingLink(e.target.value); setMeetingLinkSaved(false); }}
            />
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={!meetingLink.trim()}>
              {meetingLinkSaved ? "Saved ✓" : "Save link"}
            </button>
          </div>
        </form>
        <div className="intg-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          This URL is included in every booking confirmation email when no auto-generated link is available.
        </div>
      </SectionCard>

      {/* Embed widget */}
      <SectionCard title="Embed Widget" subtitle="Add your booking page to any website in seconds">
        <div className="intg-embed-tabs">
          <button
            type="button"
            className={`intg-embed-tab ${embedTab === "iframe" ? "active" : ""}`}
            onClick={() => setEmbedTab("iframe")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
            </svg>
            Inline embed
            <span className="intg-badge intg-badge-popular" style={{ fontSize: 10 }}>Recommended</span>
          </button>
          <button
            type="button"
            className={`intg-embed-tab ${embedTab === "floating" ? "active" : ""}`}
            onClick={() => setEmbedTab("floating")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Floating widget
          </button>
        </div>

        <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
          {embedTab === "iframe"
            ? "Paste this inside your page HTML where you want the booking calendar to appear."
            : "Add this before </body> — a floating 'Book now' button appears in the bottom corner."}
        </p>

        <div className="code-block" style={{ maxHeight: 180 }}>
          <pre style={{ margin: 0, fontSize: 12.5, padding: "14px 18px", overflowX: "auto", lineHeight: 1.7 }}>
            {embedTab === "iframe" ? iframeCode : floatingCode}
          </pre>
          <button className="code-copy-btn" onClick={copyEmbed}>
            {embedCopied
              ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg> Copied</>
              : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy</>
            }
          </button>
        </div>
      </SectionCard>

      {/* API access */}
      <SectionCard title="API Access" subtitle="Build custom integrations with the Shopper REST API">
        <div
          style={{
            padding: "var(--space-4)",
            background: "var(--surface-muted)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--border)",
            marginBottom: "var(--space-4)",
          }}
        >
          <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Secret API key
          </p>
          <div className="share-url-box" style={{ marginBottom: 0 }}>
            <span className="share-url-text" style={{ letterSpacing: "0.04em" }}>{demoApiKey}</span>
            <button className="icon-button" onClick={copyApiKey} style={{ borderRadius: 0, borderLeft: "1px solid var(--border)", minHeight: 42 }}>
              {apiKeyCopied ? "Copied ✓" : "Reveal & copy"}
            </button>
          </div>
          <p className="field-hint" style={{ marginTop: 10 }}>
            Keep this secret. Never expose it in client-side code.
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "var(--space-3)",
          }}
        >
          {[
            { method: "GET", path: "/api/event-types", desc: "List all event types" },
            { method: "POST", path: "/api/event-types", desc: "Create an event type" },
            { method: "GET", path: "/api/bookings", desc: "List all bookings" },
            { method: "GET", path: "/api/summary", desc: "Dashboard summary stats" },
          ].map((ep) => (
            <div
              key={ep.path}
              style={{
                padding: "10px 14px",
                background: "var(--surface-solid)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                display: "flex", flexDirection: "column", gap: 5,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: "0.05em",
                  padding: "2px 7px", borderRadius: 4,
                  background: ep.method === "GET" ? "var(--success-bg)" : "var(--accent-soft)",
                  color: ep.method === "GET" ? "var(--success)" : "var(--accent)",
                }}>
                  {ep.method}
                </span>
                <code style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: "var(--text-muted)" }}>
                  {ep.path}
                </code>
              </div>
              <span style={{ fontSize: 12, color: "var(--text-subtle)" }}>{ep.desc}</span>
            </div>
          ))}
        </div>

        <div className="intg-hint" style={{ marginTop: "var(--space-4)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Pass your key as <code style={{ fontFamily: "ui-monospace,monospace", fontSize: 12 }}>Authorization: Bearer sk_live_...</code> in request headers.
        </div>
      </SectionCard>

      {/* Webhooks */}
      <SectionCard title="Webhooks" subtitle="Receive real-time booking events on your own server">
        <form
          style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          onSubmit={(e) => { e.preventDefault(); setWebhookSaved(true); toast.success("Webhook saved! (demo mode)"); }}
        >
          <label>
            Endpoint URL
            <input
              type="url"
              placeholder="https://your-server.com/hooks/shopper"
              value={webhookUrl}
              onChange={(e) => { setWebhookUrl(e.target.value); setWebhookSaved(false); }}
            />
            <p className="field-hint">We'll POST a JSON payload to this URL for every selected event.</p>
          </label>
          <div className="button-row">
            <button type="submit" className="primary-button" disabled={!webhookUrl.trim()}>
              {webhookSaved ? "Saved ✓" : "Save webhook"}
            </button>
            {webhookSaved && (
              <button type="button" className="secondary-button" onClick={() => toast.success("Test ping sent!")}>
                Send test ping
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: "var(--space-5)" }}>
          <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            Events dispatched
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-2)" }}>
            {[
              { event: "booking.confirmed", desc: "New booking made" },
              { event: "booking.cancelled", desc: "Booking cancelled" },
              { event: "booking.rescheduled", desc: "Time changed" },
              { event: "booking.reminder", desc: "Before meeting" },
            ].map((e) => (
              <div
                key={e.event}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 14px",
                  background: "var(--surface-muted)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: webhookSaved ? "var(--success)" : "var(--border-strong)",
                  flexShrink: 0,
                }} />
                <div>
                  <code style={{ fontSize: 11.5, fontFamily: "ui-monospace,monospace", color: "var(--accent)", display: "block" }}>{e.event}</code>
                  <span style={{ fontSize: 11.5, color: "var(--text-subtle)" }}>{e.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
