import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const APP_ORIGIN = typeof window !== "undefined" ? window.location.origin : "https://shopper.app";

// ─── Brand icons ────────────────────────────────────────────────────────────
const ICON_COLORS = {
  google_calendar: "#4285F4", outlook: "#0078D4", apple_calendar: "#555",
  zoom: "#2D8CFF", google_meet: "#00897B", teams: "#6264A7", webex: "#00BCEB",
  slack: "#4A154B", discord: "#5865F2", teams_notify: "#6264A7",
  zapier: "#FF4A00", make: "#6D4AFF", n8n: "#EA4B71",
  hubspot: "#FF7A59", salesforce: "#00A1E0", pipedrive: "#172B4D",
  notion: "#000", airtable: "#FCB400", linear: "#5E6AD2",
  stripe: "#635BFF", google_analytics: "#E37400", twilio: "#F22F46",
};

function IntegrationIcon({ intKey, size = 40 }) {
  const bg = ICON_COLORS[intKey] || "#6366f1";
  const icons = {
    google_calendar: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18" />
      </svg>
    ),
    outlook: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M8 14h.01M12 14h.01" />
      </svg>
    ),
    apple_calendar: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M12 14v4M10 16h4" />
      </svg>
    ),
    zoom: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
      </svg>
    ),
    google_meet: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /><circle cx="8" cy="12" r="2" />
      </svg>
    ),
    teams: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    webex: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" /><path d="M5 12h5M7 10v4" />
      </svg>
    ),
    slack: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z" />
        <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
        <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z" />
        <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z" />
        <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z" />
        <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z" />
        <path d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z" />
        <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z" />
      </svg>
    ),
    discord: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h.01M15 12h.01" />
        <path d="M8 19l-3 3v-3H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2v3l-3-3H8z" />
      </svg>
    ),
    zapier: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    make: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" /><circle cx="4" cy="6" r="2" /><circle cx="20" cy="6" r="2" /><circle cx="4" cy="18" r="2" /><circle cx="20" cy="18" r="2" />
        <line x1="6" y1="6" x2="10" y2="10" /><line x1="18" y1="6" x2="14" y2="10" /><line x1="6" y1="18" x2="10" y2="14" /><line x1="18" y1="18" x2="14" y2="14" />
      </svg>
    ),
    n8n: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    hubspot: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><circle cx="19" cy="11" r="3" />
      </svg>
    ),
    salesforce: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    pipedrive: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
      </svg>
    ),
    notion: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" />
      </svg>
    ),
    airtable: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="8" height="5" rx="1" /><rect x="13" y="3" width="8" height="5" rx="1" /><rect x="3" y="10" width="8" height="5" rx="1" /><rect x="13" y="10" width="8" height="5" rx="1" /><rect x="3" y="17" width="8" height="4" rx="1" /><rect x="13" y="17" width="8" height="4" rx="1" />
      </svg>
    ),
    linear: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 8l4 4-4 4-4-4 4-4z" />
      </svg>
    ),
    stripe: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    google_analytics: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    twilio: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.36 12 19.79 19.79 0 0 1 1.21 3.44 2 2 0 0 1 3.18 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 16z" />
      </svg>
    ),
    teams_notify: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  };
  return (
    <div className="integration-icon" style={{ background: bg, width: size, height: size }}>
      {icons[intKey] || (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
        </svg>
      )}
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────
const WEBHOOK_KEYS = new Set(["slack", "discord", "teams_notify"]);
const VIDEO_URL_KEYS = new Set(["zoom", "teams", "webex"]);

const INTEGRATIONS = [
  { key: "google_calendar", name: "Google Calendar", category: "calendar", status: "ready", highlight: "Most popular", tagline: "Sync confirmed bookings with your Google Calendar.", description: "Every confirmed meeting automatically appears on your calendar. Prevent overlaps and keep your schedule in one place without manual sync.", outcomes: ["Sync confirmed meetings automatically", "Prevent overlap with your calendar", "Keep guest bookings in one timeline"] },
  { key: "outlook", name: "Microsoft Outlook", category: "calendar", status: "ready", tagline: "Keep Outlook calendar up to date with every booking.", description: "Push new, cancelled, and rescheduled meetings into Outlook so your availability is always accurate across the Microsoft ecosystem.", outcomes: ["Automatic calendar entries", "Works with Microsoft 365", "Syncs cancellations and reschedules"] },
  { key: "apple_calendar", name: "Apple Calendar / iCal", category: "calendar", status: "ready", tagline: "Subscribe to a live iCal feed of your bookings.", description: "Get a live iCal feed URL for your confirmed bookings. Subscribe once in Apple Calendar, Google Calendar, or Outlook and it stays in sync automatically.", outcomes: ["Live iCal feed URL", "Works on iPhone, Mac, and any iCal app", "No manual export — subscribe once"] },
  { key: "zoom", name: "Zoom", category: "video", status: "ready", highlight: "Fast setup", tagline: "Set your Zoom room URL for every booking.", description: "Save your personal Zoom meeting room link and it will be included in all confirmation emails automatically.", outcomes: ["Meeting link in confirmation emails", "One-click join for guests", "No per-meeting creation needed"] },
  { key: "google_meet", name: "Google Meet", category: "video", status: "ready", tagline: "Default video layer for Google-first teams.", description: "Mark Google Meet as your video provider so auto-generated Meet links are included in booking confirmations.", outcomes: ["Works with Google Workspace", "Links auto-generated per booking", "Pairs well with Google Calendar"] },
  { key: "teams", name: "Microsoft Teams", category: "video", status: "ready", tagline: "Set your Teams meeting URL for bookings.", description: "Save your Teams meeting room URL and include it in booking confirmation emails for enterprise video.", outcomes: ["Teams link in confirmation emails", "Works with Microsoft 365", "No per-meeting provisioning needed"] },
  { key: "webex", name: "Cisco Webex", category: "video", status: "soon", tagline: "Create Webex spaces for each meeting.", description: "Automatically provision Webex rooms for enterprise clients who prefer Cisco's video infrastructure.", outcomes: ["One Webex room per booking", "Enterprise-grade video", "Link in confirmation flow"] },
  { key: "slack", name: "Slack", category: "notifications", status: "ready", tagline: "Send booking alerts directly to Slack channels.", description: "Post a message to any Slack channel via incoming webhook when a booking is created, cancelled, or rescheduled.", outcomes: ["Post alerts in channels", "Route changes to ops teams", "Reduce missed dashboard updates"] },
  { key: "discord", name: "Discord", category: "notifications", status: "ready", tagline: "Send booking notifications to Discord servers.", description: "Configure an incoming webhook URL to push booking events into Discord channels — useful for teams that coordinate on Discord.", outcomes: ["Webhook-based alerts", "Custom message format", "Works on any Discord server"] },
  { key: "teams_notify", name: "Teams Notifications", category: "notifications", status: "ready", tagline: "Alert your team via Microsoft Teams messages.", description: "Send messages to Teams channels via incoming webhook when bookings change so scheduling stays visible inside your hub.", outcomes: ["Rich message format", "Configurable channels", "Works alongside Teams video"] },
  { key: "zapier", name: "Zapier", category: "automation", status: "soon", tagline: "Connect Shopper to 6,000+ apps via Zaps.", description: "Use booking events to update spreadsheets, CRMs, task boards, and internal workflows — no code required.", outcomes: ["Automate repetitive admin", "Send data to 6,000+ apps", "Trigger on booking changes"] },
  { key: "make", name: "Make", category: "automation", status: "soon", tagline: "Build visual automation scenarios with booking data.", description: "Use Make (formerly Integromat) to orchestrate multi-step automations triggered by Shopper booking events with powerful branching logic.", outcomes: ["Visual no-code builder", "Advanced branching and filtering", "Handles complex multi-step flows"] },
  { key: "n8n", name: "n8n", category: "automation", status: "soon", tagline: "Self-hosted automation for full data control.", description: "Connect Shopper to any system using n8n's open-source workflow engine. Keep booking data inside your infrastructure.", outcomes: ["Self-hostable", "Open source", "Full control over data routing"] },
  { key: "hubspot", name: "HubSpot", category: "crm", status: "soon", tagline: "Enrich contacts and log meetings in HubSpot.", description: "Sync new bookers to HubSpot as contacts and log each meeting as an activity so your sales pipeline stays accurate.", outcomes: ["Sync new contacts automatically", "Log meetings as activities", "Connect bookings to deals"] },
  { key: "salesforce", name: "Salesforce", category: "crm", status: "soon", tagline: "Push booking activity into Salesforce records.", description: "Create or update Salesforce contacts and opportunities when bookings are confirmed, keeping your CRM data fresh.", outcomes: ["Contact creation on booking", "Opportunity enrichment", "Works with Lightning and Classic"] },
  { key: "pipedrive", name: "Pipedrive", category: "crm", status: "soon", tagline: "Link meetings to deals and contacts in Pipedrive.", description: "Automatically log booking activity in Pipedrive so sales reps always have accurate context before every call.", outcomes: ["Activity logging per booking", "Deal stage tracking", "Contact enrichment"] },
  { key: "notion", name: "Notion", category: "productivity", status: "soon", tagline: "Log bookings into a Notion database.", description: "Append confirmed bookings to a Notion database page so you can manage scheduling context alongside notes and tasks.", outcomes: ["Auto-populate a Notion DB", "Include guest details and links", "Works with any database template"] },
  { key: "airtable", name: "Airtable", category: "productivity", status: "soon", tagline: "Send booking rows into Airtable bases.", description: "Populate an Airtable base with each new booking so ops teams can manage scheduling data alongside spreadsheet workflows.", outcomes: ["Rows added per booking", "Choose target base and table", "Custom field mapping"] },
  { key: "linear", name: "Linear", category: "productivity", status: "soon", tagline: "Create Linear issues when key bookings land.", description: "Automatically open a Linear issue for important meeting types so follow-up tasks exist before the meeting even starts.", outcomes: ["Issue per booking event", "Configurable project and team", "Link meeting URL in issue"] },
  { key: "stripe", name: "Stripe", category: "payments", status: "soon", highlight: "High demand", tagline: "Collect payment before a booking is confirmed.", description: "Require a Stripe payment checkout before a slot is confirmed — useful for paid consultations, workshops, and services.", outcomes: ["Collect payment before confirmation", "Refund on cancellation", "Works with Stripe Checkout"] },
  { key: "google_analytics", name: "Google Analytics", category: "analytics", status: "soon", tagline: "Track booking funnel events in GA4.", description: "Send booking flow events to GA4 to measure conversion through your funnel.", outcomes: ["Funnel event tracking", "GA4 compatible", "Measure OTP and confirmation drop-off"] },
  { key: "twilio", name: "Twilio SMS", category: "notifications", status: "soon", tagline: "Send booking confirmations via SMS.", description: "Deliver booking confirmations and reminder messages to guests via SMS using Twilio.", outcomes: ["SMS confirmations", "Reminder messages before meetings", "International coverage"] },
];

const CATEGORY_FILTERS = [
  { key: "all", label: "All" },
  { key: "calendar", label: "Calendar" },
  { key: "video", label: "Video" },
  { key: "notifications", label: "Notifications" },
  { key: "automation", label: "Automation" },
  { key: "crm", label: "CRM" },
  { key: "productivity", label: "Productivity" },
  { key: "payments", label: "Payments" },
  { key: "analytics", label: "Analytics" },
];

const API_ENDPOINTS = [
  { method: "GET", path: "/api/auth/me", detail: "Return current user profile and extended fields" },
  { method: "PUT", path: "/api/auth/profile", detail: "Update display name, bio, avatar color, booking username" },
  { method: "PUT", path: "/api/auth/change-password", detail: "Change password for email/password accounts" },
  { method: "GET", path: "/api/auth/api-keys", detail: "List API keys (prefix and creation date only)" },
  { method: "POST", path: "/api/auth/api-keys", detail: "Generate a new API key (returned once)" },
  { method: "DELETE", path: "/api/auth/api-keys", detail: "Revoke all API keys" },
  { method: "GET", path: "/api/integrations", detail: "List all connected integrations with config" },
  { method: "POST", path: "/api/integrations/{key}", detail: "Connect or update an integration with config" },
  { method: "DELETE", path: "/api/integrations/{key}", detail: "Disconnect an integration" },
  { method: "POST", path: "/api/integrations/{key}/test", detail: "Send a test webhook payload" },
  { method: "GET", path: "/api/event-types", detail: "List all event types for the authenticated user" },
  { method: "POST", path: "/api/event-types", detail: "Create a new event type with full configuration" },
  { method: "PUT", path: "/api/event-types/{id}", detail: "Update event type fields" },
  { method: "PATCH", path: "/api/event-types/{id}/toggle", detail: "Pause or resume an event type" },
  { method: "POST", path: "/api/event-types/{id}/duplicate", detail: "Clone an event type with a new slug" },
  { method: "GET", path: "/api/bookings", detail: "Fetch bookings — scope: all | upcoming | past" },
  { method: "POST", path: "/api/bookings", detail: "Admin-create a booking for a guest" },
  { method: "PATCH", path: "/api/bookings/{id}/notes", detail: "Update internal notes on a booking" },
  { method: "POST", path: "/api/bookings/{id}/cancel", detail: "Cancel a booking and notify the guest" },
  { method: "POST", path: "/api/bookings/{id}/reschedule", detail: "Move booking to a new available slot" },
  { method: "GET", path: "/api/availability", detail: "Return timezone and weekly availability rules" },
  { method: "PUT", path: "/api/availability", detail: "Update timezone and all weekly rules" },
  { method: "GET", path: "/api/blockouts", detail: "List blocked dates" },
  { method: "POST", path: "/api/blockouts", detail: "Block a specific date with an optional reason" },
  { method: "DELETE", path: "/api/blockouts/{date}", detail: "Remove a blockout date" },
  { method: "GET", path: "/api/summary", detail: "Dashboard-level metrics (event counts, booking counts)" },
  { method: "GET", path: "/api/public/ical/{username}", detail: "Download iCal feed of confirmed bookings (no auth)" },
  { method: "GET", path: "/api/public/event-types/{slug}", detail: "Fetch public event type (no auth)" },
  { method: "GET", path: "/api/public/event-types/{slug}/slots", detail: "Get available slots for a date" },
  { method: "POST", path: "/api/public/event-types/{slug}/book", detail: "Guest creates a booking with OTP token" },
  { method: "POST", path: "/api/public/otp/request", detail: "Send OTP code to guest email" },
  { method: "POST", path: "/api/public/otp/verify", detail: "Verify OTP and return verification token" },
];

const WEBHOOK_EVENTS = [
  { key: "booking.confirmed", label: "Booking confirmed", desc: "Fired when a new booking is created" },
  { key: "booking.cancelled", label: "Booking cancelled", desc: "Fired when a booking is cancelled" },
  { key: "booking.rescheduled", label: "Booking rescheduled", desc: "Fired when a booking start time changes" },
];

const WEBHOOK_FORMATS = [
  { key: "json", label: "Generic JSON" },
  { key: "slack", label: "Slack (text)" },
  { key: "discord", label: "Discord (content)" },
];

// ─── Connection modal ────────────────────────────────────────────────────────
const ICAL_KEYS = new Set(["apple_calendar"]);
const OAUTH_KEYS = new Set(["google_calendar", "outlook", "google_meet"]);

function ConnectModal({ integration, onClose, onSave, bookingUsername }) {
  const isWebhook = WEBHOOK_KEYS.has(integration.key);
  const isVideo = VIDEO_URL_KEYS.has(integration.key);
  const isIcal = ICAL_KEYS.has(integration.key);
  const isOAuth = OAUTH_KEYS.has(integration.key);

  const [urlValue, setUrlValue] = useState("");
  const [format, setFormat] = useState(
    integration.key === "slack" ? "slack" : integration.key === "discord" ? "discord" : "json"
  );
  const [events, setEvents] = useState(new Set(["booking.confirmed", "booking.cancelled", "booking.rescheduled"]));
  const [saving, setSaving] = useState(false);

  function toggleEvent(key) {
    setEvents((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    let config = {};
    if (isWebhook) {
      if (!urlValue.trim()) { setSaving(false); return; }
      config = { webhook_url: urlValue.trim(), format, events: [...events] };
    } else if (isVideo) {
      if (!urlValue.trim()) { setSaving(false); return; }
      config = { video_url: urlValue.trim() };
    }
    await onSave(integration.key, config);
    setSaving(false);
    onClose();
  }

  const icalUrl = bookingUsername ? api.icalUrl(bookingUsername) : null;

  const videoPlaceholders = {
    zoom: "https://zoom.us/j/your-meeting-id",
    teams: "https://teams.microsoft.com/l/meetup-join/…",
    webex: "https://your-org.webex.com/meet/your-room",
  };

  const webhookPlaceholders = {
    slack: "https://hooks.slack.com/services/T00000000/B00000000/xxxx",
    discord: "https://discord.com/api/webhooks/0000000000/xxxx",
    teams_notify: "https://your-org.webhook.office.com/webhookb2/xxxx",
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-panel" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <IntegrationIcon intKey={integration.key} size={40} />
            <div>
              <h3 style={{ margin: 0 }}>Connect {integration.name}</h3>
              <p className="modal-subtitle" style={{ margin: 0 }}>{integration.tagline}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {isWebhook && (
            <>
              <label>
                Incoming webhook URL
                <input
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder={webhookPlaceholders[integration.key] || "https://your-domain.com/hooks/booking"}
                  autoFocus
                />
              </label>
              <label style={{ marginTop: "var(--space-3)" }}>
                Message format
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  {WEBHOOK_FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
              </label>
              <div style={{ marginTop: "var(--space-4)" }}>
                <p className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>Subscribe to events</p>
                {WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.key} className="webhook-event-row">
                    <input type="checkbox" checked={events.has(ev.key)} onChange={() => toggleEvent(ev.key)} />
                    <div className="webhook-event-copy">
                      <strong>{ev.label}</strong>
                      <span>{ev.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {isVideo && (
            <label>
              Default meeting room URL
              <input
                type="url"
                value={urlValue}
                onChange={(e) => setUrlValue(e.target.value)}
                placeholder={videoPlaceholders[integration.key] || "https://your-video-url.com/room"}
                autoFocus
              />
              <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 6 }}>
                This URL will be sent to guests in booking confirmation emails.
              </p>
            </label>
          )}

          {isIcal && (
            <div>
              {icalUrl ? (
                <>
                  <p style={{ marginBottom: "var(--space-3)" }}>
                    Subscribe to this URL in any calendar app to receive your confirmed bookings automatically.
                  </p>
                  <div className="booking-url-box" style={{ marginBottom: "var(--space-3)" }}>
                    <code className="booking-url-text" style={{ fontSize: 12 }}>{icalUrl}</code>
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    <strong>Google Calendar:</strong> Other calendars → From URL<br />
                    <strong>Outlook:</strong> Add calendar → From internet<br />
                    <strong>iPhone:</strong> Settings → Calendar → Add account → Other → Add subscribed calendar
                  </p>
                </>
              ) : (
                <p style={{ color: "var(--text-muted)" }}>
                  Set a <strong>booking username</strong> in your <a href="/profile" style={{ color: "var(--accent)" }}>Profile</a> to generate your iCal feed URL.
                </p>
              )}
            </div>
          )}

          {isOAuth && (
            <div>
              <p style={{ marginBottom: "var(--space-3)" }}>
                Full OAuth calendar sync is coming soon. Your booking events will sync automatically once connected.
              </p>
              <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                In the meantime, you can use the <strong>iCal feed</strong> (available in Profile → copy booking URL, then use <code>/api/public/ical/your-username</code>) as a read-only calendar subscription.
              </p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
          {(isWebhook || isVideo) ? (
            <button
              type="button"
              className="primary-button"
              onClick={handleSave}
              disabled={saving || !urlValue.trim()}
            >
              {saving ? <><span className="btn-spinner" />Connecting…</> : "Connect"}
            </button>
          ) : isIcal ? (
            <button type="button" className="primary-button" onClick={onClose}>
              {icalUrl ? "Done" : "Close"}
            </button>
          ) : (
            <button type="button" className="primary-button" onClick={() => { onSave(integration.key, {}); onClose(); }}>
              Mark as connected
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function IntegrationsPage() {
  const toast = useToast();

  const [loadingConnections, setLoadingConnections] = useState(true);
  const [connections, setConnections] = useState({});
  const [modal, setModal] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const [testing, setTesting] = useState(null);

  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [embedTab, setEmbedTab] = useState("iframe");
  const [copiedKey, setCopiedKey] = useState("");

  // Webhook section (generic webhook)
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookFormat, setWebhookFormat] = useState("json");
  const [webhookEvents, setWebhookEvents] = useState(new Set(["booking.confirmed", "booking.cancelled"]));
  const [savingWebhook, setSavingWebhook] = useState(false);

  // API keys
  const [apiKeyData, setApiKeyData] = useState(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [revokingKey, setRevokingKey] = useState(false);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [existingKeyPrefix, setExistingKeyPrefix] = useState(null);

  const [apiSearch, setApiSearch] = useState("");

  // Booking username for iCal URL
  const [bookingUsername, setBookingUsername] = useState("");

  // Load integrations + API keys + profile on mount
  useEffect(() => {
    async function load() {
      try {
        const [intList, me] = await Promise.all([api.getIntegrations(), api.getMe()]);
        const map = {};
        for (const i of intList) {
          map[i.key] = i;
        }
        setConnections(map);
        setBookingUsername(me.booking_username || "");

        // Pre-populate webhook section from generic_webhook integration
        const gw = map["generic_webhook"];
        if (gw?.config) {
          setWebhookUrl(gw.config.webhook_url || "");
          setWebhookFormat(gw.config.format || "json");
          setWebhookEvents(new Set(gw.config.events || ["booking.confirmed", "booking.cancelled"]));
        }
      } catch (err) {
        toast.error(err.message || "Could not load integrations.");
      } finally {
        setLoadingConnections(false);
      }
    }

    async function loadKeys() {
      try {
        const keys = await api.getApiKeys();
        if (keys.length > 0) {
          setExistingKeyPrefix(keys[0].prefix);
        }
      } catch {
        // ignore
      } finally {
        setLoadingKeys(false);
      }
    }

    load();
    loadKeys();
  }, [toast]);

  const filteredIntegrations = useMemo(() => {
    let list = category === "all" ? INTEGRATIONS : INTEGRATIONS.filter((i) => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.name.toLowerCase().includes(q) || i.tagline.toLowerCase().includes(q) || i.category.includes(q));
    }
    return list;
  }, [category, search]);

  const connectedList = INTEGRATIONS.filter((i) => connections[i.key]);
  const connectedCount = connectedList.length;
  const readyCount = INTEGRATIONS.filter((i) => i.status === "ready").length;
  const soonCount = INTEGRATIONS.filter((i) => i.status === "soon").length;

  const filteredApiEndpoints = useMemo(() => {
    if (!apiSearch.trim()) return API_ENDPOINTS;
    const q = apiSearch.toLowerCase();
    return API_ENDPOINTS.filter((e) => e.path.toLowerCase().includes(q) || e.detail.toLowerCase().includes(q) || e.method.toLowerCase().includes(q));
  }, [apiSearch]);

  async function handleConnectSave(key, config) {
    try {
      await api.saveIntegration(key, config);
      setConnections((prev) => ({ ...prev, [key]: { key, config, connected_at: new Date().toISOString() } }));
      toast.success(`${INTEGRATIONS.find((i) => i.key === key)?.name || key} connected.`);
    } catch (err) {
      toast.error(err.message || "Could not connect integration.");
    }
  }

  async function handleDisconnect(key) {
    setDisconnecting(key);
    try {
      await api.disconnectIntegration(key);
      setConnections((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success(`${INTEGRATIONS.find((i) => i.key === key)?.name || key} disconnected.`);
    } catch (err) {
      toast.error(err.message || "Could not disconnect.");
    } finally {
      setDisconnecting(null);
    }
  }

  function handleCardConnect(integration) {
    if (connections[integration.key]) {
      handleDisconnect(integration.key);
    } else {
      setModal(integration);
    }
  }

  async function handleTestWebhook(key) {
    setTesting(key);
    try {
      await api.testIntegration(key);
      toast.success("Test payload sent.");
    } catch (err) {
      toast.error(err.message || "Test failed.");
    } finally {
      setTesting(null);
    }
  }

  async function handleSaveWebhook() {
    if (!webhookUrl.trim()) { toast.error("Enter a webhook URL."); return; }
    if (webhookEvents.size === 0) { toast.error("Subscribe to at least one event."); return; }
    setSavingWebhook(true);
    try {
      const config = { webhook_url: webhookUrl.trim(), format: webhookFormat, events: [...webhookEvents] };
      await api.saveIntegration("generic_webhook", config);
      setConnections((prev) => ({ ...prev, generic_webhook: { key: "generic_webhook", config, connected_at: new Date().toISOString() } }));
      toast.success(`Webhook saved — ${webhookEvents.size} event${webhookEvents.size !== 1 ? "s" : ""} subscribed.`);
    } catch (err) {
      toast.error(err.message || "Could not save webhook.");
    } finally {
      setSavingWebhook(false);
    }
  }

  async function handleGenerateApiKey() {
    setGeneratingKey(true);
    try {
      const result = await api.generateApiKey();
      setApiKeyData(result);
      setExistingKeyPrefix(result.prefix);
      setShowApiKey(true);
      toast.success("API key generated. Copy it now — it won't be shown again.");
    } catch (err) {
      toast.error(err.message || "Could not generate API key.");
    } finally {
      setGeneratingKey(false);
    }
  }

  async function handleRevokeApiKey() {
    setRevokingKey(true);
    try {
      await api.revokeApiKey();
      setApiKeyData(null);
      setExistingKeyPrefix(null);
      setShowApiKey(false);
      toast.success("API key revoked.");
    } catch (err) {
      toast.error(err.message || "Could not revoke API key.");
    } finally {
      setRevokingKey(false);
    }
  }

  function copyValue(value, key) {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    toast.success("Copied to clipboard.");
    window.setTimeout(() => setCopiedKey(""), 1800);
  }

  function toggleWebhookEvent(key) {
    setWebhookEvents((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  const iframeCode = `<iframe\n  src="${APP_ORIGIN}/book/your-event-slug"\n  width="100%"\n  height="720"\n  style="border:none;border-radius:24px;"\n></iframe>`;
  const floatingCode = `<!-- Add before </body> -->\n<script>\n  window.__SHOPPER__ = {\n    slug: "your-event-slug",\n    origin: "${APP_ORIGIN}",\n    buttonLabel: "Book a time",\n    buttonColor: "#d06132"\n  };\n</script>\n<script src="${APP_ORIGIN}/embed/widget.js" async></script>`;
  const popupCode = `<!-- Trigger on any button -->\n<button onclick="Shopper.open('your-event-slug')">Book a time</button>\n<script src="${APP_ORIGIN}/embed/popup.js" async></script>`;
  const embedCodes = { iframe: iframeCode, floating: floatingCode, popup: popupCode };

  const webhookPayloadExample = `{\n  "event": "booking.confirmed",\n  "booker_name": "Priya Sharma",\n  "booker_email": "priya@example.com",\n  "event_title": "Discovery call",\n  "start_time": "Monday, May 12, 2026 at 10:00 AM",\n  "meeting_url": "https://meet.jit.si/shopper-abc123",\n  "notes": ""\n}`;

  const methodClass = (m) => ({ GET: "get", POST: "post", PUT: "put", PATCH: "patch", DELETE: "delete" }[m] || "get");

  const displayKey = apiKeyData?.key;
  const displayPrefix = apiKeyData?.prefix || existingKeyPrefix;

  return (
    <div className="stack">
      {modal && (
        <ConnectModal
          integration={modal}
          onClose={() => setModal(null)}
          onSave={handleConnectSave}
          bookingUsername={bookingUsername}
        />
      )}

      {/* Hero */}
      <section className="integrations-hero">
        <div className="integrations-hero-copy">
          <p className="eyebrow">Connected systems</p>
          <h3>Turn Shopper into the hub of your scheduling stack.</h3>
          <p>
            Calendar sync, video rooms, internal alerts, webhooks, an iCal feed, and a full REST API — everything needed to make bookings work inside your existing tools.
          </p>
        </div>
        <div className="integrations-hero-stats">
          {[
            { label: "Total integrations", value: INTEGRATIONS.length },
            { label: "Ready now", value: readyCount },
            { label: "Connected", value: loadingConnections ? "…" : connectedCount },
            { label: "Coming soon", value: soonCount },
          ].map((item) => (
            <div key={item.label} className="integrations-hero-card">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      {/* iCal feed notice */}
      {bookingUsername && (
        <SectionCard title="iCal feed" subtitle="Subscribe to your confirmed bookings in any calendar app.">
          <div className="booking-url-box" style={{ marginBottom: "var(--space-3)" }}>
            <code className="booking-url-text">{api.icalUrl(bookingUsername)}</code>
            <button className="secondary-button" onClick={() => copyValue(api.icalUrl(bookingUsername), "ical")}>
              {copiedKey === "ical" ? "Copied!" : "Copy URL"}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Use this URL in Google Calendar (Other calendars → From URL), Outlook (Add calendar → From internet), or iPhone (Settings → Calendar → Add account → Other → Add subscribed calendar).
          </p>
        </SectionCard>
      )}

      {/* Connected overview */}
      {!loadingConnections && connectedCount > 0 && (
        <SectionCard title="Active connections" subtitle={`${connectedCount} integration${connectedCount !== 1 ? "s" : ""} connected to your account.`}>
          <div className="integrations-connected-grid">
            {connectedList.map((integration) => {
              const isWebhookType = connections[integration.key]?.type === "webhook" || WEBHOOK_KEYS.has(integration.key);
              return (
                <div key={integration.key} className="integrations-connected-card">
                  <IntegrationIcon intKey={integration.key} size={40} />
                  <div className="integrations-connected-info">
                    <strong>{integration.name}</strong>
                    <span>{integration.tagline}</span>
                  </div>
                  <div className="integrations-connected-actions">
                    <span className="integrations-tag success">Active</span>
                    {isWebhookType && (
                      <button
                        type="button"
                        className="ghost-button"
                        style={{ minHeight: 32, padding: "4px 12px", fontSize: 12.5 }}
                        onClick={() => handleTestWebhook(integration.key)}
                        disabled={testing === integration.key}
                      >
                        {testing === integration.key ? <><span className="btn-spinner" />Testing…</> : "Test"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="ghost-button danger"
                      style={{ minHeight: 32, padding: "4px 12px", fontSize: 12.5 }}
                      onClick={() => handleDisconnect(integration.key)}
                      disabled={disconnecting === integration.key}
                    >
                      {disconnecting === integration.key ? <><span className="btn-spinner" />…</> : "Disconnect"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Integration library */}
      <SectionCard title="Integration library" subtitle={`${INTEGRATIONS.length} integrations across ${CATEGORY_FILTERS.length - 1} categories.`}>
        <div className="integrations-library-toolbar">
          <div className="integrations-filter-row">
            {CATEGORY_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`integrations-filter-chip ${category === filter.key ? "active" : ""}`}
                onClick={() => setCategory(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="integrations-search-wrap">
            <svg className="integrations-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="integrations-search-input"
              placeholder="Search integrations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button className="search-clear" onClick={() => setSearch("")} aria-label="Clear">×</button>
            )}
          </div>
        </div>

        {filteredIntegrations.length === 0 ? (
          <div className="chart-empty">No integrations match "{search}".</div>
        ) : (
          <div className="integrations-library-grid integrations-library-grid-3">
            {filteredIntegrations.map((integration) => {
              const connected = Boolean(connections[integration.key]);
              const isSoon = integration.status === "soon";
              const isDisconnecting = disconnecting === integration.key;

              return (
                <article key={integration.key} className={`integrations-library-card ${connected ? "connected" : ""}`}>
                  <div className="integrations-library-top">
                    <div className="integrations-card-header">
                      <IntegrationIcon intKey={integration.key} size={44} />
                      <div>
                        <div className="integrations-library-badges">
                          {integration.highlight && <span className="integrations-tag warm">{integration.highlight}</span>}
                          {isSoon && <span className="integrations-tag muted">Coming soon</span>}
                          {connected && <span className="integrations-tag success">Connected</span>}
                        </div>
                        <h4>{integration.name}</h4>
                      </div>
                    </div>
                  </div>

                  <p className="integrations-library-card-tagline">{integration.tagline}</p>
                  <p className="integrations-library-description">{integration.description}</p>

                  <div className="integrations-outcome-list">
                    {integration.outcomes.map((item) => (
                      <div key={item} className="integrations-outcome-row">
                        <span className="integrations-outcome-dot" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="integrations-library-footer">
                    {isSoon ? (
                      <button type="button" className="secondary-button" style={{ width: "100%", opacity: 0.6 }} disabled>
                        Coming soon
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={connected ? "ghost-button" : "primary-button"}
                        style={{ width: "100%" }}
                        onClick={() => handleCardConnect(integration)}
                        disabled={isDisconnecting}
                      >
                        {isDisconnecting ? <><span className="btn-spinner" />Disconnecting…</> : connected ? "Disconnect" : "Connect"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Embed + Webhook side by side */}
      <div className="integrations-two-col">
        <SectionCard title="Embed your booking page" subtitle="Put Shopper inside your own site.">
          <div className="integrations-embed-tabs">
            {[{ key: "iframe", label: "Inline iframe" }, { key: "floating", label: "Floating widget" }, { key: "popup", label: "Popup button" }].map((t) => (
              <button key={t.key} type="button" className={`integrations-embed-tab ${embedTab === t.key ? "active" : ""}`} onClick={() => setEmbedTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="integrations-embed-hint">
            Replace <code className="integrations-inline-code">your-event-slug</code> with your real event URL slug from the Dashboard.
          </div>
          <div className="integrations-code-card">
            <pre>{embedCodes[embedTab]}</pre>
          </div>
          <div className="button-row" style={{ marginTop: "var(--space-4)" }}>
            <button type="button" className="primary-button" onClick={() => copyValue(embedCodes[embedTab], "embed")}>
              {copiedKey === "embed" ? "Copied!" : "Copy code"}
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Webhook endpoint" subtitle="Receive real-time booking events on your server.">
          <label>
            Endpoint URL
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://your-domain.com/hooks/shopper"
            />
          </label>

          <label style={{ marginTop: "var(--space-3)" }}>
            Message format
            <select value={webhookFormat} onChange={(e) => setWebhookFormat(e.target.value)}>
              {WEBHOOK_FORMATS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </label>

          <div className="integrations-webhook-events">
            <p className="eyebrow" style={{ marginBottom: "var(--space-3)" }}>Subscribe to events</p>
            {WEBHOOK_EVENTS.map((ev) => (
              <label key={ev.key} className="webhook-event-row">
                <input
                  type="checkbox"
                  checked={webhookEvents.has(ev.key)}
                  onChange={() => toggleWebhookEvent(ev.key)}
                />
                <div className="webhook-event-copy">
                  <strong>{ev.label}</strong>
                  <span>{ev.desc}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="button-row" style={{ marginTop: "var(--space-4)" }}>
            <button
              type="button"
              className="primary-button"
              disabled={savingWebhook || !webhookUrl.trim() || webhookEvents.size === 0}
              onClick={handleSaveWebhook}
            >
              {savingWebhook ? <><span className="btn-spinner" />Saving…</> : connections["generic_webhook"] ? "Update webhook" : "Save webhook"}
            </button>
            {connections["generic_webhook"] && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => handleTestWebhook("generic_webhook")}
                disabled={testing === "generic_webhook"}
              >
                {testing === "generic_webhook" ? <><span className="btn-spinner" />Testing…</> : "Send test"}
              </button>
            )}
            <button type="button" className="secondary-button" onClick={() => copyValue(webhookPayloadExample, "webhook")}>
              {copiedKey === "webhook" ? "Copied!" : "Sample payload"}
            </button>
          </div>

          <div className="integrations-code-card compact" style={{ marginTop: "var(--space-4)" }}>
            <pre>{webhookPayloadExample}</pre>
          </div>
        </SectionCard>
      </div>

      {/* API Key Management */}
      <SectionCard title="API key" subtitle="Authenticate direct requests to the Shopper REST API.">
        <div className="integrations-apikey-section">
          {loadingKeys ? (
            <div className="integrations-apikey-empty">
              <div className="integrations-apikey-icon"><span className="btn-spinner" style={{ width: 24, height: 24 }} /></div>
              <div><p>Loading…</p></div>
            </div>
          ) : displayKey || existingKeyPrefix ? (
            <>
              <div className="integrations-apikey-row">
                <code className="integrations-apikey-value">
                  {displayKey && showApiKey
                    ? displayKey
                    : (displayPrefix || "sk_live_") + "••••••••••••••••••••••••"}
                </code>
                <div className="integrations-apikey-actions">
                  {displayKey && (
                    <button type="button" className="secondary-button" style={{ minHeight: 36, padding: "6px 14px", fontSize: 13 }} onClick={() => setShowApiKey((v) => !v)}>
                      {showApiKey ? "Hide" : "Reveal"}
                    </button>
                  )}
                  {displayKey && showApiKey && (
                    <button type="button" className="secondary-button" style={{ minHeight: 36, padding: "6px 14px", fontSize: 13 }} onClick={() => copyValue(displayKey, "apikey")}>
                      {copiedKey === "apikey" ? "Copied!" : "Copy"}
                    </button>
                  )}
                  <button type="button" className="ghost-button danger" style={{ minHeight: 36, padding: "6px 14px", fontSize: 13 }} onClick={handleRevokeApiKey} disabled={revokingKey}>
                    {revokingKey ? <><span className="btn-spinner" />Revoking…</> : "Revoke"}
                  </button>
                </div>
              </div>
              {displayKey && <p className="integrations-apikey-warning">Copy your key now. For security, it will not be shown in full after you leave this page.</p>}
              <div className="integrations-code-card compact" style={{ marginTop: "var(--space-4)" }}>
                <pre>{`curl https://shopper-backend-2n4n.onrender.com/api/bookings \\\n  -H "Authorization: Bearer ${displayKey && showApiKey ? displayKey : (displayPrefix || "sk_live_") + "••••••••••••••••••••••••"}" \\\n  -H "Content-Type: application/json"`}</pre>
              </div>
            </>
          ) : (
            <div className="integrations-apikey-empty">
              <div className="integrations-apikey-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <div>
                <strong>No API key</strong>
                <p>Generate a key to authenticate direct requests to the Shopper REST API.</p>
              </div>
              <button type="button" className="primary-button" onClick={handleGenerateApiKey} disabled={generatingKey}>
                {generatingKey ? <><span className="btn-spinner" />Generating…</> : "Generate API key"}
              </button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* API Reference */}
      <SectionCard title="API reference" subtitle={`${API_ENDPOINTS.length} endpoints — REST JSON API with Bearer token auth.`}>
        <input
          className="search-input"
          style={{ width: "100%", marginBottom: "var(--space-4)" }}
          placeholder="Filter endpoints by path or description…"
          value={apiSearch}
          onChange={(e) => setApiSearch(e.target.value)}
        />
        <div className="integrations-api-grid integrations-api-grid-full">
          {filteredApiEndpoints.map((item) => (
            <div key={`${item.method}-${item.path}`} className="integrations-api-card">
              <div className="integrations-api-header">
                <span className={`integrations-method ${methodClass(item.method)}`}>{item.method}</span>
                <code>{item.path}</code>
              </div>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
        <div className="integrations-code-card compact" style={{ marginTop: "var(--space-4)" }}>
          <pre>{`# Authentication\ncurl https://shopper-backend-2n4n.onrender.com/api/bookings \\\n  -H "Authorization: Bearer <your_jwt_or_api_key>"\n\n# All responses return JSON.\n# Errors include a "detail" field with a human-readable message.`}</pre>
        </div>
      </SectionCard>

    </div>
  );
}
