import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import { useToast } from "../components/Toast";
import { useAuth } from "../components/AuthContext";
import { api } from "../services/api";
import { useNavigate } from "react-router-dom";

const AVATAR_COLORS = ["#d06132", "#0f766e", "#2563eb", "#7c3aed", "#ea580c", "#be123c", "#0891b2", "#16a34a"];

const emptyProfile = {
  name: "",
  username: "",
  bio: "",
  title: "",
  company: "",
  website: "",
  twitter: "",
  linkedin: "",
  avatar_color: "#d06132",
  welcome_message: "",
};

export default function ProfilePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user: authUser, login } = useAuth();
  const [profile, setProfile] = useState(emptyProfile);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);
  const [isOAuthUser, setIsOAuthUser] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const data = await api.getMe();
        setIsOAuthUser(!!data.oauth_provider);
        setProfile({
          name: data.name || "",
          username: data.booking_username || "",
          bio: data.bio || "",
          title: data.title || "",
          company: data.company || "",
          website: data.website || "",
          twitter: data.twitter || "",
          linkedin: data.linkedin || "",
          avatar_color: data.avatar_color || "#d06132",
          welcome_message: data.welcome_message || "",
        });
      } catch (err) {
        toast.error(err.message || "Could not load profile.");
      } finally {
        setLoadingProfile(false);
      }
    }
    loadProfile();
  }, [toast]);

  const initials = useMemo(() => {
    const value = profile.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return value || "S";
  }, [profile.name]);

  const bookingPath = profile.username ? `/book/${profile.username}` : "/book/";
  const bookingUrl = `${window.location.origin}${bookingPath}`;

  function updateField(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await api.updateProfile({
        name: profile.name,
        bio: profile.bio,
        title: profile.title,
        company: profile.company,
        website: profile.website,
        twitter: profile.twitter,
        linkedin: profile.linkedin,
        avatar_color: profile.avatar_color,
        welcome_message: profile.welcome_message,
        booking_username: profile.username,
      });
      setProfile((prev) => ({ ...prev, username: updated.booking_username || prev.username }));
      // Update the token's user display name if it changed
      if (authUser && updated.name !== authUser.name) {
        login(localStorage.getItem("shopper_token"), { ...authUser, name: updated.name });
      }
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  function validatePw() {
    const errs = {};
    if (!pwForm.current) errs.current = "Enter your current password.";
    if (!pwForm.next) errs.next = "Enter a new password.";
    else if (pwForm.next.length < 8) errs.next = "At least 8 characters.";
    if (pwForm.next !== pwForm.confirm) errs.confirm = "Passwords do not match.";
    return errs;
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    const errs = validatePw();
    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setSavingPw(true);
    try {
      await api.changePassword({ current_password: pwForm.current, new_password: pwForm.next });
      toast.success("Password changed.");
      setPwForm({ current: "", next: "", confirm: "" });
      setPwErrors({});
    } catch (err) {
      toast.error(err.message || "Could not change password.");
    } finally {
      setSavingPw(false);
    }
  }

  function copyBookingUrl() {
    if (!profile.username) {
      toast.error("Add a booking username before copying the public link.");
      return;
    }
    navigator.clipboard.writeText(bookingUrl);
    toast.success("Booking URL copied.");
  }

  if (loadingProfile) {
    return (
      <div className="stack">
        <div className="profile-hero-card" style={{ minHeight: 140 }} />
        <div className="section-card" style={{ minHeight: 320 }} />
      </div>
    );
  }

  return (
    <div className="profile-layout profile-layout-enhanced">
      <div className="stack">
        <section className="profile-hero-card">
          <div className="profile-hero-copy">
            <p className="eyebrow">Public profile</p>
            <h3>Make it easy for guests to trust your booking page.</h3>
            <p>Update your identity, short bio, and welcome message so the public booking page feels more personal and easier to understand.</p>
          </div>
          <button className="primary-button" onClick={copyBookingUrl}>
            Copy booking URL
          </button>
        </section>

        <SectionCard title="Profile details" subtitle="These fields shape your public presence.">
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="full-width avatar-section">
              <div className="avatar-preview" style={{ background: profile.avatar_color }}>{initials}</div>
              <div>
                <p className="eyebrow" style={{ marginBottom: 8 }}>Avatar color</p>
                <div className="avatar-color-grid">
                  {AVATAR_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`avatar-color-dot ${profile.avatar_color === color ? "selected" : ""}`}
                      style={{ background: color }}
                      onClick={() => updateField("avatar_color", color)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <label>
              Display name
              <input value={profile.name} onChange={(e) => updateField("name", e.target.value)} placeholder="Enter your display name" />
            </label>

            <label>
              Booking username
              <div className="url-input-wrap">
                <span className="url-prefix">/book/</span>
                <input
                  className="url-suffix-input"
                  value={profile.username}
                  onChange={(e) => updateField("username", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-"))}
                  placeholder="choose-a-public-url"
                />
              </div>
            </label>

            <label>
              Title
              <input value={profile.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Add your role or focus area" />
            </label>

            <label>
              Company
              <input value={profile.company} onChange={(e) => updateField("company", e.target.value)} placeholder="Add your company or team" />
            </label>

            <label className="full-width">
              Bio
              <textarea rows="3" value={profile.bio} onChange={(e) => updateField("bio", e.target.value)} placeholder="Write a short introduction so guests know what kind of meeting they are booking." />
            </label>

            <label className="full-width">
              Welcome message
              <textarea rows="3" value={profile.welcome_message} onChange={(e) => updateField("welcome_message", e.target.value)} placeholder="Add a short note that appears on the public booking page." />
            </label>

            <label>
              Website
              <input type="url" value={profile.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://your-site.com" />
            </label>

            <label>
              Twitter or X
              <input value={profile.twitter} onChange={(e) => updateField("twitter", e.target.value)} placeholder="@handle" />
            </label>

            <label className="full-width">
              LinkedIn
              <input value={profile.linkedin} onChange={(e) => updateField("linkedin", e.target.value)} placeholder="linkedin.com/in/your-name" />
            </label>

            <div className="button-row full-width">
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? <><span className="btn-spinner" />Saving...</> : "Save profile"}
              </button>
            </div>
          </form>
        </SectionCard>

        {!isOAuthUser && (
          <SectionCard title="Change password" subtitle="Update your login password.">
            <form className="form-grid" onSubmit={handlePasswordSubmit} noValidate>
              <label className="full-width">
                Current password
                <input
                  type="password"
                  value={pwForm.current}
                  onChange={(e) => { setPwForm((prev) => ({ ...prev, current: e.target.value })); setPwErrors((prev) => ({ ...prev, current: "" })); }}
                  autoComplete="current-password"
                  aria-invalid={pwErrors.current ? "true" : "false"}
                />
                {pwErrors.current && <p className="field-error">{pwErrors.current}</p>}
              </label>

              <label>
                New password
                <input
                  type="password"
                  value={pwForm.next}
                  onChange={(e) => { setPwForm((prev) => ({ ...prev, next: e.target.value })); setPwErrors((prev) => ({ ...prev, next: "" })); }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  aria-invalid={pwErrors.next ? "true" : "false"}
                />
                {pwErrors.next && <p className="field-error">{pwErrors.next}</p>}
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  value={pwForm.confirm}
                  onChange={(e) => { setPwForm((prev) => ({ ...prev, confirm: e.target.value })); setPwErrors((prev) => ({ ...prev, confirm: "" })); }}
                  autoComplete="new-password"
                  aria-invalid={pwErrors.confirm ? "true" : "false"}
                />
                {pwErrors.confirm && <p className="field-error">{pwErrors.confirm}</p>}
              </label>

              <div className="button-row full-width">
                <button type="submit" className="primary-button" disabled={savingPw}>
                  {savingPw ? <><span className="btn-spinner" />Updating...</> : "Change password"}
                </button>
              </div>
            </form>
          </SectionCard>
        )}
      </div>

      <div className="stack">
        <SectionCard title="Booking URL" subtitle="Share this link with guests.">
          <div className="booking-url-box">
            <code className="booking-url-text">{profile.username ? bookingUrl : "Choose a booking username to generate your public link."}</code>
            <button className="secondary-button" onClick={copyBookingUrl} disabled={!profile.username}>Copy</button>
          </div>
        </SectionCard>

        <SectionCard title="Connected accounts" subtitle="OAuth providers and external integrations.">
          <div className="connected-accounts-list">
            <div className="connected-account-row">
              <div className="connected-account-icon" style={{ background: isOAuthUser ? "#4285F4" : "var(--surface-muted)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-4.36 1.408-4.36 4.734 0 .361.032.716.095 1.055A8.003 8.003 0 0 0 8 16a5.502 5.502 0 0 0 5.278-3.958H8v-3.484z" />
                </svg>
              </div>
              <div className="connected-account-info">
                <strong>Google</strong>
                <span>{isOAuthUser ? `Connected as ${authUser?.email || ""}` : "Not connected"}</span>
              </div>
              <div>
                {isOAuthUser ? (
                  <span className="integrations-tag success">Active</span>
                ) : (
                  <a href={`${import.meta.env.VITE_API_URL || "https://shopper-backend-2n4n.onrender.com"}/api/auth/google`} className="secondary-button" style={{ textDecoration: "none", display: "inline-block", padding: "6px 14px", fontSize: 13 }}>
                    Connect
                  </a>
                )}
              </div>
            </div>

            <div className="connected-account-row" style={{ marginTop: "var(--space-3)" }}>
              <div className="connected-account-icon" style={{ background: "var(--accent)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <div className="connected-account-info">
                <strong>Integrations & webhooks</strong>
                <span>Manage Slack, Zoom, iCal, and more</span>
              </div>
              <div>
                <button type="button" className="secondary-button" style={{ fontSize: 13, padding: "6px 14px" }} onClick={() => navigate("/integrations")}>
                  Manage
                </button>
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Live preview" subtitle="How the public profile feels to a guest.">
          <div className="profile-preview-card profile-preview-card-rich">
            <div className="profile-preview-avatar" style={{ background: profile.avatar_color }}>{initials}</div>
            <h3 className="profile-preview-name">{profile.name || "Your display name"}</h3>
            <p className="profile-preview-title">
              {profile.title || "Your role"}
              {profile.company ? ` at ${profile.company}` : ""}
            </p>
            <p className="profile-preview-bio">{profile.bio || "Your short introduction will appear here so guests understand the purpose and tone of the booking page."}</p>
            <div className="profile-preview-welcome">{profile.welcome_message || "Your welcome message will appear here once you add it."}</div>
            <div className="profile-preview-links">
              {profile.website ? <a href={profile.website} target="_blank" rel="noreferrer" className="profile-link-chip">Website</a> : null}
              {profile.twitter ? <a href={`https://twitter.com/${profile.twitter.replace("@", "")}`} target="_blank" rel="noreferrer" className="profile-link-chip">Twitter</a> : null}
              {profile.linkedin ? <a href={`https://${profile.linkedin.replace(/^https?:\/\//, "")}`} target="_blank" rel="noreferrer" className="profile-link-chip">LinkedIn</a> : null}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
