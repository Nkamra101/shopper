import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const FEATURES = [
  {
    icon: "📅",
    title: "Smart Event Types",
    desc: "Create unlimited booking pages with custom durations, locations, colors, and advanced scheduling rules like buffer times and notice periods.",
    color: "#6366f1",
  },
  {
    icon: "⚡",
    title: "Automated Workflows",
    desc: "Send confirmation emails, 24-hour reminders, and follow-ups automatically. Set it once and let Shopper handle the rest.",
    color: "#8b5cf6",
  },
  {
    icon: "📊",
    title: "Analytics & Insights",
    desc: "Track booking trends, peak hours, and your most popular event types with beautiful charts and heatmaps.",
    color: "#06b6d4",
  },
  {
    icon: "🔗",
    title: "Integrations",
    desc: "Connect Google Calendar, Zoom, and Google Meet. Embed your booking page on any website with a single line of code.",
    color: "#10b981",
  },
  {
    icon: "🛡️",
    title: "Spam-Free Booking",
    desc: "OTP-verified bookings mean every guest confirms their email before securing a slot — no bots, no fake reservations.",
    color: "#f59e0b",
  },
  {
    icon: "🌐",
    title: "Public Booking Pages",
    desc: "Share a clean, branded booking link anywhere — social media, email signature, website. Works beautifully on mobile.",
    color: "#ec4899",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Create an event type",
    desc: "Set your meeting name, duration, location, and advanced rules. Your shareable link is ready instantly.",
  },
  {
    n: "02",
    title: "Set your availability",
    desc: "Choose your working hours, time zone, and block out holidays. Shopper handles the calendar math for you.",
  },
  {
    n: "03",
    title: "Share & get booked",
    desc: "Share your link via email, add it to your bio, or embed it on your site. Guests book 24/7 with zero back-and-forth.",
  },
];

const STATS = [
  { value: "∞", label: "Event types" },
  { value: "24/7", label: "Booking availability" },
  { value: "< 2 min", label: "Setup time" },
  { value: "100%", label: "Free forever" },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* ── Navbar ─────────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="M8 14h.01M12 14h.01M16 14h.01" />
              </svg>
            </div>
            <span className="landing-brand-name">Shopper</span>
          </div>

          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
          </div>

          <div className="landing-nav-actions">
            <ThemeToggle />
            <Link to="/login" className="secondary-button" style={{ minHeight: 38, padding: "0 18px", fontSize: 13.5 }}>
              Sign in
            </Link>
            <Link to="/login" className="primary-button" style={{ minHeight: 38, padding: "0 20px", fontSize: 13.5 }}>
              Get started free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-bg" aria-hidden="true">
          <div className="landing-hero-orb landing-hero-orb-1" />
          <div className="landing-hero-orb landing-hero-orb-2" />
          <div className="landing-hero-orb landing-hero-orb-3" />
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span className="landing-hero-badge-dot" />
            Free scheduling tool — no credit card required
          </div>

          <h1 className="landing-hero-title">
            Scheduling that
            <br />
            <span className="landing-hero-gradient">works for you</span>
          </h1>

          <p className="landing-hero-sub">
            Shopper lets you share a single link for people to book time with you —
            no back-and-forth emails, no double bookings, no stress.
          </p>

          <div className="landing-hero-cta">
            <Link to="/login" className="primary-button landing-hero-btn-primary">
              Start scheduling free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
            <a href="#how-it-works" className="secondary-button landing-hero-btn-secondary">
              See how it works
            </a>
          </div>

          <p className="landing-hero-note">
            ✓ Free forever &nbsp;&nbsp; ✓ No credit card &nbsp;&nbsp; ✓ Up in 2 minutes
          </p>
        </div>

        {/* Hero mockup card */}
        <div className="landing-hero-mockup" aria-hidden="true">
          <div className="landing-mockup-card">
            <div className="landing-mockup-topbar">
              <div className="landing-mockup-dots">
                <span /><span /><span />
              </div>
              <div className="landing-mockup-url">shopper.app/book/your-name</div>
            </div>
            <div className="landing-mockup-body">
              <div className="landing-mockup-avatar">S</div>
              <div className="landing-mockup-event-name">30-min Intro Call</div>
              <div className="landing-mockup-chips">
                <span>📹 Video call</span>
                <span>30 min</span>
              </div>
              <div className="landing-mockup-calendar">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, i) => (
                  <div key={d} className={`landing-mockup-day ${i === 2 ? "active" : ""}`}>{d}</div>
                ))}
              </div>
              <div className="landing-mockup-slots">
                {["9:00 AM", "10:00 AM", "11:00 AM", "2:00 PM"].map((t, i) => (
                  <div key={t} className={`landing-mockup-slot ${i === 1 ? "selected" : ""}`}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats strip ────────────────────────────────── */}
      <section className="landing-stats">
        <div className="landing-section-inner landing-stats-grid">
          {STATS.map((s) => (
            <div key={s.label} className="landing-stat">
              <div className="landing-stat-value">{s.value}</div>
              <div className="landing-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────── */}
      <section className="landing-section" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <p className="landing-eyebrow">Everything you need</p>
            <h2 className="landing-section-title">Built for modern scheduling</h2>
            <p className="landing-section-sub">
              From one-on-one meetings to team scheduling, Shopper has every tool you need to manage your time.
            </p>
          </div>

          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon" style={{ background: `${f.color}18`, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="landing-feature-title">{f.title}</h3>
                <p className="landing-feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────── */}
      <section className="landing-section landing-section-alt" id="how-it-works">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <p className="landing-eyebrow">Simple process</p>
            <h2 className="landing-section-title">Up and running in minutes</h2>
          </div>

          <div className="landing-steps">
            {STEPS.map((s, i) => (
              <div key={s.n} className="landing-step">
                <div className="landing-step-number">{s.n}</div>
                {i < STEPS.length - 1 && <div className="landing-step-connector" aria-hidden="true" />}
                <div className="landing-step-content">
                  <h3 className="landing-step-title">{s.title}</h3>
                  <p className="landing-step-desc">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA banner ─────────────────────────────────── */}
      <section className="landing-cta-banner">
        <div className="landing-section-inner landing-cta-inner">
          <div className="landing-cta-orb" aria-hidden="true" />
          <h2 className="landing-cta-title">Ready to take back your calendar?</h2>
          <p className="landing-cta-sub">
            Join and start sharing your booking link today. Free, forever.
          </p>
          <Link to="/login" className="primary-button" style={{ minHeight: 52, padding: "0 32px", fontSize: 16, fontWeight: 700 }}>
            Create your free account
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────── */}
      <footer className="landing-footer">
        <div className="landing-section-inner landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-brand">
              <div className="landing-brand-icon" style={{ width: 28, height: 28 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                </svg>
              </div>
              <span className="landing-brand-name" style={{ fontSize: 15 }}>Shopper</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 8, maxWidth: 260, lineHeight: 1.6 }}>
              Smart scheduling for busy people. Share a link, get booked.
            </p>
          </div>

          <div className="landing-footer-links">
            <Link to="/login" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>Sign in</Link>
            <Link to="/login" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>Register</Link>
            <a href="#features" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>Features</a>
            <a href="#how-it-works" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none" }}>How it works</a>
          </div>

          <p style={{ fontSize: 12, color: "var(--text-subtle)", gridColumn: "1/-1", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 8 }}>
            © {new Date().getFullYear()} Shopper. Built with ❤️
          </p>
        </div>
      </footer>
    </div>
  );
}
