import { useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
];

export default function ProfilePage() {
  const toast = useToast();
  const [profile, setProfile] = useState({
    name: "Alex Johnson",
    username: "alexj",
    bio: "Product designer & startup advisor. Book a time to chat about your project.",
    title: "Product Designer",
    company: "Indie Studio",
    timezone: "Asia/Kolkata",
    website: "",
    twitter: "",
    linkedin: "",
    avatar_color: "#6366f1",
    welcome_message: "Hi there! Looking forward to our conversation. Feel free to add any context in the notes.",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function handleChange(key, value) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    toast.success("Profile updated!");
  }

  const initials = profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  const bookingUrl = `${window.location.origin}/book/${profile.username}`;

  function copyBookingUrl() {
    navigator.clipboard.writeText(bookingUrl);
    toast.success("Booking URL copied!");
  }

  return (
    <div className="page-grid">
      {/* Left: form */}
      <div className="stack">
        <SectionCard title="Public Profile" subtitle="This is what people see when they visit your booking page">
          <form className="form-grid" onSubmit={handleSubmit}>
            {/* Avatar */}
            <div className="full-width avatar-section">
              <div className="avatar-preview" style={{ background: profile.avatar_color }}>
                {initials}
              </div>
              <div>
                <p className="eyebrow" style={{ marginBottom: 8 }}>Avatar color</p>
                <div className="avatar-color-grid">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`avatar-color-dot ${profile.avatar_color === c ? "selected" : ""}`}
                      style={{ background: c }}
                      onClick={() => handleChange("avatar_color", c)}
                      aria-label={`Select color ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label>
              Display name
              <input
                value={profile.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Alex Johnson"
                required
              />
            </label>

            <label>
              Username (booking URL)
              <div className="url-input-wrap">
                <span className="url-prefix">/book/</span>
                <input
                  value={profile.username}
                  onChange={(e) => handleChange("username", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  placeholder="alexj"
                  required
                  className="url-suffix-input"
                />
              </div>
            </label>

            <label>
              Job title
              <input
                value={profile.title}
                onChange={(e) => handleChange("title", e.target.value)}
                placeholder="Product Designer"
              />
            </label>

            <label>
              Company
              <input
                value={profile.company}
                onChange={(e) => handleChange("company", e.target.value)}
                placeholder="Acme Inc."
              />
            </label>

            <label className="full-width">
              Bio
              <textarea
                rows="3"
                value={profile.bio}
                onChange={(e) => handleChange("bio", e.target.value)}
                placeholder="A short description shown on your public booking pages."
              />
            </label>

            <label className="full-width">
              Welcome message
              <textarea
                rows="2"
                value={profile.welcome_message}
                onChange={(e) => handleChange("welcome_message", e.target.value)}
                placeholder="Shown to guests at the top of your booking page."
              />
            </label>

            <label>
              Website
              <input
                type="url"
                value={profile.website}
                onChange={(e) => handleChange("website", e.target.value)}
                placeholder="https://yoursite.com"
              />
            </label>

            <label>
              Twitter / X
              <input
                value={profile.twitter}
                onChange={(e) => handleChange("twitter", e.target.value)}
                placeholder="@handle"
              />
            </label>

            <label>
              LinkedIn
              <input
                value={profile.linkedin}
                onChange={(e) => handleChange("linkedin", e.target.value)}
                placeholder="linkedin.com/in/yourprofile"
              />
            </label>

            <div className="button-row full-width">
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "Saving..." : saved ? "Saved ✓" : "Save profile"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      {/* Right: preview */}
      <div className="stack">
        <SectionCard title="Your Booking URL" subtitle="Share this link with anyone to let them book time with you">
          <div className="booking-url-box">
            <code className="booking-url-text">{bookingUrl}</code>
            <button className="primary-button" onClick={copyBookingUrl}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copy
            </button>
          </div>
        </SectionCard>

        <SectionCard title="Profile Preview" subtitle="How your profile card looks to guests">
          <div className="profile-preview-card">
            <div className="profile-preview-avatar" style={{ background: profile.avatar_color }}>
              {initials}
            </div>
            <h3 className="profile-preview-name">{profile.name || "Your Name"}</h3>
            {profile.title && (
              <p className="profile-preview-title">{profile.title}{profile.company ? ` · ${profile.company}` : ""}</p>
            )}
            {profile.bio && (
              <p className="profile-preview-bio">{profile.bio}</p>
            )}
            {profile.welcome_message && (
              <div className="profile-preview-welcome">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                {profile.welcome_message}
              </div>
            )}
            <div className="profile-preview-links">
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noreferrer" className="profile-link-chip">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Website
                </a>
              )}
              {profile.twitter && (
                <a href={`https://twitter.com/${profile.twitter.replace("@", "")}`} target="_blank" rel="noreferrer" className="profile-link-chip">
                  𝕏 Twitter
                </a>
              )}
              {profile.linkedin && (
                <a href={`https://linkedin.com/in/${profile.linkedin}`} target="_blank" rel="noreferrer" className="profile-link-chip">
                  in LinkedIn
                </a>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Account" subtitle="Account settings and danger zone">
          <div className="account-actions">
            <div className="account-action-row">
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Export your data</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Download all your bookings as CSV</p>
              </div>
              <button
                className="secondary-button"
                onClick={() => toast.info("Export started — your CSV will download shortly.")}
              >
                Export
              </button>
            </div>
            <div className="account-action-row danger-row">
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: "var(--danger)" }}>Delete account</p>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>Permanently remove all data</p>
              </div>
              <button
                className="ghost-button"
                onClick={() => toast.error("Deletion requires confirmation — feature coming soon.")}
              >
                Delete
              </button>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
