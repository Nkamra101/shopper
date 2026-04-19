import { Link } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

const FEATURES = [
  {
    title: "Branded booking pages",
    desc: "Create public pages with your colors, descriptions, and custom meeting locations so every booking feels intentional.",
  },
  {
    title: "OTP-protected reservations",
    desc: "Guests verify their email before they reserve time, which keeps fake bookings and spam off your calendar.",
  },
  {
    title: "Manual booking portal",
    desc: "Add bookings for a person yourself from the dashboard when you take requests over phone, chat, or in person.",
  },
  {
    title: "Availability controls",
    desc: "Set your working hours, notice windows, buffers, and blocked dates once, then let Shopper handle the timing rules.",
  },
  {
    title: "Reschedule and cancel tools",
    desc: "Manage changes from one place with clear status tracking, meeting links, and fast follow-up actions.",
  },
  {
    title: "Clean analytics and workflow setup",
    desc: "See what gets booked most often and build a simple scheduling system your team can actually maintain.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Create an event type",
    desc: "Define the title, duration, slug, and location guests should see.",
  },
  {
    number: "02",
    title: "Set your schedule",
    desc: "Choose your availability, booking windows, and protected time blocks.",
  },
  {
    number: "03",
    title: "Share or add bookings",
    desc: "Let people book through the public page or add their booking yourself from the portal.",
  },
];

const STATS = [
  { value: "24/7", label: "Public booking access" },
  { value: "OTP", label: "Email verification flow" },
  { value: "1", label: "Unified booking portal" },
  { value: "< 5 min", label: "Setup time" },
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <nav className="landing-nav">
        <div className="landing-nav-inner">
          <Link to="/" className="landing-brand">
            <div className="landing-brand-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
              </svg>
            </div>
            <span className="landing-brand-name">Shopper</span>
          </Link>

          <div className="landing-nav-links">
            <a href="#features" className="landing-nav-link">Features</a>
            <a href="#how-it-works" className="landing-nav-link">How it works</a>
          </div>

          <div className="landing-nav-actions">
            <ThemeToggle />
            <Link to="/login" className="secondary-button landing-nav-button">
              Sign in
            </Link>
            <Link to="/login" className="primary-button landing-nav-button">
              Launch dashboard
            </Link>
          </div>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-bg" aria-hidden="true">
          <div className="landing-hero-orb landing-hero-orb-1" />
          <div className="landing-hero-orb landing-hero-orb-2" />
          <div className="landing-hero-orb landing-hero-orb-3" />
        </div>

        <div className="landing-hero-content">
          <div className="landing-hero-badge">
            <span className="landing-hero-badge-dot" />
            Scheduling for real teams, real guests, and real follow-through
          </div>

          <h1 className="landing-hero-title">
            One booking system
            <br />
            <span className="landing-hero-gradient">for you and your guests</span>
          </h1>

          <p className="landing-hero-sub">
            Shopper gives you a polished public booking page, OTP verification for guests,
            and an internal portal where you can add bookings for a person yourself.
          </p>

          <div className="landing-hero-cta">
            <Link to="/login" className="primary-button landing-hero-btn-primary">
              Start scheduling
            </Link>
            <a href="#features" className="secondary-button landing-hero-btn-secondary">
              Explore features
            </a>
          </div>

          <p className="landing-hero-note">
            Manual portal included. OTP verification included. Public booking pages included.
          </p>
        </div>

        <div className="landing-hero-mockup" aria-hidden="true">
          <div className="landing-mockup-card">
            <div className="landing-mockup-topbar">
              <div className="landing-mockup-dots">
                <span />
                <span />
                <span />
              </div>
              <div className="landing-mockup-url">shopper.app/book/booking-page</div>
            </div>

            <div className="landing-mockup-body">
              <div className="landing-mockup-avatar">S</div>
              <div className="landing-mockup-event-name">Scheduled meeting</div>
              <div className="landing-mockup-chips">
                <span>Video meeting</span>
                <span>OTP verified</span>
              </div>
              <div className="landing-mockup-calendar">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map((day, index) => (
                  <div key={day} className={`landing-mockup-day ${index === 2 ? "active" : ""}`}>
                    {day}
                  </div>
                ))}
              </div>
              <div className="landing-mockup-slots">
                {["9:00 AM", "10:30 AM", "1:00 PM", "4:00 PM"].map((time, index) => (
                  <div key={time} className={`landing-mockup-slot ${index === 1 ? "selected" : ""}`}>
                    {time}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-stats">
        <div className="landing-section-inner landing-stats-grid">
          {STATS.map((item) => (
            <div key={item.label} className="landing-stat">
              <div className="landing-stat-value">{item.value}</div>
              <div className="landing-stat-label">{item.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <p className="landing-eyebrow">Everything in one flow</p>
            <h2 className="landing-section-title">Built to feel complete from day one</h2>
            <p className="landing-section-sub">
              The public side and the admin side now work together: people can book you, and you can also book people.
            </p>
          </div>

          <div className="landing-features-grid">
            {FEATURES.map((feature, index) => (
              <article key={feature.title} className="landing-feature-card">
                <div className="landing-feature-index">0{index + 1}</div>
                <h3 className="landing-feature-title">{feature.title}</h3>
                <p className="landing-feature-desc">{feature.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt" id="how-it-works">
        <div className="landing-section-inner">
          <div className="landing-section-header">
            <p className="landing-eyebrow">How it works</p>
            <h2 className="landing-section-title">Get live quickly</h2>
          </div>

          <div className="landing-steps">
            {STEPS.map((step, index) => (
              <div key={step.number} className="landing-step">
                <div className="landing-step-number">{step.number}</div>
                {index < STEPS.length - 1 && <div className="landing-step-connector" aria-hidden="true" />}
                <div className="landing-step-content">
                  <h3 className="landing-step-title">{step.title}</h3>
                  <p className="landing-step-desc">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-cta-banner">
        <div className="landing-section-inner landing-cta-inner">
          <div className="landing-cta-orb" aria-hidden="true" />
          <h2 className="landing-cta-title">Ready to run bookings from one place?</h2>
          <p className="landing-cta-sub">
            Create event types, verify guests with OTP, and manage manual bookings without juggling multiple tools.
          </p>
          <Link to="/login" className="primary-button landing-cta-button">
            Open Shopper
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-section-inner landing-footer-inner">
          <div className="landing-footer-brand">
            <div className="landing-brand">
              <div className="landing-brand-icon landing-brand-icon-small">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                </svg>
              </div>
              <span className="landing-brand-name landing-brand-name-small">Shopper</span>
            </div>
            <p className="landing-footer-copy">
              Scheduling with OTP verification and a built-in manual booking portal.
            </p>
          </div>

          <div className="landing-footer-links">
            <Link to="/login">Sign in</Link>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
          </div>

          <p className="landing-footer-note">
            Copyright {new Date().getFullYear()} Shopper
          </p>
        </div>
      </footer>
    </div>
  );
}
