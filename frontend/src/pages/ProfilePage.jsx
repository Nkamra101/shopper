import { useEffect, useMemo, useState } from "react";
import SectionCard from "../components/SectionCard";
import Icon from "../components/Icon";
import { useAuth } from "../components/AuthContext";
import { useToast } from "../components/Toast";
import { api } from "../services/api";

const EMPTY = {
  name: "", email: "", bio: "", title: "", company: "",
  website: "", twitter: "", linkedin: "",
  avatar_color: "#111113", welcome_message: "", booking_username: "",
};

const COLORS = ["#111113", "#5c5c66", "#1d4ed8", "#6d28d9", "#be185d", "#c02626", "#c2410c", "#0f7a3d"];

function initialsOf(name, email) {
  if (name?.trim()) {
    return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  }
  return (email?.[0] || "?").toUpperCase();
}

export default function ProfilePage() {
  const toast = useToast();
  const { user: authUser, login } = useAuth();

  const [profile, setProfile] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOAuth, setIsOAuth] = useState(false);

  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [savingPassword, setSavingPassword] = useState(false);

  const [feedUrl, setFeedUrl] = useState("");
  const [feedBusy, setFeedBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.getMe();
        setProfile({ ...EMPTY, ...me, booking_username: me.booking_username || "" });
        setIsOAuth(Boolean(me.oauth_provider));
      } catch (error) {
        toast.error(error.message || "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  useEffect(() => {
    api.getCalendarFeed().then((feed) => setFeedUrl(feed.url)).catch(() => setFeedUrl(""));
  }, []);

  const bookingUrl = useMemo(
    () => (profile.booking_username ? `${window.location.origin}/book/${profile.booking_username}` : ""),
    [profile.booking_username]
  );

  async function saveProfile(event) {
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
        booking_username: profile.booking_username,
      });
      setProfile((current) => ({ ...current, ...updated }));
      // Keep the sidebar in sync with the new name.
      const token = localStorage.getItem("shopper_token");
      if (token) login(token, { ...authUser, ...updated });
      toast.success("Profile saved.");
    } catch (error) {
      toast.error(error.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (password.next.length < 8) { toast.error("New password must be at least 8 characters."); return; }
    if (password.next !== password.confirm) { toast.error("New passwords do not match."); return; }

    setSavingPassword(true);
    try {
      await api.changePassword({ current_password: password.current, new_password: password.next });
      setPassword({ current: "", next: "", confirm: "" });
      toast.success("Password updated.");
    } catch (error) {
      toast.error(error.message || "Could not change your password.");
    } finally {
      setSavingPassword(false);
    }
  }

  async function copy(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy.");
    }
  }

  async function rotateFeed() {
    if (!window.confirm("Generate a new calendar URL? Existing subscriptions stop updating.")) return;
    setFeedBusy(true);
    try {
      const feed = await api.rotateCalendarFeed();
      setFeedUrl(feed.url);
      toast.success("New URL generated — re-subscribe your calendar.");
    } catch (error) {
      toast.error(error.message || "Could not rotate the URL.");
    } finally {
      setFeedBusy(false);
    }
  }

  if (loading) return <p className="hint">Loading your profile…</p>;

  return (
    <div className="split">
      <div className="stack">
        <SectionCard title="Profile" subtitle="This is what guests see on your booking pages.">
          <form className="stack-4" onSubmit={saveProfile}>
            <div className="row" style={{ gap: "var(--s4)" }}>
              <span className="avatar avatar-lg" style={{ background: profile.avatar_color }}>
                {initialsOf(profile.name, profile.email)}
              </span>
              <div className="field" style={{ flex: 1 }}>
                <span className="field-label">Avatar colour</span>
                <div className="swatch-grid">
                  {COLORS.map((color) => (
                    <button key={color} type="button" className="swatch-btn" style={{ background: color }}
                            aria-pressed={profile.avatar_color === color} aria-label={`Use ${color}`}
                            onClick={() => setProfile({ ...profile, avatar_color: color })} />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="p-name">Name</label>
                <input id="p-name" className="input" value={profile.name}
                       onChange={(event) => setProfile({ ...profile, name: event.target.value })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="p-title">Job title <span className="opt">optional</span></label>
                <input id="p-title" className="input" value={profile.title} placeholder="Product designer"
                       onChange={(event) => setProfile({ ...profile, title: event.target.value })} />
              </div>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="p-user">Booking username</label>
              <div className="input-affix">
                <span className="affix affix-start">/book/</span>
                <input id="p-user" className="input input-mono" value={profile.booking_username} placeholder="priya"
                       onChange={(event) => setProfile({ ...profile, booking_username: event.target.value.toLowerCase() })} />
              </div>
              <span className="hint">Lowercase letters, numbers and hyphens.</span>
            </div>

            <div className="field">
              <label className="field-label" htmlFor="p-welcome">Welcome message <span className="opt">optional</span></label>
              <textarea id="p-welcome" className="textarea" rows="3" value={profile.welcome_message}
                        placeholder="Shown on your booking pages instead of the default explainer."
                        onChange={(event) => setProfile({ ...profile, welcome_message: event.target.value })} />
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="field-label" htmlFor="p-company">Company <span className="opt">optional</span></label>
                <input id="p-company" className="input" value={profile.company}
                       onChange={(event) => setProfile({ ...profile, company: event.target.value })} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="p-web">Website <span className="opt">optional</span></label>
                <input id="p-web" className="input" value={profile.website} placeholder="https://example.com"
                       onChange={(event) => setProfile({ ...profile, website: event.target.value })} />
              </div>
            </div>

            <div>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <><span className="spinner" /> Saving…</> : "Save profile"}
              </button>
            </div>
          </form>
        </SectionCard>

        {!isOAuth && (
          <SectionCard title="Password" subtitle="Change the password you sign in with.">
            <form className="stack-4" onSubmit={changePassword}>
              <div className="field">
                <label className="field-label" htmlFor="pw-current">Current password</label>
                <input id="pw-current" className="input" type="password" autoComplete="current-password"
                       value={password.current}
                       onChange={(event) => setPassword({ ...password, current: event.target.value })} />
              </div>
              <div className="grid-2">
                <div className="field">
                  <label className="field-label" htmlFor="pw-next">New password</label>
                  <input id="pw-next" className="input" type="password" autoComplete="new-password"
                         value={password.next}
                         onChange={(event) => setPassword({ ...password, next: event.target.value })} />
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="pw-confirm">Confirm</label>
                  <input id="pw-confirm" className="input" type="password" autoComplete="new-password"
                         value={password.confirm}
                         onChange={(event) => setPassword({ ...password, confirm: event.target.value })} />
                </div>
              </div>
              <div>
                <button type="submit" className="btn" disabled={savingPassword}>
                  {savingPassword ? <><span className="spinner" /> Updating…</> : "Update password"}
                </button>
              </div>
            </form>
          </SectionCard>
        )}
      </div>

      <div className="stack">
        <SectionCard title="Your booking link">
          {bookingUrl ? (
            <div className="mono-box">
              <code>{bookingUrl}</code>
              <button className="btn btn-sm" onClick={() => copy(bookingUrl, "Link")}>
                <Icon name="copy" size={12} /> Copy
              </button>
            </div>
          ) : (
            <p className="hint">Choose a booking username above to generate your personal link.</p>
          )}
        </SectionCard>

        <SectionCard title="Calendar subscription" subtitle="Your bookings, inside your own calendar.">
          <div className="stack-3">
            <div className="mono-box">
              <code>{feedUrl || "Loading…"}</code>
              <button className="btn btn-sm" disabled={!feedUrl} onClick={() => copy(feedUrl, "Calendar URL")}>
                <Icon name="copy" size={12} /> Copy
              </button>
            </div>
            <p className="hint">
              Treat this like a password — anyone with it can read your bookings.
            </p>
            <div>
              <button className="btn btn-sm btn-ghost btn-danger" onClick={rotateFeed} disabled={feedBusy || !feedUrl}>
                {feedBusy ? <span className="spinner" /> : <Icon name="refresh" size={13} />} Generate new URL
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Account">
          <dl className="dl">
            <div><dt>Email</dt><dd>{profile.email}</dd></div>
            <div><dt>Sign-in</dt><dd>{isOAuth ? "Google" : "Email and password"}</dd></div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
