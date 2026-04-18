import { useState } from "react";
import SectionCard from "../components/SectionCard";

const STEPS = [
  {
    id: "event-types",
    icon: "📋",
    title: "Create your first event type",
    color: "#6366f1",
    duration: "~2 min",
    desc: "Event types are your bookable meeting formats. Each one gets a unique shareable link.",
    substeps: [
      { label: "Go to Event Types in the sidebar", detail: "This is your main dashboard — where all your booking pages live." },
      { label: 'Click "Create event type"', detail: "Fill in a title like \"30-min intro call\", set a duration, and pick a color." },
      { label: "Set the URL slug", detail: "This becomes your link: shopper.app/book/your-slug. Keep it short and memorable." },
      { label: "Choose a location type", detail: "Pick Video call (auto-generates a Jitsi link), Phone, In person, or Custom." },
      { label: "Hit Create", detail: "Your booking page is live instantly. Copy the link and share it anywhere." },
    ],
    tips: [
      "Use duration presets (15, 30, 45, 60 min) for quick setup.",
      "Add a description — guests see it before booking.",
      "Set buffer time to give yourself a break between meetings.",
    ],
  },
  {
    id: "availability",
    icon: "⏰",
    title: "Set your availability",
    color: "#8b5cf6",
    duration: "~3 min",
    desc: "Tell Shopper when you're open for bookings. Your guests will only see the slots that work for you.",
    substeps: [
      { label: "Open Availability in the sidebar", detail: "This controls your global working hours across all event types." },
      { label: "Select your timezone", detail: "Crucial — all slots display in your timezone. Guests see their own local time." },
      { label: "Use a quick preset", detail: "Try \"Weekdays 9-5\" or \"Mon–Wed\" presets to fill in your schedule instantly." },
      { label: "Adjust individual days", detail: "Toggle days on/off and set custom start/end times per day." },
      { label: "Block out dates", detail: "Add vacation days or holidays in the Blockout Dates section so nothing gets booked." },
    ],
    tips: [
      "Auto-detect your timezone with the 🌍 button.",
      "Saturday/Sunday are off by default — enable them if needed.",
      "Blockout dates override availability for that entire day.",
    ],
  },
  {
    id: "sharing",
    icon: "🔗",
    title: "Share your booking link",
    color: "#06b6d4",
    duration: "~1 min",
    desc: "Your booking page is already live. Now get it in front of the right people.",
    substeps: [
      { label: "Copy your booking link from Event Types", detail: "Click 'Copy link' on any event card to copy /book/your-slug to clipboard." },
      { label: "Add it to your email signature", detail: "Something like: \"Book a call → shopper.app/book/intro\"." },
      { label: "Share on social media or messaging", detail: "Use the Share button to instantly post on Twitter, LinkedIn, or WhatsApp." },
      { label: "Embed on your website", detail: "Go to Integrations → Embed Widget for the iframe or floating widget code." },
      { label: "Preview your page", detail: "Click Preview on any event card to see exactly what guests will see." },
    ],
    tips: [
      "Add the link to your Linktree, bio, or website header.",
      "Create different event types for different contexts (quick call, deep dive, etc.).",
      "Duplicate an event type to quickly create a variant.",
    ],
  },
  {
    id: "bookings",
    icon: "📬",
    title: "Manage your bookings",
    color: "#10b981",
    duration: "~2 min",
    desc: "Once people start booking, Shopper sends automatic emails and keeps everything organized.",
    substeps: [
      { label: "Open Bookings in the sidebar", detail: "See all upcoming and past meetings at a glance." },
      { label: "Filter by upcoming or past", detail: "Use the scope tabs to focus on what's next or review history." },
      { label: "Search and filter", detail: "Search by guest name, email, or event type instantly." },
      { label: "Cancel or reschedule", detail: "Click Cancel or Reschedule on any booking card — the guest gets notified automatically." },
      { label: "Export to CSV", detail: "Download all bookings as a spreadsheet for reporting or CRM imports." },
    ],
    tips: [
      "Guests receive confirmation emails automatically (if SMTP is configured).",
      "Bulk-cancel multiple bookings with the checkbox + bulk action bar.",
      "Meeting links appear directly on the booking card.",
    ],
  },
  {
    id: "workflows",
    icon: "⚡",
    title: "Automate with Workflows",
    color: "#f59e0b",
    duration: "~3 min",
    desc: "Workflows send automatic emails or webhook payloads when booking events happen — zero manual work.",
    substeps: [
      { label: "Go to Workflows in the sidebar", detail: "You'll see two default workflows already set up: confirmation and 24h reminder." },
      { label: "Create a new workflow", detail: "Click 'New workflow', give it a name, and pick a trigger event." },
      { label: "Choose a trigger", detail: "Options: booking created, 24h before, 1h before, 15min before, after meeting, cancelled, rescheduled." },
      { label: "Set the action", detail: "Send email to guest, send email to host, or fire a webhook to your server." },
      { label: "Customize the email template", detail: "Use {{guest_name}}, {{event_title}}, {{start_time}} variables in the subject and body." },
    ],
    tips: [
      "The 'after meeting' workflow is great for follow-ups and review requests.",
      "Use webhooks to connect with CRMs, Notion, or custom pipelines.",
      "Toggle workflows on/off without deleting them.",
    ],
  },
  {
    id: "integrations",
    icon: "🔌",
    title: "Connect integrations",
    color: "#ec4899",
    duration: "~5 min",
    desc: "Sync your calendar, video tools, and automate across 5,000+ apps.",
    substeps: [
      { label: "Open Integrations in the sidebar", detail: "See all available connections and their current status." },
      { label: "Connect Google Calendar", detail: "Click Connect — this syncs bookings to your Google Calendar and blocks busy times." },
      { label: "Connect Zoom or Google Meet", detail: "Auto-generates a unique meeting link for every confirmed booking." },
      { label: "Add a default meeting link", detail: "Set a fallback URL (e.g. your personal Zoom room) if no integration is connected." },
      { label: "Set up webhooks", detail: "Add your server URL to receive real-time booking events as JSON payloads." },
    ],
    tips: [
      "Use the Embed Widget section to get iframe or script code for your website.",
      "Zapier (coming soon) will connect Shopper to Slack, HubSpot, Notion, and more.",
      "Your API key (in Integrations → API) lets you build custom integrations.",
    ],
  },
];

const FAQ = [
  {
    q: "Do guests need a Shopper account to book?",
    a: "No. Guests just open your booking link, verify their email with a 6-digit code, and pick a time. No sign-up required.",
  },
  {
    q: "What happens when I cancel a booking?",
    a: "Shopper sends an automatic cancellation email to the guest (if SMTP is configured). The slot opens back up immediately.",
  },
  {
    q: "Can I have multiple event types?",
    a: "Yes — unlimited. Create one for every type of meeting you offer: intro calls, demos, consultations, reviews, etc.",
  },
  {
    q: "How does buffer time work?",
    a: "Buffer time adds a gap after each slot. A 30-min meeting with 10-min buffer means the next bookable slot is 40 minutes later.",
  },
  {
    q: "Can I block specific dates?",
    a: "Yes. Go to Availability → Blockout Dates and add any date you want fully blocked (holidays, vacation, etc.).",
  },
  {
    q: "Is there a mobile app?",
    a: "Not yet, but the web app is fully responsive and works great on mobile browsers.",
  },
];

export default function TutorialPage() {
  const [activeStep, setActiveStep] = useState(0);
  const [expandedSubsteps, setExpandedSubsteps] = useState({});
  const [expandedFaq, setExpandedFaq] = useState(null);

  function toggleSubstep(key) {
    setExpandedSubsteps((s) => ({ ...s, [key]: !s[key] }));
  }

  const step = STEPS[activeStep];

  return (
    <div className="tutorial-layout">
      {/* ── Step navigator sidebar ── */}
      <aside className="tutorial-nav-panel">
        <p className="tutorial-nav-title">Getting started</p>
        {STEPS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`tutorial-nav-item ${i === activeStep ? "active" : ""} ${i < activeStep ? "done" : ""}`}
            onClick={() => setActiveStep(i)}
          >
            <span className="tutorial-nav-num">
              {i < activeStep
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                : i + 1}
            </span>
            <span className="tutorial-nav-label">{s.title}</span>
            <span className="tutorial-nav-time">{s.duration}</span>
          </button>
        ))}

        <div className="tutorial-progress-bar">
          <div
            className="tutorial-progress-fill"
            style={{ width: `${((activeStep) / STEPS.length) * 100}%` }}
          />
        </div>
        <p className="tutorial-progress-label">
          Step {activeStep + 1} of {STEPS.length}
        </p>
      </aside>

      {/* ── Main content ── */}
      <div className="tutorial-content">
        {/* Step header */}
        <div className="tutorial-step-header">
          <div
            className="tutorial-step-icon"
            style={{ background: `${step.color}18`, color: step.color, borderColor: `${step.color}30` }}
          >
            {step.icon}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span className="tutorial-step-badge" style={{ background: `${step.color}18`, color: step.color }}>
                Step {activeStep + 1}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-subtle)", fontWeight: 600 }}>
                {step.duration}
              </span>
            </div>
            <h2 className="tutorial-step-title">{step.title}</h2>
            <p className="tutorial-step-desc">{step.desc}</p>
          </div>
        </div>

        {/* Sub-steps */}
        <SectionCard title="Step-by-step" subtitle="Follow these steps in order">
          <div className="tutorial-substeps">
            {step.substeps.map((sub, i) => {
              const key = `${activeStep}-${i}`;
              const isOpen = expandedSubsteps[key];
              return (
                <div key={key} className="tutorial-substep">
                  <button
                    type="button"
                    className="tutorial-substep-btn"
                    onClick={() => toggleSubstep(key)}
                  >
                    <span className="tutorial-substep-num" style={{ background: `${step.color}18`, color: step.color }}>
                      {i + 1}
                    </span>
                    <span className="tutorial-substep-label">{sub.label}</span>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, transition: "transform 200ms", transform: isOpen ? "rotate(180deg)" : "none", color: "var(--text-subtle)" }}
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="tutorial-substep-detail">
                      {sub.detail}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Tips */}
        <SectionCard title="💡 Pro tips" subtitle={`Quick wins for ${step.title.toLowerCase()}`}>
          <ul className="tutorial-tips-list">
            {step.tips.map((tip) => (
              <li key={tip} className="tutorial-tip-item">
                <span className="tutorial-tip-dot" style={{ background: step.color }} />
                {tip}
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Navigation buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 8 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
            disabled={activeStep === 0}
          >
            ← Previous
          </button>
          {activeStep < STEPS.length - 1 ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setActiveStep((s) => s + 1)}
            >
              Next step →
            </button>
          ) : (
            <a href="/dashboard" className="primary-button" style={{ textDecoration: "none" }}>
              🎉 Go to dashboard
            </a>
          )}
        </div>

        {/* FAQ */}
        <SectionCard title="Frequently asked questions" subtitle="Common questions about Shopper">
          <div className="tutorial-faq">
            {FAQ.map((item, i) => (
              <div key={i} className="tutorial-faq-item">
                <button
                  type="button"
                  className="tutorial-faq-btn"
                  onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                >
                  <span>{item.q}</span>
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0, transition: "transform 200ms", transform: expandedFaq === i ? "rotate(180deg)" : "none" }}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {expandedFaq === i && (
                  <p className="tutorial-faq-answer">{item.a}</p>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
